import { sql } from "../../lib/db.js";
import { getUserIdFromRequest } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const [user] = await sql`select plan from users where id = ${userId}`;
  if (!user || user.plan !== "premium") {
    return res.status(403).json({ error: "Esta función es parte del plan premium" });
  }

  const [pro] = await sql`
    select id, name, whatsapp_number from professionals
    where status = 'approved' and available = true
    order by random()
    limit 1
  `;

  if (!pro) {
    return res.status(503).json({
      error: "No hay psicólogos disponibles en este momento. Si es urgente, revisa Ayuda urgente en el sitio principal.",
    });
  }

  const message = encodeURIComponent("Hola, vengo de LÚMINA y me gustaría conversar.");
  const cleanNumber = pro.whatsapp_number.replace(/[^0-9]/g, "");
  const link = `https://wa.me/${cleanNumber}?text=${message}`;

  return res.status(200).json({ name: pro.name, link });
}
