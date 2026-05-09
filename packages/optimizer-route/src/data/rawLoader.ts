/**
 * Carga y normaliza los 7 archivos raw de Damm.
 * Se ejecuta una sola vez al arrancar (índices en memoria).
 * Todos los campos NaN del export Python se limpian a null/undefined.
 */
import * as fs from "fs";
import * as path from "path";

const RAW_DIR = path.resolve(__dirname, "../../../../data/raw");

function loadJson(filename: string): any[] {
  const fullPath = path.join(RAW_DIR, filename);
  try {
    const raw = fs.readFileSync(fullPath, "utf-8");
    // Python exporta NaN como literal JSON inválido — reemplazar antes de parsear
    const clean = raw.replace(/\bNaN\b/g, "null");
    return JSON.parse(clean);
  } catch (e: any) {
    throw new Error(
      `No se puede leer ${filename} desde ${RAW_DIR}.\n` +
      `  Causa: ${e.message}\n` +
      `  Comprueba que los 7 archivos raw de Damm estén en data/raw/`
    );
  }
}

// ── Tipos normalizados ────────────────────────────────────────────────────────

export interface RawEntrega {
  entrega: number;
  nTransporte: number;
  creadoEl: string;       // "DD/MM/YYYY"
  repartidorId: number;
  repartidorNombre: string;
  clienteId: number;      // formato 910xxxxxxx
  clienteNombre: string;
}

export interface RawDireccion {
  clienteId: number;
  nombre: string;
  calle: string;
  cp: number;
  poblacion: string;
}

export interface RawHorario {
  deudorId: number;
  diaSemana: number;      // 1=lunes … 7=domingo
  turno: number;
  nombre: string;
  ddi: string;
  horaInicio: string;     // "HH:MM:SS"
  horaFin: string;        // "HH:MM:SS"
  cerrado: boolean;
}

export interface RawDimension {
  materialId: string;
  uma: string;            // CAJ | PAL | UN | BOT | BRL
  contador: number;       // unidades por UMA
  longCm: number;
  anchoCm: number;
  altCm: number;
  volumenL: number;
  pesoBrutoKg: number;
  pesoNetoKg: number;
}

export interface RawMaterial {
  materialId: string;
  nombre: string;
  ubicacion: string;      // código slot almacén, ej. "AA09A1"
  uma: string;
}

export interface RawLineaEntrega {
  nEntrega: number;
  clienteId: number;
  clienteNombre: string;
  lineas: Array<{
    material: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
  }>;
}

export interface RawZona {
  zonaCode: string;
  zonaNombre: string;
  zonaTransp: string;
  rutReal: string;        // "DR0001", "DR0027", etc.
  denominacion: string;   // nombre del repartidor asignado
}

// ── Carga y normalización ─────────────────────────────────────────────────────

export function loadEntregas(): RawEntrega[] {
  return loadJson("raw_cabecera_transporte.json")
    .filter((r) => r["Destinatario mcía."] && r["Repartidor"])
    .map((r) => ({
      entrega:           Number(r["Entrega"]),
      nTransporte:       Number(r["Nº Transporte."]),
      creadoEl:          r["Creado el"] ?? "",
      repartidorId:      Number(r["Repartidor"]),
      repartidorNombre:  String(r["Unnamed: 5"] ?? ""),
      clienteId:         Number(r["Destinatario mcía."]),
      clienteNombre:     String(r["Destinatario mcía..1"] ?? ""),
    }));
}

export function loadDirecciones(): RawDireccion[] {
  return loadJson("raw_direcciones.json")
    .filter((r) => r["Cliente"])
    .map((r) => ({
      clienteId:  Number(r["Cliente"]),
      nombre:     String(r["Nombre 1"] ?? ""),
      calle:      String(r["Calle"] ?? ""),
      cp:         Number(r["CP"] ?? 0),
      poblacion:  String(r["Población"] ?? ""),
    }));
}

export function loadHorarios(): RawHorario[] {
  return loadJson("raw_horarios.json")
    .filter((r) => r["Deudor"] && r["Día semana"])
    .map((r) => {
      const inicio = String(r["Horario inicia a"] ?? "00:00:00");
      const fin    = String(r["Horario termina a"] ?? "23:59:59");
      // "00:00:00" como fin = día cerrado
      const cerrado = fin === "00:00:00" || r["Cierre Si/No"] === "X";
      return {
        deudorId:   Number(r["Deudor"]),
        diaSemana:  Number(r["Día semana"]),
        turno:      Number(r["Turno"] ?? 1),
        nombre:     String(r["Nombre 1"] ?? ""),
        ddi:        String(r["Descripción"] ?? ""),
        horaInicio: inicio.slice(0, 5),  // "HH:MM"
        horaFin:    fin.slice(0, 5),
        cerrado,
      };
    });
}

export function loadDimensiones(): RawDimension[] {
  return loadJson("raw_dimensiones.json")
    .filter((r) => r["Material"] && r["UMA"])
    .map((r) => ({
      materialId:   String(r["Material"]),
      uma:          String(r["UMA"]),
      contador:     Number(r["Contador"] ?? 1),
      longCm:       Number(r["Longitud"] ?? 0),
      anchoCm:      Number(r["Ancho"] ?? 0),
      altCm:        Number(r["Altura"] ?? 0),
      volumenL:     Number(r["Volumen"] ?? 0),
      pesoBrutoKg:  Number(r["Peso bruto"] ?? 0),
      pesoNetoKg:   Number(r["Peso neto"] ?? 0),
    }));
}

export function loadMateriales(): RawMaterial[] {
  return loadJson("raw_materiales.json")
    .filter((r) => r["Material"] && r["Ubic."])
    .map((r) => ({
      materialId: String(r["Material"]),
      nombre:     String(r["Número de material"] ?? ""),
      ubicacion:  String(r["Ubic."]),
      uma:        String(r["UMB"] ?? "CAJ"),
    }));
}

export function loadLineasEntrega(): RawLineaEntrega[] {
  return loadJson("raw_lineas_entrega.json")
    .filter((r) => r["n_entrega"] && r["lineas"])
    .map((r) => ({
      nEntrega:      Number(r["n_entrega"]),
      clienteId:     Number(r["cliente"]?.["codigo"] ?? 0),
      clienteNombre: String(r["cliente"]?.["nombre"] ?? ""),
      lineas: (r["lineas"] ?? []).map((l: any) => ({
        material:    String(l["material"]),
        descripcion: String(l["descripcion"] ?? ""),
        cantidad:    Number(l["cantidad"] ?? 0),
        unidad:      String(l["unidad"] ?? "CAJ"),
      })),
    }));
}

export function loadZonas(): RawZona[] {
  return loadJson("raw_zonas.json")
    .filter((r) => r["ZONAS"] && r["RutReal"])
    .map((r) => ({
      zonaCode:    String(r["ZONAS"]),
      zonaNombre:  String(r["NOMBRE ZONAS"] ?? ""),
      zonaTransp:  String(r["ZonaTransp"] ?? ""),
      rutReal:     String(r["RutReal"]),
      denominacion: String(r["Denominación"] ?? ""),
    }));
}
