# Demo flow

1. **Instalar** (raíz del repo): `npm install`
2. **Variables** (opcional voz): copia `.env.example` → `.env` y pon `ELEVENLABS_API_KEY` si quieres TTS/STT reales.
3. **Arrancar todo**: `npm run dev`  
   - API en `http://127.0.0.1:3001`  
   - Web en `http://127.0.0.1:5173` (proxy `/api` → API)
4. **Probar copilot demo**: abre `http://127.0.0.1:5173/handsfree` o directamente en la API `http://127.0.0.1:3001/handsfree`.
5. **Optimizar ruta**: `POST /api/optimize-route` con un JSON válido `InputPayload` (p. ej. generado o adaptado desde `data/`).

El escenario del copilot (`packages/mock-data/demo-scenario.json`) está pensado para la demo de preguntas/respuestas; el contrato del optimizador de rutas es más estricto: si mezclas JSON incompatible, valida o adapta el payload antes de llamar al endpoint.
