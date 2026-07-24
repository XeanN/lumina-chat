import { sql } from "../../lib/db.js";
import { getSubscription, parseCulqiDate } from "../../lib/culqi.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Nunca confiamos en el contenido del payload del webhook tal cual llega:
  // se usa solo para saber "algo pasó con este id" y se vuelve a pedir el
  // objeto real a la API de Culqi (autenticada con nuestra propia llave
  // secreta) antes de tocar la base de datos. La forma exacta del payload
  // de Culqi no se pudo confirmar en vivo — el producto de Suscripciones
  // no está activo en la cuenta todavía (ver nota en lib/culqi.js) — por
  // eso se prueban varias formas posibles de encontrar el id.
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
