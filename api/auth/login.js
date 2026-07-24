import bcrypt from "bcryptjs";
import { sql } from "../../lib/db.js";
import { signSession, setSessionCookie } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body || {};
  const [user] = await sql`select id, password_hash from users where email = ${email}`;

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }

  setSessionCookie(res, signSession(user.id));
  return res.status(200).json({ ok: true });
}
