import crypto from "crypto";
import { Resend } from "resend";
import { sql } from "../../lib/db.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  const [user] = await sql`select id from users where email = ${email}`;

  // Responde igual exista o no la cuenta — no reveles si un correo está registrado.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

    await sql`
      insert into password_resets (user_id, token_hash, expires_at)
      values (${user.id}, ${tokenHash}, ${expiresAt})
    `;

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;

    await resend.emails.send({
      from: "Lumina <no-responder@aliiatech.com>",
      to: email,
      subject: "Recupera tu contraseña de Lumina",
      html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
             <p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p>
             <p>Este enlace vence en 30 minutos. Si no fuiste tú, ignora este correo.</p>`,
    });
  }

  return res.status(200).json({ ok: true });
}
