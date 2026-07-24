import React, { useState, useEffect } from "react";
import ChatWindow from "./components/ChatWindow";
import Auth from "./pages/Auth";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = no logueado

  async function checkSession() {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user);
  }

  useEffect(() => {
    checkSession();
  }, []);

  if (user === undefined) return null; // o un spinner simple

  if (!user) return <Auth onAuthenticated={checkSession} />;

  return (
    <div className="chat-page">
      <header className="chat-header">
        <span className="brand-dot" aria-hidden="true" />
        <span className="brand-name">LÚMINA</span>
      </header>
      <ChatWindow />
    </div>
  );
}
