import React, { useState, useRef, useEffect } from "react";
import HelpBanner from "./HelpBanner";

export default function ChatWindow() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [riskLevel, setRiskLevel] = useState(1);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/messages");
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
        const maxRisk = data.messages.reduce((max, m) => Math.max(max, m.risk_level || 1), 1);
        setRiskLevel(maxRisk);
      } catch {
        // si falla la carga del historial, se arranca con el chat vacío
      }
    }
    loadHistory();
  }, []);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error desconocido");
      }

      // api/chat.js responde en NDJSON: una línea JSON por evento
      // ({type:"delta"} mientras el modelo escribe, {type:"final"} al
      // terminar con el risk_level ya definido). Se arma el texto de a
      // poco en vez de esperar la respuesta completa.
      let assistantIndex = -1;
      let finalRiskLevel = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.trim()) continue;

          const event = JSON.parse(line);

          if (event.type === "error") throw new Error(event.error);

          if (event.type === "delta" || event.type === "final") {
            setStreaming(true);
            setMessages((prev) => {
              if (assistantIndex === -1) {
                assistantIndex = prev.length;
                return [...prev, { role: "assistant", content: event.reply }];
              }
              const next = [...prev];
              next[assistantIndex] = { role: "assistant", content: event.reply };
              return next;
            });
          }

          if (event.type === "final") {
            finalRiskLevel = event.risk_level;
          }
        }
      }

      if (finalRiskLevel != null) {
        // el nivel de riesgo nunca baja solo dentro de la misma sesión
        setRiskLevel((prev) => Math.max(prev, finalRiskLevel));
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hubo un problema de conexión. Intenta de nuevo en un momento." },
      ]);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  return (
    <div className="chat-window">
      <p className="chat-disclaimer small muted">
        Lumina es una inteligencia artificial. No reemplaza atención
        profesional de salud mental. Si estás en riesgo inmediato, marca
        directamente el 106 (SAMU) o el 100 (violencia).
      </p>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="muted small">Escribe cuando quieras. No hay prisa.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && !streaming && (
          <div className="chat-bubble chat-bubble-assistant chat-typing">
            Lumina está escribiendo…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {riskLevel >= 2 && <HelpBanner critical={riskLevel === 3} />}

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe con calma..."
          disabled={loading}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
