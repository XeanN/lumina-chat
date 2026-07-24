import React from "react";

const LINES = [
  { name: "Línea 100", desc: "Violencia familiar y sexual", contact: "Marca 100" },
  { name: "Línea 113, opción 5", desc: "Salud mental", contact: "Marca 113 y elige la opción 5" },
  { name: "SAMU", desc: "Emergencia médica", contact: "Marca 106" },
];

export default function HelpBanner({ critical }) {
  return (
    <div className={`help-banner${critical ? " help-banner-critical" : ""}`}>
      <p className="small" style={{ marginBottom: 8 }}>
        {critical
          ? "Esto que compartes es serio. Por favor considera contactar ahora a una de estas líneas:"
          : "¿Quieres que te conecte con ayuda real? Estas líneas son gratuitas y confidenciales:"}
      </p>
      <div className="help-lines">
        {LINES.map((l) => (
          <div key={l.name} className="help-line">
            <strong>{l.name}</strong> — {l.desc} · {l.contact}
          </div>
        ))}
      </div>
    </div>
  );
}
