import { sql } from "../../lib/db.js";
import { getUserIdFromRequest } from "../../lib/auth.js";

export default async function handler(req, res) {
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
