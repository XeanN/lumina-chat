# lumina-chat

Backend + frontend del chat conversacional de LÚMINA. Repo separado del
sitio de marketing (`lumina`) a propósito — ver razones en el historial
del proyecto si hace falta contexto.

## Reglas de Git — seguir siempre, sin excepción

- Rama principal: `master`. Nunca crear ni usar `main`.
- Después de cada commit, hacer `git push` de inmediato — no dejar
  commits solo en local esperando un push posterior.
- No agregar ningún metadato de coautoría o atribución de Claude/Claude
  Code en los mensajes de commit ni en pull requests (sin
  "Co-Authored-By: Claude", sin firmas automáticas). Los commits deben
  verse como si los hubiera escrito directamente el autor humano del
  repositorio.

## Contexto del proyecto

Este es el backend/frontend del agente conversacional de LÚMINA — una
plataforma de orientación y prevención en bienestar emocional (Perú).
El agente:

- Usa la API de Claude con un system prompt específico (documentado por
  separado, pedir al usuario si hace falta el archivo completo).
- Evalúa el riesgo de cada conversación en 3 niveles (normal / alerta /
  crítico) y devuelve un campo `risk_level` estructurado junto a la
  respuesta, que el frontend usa para decidir si mostrar el botón de
  ayuda urgente (Línea 100, Línea 113 opción 5, SAMU 106 — Perú).
- Nunca diagnostica, nunca decide acciones por la persona (el botón de
  ayuda siempre requiere que la persona lo presione), nunca da detalles
  de métodos de autolesión.
- Se despliega en Vercel, pensado para vivir en `chatlumina.aliiatech.com`.
- Debe mantener la misma identidad visual que `lumina.aliiatech.com`:
  fondo negro cálido, acento dorado, tipografía Fraunces (títulos) +
  Inter (cuerpo) — mismo sistema de diseño, proyecto técnico distinto.
