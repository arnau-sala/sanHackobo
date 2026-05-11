/**
 * Demo standalone del TruckLoadView. Importa los mocks del optimizer-load
 * y monta la vista con el LoadPlan precomputado.
 *
 * Uso típico (Vite/Next.js):
 *
 *   import { TruckLoadViewDemo } from "@/components/truck/TruckLoadView.demo";
 *   export default function Page() {
 *     return <TruckLoadViewDemo />;
 *   }
 */

import {
  optimizeLoad,
  mockInputData,
  mockRoutePlan,
} from "../../../../../packages/optimizer-load/src";
import { TruckLoadView } from "./TruckLoadView";

export function TruckLoadViewDemo() {
  const loadPlan = optimizeLoad(mockInputData, mockRoutePlan);
  return <TruckLoadView loadPlan={loadPlan} />;
}

export default TruckLoadViewDemo;
