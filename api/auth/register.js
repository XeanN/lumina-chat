import bcrypt from "bcryptjs";
import { sql } from "../../lib/db.js";
import { signSession, setSessionCookie } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Correo y contraseña (mínimo 8 caracteres) son requeridos" });
  }

  const existing = await sql`select id from users where email = ${email}`;
  if (existing.length > 0) {
    return res.status(409).json({ error: "Ya existe una cuenta con este correo" });
  }

  const hash = await bcrypt.hash(password, 10);
  const [user] = await sql`
    insert into users (email, password_hash) values (${email}, ${hash})
    returning id
  `;

  setSessionCookie(res, signSession(user.id));
  return res.status(201).json({ ok: true });
}
