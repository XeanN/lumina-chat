import { OAuth2Client } from "google-auth-library";
import { sql } from "../../lib/db.js";
import { signSession, setSessionCookie } from "../../lib/auth.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { credential } = req.body || {}; // el id_token que entrega el botón de Google

  let payload;
  try {
    const ticket = await client.verifyIdToken({
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
