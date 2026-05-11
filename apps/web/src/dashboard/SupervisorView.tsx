/**
 * SupervisorView — Centro de Control Operaciones DDI Mollet
 *
 * Tres fases operativas:
 *  MAÑANA  (07:00-09:00) — Verificación de carga y salida de camiones
 *  JORNADA (09:00-16:00) — Monitorización en ruta, excepciones, ETAs
 *  CIERRE  (16:00+)      — Reconciliación: efectivo, barriles, retornables
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type * as GeoJSON from "geojson";

mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "";

// ─── Design tokens — light Damm theme (matches conductor/Dashboard) ───────────
const C = {
  bg:      "#fbf8f4",
  surface: "#ffffff",
  card:    "#ffffff",
  card2:   "#f3f4f6",
  border:  "#e7e2dd",
  border2: "#efeae3",
  text:    "#0f1115",
  muted:   "#6b7280",
  muted2:  "#4b5563",
  red:     "#e10600",
  gold:    "#f5c842",
  green:   "#16a34a",
  green2:  "#22c55e",
  amber:   "#f59e0b",
  blue:    "#3b82f6",
  purple:  "#9333ea",
  teal:    "#0d9488",
  indigo:  "#6366f1",
} as const;

const PALETTE = [
  "#3b82f6","#22c55e","#f59e0b","#e879f9","#14b8a6",
  "#f97316","#06b6d4","#a78bfa","#84cc16","#ec4899",
  "#38bdf8","#4ade80","#fbbf24","#c084fc","#2dd4bf",
  "#fb923c","#e32819","#f5c518",
];

// ─── Types ───────────────────────────────────────────────────────────────────
type Item = { material: string; descripcion: string; cantidad: number; unidad: string };
type Stop = {
  stopId: string; deliveryId: number; sequence: number;
  clientId: number; clientName: string; address: string;
  city: string; cp: string; lat: number|null; lng: number|null;
  items: Item[];
};
type Route = {
  transportId: number; date: string; route: string;
  driverId: number; driverName: string; stops: Stop[];
};

// ─── Data derivation ─────────────────────────────────────────────────────────
type DriverStats = {
  id: number; name: string; routes: string[]; color: string;
  // Volume
  stops: number; totalUnits: number; weightKg: number;
  // Product mix
  barrelUnits: number; crateUnits: number; returnableUnits: number;
  // Commercial
  contadoStops: number; cashExposure: number;
  // Operations
  cities: string[]; geocodedPct: number;
  vehicleLoadPct: number; overloaded: boolean;
  estimatedFinishMin: number; estimatedFinish: string;
  loadScore: number;
  allStops: Stop[];
};

function itemWeight(item: Item): number {
  const u = item.unidad?.toUpperCase() ?? "";
  const d = item.descripcion?.toUpperCase() ?? "";
  const qty = Number(item.cantidad) || 0;
  if (u === "BAR" || /BARRIL|KEG|\bFUT\b/.test(d)) return qty * 58;  // 58kg keg
  if (u === "CAJ" || /\bCAJ\b|CAJA/.test(d)) return qty * 13;         // 13kg case
  if (/LATA|BRIK/.test(d)) return qty * 9;
  return qty * 4;
}

function isBarrel(item: Item): boolean {
  return item.unidad?.toUpperCase() === "BAR" || /BARRIL|KEG|\bFUT\b/.test(item.descripcion?.toUpperCase() ?? "");
}
function isCrate(item: Item): boolean {
  return item.unidad?.toUpperCase() === "CAJ" || /\bCAJ\b|CAJA/.test(item.descripcion?.toUpperCase() ?? "");
}
function isReturnable(item: Item): boolean {
  return /\bRET\.?\b|RETORN|ENVAS|BUIT|VACI[ÓO]/.test(item.descripcion?.toUpperCase() ?? "");
}
function isContadoClient(name: string): boolean {
  return /\bBAR\b|CAFETER|RESTAUR|HOTEL|TABAC|QUIOSC|BODEG|CERVECERIA|\bPUB\b|HOSTEL|CANTINE/.test(name.toUpperCase());
}

function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}:${String(m).padStart(2,"0")}`;
}

function deriveStats(routes: Route[], colorOf: Map<number,string>): DriverStats[] {
  const byDriver = new Map<number, Route[]>();
  for (const r of routes) {
    if (!byDriver.has(r.driverId)) byDriver.set(r.driverId, []);
    byDriver.get(r.driverId)!.push(r);
  }

  const all: DriverStats[] = [];
  for (const [id, dRoutes] of byDriver) {
    const allStops = dRoutes.flatMap(r => r.stops);
    const driverRoutes = [...new Set(dRoutes.map(r => r.route))];
    const stops = allStops.length;

    let totalUnits = 0, weightKg = 0, barrelUnits = 0, crateUnits = 0, returnableUnits = 0;
    for (const st of allStops) {
      for (const i of st.items) {
        const qty = Number(i.cantidad) || 0;
        totalUnits += qty;
        weightKg   += itemWeight(i);
        if (isBarrel(i))     barrelUnits    += qty;
        if (isCrate(i))      crateUnits     += qty;
        if (isReturnable(i)) returnableUnits += qty;
      }
    }

    const contadoStops = allStops.filter(s => isContadoClient(s.clientName)).length;
    const cashExposure = Math.round(contadoStops * 88); // avg ticket DDI ~88€

    const geocoded = allStops.filter(s => s.lat && Math.abs(s.lat) > 0.1).length;
    const geocodedPct = stops > 0 ? Math.round(geocoded / stops * 100) : 0;

    const cities = [...new Set(allStops.map(s => s.city).filter(Boolean))];

    // Vehicle load: 8-pallet truck, max ~8000kg useful
    const vehicleLoadPct = Math.min(Math.round(weightKg / 8000 * 100), 100);

    // ETA: 07:30 salida, 12min/parada + 40min base conducción + 5min/barril extra
    const totalMin = 7*60 + 30 + stops * 12 + 40 + barrelUnits * 0.5;
    const estimatedFinishMin = Math.round(totalMin);

    all.push({
      id, name: dRoutes[0].driverName, routes: driverRoutes,
      color: colorOf.get(id) ?? C.blue,
      stops, totalUnits, weightKg: Math.round(weightKg),
      barrelUnits, crateUnits, returnableUnits,
      contadoStops, cashExposure,
      cities, geocodedPct,
      vehicleLoadPct, overloaded: stops >= 24,
      estimatedFinishMin, estimatedFinish: minsToHHMM(estimatedFinishMin),
      loadScore: stops,
      allStops,
    });
  }

  const maxStops = Math.max(...all.map(d => d.stops), 1);
  all.forEach(d => d.loadScore = Math.round(d.stops / maxStops * 100));
  return all.sort((a,b) => b.stops - a.stops);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (n: string) => n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
const shortName = (n: string) => { const p=n.split(" "); return p[0]+" "+(p[1]?p[1][0]+".":""); };
const fmtNum  = (n: number) => n>=1000?(n/1000).toFixed(1)+"k":String(n);
const fmtKg   = (kg: number) => kg>=1000?`${(kg/1000).toFixed(1)}t`:`${kg}kg`;
const fmtEuro = (e: number) => e>=1000?`${(e/1000).toFixed(1)}k€`:`${e}€`;

function hexRgb(hex: string): string {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ─── Micro components ─────────────────────────────────────────────────────────
function Pill({ text, color, bg }: { text:string; color:string; bg?:string }) {
  return (
    <span style={{ padding:"2px 7px", borderRadius:20, fontSize:9, fontWeight:800,
      background: bg ?? `${color}1A`, color, border:`1px solid ${color}35`, letterSpacing:.3,
      display:"inline-block", lineHeight:"16px" }}>
      {text}
    </span>
  );
}

function KpiTile({ label, value, sub, color, icon }:
  { label:string; value:string|number; sub?:string; color?:string; icon:string }) {
  return (
    <div style={{ padding:"10px 16px", borderRadius:10,
      background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
      border:`1px solid ${C.border}`, flex:1, minWidth:100,
      boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 6px 16px rgba(17,17,17,.04)" }}>
      <div style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:.7, textTransform:"uppercase", marginBottom:3 }}>
        <span style={{ marginRight:4 }}>{icon}</span>{label}
      </div>
      <div style={{ color:color??C.text, fontWeight:900, fontSize:22, lineHeight:1,
        fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color, h=5, bg="rgba(15,17,21,.07)" }:
  { value:number; max:number; color:string; h?:number; bg?:string }) {
  const w = max>0 ? Math.min(value/max*100, 100) : 0;
  return (
    <div style={{ height:h, background:bg, borderRadius:h/2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${w}%`, background:color,
        borderRadius:h/2, transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
    </div>
  );
}

// ─── Alert threshold config ───────────────────────────────────────────────────
type AlertSev = "critical"|"warning"|"info";
type Alert = { icon:string; title:string; detail:string; driverId?:number; sev:AlertSev };

function buildAlerts(stats: DriverStats[], kpis: Record<string,number>): Alert[] {
  const alerts: Alert[] = [];

  // Critical: overloaded route (likely late finish)
  for (const d of stats.filter(d => d.overloaded)) {
    alerts.push({ icon:"🔴", sev:"critical",
      title:`${shortName(d.name)} — sobrecarga de ruta`,
      detail:`${d.stops} paradas · fin estimado ${d.estimatedFinish} (>16h)`, driverId: d.id });
  }

  // Critical: high cash exposure (>800€)
  for (const d of stats.filter(d => d.cashExposure >= 800)) {
    alerts.push({ icon:"💶", sev:"critical",
      title:`${shortName(d.name)} — alta exposición de efectivo`,
      detail:`~${fmtEuro(d.cashExposure)} estimados (${d.contadoStops} paradas CONTADO)`, driverId: d.id });
  }

  // Warning: many kegs (heavy route, vehicle stress)
  for (const d of stats.filter(d => d.barrelUnits >= 6)) {
    alerts.push({ icon:"🍺", sev:"warning",
      title:`${shortName(d.name)} — carga pesada de barriles`,
      detail:`${d.barrelUnits} barriles (~${fmtKg(d.barrelUnits*58)}) · ${Math.round(d.vehicleLoadPct)}% vehículo`, driverId: d.id });
  }

  // Warning: low geocoding (<50%)
  for (const d of stats.filter(d => d.geocodedPct < 50 && d.stops > 5)) {
    alerts.push({ icon:"📍", sev:"warning",
      title:`${shortName(d.name)} — coordenadas incompletas`,
      detail:`Solo ${d.geocodedPct}% paradas geocodificadas — ruta menos fiable`, driverId: d.id });
  }

  // Info: fleet weight
  if (kpis.weightKg > 50000) {
    alerts.push({ icon:"⚖", sev:"info",
      title:`Carga total de la flota: ${fmtKg(kpis.weightKg)}`,
      detail:"Verificar ITV y permisos de peso para vehículos cargados" });
  }

  return alerts.slice(0, 9);
}

// ─── Main component ───────────────────────────────────────────────────────────
type Phase = "morning"|"day"|"close";

export function SupervisorView({ onBack }: { onBack:()=>void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<mapboxgl.Map|null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const layersRef  = useRef<string[]>([]);   // all layer ids added
  const sourcesRef = useRef<string[]>([]);   // all source ids added
  const popupRef   = useRef<mapboxgl.Popup|null>(null);
  const roadCacheRef = useRef<Map<string, [number,number][]>>(new Map());

  const [routes,         setRoutes]         = useState<Route[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate,   setSelectedDate]   = useState("");
  const [selectedDriver, setSelectedDriver] = useState<number|null>(null);
  const [activeTab,      setActiveTab]      = useState<"ops"|"analytics">("ops");
  const [detailTab,      setDetailTab]      = useState<"stops"|"products"|"cash">("stops");
  const [apiOnline,      setApiOnline]      = useState<boolean|null>(null);
  const [loading,        setLoading]        = useState(true);
  const [filterRoute,    setFilterRoute]    = useState("all");
  const [mapReady,       setMapReady]       = useState(false);
  const [phase,          setPhase]          = useState<Phase>("morning");

  // Color map
  const colorOf = useMemo(() => {
    const m = new Map<number,string>();
    [...new Set(routes.map(r=>r.driverId))].sort().forEach((id,i) =>
      m.set(id, PALETTE[i % PALETTE.length]));
    return m;
  }, [routes]);

  const driverStats = useMemo(() => deriveStats(routes, colorOf), [routes, colorOf]);

  const filteredStats = useMemo(() =>
    filterRoute === "all" ? driverStats : driverStats.filter(d => d.routes.includes(filterRoute)),
    [driverStats, filterRoute]);

  const selectedStats = useMemo(() =>
    driverStats.find(d => d.id === selectedDriver) ?? null,
    [driverStats, selectedDriver]);

  const availableRoutes = useMemo(() =>
    [...new Set(driverStats.flatMap(d => d.routes))].sort(),
    [driverStats]);

  // Fleet KPIs
  const kpis = useMemo(() => ({
    drivers:   new Set(routes.map(r=>r.driverId)).size,
    stops:     driverStats.reduce((s,d)=>s+d.stops, 0),
    totalUnits:driverStats.reduce((s,d)=>s+d.totalUnits, 0),
    weightKg:  driverStats.reduce((s,d)=>s+d.weightKg, 0),
    barrels:   driverStats.reduce((s,d)=>s+d.barrelUnits, 0),
    returnables:driverStats.reduce((s,d)=>s+d.returnableUnits, 0),
    cashExposure:driverStats.reduce((s,d)=>s+d.cashExposure, 0),
    overloaded:driverStats.filter(d=>d.overloaded).length,
    avgLoad:   driverStats.length ? Math.round(driverStats.reduce((s,d)=>s+d.vehicleLoadPct,0)/driverStats.length) : 0,
  }), [driverStats, routes.length]);

  const alerts = useMemo(() => buildAlerts(driverStats, kpis as any), [driverStats, kpis]);

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch("/api/history")
      .then(r=>r.ok?r.json():null).catch(()=>null)
      .then(h => {
        if (!h) { setApiOnline(false); setLoading(false); return; }
        setApiOnline(true);
        const dates: string[] = (h.availableDates ?? []).slice().reverse();
        setAvailableDates(dates);
        // Prefer a date that is not the last (which may be sparse)
        const best = dates.find(d => !d.endsWith("-31") && !d.endsWith("-01")) ?? dates[0] ?? "";
        setSelectedDate(best);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedDate || !apiOnline) return;
    setRoutes([]); setSelectedDriver(null);
    fetch(`/api/history/routes?date=${selectedDate}`)
      .then(r=>r.ok?r.json():{routes:[]}).catch(()=>({routes:[]}))
      .then(d => setRoutes(d.routes ?? []));
  }, [selectedDate, apiOnline]);

  // ── Map init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [2.28, 41.62], zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch:false }), "top-right");
    map.on("load", () => { mapRef.current = map; setMapReady(true); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Directions API ─────────────────────────────────────────────────────
  async function fetchRoadRoute(waypoints: [number,number][]): Promise<[number,number][]> {
    if (waypoints.length < 2) return waypoints;
    const token = mapboxgl.accessToken;
    if (!token) return waypoints;
    const CHUNK = 25;
    const all: [number,number][] = [];
    for (let i = 0; i < waypoints.length - 1; i += CHUNK - 1) {
      const chunk = waypoints.slice(i, Math.min(i + CHUNK, waypoints.length));
      const coordStr = chunk.map(c=>`${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
      try {
        const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${token}`);
        const data = await res.json() as any;
        const coords: [number,number][] = data.routes?.[0]?.geometry?.coordinates ?? chunk;
        if (all.length === 0) all.push(...coords); else all.push(...coords.slice(1));
      } catch { all.push(...chunk); }
    }
    return all.length > 0 ? all : waypoints;
  }

  // ── Draw map ───────────────────────────────────────────────────────────
  const drawMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // ── Cleanup ──────────────────────────────────────────────────────────
    popupRef.current?.remove();
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    for (const lid of layersRef.current)  { try { map.removeLayer(lid);   } catch {} }
    for (const sid of sourcesRef.current) { try { map.removeSource(sid);  } catch {} }
    layersRef.current  = [];
    sourcesRef.current = [];
    if (!routes.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    const DEPOT: [number,number] = [2.213, 41.539];

    // ── Helpers ───────────────────────────────────────────────────────────
    const addLayer = (spec: Parameters<mapboxgl.Map["addLayer"]>[0]) => {
      map.addLayer(spec);
      layersRef.current.push(spec.id);
    };
    const addSource = (id: string, spec: Parameters<mapboxgl.Map["addSource"]>[1]) => {
      map.addSource(id, spec);
      sourcesRef.current.push(id);
    };

    // ── Depot marker (one HTML marker, acceptable) ────────────────────────
    const depEl = document.createElement("div");
    depEl.innerHTML = `<div style="width:38px;height:38px;background:#fff;border:2.5px solid ${C.gold};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 0 4px rgba(245,200,66,.2),0 4px 12px rgba(17,17,17,.14);cursor:pointer;z-index:10">🏭</div>`;
    const depMarker = new mapboxgl.Marker({ element:depEl, anchor:"center" })
      .setLngLat(DEPOT)
      .setPopup(new mapboxgl.Popup({ offset:24, closeButton:false, maxWidth:"240px" })
        .setHTML(`<div style="background:#fff;border:1px solid #e7e2dd;border-radius:12px;padding:14px 16px;font-family:'Inter',sans-serif;">
          <div style="color:#e10600;font-weight:800;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:7px;">
            <span style="background:rgba(225,6,0,.08);border-radius:8px;padding:3px 7px;border:1px solid rgba(225,6,0,.15);">🏭</span>
            DDI Mollet del Vallès
          </div>
          <div style="color:#4b5563;font-size:11px;line-height:1.8;">
            <b style="color:#0f1115">${kpis.drivers}</b> repartidores activos<br>
            <b style="color:#0f1115">${fmtNum(kpis.stops)}</b> paradas &nbsp;·&nbsp; <b style="color:#0f1115">${fmtNum(kpis.totalUnits)}</b> uds.<br>
            <b style="color:#0f1115">${fmtKg(kpis.weightKg)}</b> carga total
          </div>
        </div>`))
      .addTo(map);
    markersRef.current.push(depMarker);
    bounds.extend(DEPOT);

    // ── Per-driver: lines + stop circles ─────────────────────────────────
    for (const driver of filteredStats) {
      const { color, id } = driver;
      const isSel = selectedDriver === id;
      const isDim = selectedDriver !== null && !isSel;
      const validStops = driver.allStops
        .filter(s => s.lat && s.lng && Math.abs(s.lat!) > 0.1)
        .sort((a,b) => a.sequence - b.sequence);
      if (!validStops.length) continue;

      validStops.forEach(s => bounds.extend([s.lng!, s.lat!]));

      // ── Route line ────────────────────────────────────────────────────
      // Overview: stops in sequence only (no depot loop — avoids visual mess)
      // Selected: depot → stops → depot, then fetched via Directions API
      const lineCoords: [number,number][] = isSel
        ? [DEPOT, ...validStops.map(s=>[s.lng!,s.lat!] as [number,number]), DEPOT]
        : validStops.map(s=>[s.lng!,s.lat!] as [number,number]);

      const lineId = `line-${id}`;
      addSource(lineId, { type:"geojson", data:{ type:"Feature", properties:{},
        geometry:{ type:"LineString", coordinates: lineCoords }}});

      if (isSel) {
        // Soft halo behind route
        addLayer({ id:`${lineId}-glow`, type:"line", source:lineId,
          layout:{ "line-join":"round","line-cap":"round" },
          paint:{ "line-color":color, "line-width":20, "line-opacity":0.1, "line-blur":12 }});
      }
      addLayer({ id:lineId, type:"line", source:lineId,
        layout:{ "line-join":"round","line-cap":"round" },
        paint:{
          "line-color": color,
          "line-width":  isSel ? 4 : 1.8,
          "line-opacity": isDim ? 0.06 : isSel ? 1 : 0.65,
        }});

      map.on("click", lineId, () => setSelectedDriver(isSel ? null : id));
      map.on("mouseenter", lineId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", lineId, () => { map.getCanvas().style.cursor = ""; });

      // Road routing only for selected driver (cached, Directions API)
      if (isSel) {
        const cacheKey = `${id}|${selectedDate}`;
        const cached = roadCacheRef.current.get(cacheKey);
        const applyRoad = (road: [number,number][]) => {
          try {
            (map.getSource(lineId) as mapboxgl.GeoJSONSource)?.setData({
              type:"Feature", properties:{},
              geometry:{ type:"LineString", coordinates: road }});
          } catch {}
        };
        if (cached) {
          applyRoad(cached);
        } else {
          // Build waypoints: depot → stops in sequence → depot
          const wps: [number,number][] = [DEPOT, ...validStops.map(s=>[s.lng!,s.lat!] as [number,number]), DEPOT];
          fetchRoadRoute(wps).then(road => {
            roadCacheRef.current.set(cacheKey, road);
            applyRoad(road);
          });
        }
      }

      // ── Stop circles as MAP LAYERS (GPU-rendered, never drift) ─────────
      const stopsGeoJSON: GeoJSON.FeatureCollection = {
        type:"FeatureCollection",
        features: validStops.map((stop, idx) => ({
          type:"Feature" as const,
          properties:{
            idx: idx + 1,
            clientName: stop.clientName,
            address: stop.address || "",
            city: stop.city,
            hasCash:   isContadoClient(stop.clientName) ? 1 : 0,
            hasBarrel: stop.items.some(isBarrel) ? 1 : 0,
            driverColor: color,
            driverName: shortName(driver.name),
            routes: driver.routes.join(", "),
            items: JSON.stringify(stop.items.slice(0,5)),
            itemCount: stop.items.length,
          },
          geometry:{ type:"Point" as const, coordinates:[stop.lng!, stop.lat!] }
        }))
      };

      const stopsId = `stops-${id}`;
      addSource(stopsId, { type:"geojson", data: stopsGeoJSON });

      if (isSel) {
        // Outer halo ring
        addLayer({ id:`${stopsId}-halo`, type:"circle", source:stopsId,
          paint:{
            "circle-radius":   16,
            "circle-color":    color,
            "circle-opacity":  0.15,
            "circle-stroke-width": 0,
          }});
        // Main circle
        addLayer({ id:stopsId, type:"circle", source:stopsId,
          paint:{
            "circle-radius":   10,
            "circle-color": ["case",
              ["==",["get","hasBarrel"],1], C.purple,
              ["==",["get","hasCash"],  1], C.amber,
              color],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
            "circle-opacity":  1,
          }});
        // Number labels
        addLayer({ id:`${stopsId}-label`, type:"symbol", source:stopsId,
          layout:{
            "text-field":             ["to-string",["get","idx"]],
            "text-size":              10,
            "text-font":              ["DIN Offc Pro Bold","Arial Unicode MS Bold"],
            "text-allow-overlap":     true,
            "text-ignore-placement":  true,
          },
          paint:{
            "text-color": "#ffffff",
          }});

        // Click popup on stops
        map.on("click", stopsId, e => {
          if (!e.features?.[0]) return;
          const p  = e.features[0].properties!;
          const co = (e.features[0].geometry as GeoJSON.Point).coordinates as [number,number];
          let items: {descripcion:string;cantidad:number;unidad:string}[] = [];
          try { items = JSON.parse(p.items ?? "[]"); } catch {}
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ offset:16, closeButton:true, maxWidth:"280px",
            className:"damm-popup" })
            .setLngLat(co)
            .setHTML(`<div style="font-family:'Inter',system-ui,sans-serif;padding:2px;">
              <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;">
                <div style="width:28px;height:28px;border-radius:50%;background:${p.driverColor};
                  color:#fff;display:flex;align-items:center;justify-content:center;
                  font-size:11px;font-weight:900;flex-shrink:0;">${p.idx}</div>
                <div style="flex:1;min-width:0;">
                  <div style="color:#0f1115;font-weight:800;font-size:12px;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.clientName}</div>
                  <div style="color:#6b7280;font-size:10px;margin-top:1px;">${p.address} · ${p.city}</div>
                </div>
              </div>
              ${p.hasCash||p.hasBarrel ? `<div style="display:flex;gap:5px;margin-bottom:9px;flex-wrap:wrap;">
                ${p.hasCash  ? `<span style="background:rgba(245,158,11,.1);color:#b45309;font-size:9px;padding:2px 8px;border-radius:20px;font-weight:800;border:1px solid rgba(245,158,11,.22);">💶 CONTADO</span>` : ""}
                ${p.hasBarrel? `<span style="background:rgba(147,51,234,.1);color:#7e22ce;font-size:9px;padding:2px 8px;border-radius:20px;font-weight:800;border:1px solid rgba(147,51,234,.2);">🍺 BARRIL</span>` : ""}
              </div>` : ""}
              <div style="border-top:1px solid #e7e2dd;padding-top:8px;margin-top:2px;">
                ${items.map(i=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">
                  <span style="color:#4b5563;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:8px;">${i.descripcion}</span>
                  <span style="color:#0f1115;font-weight:800;font-size:10px;flex-shrink:0;">${i.cantidad} ${i.unidad}</span>
                </div>`).join("")}
                ${p.itemCount>5 ? `<div style="color:#9ca3af;font-size:9px;margin-top:3px;">+${p.itemCount-5} productos más</div>` : ""}
              </div>
              <div style="margin-top:8px;color:#9ca3af;font-size:9px;border-top:1px solid #f3f4f6;padding-top:6px;">${p.routes} · ${p.driverName}</div>
            </div>`)
            .addTo(map);
        });
        map.on("mouseenter", stopsId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", stopsId, () => { map.getCanvas().style.cursor = ""; });
      } else {
        // Overview: tiny dots (no labels, no halos — clean read)
        addLayer({ id:stopsId, type:"circle", source:stopsId,
          paint:{
            "circle-radius":   isDim ? 3 : 4.5,
            "circle-color":    isDim ? "#d1d5db" : color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity":  isDim ? 0.2 : 0.8,
          }});
      }
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding:{ top:60, bottom:60, left:350, right: selectedDriver ? 310 : 60 },
        maxZoom:13, duration:800,
      });
    }
  }, [routes, filteredStats, selectedDriver, selectedDate, kpis]);

  useEffect(() => { if (mapReady) drawMap(); }, [drawMap, mapReady]);

  // ── Weekly trend ───────────────────────────────────────────────────────
  const [trendData, setTrendData] = useState<{d:string; stops:number; units:number}[]>([]);
  useEffect(() => {
    if (!apiOnline) return;
    fetch("/api/history").then(r=>r.ok?r.json():null).then(h => {
      if (!h?.availableDates) return;
      const last8 = (h.availableDates as string[]).slice(-8);
      Promise.all(last8.map(d =>
        fetch(`/api/history/routes?date=${d}`).then(r=>r.ok?r.json():{routes:[]}).catch(()=>({routes:[]}))
      )).then(res => {
        setTrendData(last8.map((d,i) => {
          const rts: Route[] = res[i].routes ?? [];
          const stops = rts.reduce((s:number,r:any)=>s+r.stops.length,0);
          const units = rts.reduce((s:number,r:any)=>s+r.stops.reduce((ss:number,st:any)=>ss+st.items.reduce((sss:number,it:any)=>sss+(Number(it.cantidad)||0),0),0),0);
          return { d:d.slice(5), stops, units };
        }));
      });
    });
  }, [apiOnline]);

  const maxTrendStops = useMemo(() => Math.max(...trendData.map(t=>t.stops),1), [trendData]);

  // ── Phase label ────────────────────────────────────────────────────────
  const phaseLabel = { morning:"🌅 Pre-salida", day:"🚛 En ruta", close:"📋 Cierre" };
  const phaseColor = { morning:C.gold, day:C.green2, close:C.indigo };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width:"100vw", height:"100vh", display:"flex",
      flexDirection:"column", fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden",
      background: "radial-gradient(1200px 600px at 92% -10%, rgba(225,6,0,.05), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(245,200,66,.06), transparent 60%), repeating-linear-gradient(0deg, rgba(15,17,21,.012) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(15,17,21,.012) 0 1px, transparent 1px 22px), linear-gradient(180deg, #fbf8f4 0%, #f4efe8 100%)",
      padding:"6px 8px", gap:"6px", boxSizing:"border-box", color:C.text,
    }}>

      {/* ══ TOPBAR ══════════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)", border:`1px solid ${C.border}`, borderRadius:12, boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 28px rgba(17,17,17,.06)", position:"relative", overflow:"hidden" }}>

        {/* Row 1 */}
        <div style={{ height:50, display:"flex", alignItems:"center", gap:14, padding:"0 16px" }}>
          {/* Brand — same style as conductor .logo */}
          <div style={{ display:"flex", alignItems:"center", gap:11, flexShrink:0 }}>
            <div style={{ position:"relative", width:34, height:34, borderRadius:9,
              background:"radial-gradient(80% 80% at 30% 20%, #ff5544 0%, transparent 55%), linear-gradient(160deg, #ff3a28 0%, #e10600 45%, #b00500 100%)",
              display:"flex", alignItems:"center", justifyContent:"center",
              border:"1px solid rgba(245,200,66,.45)",
              boxShadow:"0 0 0 1px rgba(225,6,0,.18), 0 8px 18px rgba(225,6,0,.32), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 5px rgba(122,5,0,.55)",
              flexShrink:0 }}>
              <svg width="17" height="17" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={C.gold}/></svg>
            </div>
            <div>
              <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>DDI Mollet · Supervisor</div>
              <div style={{ color:C.muted, fontSize:9, letterSpacing:".04em", textTransform:"uppercase", fontWeight:600 }}>Control operaciones reparto</div>
            </div>
          </div>

          <div style={{ width:1, height:28, background:C.border2, flexShrink:0 }}/>

          {/* Phase toggle */}
          <div style={{ display:"flex", gap:2, background:"linear-gradient(180deg,#f4efe7 0%,#efe8dd 100%)", borderRadius:9, padding:3,
            border:`1px solid ${C.border}`, flexShrink:0,
            boxShadow:"inset 0 1px 2px rgba(0,0,0,.04)" }}>
            {(["morning","day","close"] as Phase[]).map(p => (
              <button key={p} onClick={()=>setPhase(p)} style={{
                padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer", fontWeight:700,
                fontSize:10, transition:"all .15s",
                background: phase===p
                  ? "linear-gradient(180deg,#ff3a28 0%,#e10600 50%,#b00500 100%)"
                  : "transparent",
                color: phase===p ? "#fff" : C.muted,
                boxShadow: phase===p
                  ? "0 0 0 1px rgba(245,200,66,.4), 0 6px 14px rgba(225,6,0,.34), inset 0 1px 0 rgba(255,255,255,.28)"
                  : "none",
              }}>{phaseLabel[p]}</button>
            ))}
          </div>

          {/* Date */}
          <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
            <span style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Fecha</span>
            <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{
              background:C.surface, border:`1px solid ${C.border2}`, color:C.text,
              borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", fontWeight:600,
            }}>
              {availableDates.map(d=><option key={d} value={d}>{d.split("-").reverse().join("/")}</option>)}
              {!availableDates.length && <option>Cargando…</option>}
            </select>
          </div>

          {/* Route filter */}
          {availableRoutes.length > 1 && (
            <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
              <span style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Ruta</span>
              <select value={filterRoute} onChange={e=>setFilterRoute(e.target.value)} style={{
                background:C.surface, border:`1px solid ${C.border2}`, color:C.text,
                borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", fontWeight:600,
              }}>
                <option value="all">Todas ({driverStats.length})</option>
                {availableRoutes.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex:1 }}/>

          {/* Tab toggle */}
          <div style={{ display:"flex", gap:2, background:"linear-gradient(180deg,#f4efe7 0%,#efe8dd 100%)", borderRadius:9, padding:3,
            border:`1px solid ${C.border}`, flexShrink:0,
            boxShadow:"inset 0 1px 2px rgba(0,0,0,.04)" }}>
            {([["ops","🗺 Mapa"],["analytics","📊 Analytics"]] as const).map(([t,l]) => (
              <button key={t} onClick={()=>setActiveTab(t)} style={{
                padding:"5px 14px", borderRadius:7, border:"none", cursor:"pointer",
                background:activeTab===t
                  ? "linear-gradient(180deg,#ff3a28 0%,#e10600 50%,#b00500 100%)"
                  : "transparent",
                color:activeTab===t?"#fff":C.muted, fontSize:11, fontWeight:700, transition:"all .15s",
                boxShadow:activeTab===t
                  ? "0 0 0 1px rgba(245,200,66,.4), 0 6px 14px rgba(225,6,0,.34), inset 0 1px 0 rgba(255,255,255,.28)"
                  : "none",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ width:1, height:28, background:C.border2, flexShrink:0 }}/>
          <button onClick={onBack} style={{ padding:"5px 13px", borderRadius:8,
            border:`1px solid ${C.border}`, background:"transparent", color:C.muted,
            fontSize:11, cursor:"pointer", flexShrink:0, fontWeight:700 }}>← Conductor</button>
        </div>

        {/* Row 2: KPI tiles */}
        <div style={{ display:"flex", gap:8, padding:"10px 16px 14px", overflowX:"auto",
          borderTop:`1px solid ${C.border2}` }}>
          <KpiTile icon="🚛" label="Repartidores" value={kpis.drivers}
            sub={`${routes.length} rutas activas`} color={C.red}/>
          <KpiTile icon="📍" label="Paradas" value={fmtNum(kpis.stops)}
            sub={`${fmtNum(kpis.totalUnits)} unidades`}/>
          <KpiTile icon="⚖" label="Carga flota" value={fmtKg(kpis.weightKg)}
            sub={`${kpis.avgLoad}% vehículo medio`} color={kpis.weightKg>60000?C.amber:C.text}/>
          <KpiTile icon="🍺" label="Barriles" value={kpis.barrels}
            sub={`~${fmtKg(kpis.barrels*58)}`} color={C.purple}/>
          <KpiTile icon="♻" label="Retornables" value={fmtNum(kpis.returnables)}
            sub="unidades" color={C.teal}/>
          <KpiTile icon="💶" label="Efectivo expuesto" value={fmtEuro(kpis.cashExposure)}
            sub="aprox. total contado" color={kpis.cashExposure>8000?C.amber:C.green}/>
          {kpis.overloaded>0 && (
            <KpiTile icon="⚠" label="Sobrecargados" value={kpis.overloaded}
              sub=">24 paradas" color={C.red}/>
          )}
          {loading && (
            <div style={{ display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:12,
              padding:"10px 10px",flexShrink:0 }}>
              <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${C.border2}`,
                borderTopColor:C.red,animation:"spin 1s linear infinite" }}/>
              Cargando…
            </div>
          )}
        </div>
      </div>

      {/* ══ BODY ══════════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden", gap:6 }}>

        {/* ─── LEFT: Alerts + Driver list ─────────────────────────────────────── */}
        <div style={{ width:330, flexShrink:0,
          background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
          border:`1px solid ${C.border}`, borderRadius:10,
          boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)",
          display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ padding:"12px 12px 10px", borderBottom:`1px solid ${C.border2}`, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.red,
                  boxShadow:`0 0 6px ${C.red}` }}/>
                <span style={{ color:C.text, fontSize:10, fontWeight:800, letterSpacing:.3 }}>
                  {alerts.filter(a=>a.sev==="critical").length > 0
                    ? `${alerts.filter(a=>a.sev==="critical").length} Alertas críticas`
                    : "Alertas operativas"}
                </span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:170, overflowY:"auto" }}>
                {alerts.map((a,i) => {
                  const bc = a.sev==="critical"?C.red:a.sev==="warning"?C.amber:C.teal;
                  return (
                    <div key={i} onClick={()=>a.driverId&&setSelectedDriver(a.driverId)}
                      style={{ padding:"8px 10px 8px 12px", borderRadius:9,
                        cursor:a.driverId?"pointer":"default",
                        background:`${bc}08`,
                        border:`1px solid ${bc}25`,
                        display:"flex", gap:8, alignItems:"flex-start",
                        borderLeft:`3px solid ${bc}`,
                        transition:"background .12s" }}>
                      <span style={{ fontSize:14, flexShrink:0, lineHeight:1.2 }}>{a.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:C.text, fontSize:10, fontWeight:700, lineHeight:1.3,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.title}</div>
                        <div style={{ color:C.muted, fontSize:9, marginTop:2, lineHeight:1.4 }}>{a.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phase-specific banner */}
          {phase === "morning" && (
            <div style={{ padding:"8px 12px", background:`${C.gold}0C`,
              borderBottom:`1px solid ${C.gold}20`, flexShrink:0 }}>
              <div style={{ color:C.gold, fontSize:10, fontWeight:800 }}>🌅 Pre-salida · Check de carga</div>
              <div style={{ color:C.muted, fontSize:9, marginTop:2 }}>
                Verifica peso, barriles y efectivo antes de que salgan los camiones
              </div>
            </div>
          )}
          {phase === "close" && (
            <div style={{ padding:"8px 12px", background:`${C.indigo}0C`,
              borderBottom:`1px solid ${C.indigo}20`, flexShrink:0 }}>
              <div style={{ color:C.indigo, fontSize:10, fontWeight:800 }}>📋 Cierre · Reconciliación</div>
              <div style={{ color:C.muted, fontSize:9, marginTop:2 }}>
                Revisa efectivo entregado, barriles retornados y desvíos
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ padding:"10px 12px 7px", flexShrink:0, display:"flex",
            justifyContent:"space-between", alignItems:"center",
            borderBottom:`1px solid ${C.border2}` }}>
            <span style={{ color:C.muted, fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:"uppercase" }}>
              🚛 Repartidores · {filteredStats.length}
            </span>
            {selectedDriver && (
              <button onClick={()=>setSelectedDriver(null)}
                style={{ background:"rgba(225,6,0,.07)", border:"1px solid rgba(225,6,0,.18)",
                  color:C.red, fontSize:9, fontWeight:800, cursor:"pointer",
                  padding:"2px 8px", borderRadius:6 }}>
                × Limpiar
              </button>
            )}
          </div>

          {/* Driver cards */}
          <div style={{ flex:1, overflowY:"auto", padding:"8px 8px 12px" }}>
            {!loading && filteredStats.length === 0 && (
              <div style={{ padding:"28px 10px", color:C.muted, fontSize:12, textAlign:"center" }}>
                {apiOnline===false ? "API offline" : "Sin rutas para esta fecha"}
              </div>
            )}
            {filteredStats.map(d => {
              const isSel = selectedDriver === d.id;
              const loadPct = Math.min(d.stops / (filteredStats[0]?.stops ?? 1) * 100, 100);
              return (
                <div key={d.id} onClick={()=>setSelectedDriver(isSel?null:d.id)} style={{
                  borderRadius:14, marginBottom:8, cursor:"pointer",
                  background: isSel
                    ? `rgba(${hexRgb(d.color)},0.06)`
                    : "linear-gradient(180deg,#ffffff 0%,#fdfcfa 100%)",
                  border:`1px solid ${isSel ? d.color : C.border}`,
                  boxShadow: isSel
                    ? `0 0 0 1px ${d.color}20, 0 8px 24px rgba(17,17,17,.07)`
                    : "0 2px 10px rgba(17,17,17,.04)",
                  transition:"all .18s",
                  overflow:"hidden",
                }}>
                  {/* Top accent line with driver color */}
                  <div style={{ height:3, background:d.color, opacity: isSel ? 1 : 0.55 }}/>

                  <div style={{ padding:"12px 14px 11px" }}>
                    {/* Row 1: Avatar + name + stops count */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:40, height:40, borderRadius:11, background:d.color,
                        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#fff", fontWeight:900, fontSize:14,
                        boxShadow:`0 4px 14px ${d.color}44` }}>
                        {initials(d.name)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {shortName(d.name)}
                        </div>
                        <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap", alignItems:"center" }}>
                          {d.routes.map(r=>(
                            <span key={r} style={{ color:d.color, fontSize:9, fontWeight:800,
                              background:`${d.color}14`, padding:"2px 8px", borderRadius:20,
                              border:`1px solid ${d.color}28`, letterSpacing:.3 }}>{r}</span>
                          ))}
                          {d.overloaded && (
                            <span style={{ color:C.red, fontSize:9, fontWeight:800,
                              background:"rgba(225,6,0,.08)", padding:"2px 8px", borderRadius:20,
                              border:"1px solid rgba(225,6,0,.22)" }}>⚠ Sobrecarga</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ color:d.overloaded?C.red:C.text, fontWeight:900, fontSize:22,
                          lineHeight:1, fontVariantNumeric:"tabular-nums", letterSpacing:"-.02em" }}>
                          {d.stops}
                        </div>
                        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase",
                          letterSpacing:.5, marginTop:2 }}>paradas</div>
                      </div>
                    </div>

                    {/* Row 2: Load bar with label */}
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>
                          Carga relativa
                        </span>
                        <span style={{ color:d.overloaded?C.red:C.muted2, fontSize:9, fontWeight:800 }}>
                          {Math.round(loadPct)}%
                        </span>
                      </div>
                      <div style={{ height:6, background:C.card2, borderRadius:999, overflow:"hidden",
                        border:`1px solid ${C.border2}` }}>
                        <div style={{ height:"100%", width:`${loadPct}%`,
                          background:d.overloaded
                            ? "linear-gradient(90deg,#e10600,#b00500)"
                            : d.color,
                          borderRadius:999, transition:"width .5s cubic-bezier(.4,0,.2,1)" }}/>
                      </div>
                    </div>

                    {/* Row 3: Key stats inline */}
                    <div style={{ display:"flex", gap:6 }}>
                      {[
                        { ico:"📦", v:fmtNum(d.totalUnits), l:"uds", c:C.text },
                        { ico:"⚖", v:fmtKg(d.weightKg), l:"carga", c:d.vehicleLoadPct>85?C.amber:C.muted2 },
                        { ico:"🕐", v:d.estimatedFinish, l:"fin est.", c:d.overloaded?C.red:C.muted2 },
                      ].map(k => (
                        <div key={k.l} style={{ flex:1, background:C.card2, borderRadius:9, padding:"7px 8px",
                          border:`1px solid ${C.border2}`, textAlign:"center" }}>
                          <div style={{ fontSize:13, lineHeight:1, marginBottom:3 }}>{k.ico}</div>
                          <div style={{ color:k.c, fontSize:12, fontWeight:900, fontVariantNumeric:"tabular-nums",
                            letterSpacing:"-.01em" }}>{k.v}</div>
                          <div style={{ color:C.muted, fontSize:8, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:.4, marginTop:2 }}>{k.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Row 4: Badges (only if notable) */}
                    {(d.barrelUnits>0 || d.contadoStops>0 || d.returnableUnits>0) && (
                      <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                        {d.barrelUnits>0 && <Pill text={`🍺 ${d.barrelUnits} bar`} color={C.purple}/>}
                        {d.contadoStops>0 && <Pill text={`💶 ${fmtEuro(d.cashExposure)}`} color={C.amber}/>}
                        {d.returnableUnits>0 && <Pill text={`♻ ${d.returnableUnits}`} color={C.teal}/>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── CENTER ─────────────────────────────────────────────────────────── */}
        <div style={{ flex:1, minWidth:0, position:"relative", overflow:"hidden", borderRadius:10, border:`1px solid ${C.border}`, boxShadow:"0 8px 22px rgba(17,17,17,.05)" }}>

          {/* MAP */}
          <div ref={mapContainer} style={{ width:"100%",height:"100%",
            display:activeTab==="ops"?"block":"none" }}/>

          {activeTab==="ops" && !loading && routes.length===0 && apiOnline!==false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              background:"rgba(255,255,255,.97)",border:`1px solid ${C.border}`,borderRadius:14,
              padding:"28px 36px",textAlign:"center",boxShadow:"0 12px 28px rgba(17,17,17,.08)" }}>
              <div style={{ fontSize:42,marginBottom:10 }}>📭</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16 }}>Sin rutas para esta fecha</div>
              <div style={{ color:C.muted,fontSize:12,marginTop:4 }}>Selecciona otra fecha</div>
            </div>
          )}
          {activeTab==="ops" && apiOnline===false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              background:"rgba(255,255,255,.97)",border:`1px solid rgba(225,6,0,.25)`,
              borderRadius:14,padding:"28px 36px",textAlign:"center",maxWidth:340,
              boxShadow:"0 12px 28px rgba(17,17,17,.08)" }}>
              <div style={{ fontSize:42,marginBottom:10 }}>🔌</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16,marginBottom:8 }}>API no disponible</div>
              <code style={{ color:"#b45309",background:"rgba(245,158,11,.08)",padding:"6px 12px",
                borderRadius:8,fontSize:12,display:"block",border:"1px solid rgba(245,158,11,.2)" }}>npm run dev:api</code>
            </div>
          )}

          {/* Map legend */}
          {activeTab==="ops" && filteredStats.length>0 && (
            <div style={{ position:"absolute",bottom:16,right:16,background:"rgba(255,255,255,.95)",
              border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",
              backdropFilter:"blur(8px)",maxHeight:220,overflowY:"auto",minWidth:180,
              boxShadow:"0 8px 22px rgba(17,17,17,.08)" }}>
              <div style={{ color:C.muted,fontSize:9,fontWeight:800,letterSpacing:.7,
                textTransform:"uppercase",marginBottom:7 }}>Repartidores activos</div>
              {filteredStats.map(d => (
                <div key={d.id} onClick={()=>setSelectedDriver(selectedDriver===d.id?null:d.id)}
                  style={{ display:"flex",alignItems:"center",gap:7,marginBottom:5,
                    cursor:"pointer",opacity:selectedDriver!==null&&selectedDriver!==d.id?0.3:1,
                    transition:"opacity .15s" }}>
                  <div style={{ width:16,height:3,borderRadius:2,background:d.color,flexShrink:0 }}/>
                  <span style={{ color:C.text,fontSize:10,flex:1 }}>{shortName(d.name)}</span>
                  <span style={{ color:C.muted,fontSize:9,flexShrink:0 }}>{d.stops}p</span>
                </div>
              ))}
            </div>
          )}

          {/* ANALYTICS */}
          {activeTab==="analytics" && (
            <div style={{ width:"100%", height:"100%", overflowY:"auto", padding:"14px 16px",
              display:"flex", flexDirection:"column", gap:14,
              background:"radial-gradient(1200px 600px at 92% -10%, rgba(225,6,0,.04), transparent 60%), linear-gradient(180deg,#fbf8f4 0%,#f4efe8 100%)" }}>

              {/* ── Tendencia semanal ── */}
              <div style={{ position:"relative", background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden",
                boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)" }}>
                <span style={{ position:"absolute",left:14,right:14,top:0,height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)" }}/>
                <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.border2}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>📈 Tendencia semanal</div>
                    <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Paradas entregadas — últimas 8 jornadas</div>
                  </div>
                  <span style={{ background:"rgba(225,6,0,.07)", color:C.red, fontSize:9, fontWeight:800,
                    borderRadius:999, padding:"3px 10px", border:"1px solid rgba(225,6,0,.18)",
                    letterSpacing:".05em", textTransform:"uppercase" }}>
                    {selectedDate.split("-").reverse().join("/")}
                  </span>
                </div>
                <div style={{ padding:"14px 18px 16px" }}>
                  {trendData.length > 0 ? (
                    <>
                      <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:100, marginBottom:8 }}>
                        {trendData.map((t,i) => {
                          const h = maxTrendStops>0 ? Math.max(t.stops/maxTrendStops*100,6) : 6;
                          const isToday = t.d === selectedDate.slice(5);
                          return (
                            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                              <span style={{ color:isToday?C.text:C.muted, fontSize:10, fontWeight:isToday?800:600 }}>{t.stops||""}</span>
                              <div style={{ width:"100%", height:h,
                                background:isToday
                                  ? "linear-gradient(180deg,#ff3a28 0%,#e10600 60%,#b00500 100%)"
                                  : C.blue,
                                borderRadius:"6px 6px 0 0",
                                boxShadow:isToday?"0 4px 12px rgba(225,6,0,.3)":"none",
                                opacity:isToday?1:.7 }}/>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display:"flex", gap:5, borderTop:`1px solid ${C.border2}`, paddingTop:7 }}>
                        {trendData.map((t,i) => {
                          const isToday = t.d === selectedDate.slice(5);
                          return (
                            <div key={i} style={{ flex:1, textAlign:"center",
                              color:isToday?C.red:C.muted, fontSize:9, fontWeight:isToday?800:400 }}>{t.d}</div>
                          );
                        })}
                      </div>
                    </>
                  ) : <div style={{ color:C.muted, fontSize:12, padding:"20px 0", textAlign:"center" }}>Cargando datos…</div>}
                </div>
              </div>

              {/* ── Balance de carga ── */}
              <div style={{ position:"relative", background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden",
                boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)" }}>
                <span style={{ position:"absolute",left:14,right:14,top:0,height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)" }}/>
                <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.border2}` }}>
                  <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>
                    ⚖ Balance de carga — {selectedDate.split("-").reverse().join("/")}
                  </div>
                  <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Paradas · Unidades · Peso estimado · Fin estimado</div>
                </div>
                <div style={{ padding:"12px 18px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                  {driverStats.map((d,i) => (
                    <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ color:C.muted, fontSize:9, width:18, textAlign:"right", flexShrink:0, fontWeight:700 }}>#{i+1}</span>
                      <div style={{ width:8, height:8, borderRadius:3, background:d.color, flexShrink:0 }}/>
                      <span style={{ color:C.text, fontSize:11, fontWeight:700, width:90, flexShrink:0,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                      <div style={{ flex:1, position:"relative", height:20, background:C.card2,
                        borderRadius:6, overflow:"hidden", border:`1px solid ${C.border2}` }}>
                        <div style={{ position:"absolute", top:0, left:0, height:"100%",
                          width:`${d.loadScore}%`,
                          background:d.overloaded
                            ? "linear-gradient(90deg,#e10600,#b00500)"
                            : d.color,
                          borderRadius:5, opacity:.85, transition:"width .5s" }}/>
                        <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                          color:C.muted2, fontSize:9, fontWeight:700, zIndex:1 }}>
                          {d.stops}p · {fmtNum(d.totalUnits)} uds · {fmtKg(d.weightKg)}
                        </span>
                      </div>
                      <span style={{ color:d.overloaded?C.red:C.muted, fontSize:10,
                        width:44, textAlign:"right", flexShrink:0, fontWeight:d.overloaded?800:500 }}>
                        {d.estimatedFinish}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Mix de producto ── */}
              <div style={{ position:"relative", background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden",
                boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)" }}>
                <span style={{ position:"absolute",left:14,right:14,top:0,height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)" }}/>
                <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.border2}` }}>
                  <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>📦 Mix de producto por repartidor</div>
                  <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Barriles · Cajas · Otros</div>
                </div>
                <div style={{ padding:"12px 18px 16px", display:"flex", flexDirection:"column", gap:7 }}>
                  {driverStats.map(d => {
                    const total = Math.max(d.barrelUnits + d.crateUnits + (d.totalUnits - d.barrelUnits - d.crateUnits), 1);
                    const pBar   = d.barrelUnits/total*100;
                    const pCrate = d.crateUnits/total*100;
                    const pOther = Math.max(100 - pBar - pCrate, 0);
                    return (
                      <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ color:C.text, fontSize:11, fontWeight:600, width:90, flexShrink:0,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                        <div style={{ flex:1, height:16, borderRadius:6, overflow:"hidden",
                          display:"flex", background:C.card2, border:`1px solid ${C.border2}` }}>
                          {pBar>0&&<div style={{ flex:pBar, background:C.purple, minWidth:3 }}/>}
                          {pCrate>0&&<div style={{ flex:pCrate, background:C.blue }}/>}
                          {pOther>0&&<div style={{ flex:pOther, background:"rgba(15,17,21,.1)" }}/>}
                        </div>
                        <span style={{ color:C.muted, fontSize:9, width:80, textAlign:"right", flexShrink:0 }}>
                          🍺{d.barrelUnits} · 📦{fmtNum(d.crateUnits)}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ display:"flex", gap:14, marginTop:4, paddingTop:10, borderTop:`1px solid ${C.border2}` }}>
                    {([[C.purple,"🍺 Barriles"],[C.blue,"📦 Cajas"],["rgba(15,17,21,.15)","· Otros"]] as [string,string][]).map(([c,l])=>(
                      <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:c, border:`1px solid ${C.border}` }}/>
                        <span style={{ color:C.muted, fontSize:10, fontWeight:600 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Exposición de efectivo ── */}
              <div style={{ position:"relative", background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden",
                boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)" }}>
                <span style={{ position:"absolute",left:14,right:14,top:0,height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)" }}/>
                <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.border2}` }}>
                  <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>💶 Exposición de efectivo</div>
                  <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Estimación cobros CONTADO · ~88€/parada media</div>
                </div>
                <div style={{ padding:"12px 18px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                  {driverStats.filter(d=>d.cashExposure>0).sort((a,b)=>b.cashExposure-a.cashExposure).map(d => {
                    const maxCash = Math.max(...driverStats.map(x=>x.cashExposure), 1);
                    const pct = d.cashExposure/maxCash*100;
                    return (
                      <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ color:C.text, fontSize:11, fontWeight:700, width:90, flexShrink:0,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                        <div style={{ flex:1, height:20, background:C.card2, borderRadius:6,
                          overflow:"hidden", position:"relative", border:`1px solid ${C.border2}` }}>
                          <div style={{ height:"100%", width:`${pct}%`,
                            background:d.cashExposure>=800
                              ? "linear-gradient(90deg,#e10600,#b00500)"
                              : "linear-gradient(90deg,#f59e0b,#d97706)",
                            borderRadius:5, opacity:.85 }}/>
                          <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                            color:C.muted2, fontSize:9, fontWeight:700 }}>
                            {d.contadoStops} paradas · {fmtEuro(d.cashExposure)}
                          </span>
                        </div>
                        <span style={{ color:d.cashExposure>=800?C.red:C.amber, fontSize:11,
                          fontWeight:800, width:54, textAlign:"right", flexShrink:0 }}>
                          {fmtEuro(d.cashExposure)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Tabla resumen ── */}
              <div style={{ position:"relative", background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
                border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden",
                boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)" }}>
                <span style={{ position:"absolute",left:14,right:14,top:0,height:1,
                  background:"linear-gradient(90deg,transparent,rgba(245,200,66,.55),transparent)" }}/>
                <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.border2}` }}>
                  <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>📋 Resumen completo</div>
                  <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Clic en fila para ver en el mapa</div>
                </div>
                <div style={{ padding:"0 18px 16px", overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, whiteSpace:"nowrap" }}>
                    <thead>
                      <tr>
                        {["Repartidor","Ruta","Paradas","Unidades","Peso","Barriles","Retorn.","Efectivo","Fin est."].map(h=>(
                          <th key={h} style={{ color:C.muted, fontWeight:700, fontSize:9, letterSpacing:.5,
                            textAlign:"left", padding:"10px 12px 8px 0", textTransform:"uppercase",
                            borderBottom:`2px solid ${C.border2}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.map(d => (
                        <tr key={d.id}
                          onClick={()=>{setSelectedDriver(d.id);setActiveTab("ops");}}
                          style={{ borderBottom:`1px solid ${C.border2}`, cursor:"pointer", transition:"background .1s" }}
                          onMouseOver={e=>(e.currentTarget.style.background="rgba(225,6,0,.03)")}
                          onMouseOut={e=>(e.currentTarget.style.background="transparent")}
                        >
                          <td style={{ padding:"8px 12px 8px 0" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <div style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0 }}/>
                              <span style={{ color:C.text, fontWeight:700 }}>{shortName(d.name)}</span>
                            </div>
                          </td>
                          <td style={{ padding:"8px 12px", color:d.color, fontWeight:800 }}>{d.routes.join(", ")}</td>
                          <td style={{ padding:"8px 12px", color:d.overloaded?C.red:C.text, fontWeight:800 }}>{d.stops}</td>
                          <td style={{ padding:"8px 12px", color:C.muted2, fontWeight:600 }}>{fmtNum(d.totalUnits)}</td>
                          <td style={{ padding:"8px 12px", color:d.vehicleLoadPct>85?C.amber:C.muted2 }}>{fmtKg(d.weightKg)}</td>
                          <td style={{ padding:"8px 12px", color:d.barrelUnits>0?C.purple:C.muted }}>{d.barrelUnits||"—"}</td>
                          <td style={{ padding:"8px 12px", color:d.returnableUnits>0?C.teal:C.muted }}>{fmtNum(d.returnableUnits)||"—"}</td>
                          <td style={{ padding:"8px 12px", color:d.cashExposure>=800?C.red:d.cashExposure>0?C.amber:C.muted, fontWeight:d.cashExposure>=800?800:500 }}>{d.cashExposure>0?fmtEuro(d.cashExposure):"—"}</td>
                          <td style={{ padding:"8px 12px", color:d.overloaded?C.red:C.muted, fontWeight:d.overloaded?800:400 }}>{d.estimatedFinish}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:`2px solid ${C.border}` }}>
                        <td style={{ padding:"10px 12px 4px 0", color:C.text, fontWeight:900, fontSize:11 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                            <svg width="10" height="10" viewBox="-7 -7 14 14">
                              <polygon points="0,-7 1.6,-2.2 6.7,-2.2 2.7,0.8 4.1,5.7 0,2.9 -4.1,5.7 -2.7,0.8 -6.7,-2.2 -1.6,-2.2"
                                fill="#f5c842" stroke="#c9a020" strokeWidth=".4"/>
                            </svg>
                            TOTAL
                          </div>
                        </td>
                        <td/>
                        <td style={{ padding:"10px 12px", color:C.red, fontWeight:900 }}>{kpis.stops}</td>
                        <td style={{ padding:"10px 12px", color:C.text, fontWeight:800 }}>{fmtNum(kpis.totalUnits)}</td>
                        <td style={{ padding:"10px 12px", color:C.text, fontWeight:800 }}>{fmtKg(kpis.weightKg)}</td>
                        <td style={{ padding:"10px 12px", color:C.purple, fontWeight:800 }}>{kpis.barrels}</td>
                        <td style={{ padding:"10px 12px", color:C.teal, fontWeight:800 }}>{fmtNum(kpis.returnables)}</td>
                        <td style={{ padding:"10px 12px", color:C.amber, fontWeight:900 }}>{fmtEuro(kpis.cashExposure)}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Driver detail ──────────────────────────────────────────── */}
        {selectedStats && activeTab==="ops" && (
          <div style={{ width:290, flexShrink:0,
            background:"linear-gradient(180deg,#ffffff 0%,#fbf9f6 100%)",
            border:`1px solid ${C.border}`, borderRadius:10,
            boxShadow:"0 1px 0 rgba(255,255,255,.6) inset, 0 8px 22px rgba(17,17,17,.05)",
            display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Driver header */}
            <div style={{ padding:"14px",background:"linear-gradient(180deg,rgba(225,6,0,.025),transparent)",borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ width:42,height:42,borderRadius:11,background:selectedStats.color,
                  flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                  color:"#fff",fontWeight:900,fontSize:14,
                  boxShadow:`0 0 18px ${selectedStats.color}44` }}>
                  {initials(selectedStats.name)}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:C.text,fontWeight:800,fontSize:13,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {selectedStats.name}
                  </div>
                  <div style={{ display:"flex",gap:4,marginTop:3,flexWrap:"wrap" }}>
                    {selectedStats.routes.map(r=>(
                      <span key={r} style={{ color:selectedStats.color,fontSize:10,fontWeight:800,
                        background:`${selectedStats.color}18`,padding:"1px 7px",borderRadius:20 }}>{r}</span>
                    ))}
                    {selectedStats.overloaded&&<span style={{ color:C.red,fontSize:10,fontWeight:700 }}>⚠ Sobrecarga</span>}
                  </div>
                </div>
                <button onClick={()=>setSelectedDriver(null)}
                  style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20,padding:0,lineHeight:1 }}>×</button>
              </div>

              {/* 6 KPIs */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
                {[
                  { l:"Paradas",   v:selectedStats.stops,                      c:C.text,   i:"📍" },
                  { l:"Unidades",  v:fmtNum(selectedStats.totalUnits),          c:C.text,   i:"📦" },
                  { l:"Peso",      v:fmtKg(selectedStats.weightKg),             c:selectedStats.vehicleLoadPct>85?C.amber:C.text, i:"⚖" },
                  { l:"Barriles",  v:selectedStats.barrelUnits||"—",            c:C.purple, i:"🍺" },
                  { l:"Efectivo",  v:fmtEuro(selectedStats.cashExposure)||"—",  c:selectedStats.cashExposure>=800?C.red:C.amber, i:"💶" },
                  { l:"Fin est.",  v:selectedStats.estimatedFinish,             c:selectedStats.overloaded?C.red:C.muted, i:"🕐" },
                ].map(k=>(
                  <div key={k.l} style={{ background:C.surface,borderRadius:8,padding:"7px 8px",border:`1px solid ${C.border}` }}>
                    <div style={{ color:C.muted,fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:.4 }}>{k.i} {k.l}</div>
                    <div style={{ color:k.c,fontWeight:900,fontSize:16,lineHeight:1,marginTop:2 }}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Vehicle load bar */}
              <div style={{ marginTop:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ color:C.muted,fontSize:9,fontWeight:700 }}>Ocupación vehículo</span>
                  <span style={{ color:selectedStats.vehicleLoadPct>85?C.amber:C.muted2,fontSize:9,fontWeight:800 }}>{selectedStats.vehicleLoadPct}%</span>
                </div>
                <ProgressBar value={selectedStats.vehicleLoadPct} max={100}
                  color={selectedStats.vehicleLoadPct>85?C.amber:selectedStats.color} h={6}/>
              </div>

              {/* Cities */}
              <div style={{ marginTop:8,color:C.muted,fontSize:9,lineHeight:1.5 }}>
                📍 {selectedStats.cities.slice(0,5).join(" · ")}
                {selectedStats.cities.length>5?` +${selectedStats.cities.length-5} más`:""}
              </div>
            </div>

            {/* Sub-tabs */}
            <div style={{ display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,flexShrink:0,background:C.surface }}>
              {([["stops","Paradas"],["products","Productos"],["cash","Efectivo"]] as const).map(([t,l])=>(
                <button key={t} onClick={()=>setDetailTab(t)} style={{
                  flex:1, padding:"8px 4px", border:"none", cursor:"pointer",
                  borderBottom:detailTab===t?`2px solid ${selectedStats.color}`:"2px solid transparent",
                  background:"transparent", color:detailTab===t?C.text:C.muted,
                  fontSize:10, fontWeight:700, transition:"all .15s",
                }}>{l}</button>
              ))}
            </div>

            {/* Stop list */}
            {detailTab==="stops" && (
              <div style={{ flex:1,overflowY:"auto",padding:"8px 10px 12px" }}>
                {selectedStats.allStops.map((stop, idx) => {
                  const hasCash   = isContadoClient(stop.clientName);
                  const hasBarrel = stop.items.some(isBarrel);
                  const hasRet    = stop.items.some(isReturnable);
                  const noCoords  = !stop.lat || Math.abs(stop.lat)<0.1;
                  const stopUnits = stop.items.reduce((s,i)=>s+(Number(i.cantidad)||0),0);
                  return (
                    <div key={stop.stopId} style={{ display:"flex",gap:8,marginBottom:5 }}>
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0 }}>
                        <div style={{ width:22,height:22,borderRadius:"50%",flexShrink:0,
                          background:hasBarrel?C.purple:hasCash?C.amber:selectedStats.color,
                          color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:8,fontWeight:900 }}>{idx+1}</div>
                        {idx<selectedStats.allStops.length-1&&(
                          <div style={{ width:1,flex:1,minHeight:5,background:C.border,marginTop:2 }}/>
                        )}
                      </div>
                      <div style={{ flex:1,minWidth:0,paddingBottom:3 }}>
                        <div style={{ color:C.text,fontWeight:600,fontSize:11,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{stop.clientName}</div>
                        <div style={{ color:C.muted,fontSize:9,marginBottom:3 }}>{stop.city}{stop.address?` · ${stop.address.slice(0,24)}`:""}</div>
                        <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
                          {hasCash&&<span style={{ fontSize:8,padding:"1px 5px",borderRadius:3,background:`${C.amber}18`,color:C.amber,fontWeight:700 }}>💶 CONTADO</span>}
                          {hasBarrel&&<span style={{ fontSize:8,padding:"1px 5px",borderRadius:3,background:`${C.purple}18`,color:C.purple,fontWeight:700 }}>🍺 BARRIL</span>}
                          {hasRet&&<span style={{ fontSize:8,padding:"1px 5px",borderRadius:3,background:`${C.teal}18`,color:C.teal,fontWeight:700 }}>♻ RETORN</span>}
                          {noCoords&&<span style={{ fontSize:8,padding:"1px 5px",borderRadius:3,background:"rgba(239,68,68,.12)",color:"#ef4444",fontWeight:700 }}>⚠gps</span>}
                        </div>
                        <div style={{ color:C.muted,fontSize:9,marginTop:2 }}>{stop.items.length} líneas · {stopUnits} uds</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Products breakdown */}
            {detailTab==="products" && (
              <div style={{ flex:1,overflowY:"auto",padding:"10px 12px" }}>
                <div style={{ color:C.muted,fontSize:9,fontWeight:800,letterSpacing:.7,textTransform:"uppercase",marginBottom:10 }}>
                  Top productos por volumen
                </div>
                {(() => {
                  const prodMap = new Map<string, { name:string; units:number; weight:number; isBarrel:boolean }>();
                  for (const stop of selectedStats.allStops) {
                    for (const item of stop.items) {
                      const key = item.material;
                      if (!prodMap.has(key)) prodMap.set(key, { name:item.descripcion, units:0, weight:0, isBarrel:isBarrel(item) });
                      const p = prodMap.get(key)!;
                      p.units += Number(item.cantidad)||0;
                      p.weight += itemWeight(item);
                    }
                  }
                  const sorted = [...prodMap.values()].sort((a,b)=>b.units-a.units).slice(0,20);
                  const maxU = Math.max(...sorted.map(p=>p.units),1);
                  return sorted.map((p,i) => (
                    <div key={i} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                        <span style={{ color:C.muted2,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:6 }}>{p.name}</span>
                        <span style={{ color:p.isBarrel?C.purple:C.text,fontSize:10,fontWeight:700,flexShrink:0 }}>{p.units} {p.isBarrel?"bar":"uds"}</span>
                      </div>
                      <ProgressBar value={p.units} max={maxU}
                        color={p.isBarrel?C.purple:selectedStats.color} h={3}/>
                      <div style={{ color:C.muted,fontSize:8,marginTop:2 }}>{fmtKg(p.weight)}</div>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Cash breakdown */}
            {detailTab==="cash" && (
              <div style={{ flex:1,overflowY:"auto",padding:"10px 12px" }}>
                <div style={{ background:`${C.amber}0C`,border:`1px solid ${C.amber}22`,borderRadius:9,padding:"10px 12px",marginBottom:12 }}>
                  <div style={{ color:C.amber,fontWeight:800,fontSize:13 }}>💶 {fmtEuro(selectedStats.cashExposure)}</div>
                  <div style={{ color:C.muted,fontSize:10,marginTop:2 }}>Estimación total efectivo a cobrar</div>
                  <div style={{ color:C.muted,fontSize:9,marginTop:4 }}>{selectedStats.contadoStops} paradas CONTADO · ~88€ ticket medio</div>
                </div>

                <div style={{ color:C.muted,fontSize:9,fontWeight:800,letterSpacing:.7,textTransform:"uppercase",marginBottom:8 }}>
                  Paradas de cobro en efectivo
                </div>
                {selectedStats.allStops
                  .filter(s => isContadoClient(s.clientName))
                  .map((stop, idx) => {
                    const stopUnits = stop.items.reduce((s,i)=>s+(Number(i.cantidad)||0),0);
                    return (
                      <div key={stop.stopId} style={{ display:"flex",alignItems:"center",gap:8,
                        padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:C.amber,flexShrink:0 }}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ color:C.text,fontSize:11,fontWeight:600,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{stop.clientName}</div>
                          <div style={{ color:C.muted,fontSize:9 }}>{stop.city} · {stopUnits} uds</div>
                        </div>
                        <span style={{ color:C.amber,fontSize:11,fontWeight:800,flexShrink:0 }}>~88€</span>
                      </div>
                    );
                  })}
                {selectedStats.contadoStops === 0 && (
                  <div style={{ color:C.muted,fontSize:12,textAlign:"center",padding:"20px 0" }}>
                    Sin paradas de cobro identificadas
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        .damm-popup .mapboxgl-popup-content {
          background:#fff;
          border:1px solid #e7e2dd;
          border-radius:14px;
          padding:14px 16px;
          box-shadow:0 12px 32px rgba(17,17,17,.1), 0 2px 8px rgba(17,17,17,.06);
          font-family:'Inter',system-ui,sans-serif;
        }
        .damm-popup .mapboxgl-popup-tip { display:none; }
        .damm-popup .mapboxgl-popup-close-button {
          color:#9ca3af; font-size:16px; right:10px; top:8px;
          background:none; border:none; cursor:pointer;
        }
        .mapboxgl-popup-close-button:hover { color:#e10600; }
      `}</style>
    </div>
  );
}
