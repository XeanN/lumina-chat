import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleCredential(credential) {
    setError("");
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (res.ok) onAuthenticated();
    else setError("No pudimos iniciar sesión con Google");
  }

  useEffect(() => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => handleGoogleCredential(response.credential),
    });
    window.google.accounts.id.renderButton(
      document.getElementById("google-signin-button"),
      { theme: "filled_black", size: "large", text: "continue_with" }
    );
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      if (mode === "forgot") {
        await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setNotice("Si el correo existe, te enviamos un enlace para recuperar tu contraseña.");
        return;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Algo salió mal");
        return;
      }

      onAuthenticated();
    } catch {
      setError("Problema de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-name">LÚMINA</span>
        </div>

        <h1 className="h2" style={{ textAlign: "center", marginBottom: 6 }}>
          {mode === "register" ? "Crea tu cuenta" : mode === "forgot" ? "Recupera tu contraseña" : "Inicia sesión"}
        </h1>
        <p className="muted small" style={{ textAlign: "center", marginBottom: 20 }}>
          Es gratis. Solo lo pedimos para cuidar la conversación como algo tuyo, no de cualquiera.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            Correo
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          {mode !== "forgot" && (
            <label className="label">
              Contraseña
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {error && <p className="small" style={{ color: "var(--accent-strong)" }}>{error}</p>}
          {notice && <p className="small muted">{notice}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {mode === "register" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : "Entrar"}
          </button>
        </form>

        <div id="google-signin-button" style={{ marginTop: 14, display: "flex", justifyContent: "center" }} />

        <div className="auth-links" style={{ marginTop: 18, textAlign: "center" }}>
          {mode === "login" && (
            <>
              <button className="link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setMode("forgot")}>
                Olvidé mi contraseña
              </button>
              <p className="small muted" style={{ marginTop: 10 }}>
                ¿No tienes cuenta?{" "}
                <button className="link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setMode("register")}>
                  Regístrate
                </button>
              </p>
            </>
          )}
          {mode !== "login" && (
            <button className="link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setMode("login")}>
              Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
