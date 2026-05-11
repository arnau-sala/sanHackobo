/**
 * Construye índices en memoria a partir de los datos raw.
 * Carga lazy — solo se construye cuando se llama por primera vez.
 */
import {
  loadEntregas, loadDirecciones, loadHorarios,
  loadDimensiones, loadMateriales, loadZonas, loadLineasEntrega,
  RawEntrega, RawDireccion, RawHorario, RawDimension, RawMaterial, RawZona, RawLineaEntrega,
} from "./rawLoader";

export interface RawIndexes {
  // nEntrega → líneas reales del pedido
  lineasByEntrega: Map<number, RawLineaEntrega>;

  // clienteId (910...) → direccion
  direccionesByCliente: Map<number, RawDireccion>;

  // clienteId (910...) → lista de entregas históricas
  entregasByCliente: Map<number, RawEntrega[]>;

  // clienteId (910...) → confidence score [0-1]
  confidenceByCliente: Map<number, number>;

  // deudorId → Map<diaSemana(1-7), RawHorario>
  horariosByDeudor: Map<number, Map<number, RawHorario>>;

  // materialId → Map<uma, RawDimension>
  dimensionesByMaterial: Map<string, Map<string, RawDimension>>;

  // materialId → RawMaterial (ubicación en almacén)
  materialesByMaterialId: Map<string, RawMaterial>;

  // rutReal (DR0027) → RawZona[]
  zonasByRuta: Map<string, RawZona[]>;
}

let _indexes: RawIndexes | null = null;

export function getIndexes(): RawIndexes {
  if (_indexes) return _indexes;

  console.log("📂 Cargando datos raw de Damm...");
  const t0 = Date.now();

  // Líneas de entrega reales
  const lineasByEntrega = new Map<number, RawLineaEntrega>();
  for (const l of loadLineasEntrega()) {
    lineasByEntrega.set(l.nEntrega, l);
  }

  // Direcciones
  const direccionesByCliente = new Map<number, RawDireccion>();
  for (const d of loadDirecciones()) {
    direccionesByCliente.set(d.clienteId, d);
  }

  // Entregas históricas + confidence
  const entregasByCliente = new Map<number, RawEntrega[]>();
  for (const e of loadEntregas()) {
    const list = entregasByCliente.get(e.clienteId) ?? [];
    list.push(e);
    entregasByCliente.set(e.clienteId, list);
  }

  // Confidence: clientes con más entregas históricas = más confianza
  // Escala logarítmica: 1 entrega = 0.50, 5 = 0.70, 20 = 0.85, 50+ = 0.95
  const confidenceByCliente = new Map<number, number>();
  let maxEntregas = 1;
  for (const list of entregasByCliente.values()) {
    if (list.length > maxEntregas) maxEntregas = list.length;
  }
  for (const [id, list] of entregasByCliente) {
    const n = list.length;
    const score = 0.50 + 0.45 * (Math.log(n + 1) / Math.log(maxEntregas + 1));
    confidenceByCliente.set(id, Math.round(score * 100) / 100);
  }

  // Horarios por deudor y día
  const horariosByDeudor = new Map<number, Map<number, RawHorario>>();
  for (const h of loadHorarios()) {
    if (!horariosByDeudor.has(h.deudorId)) {
      horariosByDeudor.set(h.deudorId, new Map());
    }
    // Guardar solo el primer turno (turno=1 es el principal)
    const byDay = horariosByDeudor.get(h.deudorId)!;
    if (!byDay.has(h.diaSemana) || h.turno < (byDay.get(h.diaSemana)?.turno ?? 99)) {
      byDay.set(h.diaSemana, h);
    }
  }

  // Dimensiones por material y unidad
  const dimensionesByMaterial = new Map<string, Map<string, RawDimension>>();
  for (const d of loadDimensiones()) {
    if (!dimensionesByMaterial.has(d.materialId)) {
      dimensionesByMaterial.set(d.materialId, new Map());
    }
    // Quedarse con el de mayor peso (más completo)
    const byUma = dimensionesByMaterial.get(d.materialId)!;
    const existing = byUma.get(d.uma);
    if (!existing || d.pesoBrutoKg > existing.pesoBrutoKg) {
      byUma.set(d.uma, d);
    }
  }

  // Materiales por materialId
  const materialesByMaterialId = new Map<string, RawMaterial>();
  for (const m of loadMateriales()) {
    if (!materialesByMaterialId.has(m.materialId)) {
      materialesByMaterialId.set(m.materialId, m);
    }
  }

  // Zonas por ruta
  const zonasByRuta = new Map<string, RawZona[]>();
  for (const z of loadZonas()) {
    const list = zonasByRuta.get(z.rutReal) ?? [];
    list.push(z);
    zonasByRuta.set(z.rutReal, list);
  }

  _indexes = {
    lineasByEntrega,
    direccionesByCliente,
    entregasByCliente,
    confidenceByCliente,
    horariosByDeudor,
    dimensionesByMaterial,
    materialesByMaterialId,
    zonasByRuta,
  };

  console.log(`✅ Índices listos en ${Date.now() - t0}ms`);
  console.log(`   Entregas con líneas reales:  ${lineasByEntrega.size}`);
  console.log(`   Clientes con dirección:   ${direccionesByCliente.size}`);
  console.log(`   Clientes con historial:   ${entregasByCliente.size}`);
  console.log(`   Clientes con horario:     ${horariosByDeudor.size}`);
  console.log(`   Productos con dimensiones: ${dimensionesByMaterial.size}`);
  console.log(`   Productos con ubicación:   ${materialesByMaterialId.size}`);
  console.log(`   Rutas en zonas:            ${zonasByRuta.size}`);

  return _indexes;
}
