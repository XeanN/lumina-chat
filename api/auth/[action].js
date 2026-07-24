import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";
import { sql } from "../../lib/db.js";
import { signSession, setSessionCookie, clearSessionCookie, getUserIdFromRequest } from "../../lib/auth.js";

// Vercel Hobby limita a 12 funciones serverless por deployment — los 7
// endpoints de auth se consolidan en un solo archivo con ruta dinámica
// ([action].js) para no tocar ninguna URL que ya usa el frontend
// (/api/auth/login, /api/auth/register, etc. siguen igual).

const resend = new Resend(process.env.RESEND_API_KEY);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function register(req, res) {
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

async function login(req, res) {
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

async function logout(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

async function me(req, res) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(200).json({ user: null });

  const [user] = await sql`select id, email, plan from users where id = ${userId}`;
  return res.status(200).json({ user: user || null });
}

async function forgotPassword(req, res) {
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

    const { error: sendError } = await resend.emails.send({
      from: "Lumina <no-responder@aliiatech.com>",
      to: email,
      subject: "Recupera tu contraseña de Lumina",
      html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
             <p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p>
             <p>Este enlace vence en 30 minutos. Si no fuiste tú, ignora este correo.</p>`,
    });

    if (sendError) console.error("Resend error en forgot-password:", sendError);
  }

  return res.status(200).json({ ok: true });
}

async function resetPassword(req, res) {
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

async function google(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { credential } = req.body || {};

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Token de Google inválido" });
  }

  const { sub: googleId, email } = payload;

  let [user] = await sql`select id from users where google_id = ${googleId} or email = ${email}`;

  if (!user) {
    [user] = await sql`
      insert into users (email, google_id) values (${email}, ${googleId})
      returning id
    `;
  } else {
    await sql`update users set google_id = ${googleId} where id = ${user.id}`;
  }

  setSessionCookie(res, signSession(user.id));
  return res.status(200).json({ ok: true });
}

const ACTIONS = {
  register,
  login,
  logout,
  me,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
  google,
};

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(404).json({ error: "No encontrado" });
  return fn(req, res);
}
