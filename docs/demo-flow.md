# Demo flow

## 1. Instalar y arrancar

1. **Instalar** (raíz del repo): `npm install`
2. **Variables** (opcional voz): copia `.env.example` → `.env` y pon
   `ELEVENLABS_API_KEY` si quieres TTS/STT reales.
3. **Arrancar todo**: `npm run dev`
   - API en `http://127.0.0.1:3001`
   - Web en `http://127.0.0.1:5173` (proxy `/api` → API)

## 2. Dashboard unificado

Abre `http://127.0.0.1:5173/`. Verás un dashboard con tres columnas:

- **Izquierda (Ruta DR0027)**: 14 paradas con secuencia, ETA y cluster.
  Selecciona una parada para fijar el contexto del resto del dashboard.
- **Centro (Vista del camión)**: TruckLoadView pseudo-3D, KPIs en chips
  (ocupación, alineación ruta, retornables, picking, descarga…), highlight
  automático del palet de la parada seleccionada y simulación de descarga
  con play/pause.
- **Derecha (Copiloto IA)**: chat con el copiloto, sugerencias rápidas,
  TTS opcional (ElevenLabs) e input por voz (Web Speech API en
  Chrome/Edge).

Al pie:

- **Alertas operativas**: warnings de carga (capacidad, pesados, acceso,
  retornables, datos faltantes, apilado).
- **Comparativa**: KPIs de la carga "tradicional" (un solo bloque) frente
  a la carga "híbrida por bloques de ruta" (`optimizeLoad` con
  `blockSize: 4`).

Modos: `Conductor`, `Almacén`, `Supervisor` (filtran las alertas
relevantes según el rol).

## 3. Endpoints útiles para la demo

```bash
# health
curl http://127.0.0.1:3001/health

# pipeline completo (mocks DR0027)
curl http://127.0.0.1:3001/api/pipeline/run

# optimizar carga con tu propio inputData/routePlan
curl -X POST http://127.0.0.1:3001/api/optimize-load \
  -H "Content-Type: application/json" \
  -d '{}'   # vacío → usa mocks

# preguntar al copiloto con contexto real
curl -X POST http://127.0.0.1:3001/api/copilot \
  -H "Content-Type: application/json" \
  -d @body.json    # body.json = pipeline output + currentStopId + question
```

## 4. Mapa de funcionalidades implementadas

| Bloque del briefing | Implementación |
|---|---|
| Ruta DR / clusters / asignación vehículo y conductor | `mockRoutePlan`, `mockInputData`, RoutePanel |
| Optimización de secuencia / ventanas horarias | `@damm/optimizer-route` (multi-objective) |
| LoadPlan automático + bloques de ruta + retornables | `optimizeLoad` → 8 slots, 4 bloques, `returnablesPlan` |
| Visualización 3D + highlight + simulación vaciado | `TruckLoadView` (autoplay, prev/next, drawer) |
| Chat copiloto / razonamiento / retornables / swap | `runCopilot` + 4 chips de prueba en `CopilotChat` |
| TTS / STT ElevenLabs | `/api/voice/query`, `/api/voice/handsfree`, demo `/handsfree` |
| Dashboard responsive con modos conductor/almacén/supervisor | `Dashboard.tsx` con tabs |
| KPIs en tiempo real | KPIs de `computeLoadKpis` en header del TruckLoadView |
| Alertas operativas (capacity/heavy/access/returnables/...) | `WarningsPanel` |
| Comparativa antes/después | `StrategyComparator` (hibrido vs blockSize=999) |
| Mock data reutilizable | `@damm/optimizer-load` exporta `mockInputData`/`mockRoutePlan` |
| API modular por contratos JSON | `@damm/contracts` re-exporta tipos |

## 5. Detalles importantes

- El escenario de copilot (`packages/mock-data/demo-scenario.json`) sigue
  estando para tests aislados del endpoint `/api/demo-scenario`.
- El cliente del copiloto (`apps/web/src/lib/copilotClient.ts`) prefiere
  la API y cae al motor in-browser si hay timeout o error → la UI
  funciona aunque solo arranques `npm run dev:web`.
- El comparador "antes/después" no entrena ningún modelo; reutiliza el
  mismo `optimizeLoad` con `blockSize` distinto para que los KPIs sean
  comparables.
