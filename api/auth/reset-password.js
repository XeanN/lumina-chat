import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, password } = req.body || {};
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: "Token y contraseña (mínimo 8 caracteres) son requeridos" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [reset] = await sql`
    select id, user_id, expires_at, used from password_resets
    where token_hash = ${tokenHash}
  `;

  if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
    return res.status(400).json({ error: "El enlace es inválido o ya venció. Solicita uno nuevo." });
  }

  const hash = await bcrypt.hash(password, 10);
  await sql`update users set password_hash = ${hash} where id = ${reset.user_id}`;
  await sql`update password_resets set used = true where id = ${reset.id}`;

  return res.status(200).json({ ok: true });
}
