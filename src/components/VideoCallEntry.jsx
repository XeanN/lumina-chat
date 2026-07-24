import React, { useState } from "react";

export default function VideoCallEntry({ plan, onUpgrade }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (plan !== "premium") {
    return (
      <div className="help-banner">
        <p className="small">
          Contacto con un psicólogo por WhatsApp — disponible en el{" "}
          <button className="link" type="button" onClick={onUpgrade}>
            plan premium
          </button>
          .
        </p>
      </div>
    );
  }

  async function confirmAndConnect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/professionals/assign", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos conectar en este momento.");
        return;
      }
      window.open(data.link, "_blank");
    } catch {
      setError("Problema de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="help-banner">
        <p className="small" style={{ marginBottom: 10 }}>
          Vamos a conectarte con un psicólogo colegiado por WhatsApp — vas
          a compartir tu número con él/ella para la conversación.
          ¿Aceptas continuar?
        </p>
        {error && (
          <p className="small" style={{ color: "var(--accent-strong)", marginBottom: 8 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={confirmAndConnect} disabled={loading}>
            {loading ? "Conectando..." : "Sí, conectar"}
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
      Hablar con un psicólogo por WhatsApp
    </button>
  );
}
