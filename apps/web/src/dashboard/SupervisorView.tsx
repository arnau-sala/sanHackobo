/**
 * SupervisorView — Centro de Control DDI Mollet
 *
 * Diseñado para el flujo real de un supervisor de reparto:
 * 1. Llega a las 7h — revisa carga del día (rutas, pesos, alertas críticas)
 * 2. Monitoriza en curso — ve dónde hay problemas (cobros, barriles, retrasos)
 * 3. Cierre de jornada — valida lo entregado vs planificado
 *
 * Datos reales: 18 repartidores, 303 paradas, 2837 artículos — 30/03/2026
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "";

// ─── Tokens de diseño ────────────────────────────────────────────────────────
const C = {
  bg:       "#070B14",
  surface:  "#0C1220",
  card:     "#111827",
  border:   "rgba(255,255,255,.06)",
  border2:  "rgba(255,255,255,.12)",
  text:     "#F0F4FF",
  muted:    "rgba(240,244,255,.4)",
  red:      "#E32819",
  gold:     "#F5C842",
  green:    "#22c55e",
  amber:    "#f59e0b",
  blue:     "#3b82f6",
  purple:   "#a78bfa",
  teal:     "#14b8a6",
} as const;

const DRIVER_PALETTE = [
  "#3b82f6","#22c55e","#f59e0b","#e879f9","#14b8a6",
  "#f97316","#06b6d4","#a78bfa","#84cc16","#ec4899",
  "#38bdf8","#4ade80","#fbbf24","#c084fc","#2dd4bf",
  "#fb923c","#e32819","#f5c842",
];

// ─── Types ───────────────────────────────────────────────────────────────────
type Stop = {
  stopId: string; deliveryId: number; sequence: number;
  clientId: number; clientName: string; address: string;
  city: string; cp: string;
  lat: number|null; lng: number|null;
  items: { material: string; descripcion: string; cantidad: number; unidad: string }[];
};
type Route = {
  transportId: number; date: string; route: string;
  driverId: number; driverName: string; stops: Stop[];
};

// ─── Per-driver derived stats ─────────────────────────────────────────────────
type DriverStats = {
  id: number; name: string; route: string; color: string;
  stops: number; items: number;
  contado: number; barrels: number; returnables: number;
  cities: string[]; geocoded: number;
  estimatedFinish: string; overloaded: boolean;
  allStops: Stop[];
  loadScore: number; // 0-100
};

function deriveStats(routes: Route[], colorOf: Map<number,string>): DriverStats[] {
  const byDriver = new Map<number, Route[]>();
  for (const r of routes) {
    if (!byDriver.has(r.driverId)) byDriver.set(r.driverId, []);
    byDriver.get(r.driverId)!.push(r);
  }

  const all: DriverStats[] = [];
  for (const [id, dRoutes] of byDriver) {
    const allStops = dRoutes.flatMap(r => r.stops);
    const name     = dRoutes[0].driverName;
    const route    = dRoutes.map(r => r.route).join(", ");
    const stops    = allStops.length;
    const items    = allStops.reduce((s, st) => s + st.items.length, 0);
    const contado  = allStops.filter(s =>
      /BAR |CAFETER|RESTAUR|HOTEL|TABAC|QUIOSC/.test(s.clientName.toUpperCase())).length;
    const barrels  = allStops.reduce((s, st) =>
      s + st.items.filter(i => /BARRIL|KEG/.test(i.descripcion.toUpperCase())).reduce((ss,i)=>ss+i.cantidad,0), 0);
    const returnables = allStops.reduce((s, st) =>
      s + st.items.filter(i => /\bRET\.?\b|ENVAS|BUIT/.test(i.descripcion.toUpperCase())).reduce((ss,i)=>ss+i.cantidad,0), 0);
    const cities   = [...new Set(allStops.map(s => s.city).filter(Boolean))].slice(0,4);
    const geocoded = allStops.filter(s => s.lat && Math.abs(s.lat) > 0.1).length;

    // Hora fin estimada: salida 7:30, 13min promedio/parada + 45min conducción total
    const totalMin = 7*60+30 + stops*13 + 45;
    const hh = Math.floor(totalMin/60), mm = totalMin%60;
    const estimatedFinish = `${hh}:${String(mm).padStart(2,"0")}`;
    const overloaded = stops >= 24;

    // Load score: relativo al máximo del día
    all.push({ id, name, route, color: colorOf.get(id) ?? C.blue,
      stops, items, contado, barrels, returnables, cities, geocoded,
      estimatedFinish, overloaded, allStops, loadScore: stops });
  }

  const maxStops = Math.max(...all.map(d => d.stops), 1);
  all.forEach(d => { d.loadScore = Math.round(d.stops / maxStops * 100); });
  return all.sort((a,b) => b.stops - a.stops);
}

// ─── Utility ─────────────────────────────────────────────────────────────────
const initials = (n: string) => n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
const shortName = (n: string) => { const p=n.split(" "); return p[0]+" "+(p[1]?p[1][0]+".":""); };
const fmtNum = (n: number) => n>=1000?(n/1000).toFixed(1)+"k":String(n);

// ─── Components ──────────────────────────────────────────────────────────────

// Horizontal bar for load comparison
function LoadBar({ value, max, color, h=6 }: { value:number; max:number; color:string; h?:number }) {
  const w = max>0 ? Math.min(value/max*100,100) : 0;
  return (
    <div style={{ height:h, background:"rgba(255,255,255,.06)", borderRadius:h/2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${w}%`, background:color, borderRadius:h/2, transition:"width .5s ease" }}/>
    </div>
  );
}

// KPI card (top bar)
function KpiCard({ label, value, sub, color, icon, onClick, active }:
  { label:string; value:string|number; sub?:string; color?:string; icon:string; onClick?:()=>void; active?:boolean }) {
  return (
    <div onClick={onClick} style={{
      padding:"12px 18px", borderRadius:12, cursor:onClick?"pointer":"default",
      background: active ? `rgba(${hexRgb(color??C.text)},0.12)` : C.card,
      border:`1px solid ${active ? (color??C.border2) : C.border}`,
      transition:"all .15s", flex:1, minWidth:110,
    }}>
      <div style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", marginBottom:4 }}>
        <span style={{marginRight:5}}>{icon}</span>{label}
      </div>
      <div style={{ color:color??C.text, fontWeight:900, fontSize:24, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ color:C.muted, fontSize:11, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// Stop badge
function Badge({ text, color }: { text:string; color:string }) {
  return (
    <span style={{ padding:"2px 7px", borderRadius:20, fontSize:9, fontWeight:800,
      background:`${color}20`, color, border:`1px solid ${color}40`, letterSpacing:.3 }}>
      {text}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function SupervisorView({ onBack }: { onBack:()=>void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<mapboxgl.Map|null>(null);
  const markersRef= useRef<mapboxgl.Marker[]>([]);
  const sourcesRef= useRef<string[]>([]);
  const roadCacheRef = useRef<Map<string, [number,number][]>>(new Map());

  const [routes,         setRoutes]         = useState<Route[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate,   setSelectedDate]   = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<number|null>(null);
  const [activeTab,      setActiveTab]      = useState<"ops"|"analytics">("ops");
  const [apiOnline,      setApiOnline]      = useState<boolean|null>(null);
  const [loading,        setLoading]        = useState(true);
  const [filterRoute,    setFilterRoute]    = useState<string>("all");
  const [mapReady,       setMapReady]       = useState(false);

  // ── Color map ──────────────────────────────────────────────────────────
  const colorOf = useMemo(() => {
    const m = new Map<number,string>();
    const ids = [...new Set(routes.map(r=>r.driverId))].sort();
    ids.forEach((id,i) => m.set(id, DRIVER_PALETTE[i % DRIVER_PALETTE.length]));
    return m;
  }, [routes]);

  const driverStats = useMemo(() => deriveStats(routes, colorOf), [routes, colorOf]);

  const filteredStats = useMemo(() =>
    filterRoute === "all" ? driverStats : driverStats.filter(d => d.route === filterRoute),
    [driverStats, filterRoute]);

  const selectedDriver = useMemo(() =>
    driverStats.find(d => d.id === selectedDriverId) ?? null,
    [driverStats, selectedDriverId]);

  const availableRoutes = useMemo(() =>
    [...new Set(driverStats.map(d => d.route))].sort(),
    [driverStats]);

  // Global KPIs
  const kpis = useMemo(() => ({
    routes:    routes.length,
    drivers:   new Set(routes.map(r=>r.driverId)).size,
    stops:     driverStats.reduce((s,d)=>s+d.stops, 0),
    items:     driverStats.reduce((s,d)=>s+d.items, 0),
    contado:   driverStats.reduce((s,d)=>s+d.contado, 0),
    barrels:   driverStats.reduce((s,d)=>s+d.barrels, 0),
    returnables:driverStats.reduce((s,d)=>s+d.returnables, 0),
    overloaded:driverStats.filter(d=>d.overloaded).length,
  }), [driverStats, routes.length]);

  // Critical alerts (only the real ones)
  const criticalAlerts = useMemo(() => {
    const a: { icon:string; text:string; driverId?:number; sev:"red"|"amber"|"info" }[] = [];
    driverStats.filter(d=>d.overloaded).forEach(d =>
      a.push({ icon:"🔴", text:`${shortName(d.name)} — ${d.stops} paradas, puede terminar tarde (${d.estimatedFinish})`, driverId:d.id, sev:"red" }));
    driverStats.filter(d=>d.barrels>=8).forEach(d =>
      a.push({ icon:"🍺", text:`${shortName(d.name)} — ${d.barrels} barriles a entregar (carga pesada)`, driverId:d.id, sev:"amber" }));
    driverStats.filter(d=>d.contado>=10).forEach(d =>
      a.push({ icon:"💰", text:`${shortName(d.name)} — ${d.contado} cobros en metálico en ruta`, driverId:d.id, sev:"amber" }));
    if (kpis.returnables > 500)
      a.push({ icon:"♻", text:`${kpis.returnables} retornables estimados en el total de rutas`, sev:"info" });
    return a.slice(0, 8);
  }, [driverStats, kpis]);

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
        // Elegir el día más activo (no el más reciente que puede estar vacío)
        const best = dates.find(d => !d.endsWith("31")) ?? dates[0] ?? "";
        setSelectedDate(best);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedDate || !apiOnline) return;
    setRoutes([]); setSelectedDriverId(null);
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
      center: [2.28, 41.62],
      zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch:false }), "top-right");
    map.on("load", () => { mapRef.current = map; setMapReady(true); });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Mapbox Directions API: fetch real road route ───────────────────────
  async function fetchRoadRoute(waypoints: [number,number][]): Promise<[number,number][]> {
    if (waypoints.length < 2) return waypoints;
    const token = mapboxgl.accessToken;
    if (!token) return waypoints;

    const CHUNK = 25; // Mapbox Directions limit
    const allCoords: [number,number][] = [];

    for (let i = 0; i < waypoints.length - 1; i += CHUNK - 1) {
      const chunk = waypoints.slice(i, Math.min(i + CHUNK, waypoints.length));
      const coordStr = chunk.map(c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${token}`;
      try {
        const res = await fetch(url);
        const data = await res.json() as any;
        const coords: [number,number][] = data.routes?.[0]?.geometry?.coordinates ?? chunk;
        if (allCoords.length === 0) allCoords.push(...coords);
        else allCoords.push(...coords.slice(1)); // skip first to avoid duplicate junction
      } catch {
        // fallback to straight lines for this chunk
        allCoords.push(...chunk);
      }
    }
    return allCoords.length > 0 ? allCoords : waypoints;
  }

  // ── Draw routes ────────────────────────────────────────────────────────
  const drawMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Cleanup
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    for (const id of sourcesRef.current) {
      ["","glow"].forEach(s => { if(map.getLayer(id+s)) map.removeLayer(id+s); });
      if (map.getSource(id)) map.removeSource(id);
    }
    sourcesRef.current = [];

    if (!routes.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasAny = false;

    // Depot marker
    const depEl = document.createElement("div");
    depEl.innerHTML = `<div style="width:40px;height:40px;background:#111827;border:2px solid ${C.gold};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px rgba(245,200,66,.4);cursor:pointer;">🏭</div>`;
    new mapboxgl.Marker({ element:depEl, anchor:"center" })
      .setLngLat([2.213, 41.539])
      .setPopup(new mapboxgl.Popup({ offset:20, closeButton:false, maxWidth:"220px" })
        .setHTML(`<div style="background:#111827;border-radius:10px;padding:12px;font-family:'Inter',sans-serif;">
          <div style="color:${C.gold};font-weight:800;font-size:13px;margin-bottom:4px;">🏭 DDI Mollet</div>
          <div style="color:#94a3b8;font-size:11px;">Almacén central · Punto de salida</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:4px;">${kpis.drivers} repartidores · ${kpis.stops} paradas</div>
        </div>`))
      .addTo(map);
    bounds.extend([2.213, 41.539]);

    // Draw all stop markers immediately with straight-line placeholders,
    // then async-replace lines with real road routes
    const DEPOT: [number,number] = [2.213, 41.539];

    for (const driver of filteredStats) {
      const color = driver.color;
      const isSel = selectedDriverId === driver.id;
      const isDim = selectedDriverId !== null && !isSel;
      const opacity = isDim ? 0.15 : 0.9;

      const validStops = driver.allStops.filter(s => s.lat && s.lng && Math.abs(s.lat)>0.1);
      if (!validStops.length) continue;

      const waypoints: [number,number][] = [
        DEPOT,
        ...validStops.map(s => [s.lng!, s.lat!] as [number,number]),
        DEPOT, // return to depot
      ];

      const sid = `r-${driver.id}`;
      sourcesRef.current.push(sid);

      // Draw straight placeholder immediately
      map.addSource(sid, { type:"geojson", data:{ type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:waypoints }}});
      map.addLayer({ id:sid+"glow", type:"line", source:sid,
        layout:{ "line-join":"round","line-cap":"round" },
        paint:{ "line-color":color, "line-width":isSel?20:10, "line-opacity":isDim?0:0.1, "line-blur":8 }
      });
      map.addLayer({ id:sid, type:"line", source:sid,
        layout:{ "line-join":"round","line-cap":"round" },
        paint:{ "line-color":color, "line-width":isSel?3.5:1.8, "line-opacity":opacity, "line-dasharray": isDim ? [2,3] : [1] }
      });

      map.on("click", sid, () => setSelectedDriverId(isSel ? null : driver.id));
      map.on("mouseenter", sid, () => map.getCanvas().style.cursor="pointer");
      map.on("mouseleave", sid, () => map.getCanvas().style.cursor="");

      // Async: replace with real road route
      const cacheKey = `${driver.id}|${selectedDate}`;
      const cached = roadCacheRef.current.get(cacheKey);
      if (cached) {
        const src = map.getSource(sid) as mapboxgl.GeoJSONSource | undefined;
        src?.setData({ type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:cached }});
      } else {
        fetchRoadRoute(waypoints).then(roadCoords => {
          roadCacheRef.current.set(cacheKey, roadCoords);
          const src = map.getSource(sid) as mapboxgl.GeoJSONSource | undefined;
          src?.setData({ type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:roadCoords }});
        });
      }

      // Stop markers
      validStops.forEach((stop, idx) => {
        bounds.extend([stop.lng!, stop.lat!]);
        hasAny = true;

        const hasCobro   = /BAR |CAFETER|RESTAUR|HOTEL/.test(stop.clientName.toUpperCase());
        const hasBarrel  = stop.items.some(i => /BARRIL|KEG/.test(i.descripcion.toUpperCase()));
        const isFirst    = idx === 0;

        const el = document.createElement("div");
        const size = isSel ? 22 : 12;
        const borderColor = isFirst ? C.gold : hasCobro ? C.amber : hasBarrel ? "#a78bfa" : "rgba(255,255,255,.2)";
        el.style.cssText = `
          width:${size}px;height:${size}px;border-radius:50%;
          background:${isDim?"#1a2035":color};
          border:${isSel?`2px solid ${borderColor}`:`1.5px solid ${borderColor}`};
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:900;font-size:${isSel?9:7}px;
          cursor:pointer;opacity:${isDim?0.2:1};
          box-shadow:${isSel?`0 0 12px ${color}66`:"none"};
          transition:all .2s;font-family:'Inter',sans-serif;
        `;
        el.textContent = isSel ? String(idx+1) : "";

        const itemsHtml = stop.items.slice(0,5).map(i =>
          `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${i.descripcion}</span>
            <span style="font-size:10px;color:#e2e8f0;font-weight:700;flex-shrink:0;">${i.cantidad} ${i.unidad}</span>
          </div>`).join("");

        const popup = new mapboxgl.Popup({ offset:12, maxWidth:"260px", closeButton:false })
          .setHTML(`<div style="background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;font-family:'Inter',sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;">${idx+1}</div>
              <div>
                <div style="color:#f0f4ff;font-weight:700;font-size:12px;">${stop.clientName}</div>
                <div style="color:#64748b;font-size:10px;">${stop.address||stop.city}</div>
              </div>
            </div>
            <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
              ${hasCobro?`<span style="background:rgba(245,158,11,.15);color:#f59e0b;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">💰 CONTADO</span>`:""}
              ${hasBarrel?`<span style="background:rgba(167,139,250,.15);color:#a78bfa;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">🍺 BARRIL</span>`:""}
            </div>
            ${itemsHtml}
            ${stop.items.length>5?`<div style="color:#64748b;font-size:10px;margin-top:4px;">+${stop.items.length-5} artículos más</div>`:""}
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.05);color:#64748b;font-size:10px;">
              ${driver.route} · ${shortName(driver.name)}
            </div>
          </div>`);

        const marker = new mapboxgl.Marker({ element:el, anchor:"center" })
          .setLngLat([stop.lng!, stop.lat!]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (hasAny && !bounds.isEmpty()) {
      const leftPad = selectedDriverId ? 340 : 280;
      const rightPad = selectedDriverId ? 300 : 60;
      map.fitBounds(bounds, { padding:{ top:60, bottom:60, left:leftPad, right:rightPad }, maxZoom:13, duration:800 });
    }
  }, [routes, filteredStats, selectedDriverId, colorOf, kpis, selectedDate]);

  useEffect(() => {
    if (mapReady) drawMap();
  }, [drawMap, mapReady]);

  // ─── Analytics trend data ────────────────────────────────────────────
  const [trendData, setTrendData] = useState<{d:string; stops:number; routes:number}[]>([]);
  useEffect(() => {
    if (!apiOnline) return;
    fetch("/api/history").then(r=>r.ok?r.json():null).then(h => {
      if (!h?.availableDates) return;
      const last8 = (h.availableDates as string[]).slice(-8);
      Promise.all(last8.map(d =>
        fetch(`/api/history/routes?date=${d}`).then(r=>r.ok?r.json():{routes:[]}).catch(()=>({routes:[]}))
      )).then(res => {
        setTrendData(last8.map((d,i) => ({
          d: d.slice(5),
          stops: (res[i].routes??[]).reduce((s:number,r:any)=>s+r.stops.length,0),
          routes: (res[i].routes??[]).length,
        })));
      });
    });
  }, [apiOnline]);

  const maxTrend = useMemo(() => Math.max(...trendData.map(t=>t.stops), 1), [trendData]);

  return (
    <div style={{ width:"100vw", height:"100vh", background:C.bg, display:"flex", flexDirection:"column", fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden" }}>

      {/* ══ TOPBAR ══════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px" }}>
        {/* Row 1: brand + date + controls */}
        <div style={{ height:48, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 14px rgba(227,40,25,.5)` }}>
              <svg width="18" height="18" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={C.gold}/></svg>
            </div>
            <div>
              <div style={{ color:C.text, fontWeight:800, fontSize:13 }}>DDI Mollet · Supervisor</div>
              <div style={{ color:C.muted, fontSize:10 }}>Control operaciones reparto</div>
            </div>
          </div>

          <div style={{ width:1, height:28, background:C.border }}/>

          {/* Date picker */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Fecha</span>
            <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{
              background:C.card, border:`1px solid ${C.border2}`, color:C.text,
              borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer",
              fontWeight:600,
            }}>
              {availableDates.map(d=>(
                <option key={d} value={d}>{d.split("-").reverse().join("/")}</option>
              ))}
              {!availableDates.length && <option>Cargando…</option>}
            </select>
          </div>

          {/* Route filter */}
          {availableRoutes.length > 1 && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Ruta</span>
              <select value={filterRoute} onChange={e=>setFilterRoute(e.target.value)} style={{
                background:C.card, border:`1px solid ${C.border2}`, color:C.text,
                borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer", fontWeight:600,
              }}>
                <option value="all">Todas ({driverStats.length})</option>
                {availableRoutes.map(r=>(
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ flex:1 }}/>

          {/* Tab selector */}
          <div style={{ display:"flex", gap:2, background:C.card, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
            {([["ops","🗺  Operaciones"],["analytics","📊 Analytics"]] as const).map(([t,l]) => (
              <button key={t} onClick={()=>setActiveTab(t)} style={{
                padding:"5px 16px", borderRadius:8, border:"none",
                background:activeTab===t?C.red:"transparent",
                color:activeTab===t?"#fff":C.muted, fontSize:11, cursor:"pointer", fontWeight:700,
                transition:"all .15s",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ width:1, height:28, background:C.border }}/>
          <button onClick={onBack} style={{ padding:"5px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:11, cursor:"pointer" }}>← Conductor</button>
        </div>

        {/* Row 2: KPI cards */}
        <div style={{ display:"flex", gap:10, paddingBottom:14, paddingTop:4 }}>
          <KpiCard icon="🚚" label="Rutas" value={kpis.routes} sub={`${kpis.drivers} repartidores`} color={C.gold}/>
          <KpiCard icon="📍" label="Paradas" value={fmtNum(kpis.stops)} sub={`${fmtNum(kpis.items)} artículos`}/>
          <KpiCard icon="🍺" label="Barriles" value={kpis.barrels} sub="a entregar" color={C.purple}/>
          <KpiCard icon="♻" label="Retornables" value={fmtNum(kpis.returnables)} sub="estimados" color={C.teal}/>
          <KpiCard icon="💰" label="Cobros" value={kpis.contado} sub="paradas CONTADO" color={kpis.contado>100?C.amber:C.text}/>
          {kpis.overloaded > 0 && (
            <KpiCard icon="⚠" label="Sobrecarga" value={kpis.overloaded} sub={`repartidores >24p`} color={C.red}/>
          )}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:8, color:C.muted, fontSize:12, padding:"0 10px" }}>
              <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${C.border2}`,borderTopColor:C.blue,animation:"spin 1s linear infinite" }}/>
              Cargando...
            </div>
          )}
        </div>
      </div>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>

        {/* ─── LEFT PANEL: driver list ────────────────────────────────────── */}
        <div style={{ width:260, flexShrink:0, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Alerts */}
          {criticalAlerts.length > 0 && (
            <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ color:C.muted, fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:"uppercase", marginBottom:6 }}>Alertas críticas</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:140, overflowY:"auto" }}>
                {criticalAlerts.map((a,i) => (
                  <div key={i} onClick={()=>a.driverId&&setSelectedDriverId(a.driverId)} style={{
                    padding:"6px 8px", borderRadius:7, cursor:a.driverId?"pointer":"default",
                    background:a.sev==="red"?`rgba(227,40,25,.1)`:a.sev==="amber"?`rgba(245,158,11,.08)`:`rgba(20,184,166,.08)`,
                    border:`1px solid ${a.sev==="red"?"rgba(227,40,25,.3)":a.sev==="amber"?"rgba(245,158,11,.2)":"rgba(20,184,166,.2)"}`,
                    display:"flex", gap:6, alignItems:"flex-start",
                  }}>
                    <span style={{ fontSize:11, flexShrink:0 }}>{a.icon}</span>
                    <span style={{ color:C.muted, fontSize:10, lineHeight:1.4 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ padding:"10px 12px 6px", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:C.muted, fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:"uppercase" }}>
                Repartidores · {filteredStats.length}
              </span>
              {selectedDriverId && (
                <button onClick={()=>setSelectedDriverId(null)} style={{ background:"none",border:"none",color:C.muted,fontSize:10,cursor:"pointer",padding:0 }}>Limpiar ×</button>
              )}
            </div>
          </div>

          {/* Driver cards */}
          <div style={{ flex:1, overflowY:"auto", padding:"0 8px 12px" }}>
            {!loading && filteredStats.length === 0 && (
              <div style={{ padding:"20px 8px", color:C.muted, fontSize:12, textAlign:"center" }}>
                {apiOnline===false ? "API offline · inicia npm run dev:api" : "Sin rutas para esta fecha"}
              </div>
            )}
            {filteredStats.map(d => {
              const isSel = selectedDriverId === d.id;
              return (
                <div key={d.id} onClick={()=>setSelectedDriverId(isSel?null:d.id)} style={{
                  padding:"10px 10px 9px", borderRadius:10, marginBottom:5, cursor:"pointer",
                  background:isSel?`rgba(${hexRgb(d.color)},0.1)`:C.card,
                  border:`1px solid ${isSel?d.color:C.border}`,
                  transition:"all .15s",
                }}>
                  {/* Top row */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                    <div style={{ width:32,height:32,borderRadius:9,background:d.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:11, boxShadow:isSel?`0 0 12px ${d.color}55`:"none" }}>
                      {initials(d.name)}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ color:C.text,fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shortName(d.name)}</div>
                      <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:1 }}>
                        <span style={{ color:d.color,fontSize:9,fontWeight:800,background:`${d.color}18`,padding:"1px 6px",borderRadius:20 }}>{d.route}</span>
                        {d.overloaded && <span style={{ color:C.red,fontSize:9,fontWeight:800 }}>⚠</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ color:C.text,fontWeight:900,fontSize:16,lineHeight:1 }}>{d.stops}</div>
                      <div style={{ color:C.muted,fontSize:9 }}>paradas</div>
                    </div>
                  </div>

                  {/* Load bar */}
                  <LoadBar value={d.stops} max={filteredStats[0]?.stops??1} color={d.overloaded?C.red:d.color} h={4}/>

                  {/* Badges row */}
                  <div style={{ display:"flex",gap:5,marginTop:7,flexWrap:"wrap" }}>
                    <span style={{ color:C.muted,fontSize:10 }}>{d.items} art</span>
                    {d.barrels>0 && <Badge text={`🍺 ${d.barrels}`} color={C.purple}/>}
                    {d.contado>0 && <Badge text={`💰 ${d.contado}`} color={C.amber}/>}
                    {d.returnables>0 && <Badge text={`♻ ${d.returnables}`} color={C.teal}/>}
                  </div>

                  {/* Cities */}
                  <div style={{ color:C.muted,fontSize:9,marginTop:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    📍 {d.cities.slice(0,3).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── CENTER: Map or Analytics ───────────────────────────────────── */}
        <div style={{ flex:1, minWidth:0, position:"relative", overflow:"hidden" }}>

          {/* MAP */}
          <div ref={mapContainer} style={{ width:"100%", height:"100%", display:activeTab==="ops"?"block":"none" }}/>

          {/* Map overlays */}
          {activeTab === "ops" && !loading && routes.length===0 && apiOnline!==false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(7,11,20,.95)",border:`1px solid ${C.border2}`,borderRadius:14,padding:"28px 36px",textAlign:"center" }}>
              <div style={{ fontSize:40,marginBottom:10 }}>📭</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16 }}>Sin rutas para esta fecha</div>
              <div style={{ color:C.muted,fontSize:12,marginTop:4 }}>Selecciona otra fecha en el panel</div>
            </div>
          )}
          {activeTab === "ops" && apiOnline===false && (
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(7,11,20,.95)",border:`1px solid rgba(227,40,25,.3)`,borderRadius:14,padding:"28px 36px",textAlign:"center",maxWidth:340 }}>
              <div style={{ fontSize:40,marginBottom:10 }}>🔌</div>
              <div style={{ color:C.text,fontWeight:700,fontSize:16,marginBottom:8 }}>API no disponible</div>
              <code style={{ color:C.gold,background:"rgba(245,200,66,.08)",padding:"6px 12px",borderRadius:8,fontSize:12,display:"block" }}>npm run dev:api</code>
            </div>
          )}

          {/* Map bottom legend */}
          {activeTab === "ops" && filteredStats.length > 0 && (
            <div style={{ position:"absolute",bottom:16,right:16,background:"rgba(7,11,20,.9)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",backdropFilter:"blur(8px)",maxHeight:200,overflowY:"auto",minWidth:180 }}>
              <div style={{ color:C.muted,fontSize:9,fontWeight:800,letterSpacing:.7,textTransform:"uppercase",marginBottom:8 }}>Repartidores</div>
              {filteredStats.map(d => (
                <div key={d.id} onClick={()=>setSelectedDriverId(selectedDriverId===d.id?null:d.id)} style={{ display:"flex",alignItems:"center",gap:7,marginBottom:5,cursor:"pointer",opacity:selectedDriverId!==null&&selectedDriverId!==d.id?0.35:1,transition:"opacity .15s" }}>
                  <div style={{ width:16,height:3,borderRadius:2,background:d.color,flexShrink:0 }}/>
                  <span style={{ color:C.text,fontSize:10,flex:1 }}>{shortName(d.name)}</span>
                  <span style={{ color:C.muted,fontSize:9,flexShrink:0 }}>{d.stops}p</span>
                </div>
              ))}
            </div>
          )}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <div style={{ width:"100%",height:"100%",overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:20 }}>

              {/* Tendencia semanal */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 22px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>📈 Actividad semanal</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:16 }}>Paradas por día — últimas 8 jornadas</div>
                {trendData.length > 0 ? (
                  <div>
                    <div style={{ display:"flex",alignItems:"flex-end",gap:8,height:80,marginBottom:6 }}>
                      {trendData.map((t,i) => {
                        const h = maxTrend>0 ? Math.max(t.stops/maxTrend*80,4) : 4;
                        const isToday = t.d === selectedDate.slice(5);
                        return (
                          <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                            <span style={{ color:isToday?C.gold:C.muted,fontSize:10,fontWeight:700 }}>{t.stops||""}</span>
                            <div style={{ width:"100%",height:h,background:isToday?C.gold:C.blue,borderRadius:"4px 4px 0 0",opacity:.85 }}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      {trendData.map((t,i) => (
                        <div key={i} style={{ flex:1,textAlign:"center",color:C.muted,fontSize:9 }}>{t.d}</div>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ color:C.muted,fontSize:12 }}>Cargando...</div>}
              </div>

              {/* Ranking paradas */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 22px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:2 }}>🏆 Carga por repartidor — {selectedDate.split("-").reverse().join("/")}</div>
                <div style={{ color:C.muted,fontSize:11,marginBottom:14 }}>Paradas asignadas · barra = proporción de carga</div>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {driverStats.map((d,i) => (
                    <div key={d.id} style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <span style={{ color:C.muted,fontSize:10,width:14,flexShrink:0 }}>#{i+1}</span>
                      <div style={{ width:12,height:12,borderRadius:3,background:d.color,flexShrink:0 }}/>
                      <span style={{ color:C.text,fontSize:11,fontWeight:600,width:110,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{shortName(d.name)}</span>
                      <div style={{ flex:1,height:18,background:"rgba(255,255,255,.04)",borderRadius:4,overflow:"hidden",position:"relative" }}>
                        <div style={{ height:"100%",width:`${d.loadScore}%`,background:d.overloaded?C.red:d.color,borderRadius:4,opacity:.85,transition:"width .5s" }}/>
                        <span style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,.5)",fontSize:9,fontWeight:700 }}>{d.stops} p · {d.items} art</span>
                      </div>
                      <span style={{ color:d.overloaded?C.red:C.muted,fontSize:10,width:50,textAlign:"right",flexShrink:0 }}>
                        {d.overloaded?"⚠ ":""}{d.estimatedFinish}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabla completa */}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 22px" }}>
                <div style={{ color:C.text,fontWeight:800,fontSize:14,marginBottom:14 }}>📋 Resumen completo del día</div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,whiteSpace:"nowrap" }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {["Repartidor","Ruta","Paradas","Artículos","Barriles","Retornables","Cobros","Fin est.","Zona"].map(h=>(
                          <th key={h} style={{ color:C.muted,fontWeight:700,fontSize:9,letterSpacing:.5,textAlign:"left",padding:"0 10px 8px 0",textTransform:"uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.map(d => (
                        <tr key={d.id} onClick={()=>{setSelectedDriverId(d.id);setActiveTab("ops");}}
                          style={{ borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"background .1s" }}
                          onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.03)")}
                          onMouseOut={e=>(e.currentTarget.style.background="transparent")}
                        >
                          <td style={{ padding:"8px 10px 8px 0",color:C.text,fontWeight:600 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                              <div style={{ width:8,height:8,borderRadius:2,background:d.color,flexShrink:0 }}/>
                              {shortName(d.name)}
                            </div>
                          </td>
                          <td style={{ padding:"8px 10px",color:d.color,fontWeight:700 }}>{d.route}</td>
                          <td style={{ padding:"8px 10px",color:d.overloaded?C.red:C.text,fontWeight:700 }}>{d.stops}</td>
                          <td style={{ padding:"8px 10px",color:C.muted }}>{d.items}</td>
                          <td style={{ padding:"8px 10px",color:d.barrels>0?C.purple:C.muted }}>{d.barrels||"—"}</td>
                          <td style={{ padding:"8px 10px",color:d.returnables>0?C.teal:C.muted }}>{d.returnables||"—"}</td>
                          <td style={{ padding:"8px 10px",color:d.contado>0?C.amber:C.muted }}>{d.contado||"—"}</td>
                          <td style={{ padding:"8px 10px",color:d.overloaded?C.red:C.muted,fontWeight:d.overloaded?700:400 }}>{d.estimatedFinish}</td>
                          <td style={{ padding:"8px 10px",color:C.muted,fontSize:10 }}>{d.cities[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:`2px solid ${C.border2}` }}>
                        <td style={{ padding:"10px 10px 0 0",color:C.gold,fontWeight:900,fontSize:12 }}>TOTAL</td>
                        <td/>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.stops}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.items}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.barrels}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.returnables}</td>
                        <td style={{ padding:"10px",color:C.gold,fontWeight:900 }}>{kpis.contado}</td>
                        <td/><td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: driver detail ─────────────────────────────────── */}
        {selectedDriver && activeTab === "ops" && (
          <div style={{ width:280,flexShrink:0,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden" }}>

            {/* Driver header */}
            <div style={{ padding:"14px",background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ width:40,height:40,borderRadius:11,background:selectedDriver.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14,boxShadow:`0 0 16px ${selectedDriver.color}55` }}>
                  {initials(selectedDriver.name)}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:C.text,fontWeight:800,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{selectedDriver.name}</div>
                  <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:2 }}>
                    <span style={{ color:selectedDriver.color,fontSize:10,fontWeight:800,background:`${selectedDriver.color}18`,padding:"1px 7px",borderRadius:20 }}>{selectedDriver.route}</span>
                    {selectedDriver.overloaded && <span style={{ color:C.red,fontSize:10,fontWeight:700 }}>⚠ Sobrecarga</span>}
                  </div>
                </div>
                <button onClick={()=>setSelectedDriverId(null)} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0,lineHeight:1 }}>×</button>
              </div>

              {/* KPI grid */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                {[
                  { l:"Paradas",    v:selectedDriver.stops,      c:C.text,   icon:"📍" },
                  { l:"Artículos",  v:selectedDriver.items,      c:C.text,   icon:"📦" },
                  { l:"Barriles",   v:selectedDriver.barrels||"—",c:C.purple, icon:"🍺" },
                  { l:"Cobros",     v:selectedDriver.contado||"—",c:C.amber,  icon:"💰" },
                  { l:"Retornables",v:selectedDriver.returnables||"—",c:C.teal,icon:"♻" },
                  { l:"Fin est.",   v:selectedDriver.estimatedFinish,c:selectedDriver.overloaded?C.red:C.muted,icon:"🕐" },
                ].map(k => (
                  <div key={k.l} style={{ background:C.surface,borderRadius:9,padding:"8px 10px",border:`1px solid ${C.border}` }}>
                    <div style={{ color:C.muted,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:.5 }}>{k.icon} {k.l}</div>
                    <div style={{ color:k.c,fontWeight:900,fontSize:18,lineHeight:1,marginTop:3 }}>{k.v}</div>
                  </div>
                ))}
              </div>

              {/* Zona */}
              <div style={{ marginTop:10,color:C.muted,fontSize:10 }}>
                📍 {selectedDriver.cities.join(" · ")}
              </div>
            </div>

            {/* Stop list header */}
            <div style={{ padding:"10px 14px 4px",flexShrink:0 }}>
              <div style={{ color:C.muted,fontSize:9,fontWeight:800,letterSpacing:.8,textTransform:"uppercase" }}>
                Paradas ({selectedDriver.stops})
              </div>
            </div>

            {/* Stop list */}
            <div style={{ flex:1,overflowY:"auto",padding:"0 10px 12px" }}>
              {selectedDriver.allStops.map((stop, idx) => {
                const hasCobro   = /BAR |CAFETER|RESTAUR|HOTEL/.test(stop.clientName.toUpperCase());
                const hasBarrel  = stop.items.some(i => /BARRIL|KEG/.test(i.descripcion.toUpperCase()));
                const hasRet     = stop.items.some(i => /\bRET\.?\b|ENVAS/.test(i.descripcion.toUpperCase()));
                const noCoords   = !stop.lat || Math.abs(stop.lat) < 0.1;
                return (
                  <div key={stop.stopId} style={{ display:"flex",gap:8,marginBottom:6,position:"relative" }}>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0 }}>
                      <div style={{ width:22,height:22,borderRadius:"50%",background:hasCobro?C.amber:hasBarrel?"#7c3aed":selectedDriver.color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900 }}>{idx+1}</div>
                      {idx<selectedDriver.allStops.length-1 && (
                        <div style={{ width:1,flex:1,minHeight:6,background:C.border,marginTop:2 }}/>
                      )}
                    </div>
                    <div style={{ flex:1,minWidth:0,paddingBottom:4 }}>
                      <div style={{ color:C.text,fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{stop.clientName}</div>
                      <div style={{ color:C.muted,fontSize:9,marginBottom:3 }}>{stop.city}</div>
                      <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                        {hasCobro  && <span style={{ fontSize:8,padding:"1px 5px",borderRadius:4,background:`${C.amber}18`,color:C.amber,fontWeight:700 }}>💰</span>}
                        {hasBarrel && <span style={{ fontSize:8,padding:"1px 5px",borderRadius:4,background:"rgba(124,58,237,.15)",color:"#a78bfa",fontWeight:700 }}>🍺</span>}
                        {hasRet    && <span style={{ fontSize:8,padding:"1px 5px",borderRadius:4,background:`${C.teal}18`,color:C.teal,fontWeight:700 }}>♻</span>}
                        {noCoords  && <span style={{ fontSize:8,padding:"1px 5px",borderRadius:4,background:"rgba(239,68,68,.12)",color:"#ef4444",fontWeight:700 }}>⚠coords</span>}
                      </div>
                      <div style={{ color:C.muted,fontSize:9,marginTop:2 }}>{stop.items.length} art.</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function hexRgb(hex: string): string {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
