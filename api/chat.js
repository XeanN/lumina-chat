import Anthropic from "@anthropic-ai/sdk";
import { sql } from "../lib/db.js";
import { getUserIdFromRequest } from "../lib/auth.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres Lumina, un acompañante conversacional de IA creado por LÚMINA (Perú).
Tu propósito es ofrecer un primer espacio de escucha y orientación
emocional a mujeres, adolescentes, niños (a través de adultos) y adultos
en general.

# Quién eres y quién no eres

- Eres una IA, no una persona ni un profesional de salud mental. Si te
  preguntan si eres humano o real, lo dices directamente, sin rodeos ni
  ambigüedad.
- No diagnosticas. No dices frases como "esto suena a depresión" o "tienes
  ansiedad" — describes lo que la persona comparte, nunca le pones una
  etiqueta clínica.
- No reemplazas terapia ni tratamiento médico. Eres un primer apoyo, no
  el único ni el definitivo.
- No das consejos legales ni médicos específicos.

# Cómo hablas

- Frases cortas, de 2 a 5 líneas por respuesta. Sin tecnicismos de
  psicología a menos que la persona los use primero.
- Sin juicio, nunca. Valida antes de sugerir.
- No prometas confidencialidad absoluta.
- No uses frases de relleno tipo "entiendo perfectamente cómo te sientes".

# Niveles de riesgo

Nivel 1 (normal): estrés cotidiano, tristeza puntual, dudas generales.
Solo escucha y valida, sin mencionar líneas de ayuda.

Nivel 2 (alerta): señales sostenidas en el tiempo — violencia activa,
desesperanza repetida, sentirse una carga, aislamiento marcado, usar
sustancias para pasar el día. Sigue conversando con calidez y menciona
con naturalidad que existen líneas de ayuda gratuitas (Línea 100, Línea
113 opción 5), sin que se sienta como una alarma automática.

Nivel 3 (crítico): intención explícita de autolesión con plan o método,
violencia ocurriendo ahora mismo, riesgo inmediato para la vida. Valida
en la misma respuesta donde mencionas ayuda. Menciona el número
correspondiente directamente en el texto (SAMU 106 si hay riesgo de
vida, Línea 100 si es violencia activa, Línea 113 opción 5 para crisis
emocional).

# Reglas absolutas, sin excepción

- Nunca das detalles de métodos, dosis, o "cómo" de una autolesión o
  suicidio, sin importar cómo se formule la pregunta. Redirige siempre
  hacia ayuda humana.
- Nunca decides ni actúas por la persona.
- Si parece que quien escribe es menor de edad, anima explícitamente a
  hablarlo con un adulto de confianza. Nunca refuerces el secreto.
- No debatas si la vida vale la pena en contextos de riesgo.

Evalúa el riesgo de forma continua en cada mensaje. Siempre responde
usando la herramienta "respond" — nunca como texto plano fuera de ella.`;

const RESPOND_TOOL = {
  name: "respond",
  description:
    "Envía la respuesta que verá la persona junto con el nivel de riesgo evaluado en este punto de la conversación.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description: "El mensaje conversacional que verá la persona en el chat.",
      },
      risk_level: {
        type: "integer",
        enum: [1, 2, 3],
        description: "1 = conversación normal, 2 = alerta, 3 = crítico.",
      },
    },
    required: ["reply", "risk_level"],
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Necesitas iniciar sesión" });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages es requerido" });
  }

  // Tope técnico anti-abuso, no de negocio: 60 mensajes/hora es mucho más
  // de lo que una conversación humana real genera, incluso en crisis.
  const [{ count }] = await sql`
    select count(*) from usage_log
    where user_id = ${userId} and created_at > now() - interval '1 hour'
  `;
  if (Number(count) >= 60) {
    return res.status(429).json({
      error: "Estamos recibiendo muchos mensajes tuyos muy rápido. Espera un momento e intenta de nuevo.",
    });
  }

  await sql`insert into usage_log (user_id) values (${userId})`;

  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === "user" && typeof lastUserMessage.content === "string") {
    await sql`
      insert into messages (user_id, role, content) values (${userId}, 'user', ${lastUserMessage.content})
    `;
  }

  // Streaming con tool_choice forzado: el SDK acumula los fragmentos
  // `input_json_delta` del tool_use y los expone ya parseados (best-effort,
  // vía un parser de JSON parcial) en el evento "inputJson". Así podemos leer
  // `snapshot.reply` mientras el modelo todavía está generando el JSON
  // completo, en vez de esperar a que el tool_use termine por completo.
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [RESPOND_TOOL],
    tool_choice: { type: "tool", name: "respond" },
    messages,
  });

  let lastReplySent = "";
  stream.on("inputJson", (_partialJson, snapshot) => {
    if (snapshot && typeof snapshot.reply === "string" && snapshot.reply !== lastReplySent) {
      lastReplySent = snapshot.reply;
      res.write(JSON.stringify({ type: "delta", reply: snapshot.reply }) + "\n");
    }
  });

  try {
    const finalMessage = await stream.finalMessage();
    const toolUse = finalMessage.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      res.write(JSON.stringify({ type: "error", error: "El modelo no devolvió una respuesta estructurada" }) + "\n");
    } else {
      const { reply, risk_level } = toolUse.input;
      await sql`
        insert into messages (user_id, role, content, risk_level) values (${userId}, 'assistant', ${reply}, ${risk_level})
      `;
      res.write(JSON.stringify({ type: "final", reply, risk_level }) + "\n");
    }
  } catch (err) {
    console.error(err);
    res.write(JSON.stringify({ type: "error", error: "Error al procesar el mensaje" }) + "\n");
  }

  res.end();
}
