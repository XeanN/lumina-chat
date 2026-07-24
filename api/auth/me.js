import { sql } from "../../lib/db.js";
import { getUserIdFromRequest } from "../../lib/auth.js";

export default async function handler(req, res) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(200).json({ user: null });

  const [user] = await sql`select id, email, plan from users where id = ${userId}`;
  return res.status(200).json({ user: user || null });
}
