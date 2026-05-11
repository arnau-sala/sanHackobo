/**
 * Re-export del contrato del módulo optimizer-load para que la UI consuma
 * los mismos tipos que el motor. En un monorepo final esto debería ser un
 * import directo del paquete `@damm/optimizer-load`; aquí usamos una ruta
 * relativa para que el componente funcione sin setup adicional.
 */
export type {
  LoadPlan,
  PalletSlot,
  LoadedItem,
  RouteBlock,
  ReturnablesPlan,
  LoadWarning,
  LoadKpis,
  Side,
  AccessPriority,
  Layer,
  HandlingType,
} from "../../../../../packages/optimizer-load/src/types";
