# Damm Smart Truck Copilot

Prototype for the Damm / DDI Interhack challenge.

The goal of this project is to optimize the full delivery operation, not only the route. The system proposes a delivery sequence, translates it into a truck loading plan, and assists the driver during the route.

> We do not optimize only for the shortest route. We optimize for a route that is easy to load, easy to unload, and realistic for the driver.

---

## Problem

DDI delivery trucks serve multiple hospitality clients in a single route. A truck can include around 15–25 deliveries, with many different product types: crates, kegs, bottles, packs, single units, cleaning products, food products and returnable containers.

Today, the warehouse preparation process is mainly product-oriented. This is efficient for picking and loading, but it can make unloading harder: the driver may need to search for products across different areas of the truck for each customer.

The challenge is to find a better balance between:

- Fast warehouse preparation.
- Efficient truck space usage.
- Easy unloading at each stop.
- Delivery order and customer time windows.
- Driver knowledge of the area.
- Returnable containers collected during the route.
- Real operational constraints such as lateral truck access, product handling and safety.

---

## Solution

**Damm Smart Truck Copilot** is a prototype that combines:

1. **Route optimization**  
   Generates a recommended delivery order using distance, customer zones, time windows, driver familiarity and operational constraints.

2. **Truck load optimization**  
   Converts the route into a physical loading plan, assigning products to truck slots or pallets according to delivery order, product type, accessibility and returnables.

3. **Driver copilot**  
   Provides explanations and assistance during the route, answering questions such as:
   - What do I need to unload at this stop?
   - Where is this customer’s merchandise?
   - Why is this stop recommended now?
   - What returnables should I collect?
   - What happens if I change the route order?

4. **Visual interface**  
   Shows the route, truck layout, loading plan, warnings, KPIs and operational recommendations.

---

## Core idea

The main concept is a **hybrid loading strategy**.

Instead of loading the truck only by product reference or only by customer, the system groups the route into delivery blocks.

Example:

```txt
Block A: stops 1–4
Block B: stops 5–8
Block C: stops 9–12
Block D: stops 13–18
```

---

## Repo layout (monorepo)

| Path | Role |
|------|------|
| `apps/api` | HTTP API: copilot, voz (ElevenLabs), optimización de ruta |
| `apps/web` | Frontend Vite + React (visualización / demos) |
| `packages/copilot` | Motor copilot (contexto + respuestas demo) |
| `packages/optimizer-route` | Optimizador de ruta |
| `packages/optimizer-load` | Optimizador de carga |
| `packages/mock-data` | JSON de escenarios |
| `packages/contracts` | Tipos compartidos (re-exports) |
| `docs/` | Contratos API, flujo demo, supuestos |
| `scripts/data-parser` | Placeholder para parsers |

---

## Developer setup

1. **Requisitos**: Node.js 20+ y npm.
2. **Instalar**: en la raíz del repo ejecuta `npm install`.
3. **Entorno** (voz opcional): copia `.env.example` a `.env` y configura `ELEVENLABS_API_KEY` si usas TTS/STT.
4. **Desarrollo**:
   - Todo junto: `npm run dev` (API `:3001` + web `:5173`, proxy `/api`).
   - Solo API: `npm run dev:api`
   - Solo web: `npm run dev:web`
5. **Comprobaciones**: `npm run typecheck`, `npm run test`, `npm run build` (cada workspace con script definido).

Más detalle: [docs/demo-flow.md](docs/demo-flow.md), [docs/api-contracts.md](docs/api-contracts.md).

---

## Branch strategy (hackathon)

- `main`: estable para demo / integración.
- Ramas cortas por feature (`feature/copilot`, `feature/route-opt`, …); merge a `main` o `develop` con PR pequeños para reducir conflictos.
- Evita historiales no relacionados: si una rama viene de otro repo, usa `cherry-pick` o merge explícito `--allow-unrelated-histories` solo si el equipo lo acuerda.