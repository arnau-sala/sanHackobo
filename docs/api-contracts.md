# API contracts (hackathon)

Base URL local: `http://127.0.0.1:3001` (API) o vía proxy Vite: `http://127.0.0.1:5173/api/...`.

## Health

- `GET /health` → `{ ok: true, service: "copilot-api" }`

## Demo data

- `GET /api/demo-scenario` → JSON con `inputData`, `routePlan`, `loadPlan`, etc. (mock copilot).

## Route optimization

- `POST /api/optimize-route`  
  Body: `InputPayload` definido en `@damm/optimizer-route` (`depot`, `vehicle`, `driver`, `stops`, `orders`, …).  
  Response: `{ routePlan, meta: { elapsedMs, algorithm, stopsCount } }`.

## Copilot (texto)

- `POST /api/copilot`  
  Body: `CopilotQuestionInput` (`currentStopId`, `question`, `routePlan`, `loadPlan`, `inputData`).

## Copilot + voz (ElevenLabs)

- `POST /api/voice/query` — texto + TTS.
- `POST /api/voice/handsfree` — audio base64 → STT → copilot → TTS.

Variables: ver `.env.example` en la raíz del repo.

## Tipos compartidos

Import recomendado para front u otros servicios: paquete `@damm/contracts` (solo re-exporta tipos).
