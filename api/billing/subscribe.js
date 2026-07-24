import { sql } from "../../lib/db.js";
import { getUserIdFromRequest } from "../../lib/auth.js";
import { createCustomer, createCard, createSubscription, parseCulqiDate } from "../../lib/culqi.js";

const PLAN_IDS = {
  mensual: process.env.CULQI_PLAN_ID_MENSUAL,
  anual: process.env.CULQI_PLAN_ID_ANUAL,
};

export default async function handler(req, res) {
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
