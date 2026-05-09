# TruckLoadView

Visualización pseudo-3D del camión y su carga, pensada para la demo del
**Damm Smart Truck Copilot**.

## Uso

```tsx
import { TruckLoadView } from "@/components/truck";
import { optimizeLoad, mockInputData, mockRoutePlan } from "@damm/optimizer-load";

const loadPlan = optimizeLoad(mockInputData, mockRoutePlan);

export default function Page() {
  return <TruckLoadView loadPlan={loadPlan} />;
}
```

También hay un componente listo para abrir directamente:

```tsx
import { TruckLoadViewDemo } from "@/components/truck/TruckLoadView.demo";
```

## Props

| Prop                   | Tipo                       | Descripción                                          |
| ---------------------- | -------------------------- | ---------------------------------------------------- |
| `loadPlan`             | `LoadPlan`                 | Resultado de `optimizeLoad`.                         |
| `initialSelectedSlotId`| `string?`                  | Slot abierto al montar (default: P1).                |
| `onSlotSelect`         | `(slotId: string) => void` | Callback de selección.                               |
| `title`                | `string?`                  | Título del header.                                   |

## Qué pinta

- 8 palets en grid 4×2 con la cabina arriba y la zona trasera abajo.
- Cada slot:
  - código (`P1`..`P8`),
  - lado (`right` / `left` / `rear`) y prioridad de acceso,
  - barra de fill con color del verde al rojo si hay overflow,
  - badges de bloque de ruta (`Bloque A 1-4`), retornables y warnings,
  - 3 items destacados.
- Header con KPIs en chips (ocupación, alineación, pesados abajo, etc.).
- Drawer lateral al hacer click:
  - capacidad de volumen y peso,
  - lista completa de items con cliente, secuencia, layer, motivo,
  - warnings asociados.
- Etiquetas laterales que recuerdan los accesos (lonas L/R, trasero).
- Pseudo-3D con CSS transforms (`perspective`, `rotateX`, `translateZ`):
  cero dependencias 3D, funciona en cualquier proyecto React.

## Integración rápida en Vite/Next/etc.

1. Copiar la carpeta `components/truck/` al proyecto.
2. Asegurarse de que el bundler trata `*.module.css` como CSS Modules
   (Vite y Next.js lo hacen por defecto).
3. Ajustar el alias relativo del archivo `types.ts` para apuntar al
   paquete `@damm/optimizer-load` real (en monorepo: `import type
{ LoadPlan } from "@damm/optimizer-load"`).
