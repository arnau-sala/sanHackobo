# @damm/optimizer-load

Motor de carga del **Damm Smart Truck Copilot** (Persona 3).

Toma como entrada los pedidos normalizados y un `RoutePlan` generado por el
optimizador de ruta y devuelve un `LoadPlan` con la distribución física
recomendada de la carga dentro del camión, listo para visualizarse en el
frontend como un camión 2D / 3D y para guiar al conductor durante el reparto.

> No buscamos un bin packing 3D perfecto. Buscamos una distribución
> realista, defendible y demoable que combine eficiencia de almacén,
> facilidad de descarga y respeto del orden de ruta.

---

## Estrategia: carga híbrida por bloques de ruta

Dividimos la ruta en bloques contiguos de 4 paradas (`Bloque A`, `B`, `C`,
`D`…) y asignamos los palets del camión a esos bloques en orden de
accesibilidad:

| Slot | Side  | Access      | Bloque típico |
| ---- | ----- | ----------- | ------------- |
| P1   | right | high        | A (1-4)       |
| P2   | right | high        | A             |
| P3   | left  | high        | B (5-8)       |
| P4   | left  | medium      | B             |
| P5   | right | medium      | C (9-12)      |
| P6   | left  | medium      | C             |
| P7   | rear  | low         | D (13-…)      |
| P8   | rear  | returnables | retorno       |

Reglas dentro de cada slot:

- Barriles y unidades pesadas (≥25 kg) en `bottom` (estabilidad).
- Cajas estándar en `middle`.
- Botellas, vasos y unidades pequeñas en `top`.
- Items con la misma referencia se agrupan en el mismo slot del bloque
  mientras quede holgura (≤ 80 % lleno) → carga rápida en almacén.
- Si un slot del bloque se satura, balanceamos al siguiente slot del bloque
  con más holgura (no overflow ciego).
- El último palet (`returnables`) se reserva para envases que vuelven al
  camión durante la ruta.

---

## Instalación

```bash
cd packages/optimizer-load
npm install
```

## Comandos

```bash
npm run demo        # ejecuta el motor con mocks reales y pinta el LoadPlan
npm run demo -- --json   # añade el JSON crudo al final
npm test            # 8 tests unitarios (node:test)
npm run typecheck   # tsc --noEmit
npm run build       # genera dist/ con declaraciones .d.ts
```

## Uso

```ts
import { optimizeLoad } from "@damm/optimizer-load";
import type { InputData, RoutePlan } from "@damm/optimizer-load";

const inputData: InputData = /* normalizado por persona 1 */;
const routePlan: RoutePlan = /* generado por persona 2 */;

const loadPlan = optimizeLoad(inputData, routePlan, {
  blockSize: 4,           // paradas por bloque (default 4)
  palletVolume: 1.6,      // m³ por palet (default 1.6)
  palletWeight: 750,      // kg por palet (default 750)
});
```

`loadPlan` cumple la interfaz `LoadPlan` del archivo `src/types.ts` y se
puede pasar directamente al componente React `TruckLoadView` en
`apps/web/src/components/truck`.

---

## Contratos

### Entrada (`InputData`)

```
depot, vehicle (8/6/3 palets, accesos), driver, stops[], orders[].items[]
```

Cada `OrderItem` puede traer `volume`, `weight`, `returnable`,
`handlingType`, `stackable` y `warehouseLocation` opcionales. Si faltan,
se estiman con defaults realistas (Barril 0.08 m³ / 35 kg, Caja 0.04 m³ /
12 kg, etc.) y se genera un warning `missing_data`.

### Entrada (`RoutePlan`)

```
id, totalStops, stops[].sequence + stopId, clusters[]
```

El motor solo necesita `sequence` y `stopId` ordenado. Los clusters de
parking, ETA y kilometraje son informativos.

### Salida (`LoadPlan`)

```
vehicleId, strategy="hybrid_by_route_blocks",
palletSlots[], routeBlocks[], returnablesPlan,
warnings[], kpis, explanation[]
```

