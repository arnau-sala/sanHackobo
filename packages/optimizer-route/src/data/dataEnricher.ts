/**
 * Enriquece el InputPayload de Persona 1 con datos reales de los 7 archivos raw.
 * Sobrescribe campos mock con valores calculados desde SAP/Damm real.
 */
import { InputPayload, Stop, Order, OrderItem } from "../types/input.types";
import { getIndexes } from "./rawIndexes";

// Día de semana JS: 0=domingo, 1=lunes… → Damm: 1=lunes, 7=domingo
function jsDayToDamm(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function parseDeliveryDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Enriquecimiento de stops ──────────────────────────────────────────────────

function enrichStop(stop: Stop, deliveryDate: string, idx: ReturnType<typeof getIndexes>): Stop {
  const clienteIdNum = Number(stop.clientId);
  const enriched = { ...stop };

  // 1. historicalConfidence REAL — calculado desde historial de entregas SAP
  const confidence = idx.confidenceByCliente.get(clienteIdNum);
  if (confidence !== undefined) {
    enriched.historicalConfidence = confidence;
  }

  // 2. Dirección REAL desde raw_direcciones
  const dir = idx.direccionesByCliente.get(clienteIdNum);
  if (dir) {
    enriched.address = dir.calle;
    enriched.city    = dir.poblacion;
    enriched.postalCode = String(dir.cp);
  }

  // 3. Ventana horaria REAL desde raw_horarios
  // Los horarios usan `Deudor` (6 dígitos) que no siempre coincide con clientId (910...).
  // Intentamos match por clienteIdNum directamente y también buscando por nombre
  const date = parseDeliveryDate(deliveryDate);
  const dammDay = jsDayToDamm(date.getDay());

  const horariosCliente = idx.horariosByDeudor.get(clienteIdNum);
  if (horariosCliente) {
    const horario = horariosCliente.get(dammDay);
    if (horario && !horario.cerrado && horario.horaInicio !== "00:00" && horario.horaFin !== "00:00") {
      enriched.timeWindow = {
        from: horario.horaInicio,
        to:   horario.horaFin,
      };
    }
  }

  return enriched;
}

// ── Enriquecimiento de items de orders ───────────────────────────────────────

function enrichOrderItem(item: OrderItem, idx: ReturnType<typeof getIndexes>): OrderItem {
  const enriched = { ...item };

  // 4. Peso y volumen REALES desde raw_dimensiones (unidad CAJ o BRL)
  const dimsByUma = idx.dimensionesByMaterial.get(item.productId);
  if (dimsByUma) {
    // Buscar por unidad exacta del item
    const umaKey = item.unit === "Barril" ? "BRL" : item.unit === "Caja" ? "CAJ" : "CAJ";
    const dim = dimsByUma.get(umaKey) ?? dimsByUma.get("CAJ");
    if (dim && dim.pesoBrutoKg > 0) {
      enriched.weight_kg = dim.pesoBrutoKg;
    }
    if (dim && dim.volumenL > 0) {
      enriched.volume_L = dim.volumenL;
    }
  }

  // 5. Ubicación en almacén REAL desde raw_materiales
  const mat = idx.materialesByMaterialId.get(item.productId);
  if (mat && mat.ubicacion) {
    enriched.warehouseLocation = mat.ubicacion;
  }

  return enriched;
}

// ── Función principal de enriquecimiento ─────────────────────────────────────

export interface EnrichmentReport {
  stopsEnriched: number;
  confidenceUpdated: number;
  addressUpdated: number;
  timeWindowUpdated: number;
  itemDimensionsUpdated: number;
  itemLocationUpdated: number;
  warnings: string[];
}

export function enrichPayload(input: InputPayload): {
  payload: InputPayload;
  report: EnrichmentReport;
} {
  const idx = getIndexes();
  const report: EnrichmentReport = {
    stopsEnriched: 0,
    confidenceUpdated: 0,
    addressUpdated: 0,
    timeWindowUpdated: 0,
    itemDimensionsUpdated: 0,
    itemLocationUpdated: 0,
    warnings: [],
  };

  // Enriquecer stops
  const enrichedStops = input.stops.map((stop) => {
    const original = { ...stop };
    const enriched = enrichStop(stop, input.deliveryDate, idx);

    if (enriched.historicalConfidence !== original.historicalConfidence) report.confidenceUpdated++;
    if (enriched.address !== original.address || enriched.city !== original.city) report.addressUpdated++;
    if (enriched.timeWindow.from !== original.timeWindow.from ||
        enriched.timeWindow.to   !== original.timeWindow.to)  report.timeWindowUpdated++;

    const clienteIdNum = Number(stop.clientId);
    if (!idx.confidenceByCliente.has(clienteIdNum)) {
      report.warnings.push(`Sin historial para cliente ${stop.clientId} (${stop.clientName}) — manteniendo confidence mock`);
    }
    if (!idx.direccionesByCliente.has(clienteIdNum)) {
      report.warnings.push(`Sin dirección real para cliente ${stop.clientId} (${stop.clientName})`);
    }

    report.stopsEnriched++;
    return enriched;
  });

  // Enriquecer items de orders
  const enrichedOrders: Order[] = input.orders.map((order) => {
    const enrichedItems = order.items.map((item) => {
      const original = { ...item };
      const enriched = enrichOrderItem(item, idx);

      if (enriched.weight_kg !== original.weight_kg || enriched.volume_L !== original.volume_L) {
        report.itemDimensionsUpdated++;
      }
      if (enriched.warehouseLocation !== original.warehouseLocation) {
        report.itemLocationUpdated++;
      }

      if (!idx.dimensionesByMaterial.has(item.productId)) {
        report.warnings.push(`Sin dimensiones reales para producto ${item.productId} (${item.name})`);
      }

      return enriched;
    });
    return { ...order, items: enrichedItems };
  });

  return {
    payload: { ...input, stops: enrichedStops, orders: enrichedOrders },
    report,
  };
}
