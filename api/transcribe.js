import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";
import { getUserIdFromRequest } from "../lib/auth.js";
import { sql } from "../lib/db.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = {
  api: {
    bodyParser: false, // necesitamos el stream crudo del audio (multipart/form-data), no JSON
  },
};

async function parseAudioFromRequest(req) {
  const form = formidable({});
  const [, files] = await form.parse(req);
  const file = files.audio?.[0];
  if (!file) throw new Error("No se recibió ningún archivo de audio");
  return file;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Necesitas iniciar sesión" });

  const [user] = await sql`select plan from users where id = ${userId}`;
  if (!user || user.plan !== "premium") {
    return res.status(403).json({ error: "Los mensajes de audio son parte del plan premium" });
  }

  try {
    const audioFile = await parseAudioFromRequest(req);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: "whisper-1",
      language: "es",
    });

    return res.status(200).json({ text: transcription.text });
  } catch (err) {
    console.error("Error de transcripción:", err);
    return res.status(500).json({ error: "No pudimos transcribir el audio. Intenta de nuevo o escribe el mensaje." });
  }
}