---

## KPIs explicables

| KPI                          | Rango | Mejor cuanto…   | Significado                                                                |
| ---------------------------- | ----- | --------------- | -------------------------------------------------------------------------- |
| `truckFillRatio`             | 0–1   | medio-alto      | Volumen usado / capacidad total.                                           |
| `routeAlignmentScore`        | 0–1   | alto            | Paradas tempranas en slots accesibles (high) y tardías en low.             |
| `heavyItemsBottomRatio`      | 0–1   | alto            | Barriles y cajas pesadas colocados en layer `bottom`.                      |
| `stopsWithDirectAccessRatio` | 0–1   | alto            | Paradas servidas íntegramente desde slots high/medium.                     |
| `estimatedPickingComplexity` | 0–1   | bajo            | Dispersión de cada referencia entre slots (más dispersa = picking duro).   |
| `estimatedUnloadingComplexity` | 0–1 | bajo            | Dispersión de los items de un cliente entre slots (alto = peor descarga). |
| `returnablesReadinessScore`  | 0–1   | alto            | Capacidad reservada para retornables / volumen estimado de retorno.        |

---

## Warnings

| Tipo           | Severity              | Cuándo                                                    |
| -------------- | --------------------- | --------------------------------------------------------- |
| `missing_data` | info / warning        | Hay items con volumen, peso o handlingType estimado.      |
| `capacity`     | warning / critical    | Slot supera capacidad de volumen o peso.                  |
| `heavy_item`   | warning               | Barril fuera de layer bottom.                             |
| `access`       | warning               | Parada del primer tercio en slot de acceso bajo.          |
| `returnables`  | warning               | No hay slot reservado o capacidad insuficiente.           |
| `stacking`     | info                  | Item no apilable en bottom con cosas encima.              |

---

## Estructura interna

```
src/
  types.ts                       contratos públicos
  optimizeLoad.ts                función principal
  helpers/
    buildTruckLayout.ts          P1..P8 según vehículo
    buildRouteBlocks.ts          A/B/C/D con slots balanceados
    classifyHandlingType.ts      keg / crate / box / bottle / unit
    estimateItemSize.ts          defaults y estimación
    chooseLayer.ts               bottom / middle / top
    assignItemsToSlots.ts        núcleo: balance + agrupación + overflow
    computeLoadKpis.ts           7 KPIs en [0,1]
    generateLoadWarnings.ts      6 tipos de warning
    generateLoadExplanation.ts   bullets en español
  mock/
    mockInputData.ts             14 stops reales DR0027 (Sant Julià / Calldetenes / Folgueroles)
    mockRoutePlan.ts             ruta tipo con 4 bloques y 4 clusters
  demo.ts                        npm run demo
tests/
  optimizeLoad.test.ts           8 tests con node:test
```

---

## Mock data

El mock está calibrado con datos reales de la **Hoja Carga 11764300** y la
**Hoja Ruta DR0027** (08/05/2026, repartidor Fran Romero, vehículo V235045):

- 14 clientes únicos en Sant Julià de Vilatorta / Calldetenes /
  Folgueroles.
- ~50 items distribuidos: cajas retornables (Estrella Damm 1/3, Voll-Damm,
  Free Damm, agua Veri), barriles 20 L y 30 L (Estrella, Inedit, Turia,
  Damm Lemon, Voll), botellas (Magno, Ratafia, Seagram's), packs de
  alimentación (Lotus Biscoff, Aceitunas, Bonka), limpieza (Floquet, GC),
  y el tubo de CO₂ TB8.

---

## Próximos pasos (post-hackathon)

- Pasar de capa lógica a geometría real (W×D×H del palet → tetris 3D).
- Considerar incompatibilidades químicas (limpieza vs. alimentación).
- Modelar tiempos de preparación en almacén con `warehouseLocation`.
- Optimización conjunta: feedback al `RoutePlan` cuando una secuencia
  obliga a un layout malo (e.g. cliente con barriles en posición 13).
