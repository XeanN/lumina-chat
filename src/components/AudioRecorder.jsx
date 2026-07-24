import React, { useState, useRef } from "react";
import { Mic, Square } from "lucide-react";

export default function AudioRecorder({ onConfirmedText, disabled }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [draftText, setDraftText] = useState(null); // null = no hay borrador todavía
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        handleRecordingStop();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("No pudimos acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleRecordingStop() {
    setTranscribing(true);
    setError("");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", blob, "audio.webm");

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No pudimos transcribir el audio.");
        return;
      }
      setDraftText(data.text);
    } catch {
      setError("Problema de conexión al transcribir.");
    } finally {
      setTranscribing(false);
    }
  }

  function confirm() {
    onConfirmedText(draftText);
    setDraftText(null);
  }

  function discard() {
    setDraftText(null);
  }

  // Paso de validación: el texto transcrito alimenta el risk_level, así
  // que un error de transcripción en un momento crítico podría cambiar
  // cómo se interpreta el riesgo — la persona revisa y corrige antes de
  // que eso pase, nunca se manda directo.
  if (draftText !== null) {
    return (
      <div className="audio-review">
        <p className="small muted" style={{ marginBottom: 6 }}>
          Esto entendimos de tu audio — revísalo antes de enviarlo:
        </p>
        <textarea
          className="textarea"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={3}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={confirm}>Enviar</button>
          <button className="btn btn-ghost" onClick={discard}>Descartar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled || transcribing}
        aria-label={recording ? "Detener grabación" : "Grabar audio"}
      >
        {transcribing ? "Transcribiendo…" : recording ? <Square size={18} /> : <Mic size={18} />}
      </button>
      {error && <p className="small" style={{ color: "var(--accent-strong)" }}>{error}</p>}
    </div>
  );
}
