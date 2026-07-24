import React, { useState, useRef } from "react";

const PLANS = {
  mensual: { label: "Mensual", amount: 3000, priceLabel: "S/ 30.00", periodLabel: "al mes" },
  anual: { label: "Anual", amount: 30000, priceLabel: "S/ 300.00", periodLabel: "al año", badge: "2 meses gratis" },
};

export default function Premium({ onSubscribed, onClose }) {
  const [billingPeriod, setBillingPeriod] = useState("mensual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const billingPeriodRef = useRef(billingPeriod);
  billingPeriodRef.current = billingPeriod;

  async function subscribeWithToken(tokenId) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, billingPeriod: billingPeriodRef.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos procesar tu suscripción.");
        return;
      }
      onSubscribed?.();
    } catch {
      setError("Problema de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function openCheckout() {
    if (!window.Culqi) {
      setError("No pudimos cargar la pasarela de pago. Recarga la página e intenta de nuevo.");
      return;
    }
    setError("");

    // Callback global que exige CulqiJS v4 — Culqi.token trae el token de
    // la tarjeta ya tokenizada, listo para mandarlo al backend.
    window.culqi = function () {
      if (window.Culqi.token) {
        subscribeWithToken(window.Culqi.token.id);
      } else {
        setError(window.Culqi.error?.user_message || "No pudimos procesar tu tarjeta.");
      }
    };

    const plan = PLANS[billingPeriod];
    window.Culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY;
    window.Culqi.settings({
      title: "LÚMINA Premium",
      currency: "PEN",
      description: `Plan ${plan.label.toLowerCase()}`,
      amount: plan.amount,
    });
    window.Culqi.open();
  }

  return (
    <div className="premium-page">
      <div className="premium-card">
        {onClose && (
          <button className="link premium-close" type="button" onClick={onClose}>
            Volver al chat
          </button>
        )}

        <h1 className="h2">Lumina Premium</h1>
        <p className="muted small" style={{ marginBottom: 20 }}>
          El texto ilimitado ya lo tienes gratis. Premium suma:
        </p>
        <ul className="list" style={{ marginBottom: 24 }}>
          <li>Mensajes de audio (grabas, Lumina transcribe y responde)</li>
          <li>Contacto directo con un psicólogo colegiado por WhatsApp</li>
          <li>Historial de conversaciones guardado, con estadísticas</li>
        </ul>

        <div className="premium-plans">
          {Object.entries(PLANS).map(([key, plan]) => (
            <button
              key={key}
              type="button"
              className={`premium-plan-option${billingPeriod === key ? " premium-plan-option-active" : ""}`}
              onClick={() => setBillingPeriod(key)}
            >
              <div className="premium-plan-label">{plan.label}</div>
              <div className="premium-plan-price">
                {plan.priceLabel} <span className="muted small">{plan.periodLabel}</span>
              </div>
              {plan.badge && <div className="badge">{plan.badge}</div>}
            </button>
          ))}
        </div>

        {error && (
          <p className="small" style={{ color: "var(--accent-strong)", marginTop: 12 }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 20, width: "100%" }}
          onClick={openCheckout}
          disabled={loading}
        >
          {loading ? "Procesando..." : "Suscribirme"}
        </button>
      </div>
    </div>
  );
}
