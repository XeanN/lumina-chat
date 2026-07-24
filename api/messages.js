import { sql } from "../lib/db.js";
import { getUserIdFromRequest } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Necesitas iniciar sesión" });
  }

  const rows = await sql`
    select role, content, risk_level from messages
    where user_id = ${userId}
    order by created_at asc
  `;

  return res.status(200).json({ messages: rows });
}
