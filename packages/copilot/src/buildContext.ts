import {
  CopilotQuestionInput,
  Order,
  PalletSlot,
  RoutePlanStop,
  Stop,
} from "./types";

export type CopilotContext = {
  currentStop?: Stop;
  routeStop?: RoutePlanStop;
  relatedOrders: Order[];
  relatedSlots: PalletSlot[];
  returnableItems: Array<{ name: string; quantity: number; unit: string }>;
};

export function buildContext(input: CopilotQuestionInput): CopilotContext {
  const currentStop = input.inputData.stops.find(
    (stop) => stop.id === input.currentStopId,
  );

  const routeStop = input.routePlan.stops.find(
    (stop) => stop.stopId === input.currentStopId,
  );

  const relatedOrders = input.inputData.orders.filter(
    (order) => order.stopId === input.currentStopId,
  );

  const relatedSlots = input.loadPlan.palletSlots.filter((slot) =>
    (slot.items ?? []).some((item) => item.stopId === input.currentStopId),
  );

  const returnableItems = relatedOrders
    .flatMap((order) => order.items)
    .filter((item) => item.returnable)
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    }));

  return {
    currentStop,
    routeStop,
    relatedOrders,
    relatedSlots,
    returnableItems,
  };
}
