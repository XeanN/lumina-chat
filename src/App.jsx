import React, { useState, useEffect } from "react";
import ChatWindow from "./components/ChatWindow";
import Auth from "./pages/Auth";
import Premium from "./pages/Premium";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState(null);
  const [view, setView] = useState("chat");

  async function checkSession() {
    setError(null);
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setUser(data.user);
    } catch {
      setError("No se pudo conectar con el servidor. Verifica que estés corriendo `vercel dev` y no `npm run dev`.");
      setUser(null);
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  if (user === undefined && !error) {
    return <p className="muted" style={{ padding: 40, textAlign: "center" }}>Cargando…</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p className="muted">{error}</p>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={checkSession}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!user) return <Auth onAuthenticated={checkSession} />;

  if (view === "premium") {
    return (
      <Premium
        onSubscribed={async () => {
          await checkSession();
          setView("chat");
        }}
        onClose={() => setView("chat")}
      />
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <span className="brand-dot" aria-hidden="true" />
        <span className="brand-name">LÚMINA</span>
      </header>
      <ChatWindow plan={user.plan} onOpenPremium={() => setView("premium")} />
    </div>
  );
}
