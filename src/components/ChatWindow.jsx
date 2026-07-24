import React, { useState, useRef, useEffect } from "react";
import HelpBanner from "./HelpBanner";

export default function ChatWindow() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [riskLevel, setRiskLevel] = useState(1);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error desconocido");

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      // el nivel de riesgo nunca baja solo dentro de la misma sesión
      setRiskLevel((prev) => Math.max(prev, data.risk_level));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hubo un problema de conexión. Intenta de nuevo en un momento." },
      ]);
    } finally {
      setLoading(false);
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
        {loading && (
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
