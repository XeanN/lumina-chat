import { sql } from "../lib/db.js";
import { getUserIdFromRequest } from "../lib/auth.js";

const ONE_DAY_MS = 86400000;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const [user] = await sql`select plan from users where id = ${userId}`;
  if (user?.plan !== "premium") {
    return res.status(403).json({ error: "Esta función es parte del plan premium" });
  }

  const [{ total_messages }] = await sql`
    select count(*) as total_messages from messages
    where user_id = ${userId} and role = 'user'
  `;

  const dateRows = await sql`
    select distinct created_at::date as day from messages
    where user_id = ${userId}
    order by day desc
  `;

  const days = dateRows.map((r) => {
    const d = new Date(r.day);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Si hoy todavía no hay mensaje, la racha puede seguir contando desde ayer.
  let expected = days.length && days[0] === today.getTime() ? today.getTime() : today.getTime() - ONE_DAY_MS;

  let streak = 0;
  for (const day of days) {
    if (day === expected) {
      streak += 1;
      expected -= ONE_DAY_MS;
    } else {
      break;
    }
  }

  return res.status(200).json({
    totalMessages: Number(total_messages),
    daysActive: days.length,
    streak,
  });
}
