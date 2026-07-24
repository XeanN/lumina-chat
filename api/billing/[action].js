import { sql } from "../../lib/db.js";
import { getUserIdFromRequest } from "../../lib/auth.js";
import { createCustomer, createCard, createSubscription, getSubscription, parseCulqiDate } from "../../lib/culqi.js";

// Consolidado por el límite de 12 funciones serverless del plan Hobby de
// Vercel — ver nota igual en api/auth/[action].js.

const PLAN_IDS = {
  mensual: process.env.CULQI_PLAN_ID_MENSUAL,
  anual: process.env.CULQI_PLAN_ID_ANUAL,
};

async function subscribe(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const { tokenId, billingPeriod } = req.body || {};
  const planId = PLAN_IDS[billingPeriod];
  if (!tokenId || !planId) {
    return res.status(400).json({ error: "Datos de suscripción incompletos" });
  }

  const [user] = await sql`select email from users where id = ${userId}`;
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  try {
    const customer = await createCustomer({ email: user.email });
    const card = await createCard({ customerId: customer.id, tokenId });
    const subscription = await createSubscription({ cardId: card.id, planId });

    const currentPeriodEnd = parseCulqiDate(subscription.current_period_end);

    await sql`
      insert into subscriptions
        (user_id, culqi_subscription_id, culqi_customer_id, culqi_card_id, status, plan, current_period_end)
      values
        (${userId}, ${subscription.id}, ${customer.id}, ${card.id}, ${subscription.status || "active"}, ${billingPeriod}, ${currentPeriodEnd})
    `;

    await sql`update users set plan = 'premium' where id = ${userId}`;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error creando suscripción Culqi:", err);
    return res.status(500).json({ error: "No pudimos procesar el pago. Verifica los datos de tu tarjeta e intenta de nuevo." });
  }
}

async function webhook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  console.log("Culqi webhook recibido:", JSON.stringify(req.body));

  const body = req.body || {};
  const subscriptionId = body.data?.id || body.id || body.object_id;

  if (!subscriptionId || !subscriptionId.startsWith("sxn_")) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    const subscription = await getSubscription(subscriptionId);
    const isActive = subscription.status === "active";

    const [existing] = await sql`
      select user_id from subscriptions where culqi_subscription_id = ${subscriptionId}
    `;

    if (!existing) {
      console.error("Webhook de Culqi para una suscripción que no tenemos registrada:", subscriptionId);
      return res.status(200).json({ ok: true, ignored: true });
    }

    await sql`
      update subscriptions
      set status = ${subscription.status}, current_period_end = ${parseCulqiDate(subscription.current_period_end)}
      where culqi_subscription_id = ${subscriptionId}
    `;

    await sql`update users set plan = ${isActive ? "premium" : "free"} where id = ${existing.user_id}`;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error procesando webhook de Culqi:", err);
    return res.status(200).json({ ok: false });
  }
}

async function status(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const [user] = await sql`select plan from users where id = ${userId}`;
  const [subscription] = await sql`
    select plan, status, current_period_end from subscriptions
    where user_id = ${userId}
    order by created_at desc
    limit 1
  `;

  return res.status(200).json({ plan: user?.plan || "free", subscription: subscription || null });
}

const ACTIONS = { subscribe, webhook, status };

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(404).json({ error: "No encontrado" });
  return fn(req, res);
}
