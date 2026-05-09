# API Copilot

Servidor HTTP simple con endpoints de demo para el hackathon.

## Endpoints

- `GET /health`
- `GET /api/demo-scenario`
- `GET /handsfree` (demo navegador: escucha continua + respuesta de voz)
- `POST /api/copilot`
- `POST /api/optimize-route` (body `InputPayload` del optimizador → `routePlan` + `meta`)
- `POST /api/voice/query` (respuesta + audio TTS ElevenLabs)
- `POST /api/voice/handsfree` (audio -> STT -> copilot -> TTS)

## Variables de entorno (ElevenLabs)

- `ELEVENLABS_API_KEY` (obligatoria para TTS)
- `ELEVENLABS_VOICE_ID` (opcional)
- `ELEVENLABS_MODEL_ID` (opcional)
- `ELEVENLABS_STT_MODEL_ID` (opcional, por defecto `scribe_v1`)

## Configurar `.env` real

1. Abre el archivo `.env` en la raiz del repo.
2. Sustituye `ELEVENLABS_API_KEY` por tu clave real de ElevenLabs.
3. Opcional: cambia `ELEVENLABS_VOICE_ID` por la voz que quieras.
4. Arranca la API y prueba `POST /api/voice/handsfree`.

## Ejemplo `POST /api/copilot`

Body:

```json
{
  "currentStopId": "stop_004",
  "question": "Donde esta lo de este cliente?",
  "routePlan": {},
  "loadPlan": {},
  "inputData": {}
}
```

## Ejemplo `POST /api/voice/query`

Body:

```json
{
  "currentStopId": "stop_004",
  "question": "Que tengo que descargar ahora?",
  "routePlan": {},
  "loadPlan": {},
  "inputData": {},
  "voiceId": "JBFqnCBsd6RMkjVDRZzb"
}
```

## Ejemplo `POST /api/voice/handsfree`

Body:

```json
{
  "currentStopId": "stop_004",
  "routePlan": {},
  "loadPlan": {},
  "inputData": {},
  "audioBase64": "<audio-base64-webm-o-wav>",
  "audioMimeType": "audio/webm",
  "languageCode": "es",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb"
}
```

Respuesta (resumen):

```json
{
  "transcript": "donde esta la mercancia de este cliente",
  "response": {
    "answer": "...",
    "actions": []
  },
  "tts": {
    "audioBase64": "<base64-mp3>",
    "mimeType": "audio/mpeg",
    "provider": "elevenlabs"
  }
}
```

Respuesta (resumen):

```json
{
  "response": {
    "answer": "...",
    "actions": []
  },
  "tts": {
    "audioBase64": "<base64-mp3>",
    "mimeType": "audio/mpeg",
    "provider": "elevenlabs"
  }
}
```

Respuesta:

```json
{
  "response": {
    "answer": "...",
    "actions": []
  },
  "prompt": {
    "system": "...",
    "user": "...",
    "context": {}
  }
}
```
