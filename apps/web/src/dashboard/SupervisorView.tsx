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

mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "";

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:      "#060A12",
  surface: "#0B1020",
  card:    "#101828",
  card2:   "#141E30",
  border:  "rgba(255,255,255,.06)",
  border2: "rgba(255,255,255,.13)",
  text:    "#EEF2FF",
  muted:   "rgba(238,242,255,.38)",
  muted2:  "rgba(238,242,255,.65)",
  red:     "#E32819",
  gold:    "#F5C518",
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
    <div style={{ padding:"10px 16px", borderRadius:10, background:C.card,
      border:`1px solid ${C.border}`, flex:1, minWidth:100 }}>
      <div style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:.7, textTransform:"uppercase", marginBottom:3 }}>
        <span style={{ marginRight:4 }}>{icon}</span>{label}
      </div>
      <div style={{ color:color??C.text, fontWeight:900, fontSize:22, lineHeight:1,
        fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color, h=5, bg="rgba(255,255,255,.05)" }:
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
  const mapRef    = useRef<mapboxgl.Map|null>(null);
  const markersRef= useRef<mapboxgl.Marker[]>([]);
  const sourcesRef= useRef<string[]>([]);
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
      style: "mapbox://styles/mapbox/dark-v11",
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

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    for (const id of sourcesRef.current) {
      ["","glow"].forEach(s => { if(map.getLayer(id+s)) map.removeLayer(id+s); });
      if (map.getSource(id)) map.removeSource(id);
    }
    sourcesRef.current = [];
    if (!routes.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    const DEPOT: [number,number] = [2.213, 41.539];

    // Depot
    const depEl = document.createElement("div");
    depEl.innerHTML = `<div style="width:42px;height:42px;background:#101828;border:2.5px solid ${C.gold};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 24px rgba(245,197,24,.35);cursor:pointer">🏭</div>`;
    new mapboxgl.Marker({ element:depEl, anchor:"center" })
      .setLngLat(DEPOT)
      .setPopup(new mapboxgl.Popup({ offset:22, closeButton:false, maxWidth:"230px" })
        .setHTML(`<div style="background:#101828;border-radius:11px;padding:14px;font-family:'Inter',sans-serif;">
          <div style="color:${C.gold};font-weight:800;font-size:13px;margin-bottom:6px;">🏭 DDI Mollet del Vallès</div>
          <div style="color:#94a3b8;font-size:11px;line-height:1.6;">
            ${kpis.drivers} repartidores activos<br>
            ${fmtNum(kpis.stops)} paradas · ${fmtNum(kpis.totalUnits)} uds.<br>
            ${fmtKg(kpis.weightKg)} carga total flota
          </div>
        </div>`))
      .addTo(map);
    bounds.extend(DEPOT);

    for (const driver of filteredStats) {
      const { color, id } = driver;
      const isSel = selectedDriver === id;
      const isDim = selectedDriver !== null && !isSel;
      const validStops = driver.allStops.filter(s => s.lat && s.lng && Math.abs(s.lat!)>0.1);
      if (!validStops.length) continue;

      const waypoints: [number,number][] = [
        DEPOT,
        ...validStops.map(s => [s.lng!, s.lat!] as [number,number]),
        DEPOT,
      ];

      const sid = `r-${id}`;
      sourcesRef.current.push(sid);
      map.addSource(sid, { type:"geojson", data:{ type:"Feature", properties:{},
        geometry:{ type:"LineString", coordinates:waypoints }}});
      map.addLayer({ id:sid+"glow", type:"line", source:sid,
        layout:{ "line-join":"round","line-cap":"round" },
        paint:{ "line-color":color, "line-width":isSel?22:10, "line-opacity":isDim?0:0.1, "line-blur":10 }
      });
      map.addLayer({ id:sid, type:"line", source:sid,
        layout:{ "line-join":"round","line-cap":"round" },
        paint:{ "line-color":color, "line-width":isSel?3.5:1.8,
          "line-opacity":isDim?0.12:0.9 }
      });
      map.on("click", sid, () => setSelectedDriver(isSel?null:id));
      map.on("mouseenter", sid, () => map.getCanvas().style.cursor="pointer");
      map.on("mouseleave", sid, () => map.getCanvas().style.cursor="");

      // Road route (cached)
      const cacheKey = `${id}|${selectedDate}`;
      const cached = roadCacheRef.current.get(cacheKey);
      if (cached) {
        (map.getSource(sid) as mapboxgl.GeoJSONSource)?.setData({ type:"Feature", properties:{},
          geometry:{ type:"LineString", coordinates:cached }});
      } else {
        fetchRoadRoute(waypoints).then(road => {
          roadCacheRef.current.set(cacheKey, road);
          (map.getSource(sid) as mapboxgl.GeoJSONSource)?.setData({ type:"Feature", properties:{},
            geometry:{ type:"LineString", coordinates:road }});
        });
      }

      // Stop markers
      validStops.forEach((stop, idx) => {
        bounds.extend([stop.lng!, stop.lat!]);
        const hasCash   = isContadoClient(stop.clientName);
        const hasBarrel = stop.items.some(isBarrel);
        const el = document.createElement("div");
        const sz = isSel ? 22 : 11;
        const bc = hasBarrel ? C.purple : hasCash ? C.amber : "rgba(255,255,255,.15)";
        el.style.cssText = `
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${isDim?"#162030":color};
          border:${isSel?"2px":"1.5px"} solid ${bc};
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:900;font-size:${isSel?9:0}px;
          cursor:pointer;opacity:${isDim?0.18:1};
          box-shadow:${isSel?`0 0 14px ${color}55`:"none"};
          transition:all .2s;font-family:'Inter',sans-serif;
        `;
        el.textContent = isSel ? String(idx+1) : "";

        const popup = new mapboxgl.Popup({ offset:13, maxWidth:"270px", closeButton:false })
          .setHTML(`<div style="background:#101828;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;font-family:'Inter',sans-serif;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;">
              <div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;">${idx+1}</div>
              <div style="flex:1;min-width:0;">
                <div style="color:#eef2ff;font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${stop.clientName}</div>
                <div style="color:#475569;font-size:10px;">${stop.address||""} · ${stop.city}</div>
              </div>
            </div>
            <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
              ${hasCash?`<span style="background:rgba(245,158,11,.15);color:#f59e0b;font-size:9px;padding:2px 7px;border-radius:4px;font-weight:700;">💶 CONTADO</span>`:""}
              ${hasBarrel?`<span style="background:rgba(147,51,234,.15);color:#c084fc;font-size:9px;padding:2px 7px;border-radius:4px;font-weight:700;">🍺 BARRIL</span>`:""}
            </div>
            <div style="font-size:10px;color:#64748b;border-top:1px solid rgba(255,255,255,.05);padding-top:7px;margin-top:4px;">
              ${stop.items.slice(0,4).map(i=>`<div style="display:flex;justify-content:space-between;padding:2px 0;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:8px;">${i.descripcion}</span><span style="color:#e2e8f0;font-weight:700;flex-shrink:0;">${i.cantidad} ${i.unidad}</span></div>`).join("")}
              ${stop.items.length>4?`<div style="color:#475569;margin-top:3px;">+${stop.items.length-4} más</div>`:""}
            </div>
            <div style="margin-top:8px;color:#334155;font-size:9px;">${driver.routes.join(", ")} · ${shortName(driver.name)}</div>
          </div>`);

        const marker = new mapboxgl.Marker({ element:el, anchor:"center" })
          .setLngLat([stop.lng!, stop.lat!]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding:{ top:60, bottom:60, left:selectedDriver?330:270, right:selectedDriver?300:50 },
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
    <div style={{ width:"100vw", height:"100vh", background:C.bg, display:"flex",
      flexDirection:"column", fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden" }}>

      {/* ══ TOPBAR ══════════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, background:C.surface, borderBottom:`1px solid ${C.border}` }}>

        {/* Row 1 */}
        <div style={{ height:50, display:"flex", alignItems:"center", gap:14, padding:"0 18px" }}>
          {/* Brand */}
          <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 14px rgba(227,40,25,.45)` }}>
              <svg width="17" height="17" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={C.gold}/></svg>
            </div>
            <div>
              <div style={{ color:C.text, fontWeight:800, fontSize:13 }}>DDI Mollet · Supervisor</div>
              <div style={{ color:C.muted, fontSize:9 }}>Control operaciones reparto</div>
            </div>
          </div>

          <div style={{ width:1, height:28, background:C.border, flexShrink:0 }}/>

          {/* Phase toggle */}
          <div style={{ display:"flex", gap:2, background:C.card, borderRadius:9, padding:3,
            border:`1px solid ${C.border}`, flexShrink:0 }}>
            {(["morning","day","close"] as Phase[]).map(p => (
              <button key={p} onClick={()=>setPhase(p)} style={{
                padding:"4px 12px", borderRadius:7, border:"none", cursor:"pointer", fontWeight:700,
                fontSize:10, transition:"all .15s",
                background: phase===p ? phaseColor[p]+"22" : "transparent",
                color: phase===p ? phaseColor[p] : C.muted,
                outline: phase===p ? `1px solid ${phaseColor[p]}40` : "none",
              }}>{phaseLabel[p]}</button>
            ))}
          </div>

          {/* Date */}
          <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
            <span style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Fecha</span>
            <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{
              background:C.card, border:`1px solid ${C.border2}`, color:C.text,
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
                background:C.card, border:`1px solid ${C.border2}`, color:C.text,
                borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", fontWeight:600,
              }}>
                <option value="all">Todas ({driverStats.length})</option>
                {availableRoutes.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex:1 }}/>

          {/* Tab toggle */}
          <div style={{ display:"flex", gap:2, background:C.card, borderRadius:9, padding:3,
            border:`1px solid ${C.border}`, flexShrink:0 }}>
            {([["ops","🗺 Mapa"],["analytics","📊 Analytics"]] as const).map(([t,l]) => (
              <button key={t} onClick={()=>setActiveTab(t)} style={{
                padding:"4px 14px", borderRadius:7, border:"none", cursor:"pointer",
                background:activeTab===t?C.red:"transparent",
                color:activeTab===t?"#fff":C.muted, fontSize:11, fontWeight:700, transition:"all .15s",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ width:1, height:28, background:C.border, flexShrink:0 }}/>
          <button onClick={onBack} style={{ padding:"5px 13px", borderRadius:8,
            border:`1px solid ${C.border}`, background:"transparent", color:C.muted,
            fontSize:11, cursor:"pointer", flexShrink:0 }}>← Conductor</button>
        </div>

        {/* Row 2: KPI tiles */}
        <div style={{ display:"flex", gap:8, padding:"0 18px 14px", overflowX:"auto" }}>
          <KpiTile icon="🚛" label="Repartidores" value={kpis.drivers}
            sub={`${routes.length} rutas`} color={C.gold}/>
          <KpiTile icon="📍" label="Paradas" value={fmtNum(kpis.stops)}
            sub={`${fmtNum(kpis.totalUnits)} unidades`}/>
          <KpiTile icon="⚖" label="Carga flota" value={fmtKg(kpis.weightKg)}
            sub={`${kpis.avgLoad}% vehículo medio`} color={kpis.weightKg>60000?C.amber:C.text}/>
          <KpiTile icon="🍺" label="Barriles" value={kpis.barrels}
            sub={`~${fmtKg(kpis.barrels*58)}`} color={C.purple}/>
          <KpiTile icon="♻" label="Retornables" value={fmtNum(kpis.returnables)}
            sub="unidades" color={C.teal}/>
          <KpiTile icon="💶" label="Efectivo expuesto" value={fmtEuro(kpis.cashExposure)}
            sub={`aprox. total contado`} color={kpis.cashExposure>8000?C.amber:C.text}/>
          {kpis.overloaded>0 && (
            <KpiTile icon="⚠" label="Sobrecargados" value={kpis.overloaded}
              sub=">24 paradas" color={C.red}/>
          )}
          {loading && (
            <div style={{ display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:12,padding:"0 10px" }}>
              <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${C.border2}`,
                borderTopColor:C.blue,animation:"spin 1s linear infinite" }}/>
              Cargando datos…
            </div>
          )}
        </div>
      </div>

      {/* ══ BODY ══════════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>

        {/* ─── LEFT: Alerts + Driver list ─────────────────────────────────────── */}
        <div style={{ width:268, flexShrink:0, background:C.surface,
          borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ padding:"10px 10px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ color:C.muted, fontSize:9, fontWeight:800, letterSpacing:.8,
                textTransform:"uppercase", marginBottom:6 }}>
                {alerts.filter(a=>a.sev==="critical").length > 0
                  ? `⚠ ${alerts.filter(a=>a.sev==="critical").length} alertas críticas`
                  : "Alertas"}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto" }}>
                {alerts.map((a,i) => {
                  const bc = a.sev==="critical"?C.red:a.sev==="warning"?C.amber:C.teal;
                  return (
                    <div key={i} onClick={()=>a.driverId&&setSelectedDriver(a.driverId)}
                      style={{ padding:"7px 9px", borderRadius:7,
                        cursor:a.driverId?"pointer":"default",
                        background:`${bc}10`, border:`1px solid ${bc}28`,
                        display:"flex", gap:7, alignItems:"flex-start" }}>
                      <span style={{ fontSize:12, flexShrink:0 }}>{a.icon}</span>
                      <div>
                        <div style={{ color:C.muted2, fontSize:10, fontWeight:700, lineHeight:1.3 }}>{a.title}</div>
                        <div style={{ color:C.muted, fontSize:9, marginTop:2, lineHeight:1.3 }}>{a.detail}</div>
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
          <div style={{ padding:"9px 12px 5px", flexShrink:0, display:"flex",
            justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:C.muted, fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:"uppercase" }}>
              Repartidores · {filteredStats.length}
            </span>
            {selectedDriver && (
              <button onClick={()=>setSelectedDriver(null)}
                style={{ background:"none",border:"none",color:C.muted,fontSize:10,cursor:"pointer",padding:0 }}>
                Limpiar ×
              </button>
            )}
          </div>

          {/* Driver cards */}
          <div style={{ flex:1, overflowY:"auto", padding:"0 8px 12px" }}>
            {!loading && filteredStats.length === 0 && (
              <div style={{ padding:"24px 10px", color:C.muted, fontSize:12, textAlign:"center" }}>
                {apiOnline===false
                  ? "API offline\nnpm run dev:api"
                  : "Sin rutas para esta fecha"}
              </div>
            )}
            {filteredStats.map(d => {
              const isSel = selectedDriver === d.id;
              return (
                <div key={d.id} onClick={()=>setSelectedDriver(isSel?null:d.id)} style={{
                  padding:"10px", borderRadius:10, marginBottom:5, cursor:"pointer",
                  background:isSel?`rgba(${hexRgb(d.color)},0.09)`:C.card,
                  border:`1px solid ${isSel?d.color:C.border}`,
                  transition:"all .15s",
                }}>
                  {/* Header row */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <div style={{ width:32,height:32,borderRadius:9,background:d.color,
                      flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      color:"#fff",fontWeight:900,fontSize:11,
                      boxShadow:isSel?`0 0 12px ${d.color}44`:"none" }}>
                      {initials(d.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:C.text,fontWeight:700,fontSize:12,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {shortName(d.name)}
                      </div>
                      <div style={{ display:"flex",gap:4,marginTop:2,flexWrap:"wrap" }}>
                        {d.routes.map(r=>(
                          <span key={r} style={{ color:d.color,fontSize:9,fontWeight:800,
                            background:`${d.color}18`,padding:"1px 6px",borderRadius:20 }}>{r}</span>
                        ))}
                        {d.overloaded && <span style={{ color:C.red,fontSize:9,fontWeight:800 }}>⚠</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ color:d.overloaded?C.red:C.text,fontWeight:900,fontSize:17,lineHeight:1 }}>{d.stops}</div>
                      <div style={{ color:C.muted,fontSize:8 }}>paradas</div>
                    </div>
                  </div>

                  {/* Load bar */}
                  <ProgressBar value={d.stops} max={filteredStats[0]?.stops??1}
                    color={d.overloaded?C.red:d.color} h={3}/>

                  {/* Stats grid */}
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginTop:7 }}>
                    {[
                      { l:"Unidades", v:fmtNum(d.totalUnits), c:C.muted2 },
                      { l:"Peso", v:fmtKg(d.weightKg), c:d.vehicleLoadPct>85?C.amber:C.muted2 },
                      { l:"Fin est.", v:d.estimatedFinish, c:d.overloaded?C.red:C.muted2 },
                    ].map(k=>(
                      <div key={k.l} style={{ background:C.card2,borderRadius:6,padding:"4px 6px" }}>
                        <div style={{ color:C.muted,fontSize:8,fontWeight:700,letterSpacing:.4,textTransform:"uppercase" }}>{k.l}</div>
                        <div style={{ color:k.c,fontSize:11,fontWeight:800,marginTop:1 }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Badges */}
                  <div style={{ display:"flex",gap:4,marginTop:6,flexWrap:"wrap" }}>
                    {d.barrelUnits>0 && <Pill text={`🍺 ${d.barrelUnits} bar`} color={C.purple}/>}
                    {d.contadoStops>0 && <Pill text={`💶 ${fmtEuro(d.cashExposure)}`} color={C.amber}/>}
                    {d.returnableUnits>0 && <Pill text={`♻ ${d.returnableUnits}`} color={C.teal}/>}
                    {d.geocodedPct < 70 && <Pill text={`📍 ${d.geocodedPct}%`} color={C.red}/>}
                  </div>

                  {/* Cities */}
                  <div style={{ color:C.muted,fontSize:9,marginTop:5,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    📍 {d.cities.slice(0,3).join(" · ")}
                    {d.cities.length>3?` +${d.cities.length-3}`:""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── CENTER ─────────────────────────────────────────────────────────── */}
        <div style={{ flex:1, minWidth:0, position:"relative", overflow:"hidden" }}>

          {/* MAP */}
          <div ref={mapContainer} style={{ width:"100%",height:"100%",
            display:activeTab==="ops"?"block":"none" }}/>

          {activeTab==="ops" && !loading && routes.length===0 && apiOnline!==false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              background:"rgba(6,10,18,.97)",border:`1px solid ${C.border2}`,borderRadius:14,
              padding:"28px 36px",textAlign:"center" }}>
              <div style={{ fontSize:42,marginBottom:10 }}>📭</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16 }}>Sin rutas para esta fecha</div>
              <div style={{ color:C.muted,fontSize:12,marginTop:4 }}>Selecciona otra fecha</div>
            </div>
          )}
          {activeTab==="ops" && apiOnline===false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              background:"rgba(6,10,18,.97)",border:`1px solid rgba(227,40,25,.3)`,
              borderRadius:14,padding:"28px 36px",textAlign:"center",maxWidth:340 }}>
              <div style={{ fontSize:42,marginBottom:10 }}>🔌</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16,marginBottom:8 }}>API no disponible</div>
              <code style={{ color:C.gold,background:"rgba(245,197,24,.08)",padding:"6px 12px",
                borderRadius:8,fontSize:12,display:"block" }}>npm run dev:api</code>
            </div>
          )}

          {/* Map legend */}
          {activeTab==="ops" && filteredStats.length>0 && (
            <div style={{ position:"absolute",bottom:16,right:16,background:"rgba(6,10,18,.92)",
              border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",
              backdropFilter:"blur(8px)",maxHeight:220,overflowY:"auto",minWidth:180 }}>
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
            <div style={{ width:"100%",height:"100%",overflowY:"auto",padding:"20px 22px",
              display:"flex",flexDirection:"column",gap:18 }}>

              {/* Tendencia */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>📈 Tendencia semanal</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:14 }}>Paradas y unidades entregadas — últimas 8 jornadas</div>
                {trendData.length > 0 ? (
                  <div>
                    <div style={{ display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:6 }}>
                      {trendData.map((t,i) => {
                        const h = maxTrendStops>0 ? Math.max(t.stops/maxTrendStops*80,4) : 4;
                        const isToday = t.d === selectedDate.slice(5);
                        return (
                          <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                            <span style={{ color:isToday?C.gold:C.muted,fontSize:10,fontWeight:700 }}>{t.stops||""}</span>
                            <div style={{ width:"100%",height:h,background:isToday?C.gold:C.blue,
                              borderRadius:"4px 4px 0 0",opacity:.85 }}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex",gap:6 }}>
                      {trendData.map((t,i)=>(
                        <div key={i} style={{ flex:1,textAlign:"center",color:C.muted,fontSize:9 }}>{t.d}</div>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ color:C.muted,fontSize:12 }}>Cargando…</div>}
              </div>

              {/* Distribución de carga */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>⚖ Balance de carga — {selectedDate.split("-").reverse().join("/")}</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:14 }}>Paradas · Peso estimado · Fin estimado</div>
                <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                  {driverStats.map((d,i) => (
                    <div key={d.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ color:C.muted,fontSize:10,width:16,textAlign:"right",flexShrink:0 }}>#{i+1}</span>
                      <div style={{ width:10,height:10,borderRadius:3,background:d.color,flexShrink:0 }}/>
                      <span style={{ color:C.text,fontSize:11,fontWeight:600,width:100,flexShrink:0,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                      <div style={{ flex:1,position:"relative",height:18,background:"rgba(255,255,255,.04)",borderRadius:4,overflow:"hidden" }}>
                        <div style={{ position:"absolute",top:0,left:0,height:"100%",
                          width:`${d.loadScore}%`,background:d.overloaded?C.red:d.color,
                          borderRadius:4,opacity:.8,transition:"width .5s" }}/>
                        <span style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
                          color:"rgba(255,255,255,.45)",fontSize:9,fontWeight:700 }}>
                          {d.stops}p · {fmtNum(d.totalUnits)} uds · {fmtKg(d.weightKg)}
                        </span>
                      </div>
                      <span style={{ color:d.overloaded?C.red:C.muted,fontSize:10,
                        width:44,textAlign:"right",flexShrink:0,fontWeight:d.overloaded?700:400 }}>
                        {d.estimatedFinish}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mix de productos */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>📦 Mix de producto por repartidor</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:14 }}>Barriles · Cajas · Retornables por ruta</div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {driverStats.map(d => {
                    const total = d.barrelUnits + d.crateUnits + (d.totalUnits - d.barrelUnits - d.crateUnits);
                    const pBar = total>0 ? d.barrelUnits/total*100 : 0;
                    const pCrate = total>0 ? d.crateUnits/total*100 : 0;
                    const pOther = 100 - pBar - pCrate;
                    return (
                      <div key={d.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ color:C.text,fontSize:10,fontWeight:600,width:90,flexShrink:0,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                        <div style={{ flex:1,height:14,borderRadius:4,overflow:"hidden",display:"flex",gap:1 }}>
                          {pBar>0&&<div style={{ flex:pBar,background:C.purple,minWidth:2,borderRadius:"4px 0 0 4px" }}/>}
                          {pCrate>0&&<div style={{ flex:pCrate,background:C.blue }}/>}
                          {pOther>0&&<div style={{ flex:pOther,background:"rgba(255,255,255,.12)",borderRadius:"0 4px 4px 0" }}/>}
                        </div>
                        <span style={{ color:C.muted,fontSize:9,width:80,textAlign:"right",flexShrink:0 }}>
                          🍺{d.barrelUnits} · 📦{fmtNum(d.crateUnits)}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ display:"flex",gap:12,marginTop:6 }}>
                    {[["🍺","Barriles",C.purple],["📦","Cajas",C.blue],["·","Otros","rgba(255,255,255,.25)"]].map(([ic,l,c])=>(
                      <div key={l as string} style={{ display:"flex",alignItems:"center",gap:5 }}>
                        <div style={{ width:10,height:10,borderRadius:2,background:c as string }}/>
                        <span style={{ color:C.muted,fontSize:10 }}>{ic} {l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Efectivo por repartidor */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>💶 Exposición de efectivo</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:14 }}>Estimación cobros CONTADO · ~88€/parada media</div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {driverStats.filter(d=>d.cashExposure>0).sort((a,b)=>b.cashExposure-a.cashExposure).map(d => {
                    const maxCash = Math.max(...driverStats.map(x=>x.cashExposure),1);
                    return (
                      <div key={d.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ color:C.text,fontSize:11,fontWeight:600,width:90,flexShrink:0,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                        <div style={{ flex:1,height:16,background:"rgba(255,255,255,.04)",borderRadius:4,overflow:"hidden",position:"relative" }}>
                          <div style={{ height:"100%",width:`${d.cashExposure/maxCash*100}%`,
                            background:d.cashExposure>=800?C.red:C.amber,opacity:.8,borderRadius:4 }}/>
                          <span style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
                            color:"rgba(255,255,255,.4)",fontSize:9,fontWeight:700 }}>
                            {d.contadoStops} paradas · {fmtEuro(d.cashExposure)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabla resumen */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:14 }}>📋 Resumen completo</div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,whiteSpace:"nowrap" }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {["Repartidor","Ruta","Paradas","Unidades","Peso","Barriles","Retorn.","Efectivo","Fin est."].map(h=>(
                          <th key={h} style={{ color:C.muted,fontWeight:700,fontSize:9,letterSpacing:.4,
                            textAlign:"left",padding:"0 10px 8px 0",textTransform:"uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.map(d => (
                        <tr key={d.id}
                          onClick={()=>{setSelectedDriver(d.id);setActiveTab("ops");}}
                          style={{ borderBottom:`1px solid ${C.border}`,cursor:"pointer" }}
                          onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.03)")}
                          onMouseOut={e=>(e.currentTarget.style.background="transparent")}
                        >
                          <td style={{ padding:"7px 10px 7px 0" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                              <div style={{ width:7,height:7,borderRadius:2,background:d.color,flexShrink:0 }}/>
                              <span style={{ color:C.text,fontWeight:600 }}>{shortName(d.name)}</span>
                            </div>
                          </td>
                          <td style={{ padding:"7px 10px",color:d.color,fontWeight:700 }}>{d.routes.join(",")}</td>
                          <td style={{ padding:"7px 10px",color:d.overloaded?C.red:C.text,fontWeight:700 }}>{d.stops}</td>
                          <td style={{ padding:"7px 10px",color:C.muted }}>{fmtNum(d.totalUnits)}</td>
                          <td style={{ padding:"7px 10px",color:d.vehicleLoadPct>85?C.amber:C.muted }}>{fmtKg(d.weightKg)}</td>
                          <td style={{ padding:"7px 10px",color:d.barrelUnits>0?C.purple:C.muted }}>{d.barrelUnits||"—"}</td>
                          <td style={{ padding:"7px 10px",color:d.returnableUnits>0?C.teal:C.muted }}>{fmtNum(d.returnableUnits)||"—"}</td>
                          <td style={{ padding:"7px 10px",color:d.cashExposure>=800?C.red:d.cashExposure>0?C.amber:C.muted,fontWeight:d.cashExposure>=800?700:400 }}>{d.cashExposure>0?fmtEuro(d.cashExposure):"—"}</td>
                          <td style={{ padding:"7px 10px",color:d.overloaded?C.red:C.muted,fontWeight:d.overloaded?700:400 }}>{d.estimatedFinish}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:`2px solid ${C.border2}` }}>
                        <td style={{ padding:"10px 10px 0 0",color:C.gold,fontWeight:900,fontSize:12 }}>TOTAL</td>
                        <td/>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.stops}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{fmtNum(kpis.totalUnits)}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{fmtKg(kpis.weightKg)}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.barrels}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{fmtNum(kpis.returnables)}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{fmtEuro(kpis.cashExposure)}</td>
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
          <div style={{ width:290,flexShrink:0,background:C.surface,
            borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden" }}>

            {/* Driver header */}
            <div style={{ padding:"14px",background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
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
            <div style={{ display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
