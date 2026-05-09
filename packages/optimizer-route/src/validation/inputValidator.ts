import { z } from "zod";
import { InputPayload } from "../types/input.types";

const TimeWindowSchema = z.object({
  from: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  to: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
}).refine((tw) => tw.from < tw.to, { message: "timeWindow.from must be before .to" });

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.string(),
  volume_L: z.number().nonnegative(),
  weight_kg: z.number().nonnegative(),
  returnable: z.boolean(),
  warehouseLocation: z.string().min(1),
  handlingType: z.enum(["crate", "barrel", "pack", "unit"]),
  palletUnitsEach: z.number().int().positive(),
  palletUnitsTotal: z.number().int().positive(),
  palletUnits: z.number().int().positive(),
});

const OrderSchema = z.object({
  id: z.string().min(1),
  stopId: z.string().min(1),
  documentId: z.string().min(1),
  items: z.array(OrderItemSchema),
  totalAmount: z.number().nonnegative(),
  collectionAmount: z.number().nonnegative(),
});

const StopSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string(),
  zone: z.string(),
  route: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timeWindow: TimeWindowSchema,
  paymentType: z.enum(["CONTADO", "CREDITO"]),
  historicalConfidence: z.number().min(0).max(1),
  orderIds: z.array(z.string()).min(1),
});

const InputPayloadSchema = z.object({
  loadId: z.string().min(1),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  depot: z.object({
    id: z.string(),
    name: z.string(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string(),
  }),
  vehicle: z.object({
    id: z.string(),
    plate: z.string(),
    type: z.string(),
    palletSlots: z.number().int().positive(),
    access: z.array(z.enum(["left", "right", "rear"])).min(1),
  }),
  driver: z.object({
    id: z.string(),
    name: z.string(),
    continuousDriveAlreadyMin: z.number().nonnegative().optional(),
    totalDriveAlreadyTodayMin: z.number().nonnegative().optional(),
  }),
  stops: z.array(StopSchema).min(1),
  orders: z.array(OrderSchema).min(1),
}).refine(
  (data) => {
    const stopIds = new Set(data.stops.map((s) => s.id));
    return data.orders.every((o) => stopIds.has(o.stopId));
  },
  { message: "All orders must reference a valid stopId" }
).refine(
  (data) => {
    const orderIds = new Set(data.orders.map((o) => o.id));
    return data.stops.every((s) => s.orderIds.every((oid) => orderIds.has(oid)));
  },
  { message: "All stop.orderIds must reference a valid order id" }
);

export type ValidationResult =
  | { valid: true; data: InputPayload }
  | { valid: false; errors: Array<{ path: string; message: string }> };

export function validateInput(raw: unknown): ValidationResult {
  const result = InputPayloadSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data as InputPayload };
  }
  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { valid: false, errors };
}
