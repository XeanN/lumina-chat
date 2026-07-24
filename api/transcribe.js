import { sql } from "../lib/db.js";
import { getUserIdFromRequest } from "../lib/auth.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const [user] = await sql`select plan from users where id = ${userId}`;
  if (user?.plan !== "premium") {
    return res.status(403).json({ error: "Los mensajes de audio son parte del plan premium" });
  }

  const { audio, mimeType } = req.body || {};
  if (!audio) return res.status(400).json({ error: "audio es requerido" });

  try {
    const base64Data = audio.includes(",") ? audio.split(",")[1] : audio;
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType || "audio/webm" });

    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model", "whisper-1");
    form.append("language", "es");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Error de OpenAI transcribiendo audio:", data);
      return res.status(500).json({ error: "No pudimos transcribir el audio. Intenta de nuevo." });
    }

    return res.status(200).json({ text: data.text });
  } catch (err) {
    console.error("Error procesando audio:", err);
    return res.status(500).json({ error: "No pudimos procesar el audio." });
  }
}
