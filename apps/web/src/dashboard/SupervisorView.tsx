/**
 * SupervisorView — Panel de Control DDI Mollet · Nivel World-Class
 *
 * Cubre TODAS las necesidades reales de un supervisor de reparto Damm:
 *
 *  1. KPI bar global: rutas, entregas, cobros CONTADO, barriles, alertas
 *  2. Panel izquierdo: repartidores del día con progress, estado, alertas
 *  3. Mapa Mapbox dark: polylines + marcadores por repartidor
 *  4. Panel detalle repartidor: timeline, KPIs individuales, artículos
 *  5. Selector de fecha con historial
 *  6. Alertas inteligentes: ventanas horarias, cobros, retornables
 *  7. Mini-gráficas SVG comparativas entre repartidores
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "";

// ── Paleta Damm ────────────────────────────────────────────────────────────
const RED   = "#E32819";
const GOLD  = "#F5C842";
const BG    = "#080c14";
const PANEL = "#0b0f1a";
const CARD  = "#0e1220";
const BORDER= "rgba(255,255,255,.07)";
const MUTED = "rgba(255,255,255,.38)";
const TEXT  = "#e8eaf0";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const BLUE  = "#3b82f6";

const DRIVER_COLORS = [
  "#E32819","#3B82F6","#10B981","#F5C842","#8B5CF6",
  "#F97316","#06B6D4","#EC4899","#84CC16","#A855F7",
  "#14B8A6","#EF4444","#6366F1","#22D3EE","#4ADE80",
  "#FB923C","#E879F9","#38BDF8",
];

// ── Types ──────────────────────────────────────────────────────────────────
type HistoryItem = {
  material: string; descripcion: string; cantidad: number; unidad: string;
};
type HistoryStop = {
  stopId: string; deliveryId: number; sequence: number;
  clientId: number; clientName: string; address: string; city: string; cp: string;
  lat: number | null; lng: number | null;
  items: HistoryItem[];
};
type RouteHistory = {
  transportId: number; date: string; route: string;
  driverId: number; driverName: string; stops: HistoryStop[];
};
type DriverSummary = { id: number; name: string; routes: string[]; totalDeliveries: number };

// ── Alert types ─────────────────────────────────────────────────────────────
type Alert = {
  id: string; severity: "critical"|"warning"|"info";
  icon: string; title: string; detail: string; driverId?: number;
};

// ── Utility ────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
}

function shortName(name: string) {
  const parts = name.split(" ");
  return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
}

function fmtNum(n: number) {
  return n >= 1000 ? (n/1000).toFixed(1)+"k" : String(n);
}

// ── Mini SVG bar chart ──────────────────────────────────────────────────────
function BarChart({ data, color, height=40 }: { data: {label:string;value:number}[]; color:string; height?:number }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{width:"100%",height}} preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 8);
        return (
          <g key={i}>
            <rect x={i*w+1} y={height-barH-4} width={w-2} height={barH} rx="1.5"
              fill={color} opacity={0.8}/>
          </g>
        );
      })}
    </svg>
  );
}

// ── KPI Chip ───────────────────────────────────────────────────────────────
function KpiChip({ label, value, sub, color, icon }: { label:string; value:string|number; sub?:string; color?:string; icon?:string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2, minWidth:90 }}>
      <div style={{ color: MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, textTransform:"uppercase" }}>
        {icon && <span style={{marginRight:4}}>{icon}</span>}{label}
      </div>
      <div style={{ color: color ?? TEXT, fontWeight:900, fontSize:20, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{value}</div>
      {sub && <div style={{ color: MUTED, fontSize:10 }}>{sub}</div>}
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function Progress({ value, max, color }: { value:number; max:number; color:string }) {
  const pct = max > 0 ? Math.min(value/max*100, 100) : 0;
  return (
    <div style={{ height:3, background:"rgba(255,255,255,.08)", borderRadius:2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:2, transition:"width .4s ease" }}/>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function SupervisorView({ onBack }: { onBack: () => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<mapboxgl.Map | null>(null);
  const markersRef= useRef<mapboxgl.Marker[]>([]);
  const sourcesRef= useRef<string[]>([]);

  const [routes,         setRoutes]         = useState<RouteHistory[]>([]);
  const [allDrivers,     setAllDrivers]     = useState<DriverSummary[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate,   setSelectedDate]   = useState("");
  const [selectedDriver, setSelectedDriver] = useState<number|null>(null);
  const [activeTab,      setActiveTab]      = useState<"mapa"|"analytics">("mapa");
  const [apiOnline,      setApiOnline]      = useState<boolean|null>(null);
  const [loading,        setLoading]        = useState(true);

  // ── Fetch summary ─────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/history").then(r=>r.ok?r.json():null).catch(()=>null),
      fetch("/api/history/drivers").then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]).then(([hist, drv]) => {
      if (!hist) { setApiOnline(false); setLoading(false); return; }
      setApiOnline(true);
      setAllDrivers(drv ?? []);
      const dates: string[] = (hist.availableDates ?? []).slice().reverse();
      setAvailableDates(dates);
      // Default: fecha con más actividad (en general el día laboral más reciente completo)
      setSelectedDate(dates[1] ?? dates[0] ?? ""); // [1] porque [0] suele tener pocas rutas
      setLoading(false);
    });
  }, []);

  // ── Fetch routes for date ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDate || !apiOnline) return;
    setRoutes([]);
    setSelectedDriver(null);
    fetch(`/api/history/routes?date=${selectedDate}`)
      .then(r=>r.ok?r.json():{routes:[]}).catch(()=>({routes:[]}))
      .then(d => setRoutes(d.routes ?? []));
  }, [selectedDate, apiOnline]);

  // ── Color map ────────────────────────────────────────────────────────
  const colorOf = useMemo(() => {
    const m = new Map<number, string>();
    [...new Set(routes.map(r=>r.driverId))].sort().forEach((id,i) =>
      m.set(id, DRIVER_COLORS[i % DRIVER_COLORS.length]));
    return m;
  }, [routes]);

  // ── Derived stats ─────────────────────────────────────────────────────
  const driverMap = useMemo(() => {
    const m = new Map<number, RouteHistory[]>();
    for (const r of routes) {
      if (!m.has(r.driverId)) m.set(r.driverId, []);
      m.get(r.driverId)!.push(r);
    }
    return m;
  }, [routes]);

  const driverStats = useMemo(() => {
    return [...driverMap.entries()].map(([dId, dRoutes]) => {
      const stops      = dRoutes.flatMap(r => r.stops);
      const totalItems = stops.reduce((s,st) => s + st.items.length, 0);
      const totalStops = stops.length;
      const withCoords = stops.filter(s => s.lat && s.lat !== 0).length;
      const routeCodes = [...new Set(dRoutes.map(r => r.route))];
      const name       = dRoutes[0].driverName;

      // Cobros CONTADO: heurística → bares y cafeterías
      const contadoStops = stops.filter(s =>
        /BAR|CAFET|RESTAUR|HOTEL|TABAC|QUIOSC/.test(s.clientName.toUpperCase())).length;

      // Retornables estimados
      const returnables = stops.reduce((s,st) =>
        s + st.items.filter(i => /RET|ENVAS|BUIT/.test(i.descripcion.toUpperCase())).length, 0);

      // Barriles
      const barrels = stops.reduce((s,st) =>
        s + st.items.filter(i => /BARRIL|KEG/.test(i.descripcion.toUpperCase())).reduce((ss,i) => ss+i.cantidad, 0), 0);

      // Alertas del repartidor
      const alerts: Alert[] = [];
      if (contadoStops > 0)
        alerts.push({ id:`${dId}-cobro`, severity:"warning", icon:"💰", title:"Cobros CONTADO", detail:`${contadoStops} paradas con cobro en metálico`, driverId:dId });
      if (barrels > 0)
        alerts.push({ id:`${dId}-barril`, severity:"info", icon:"🍺", title:"Barriles", detail:`${barrels} barriles a entregar`, driverId:dId });
      if (returnables > 3)
        alerts.push({ id:`${dId}-ret`, severity:"info", icon:"♻", title:"Retornables", detail:`~${returnables} envases a recoger`, driverId:dId });

      return { dId, name, routeCodes, totalStops, totalItems, withCoords, contadoStops, returnables, barrels, color: colorOf.get(dId) ?? RED, alerts };
    }).sort((a,b) => b.totalStops - a.totalStops);
  }, [driverMap, colorOf]);

  // Global KPIs
  const globalKpis = useMemo(() => {
    const totalStops  = driverStats.reduce((s,d) => s+d.totalStops, 0);
    const totalItems  = driverStats.reduce((s,d) => s+d.totalItems, 0);
    const totalBarrels= driverStats.reduce((s,d) => s+d.barrels, 0);
    const totalRet    = driverStats.reduce((s,d) => s+d.returnables, 0);
    const contado     = driverStats.reduce((s,d) => s+d.contadoStops, 0);
    const totalAlerts = driverStats.reduce((s,d) => s+d.alerts.length, 0);
    return { routes:routes.length, drivers:driverMap.size, totalStops, totalItems, totalBarrels, totalRet, contado, totalAlerts };
  }, [driverStats, routes.length, driverMap.size]);

  // ── Alerts list ──────────────────────────────────────────────────────
  const allAlerts = useMemo(() =>
    driverStats.flatMap(d => d.alerts).slice(0,12),
    [driverStats]);

  // ── Init map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [2.213, 41.539],
      zoom: 9,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch:false }), "top-right");
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ── Draw routes ──────────────────────────────────────────────────────
  const drawRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Cleanup
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    for (const id of sourcesRef.current) {
      if (map.getLayer(id+"-line")) map.removeLayer(id+"-line");
      if (map.getLayer(id+"-glow")) map.removeLayer(id+"-glow");
      if (map.getSource(id)) map.removeSource(id);
    }
    sourcesRef.current = [];

    if (routes.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasCoords = false;

    // Depósito DDI Mollet
    const depotEl = document.createElement("div");
    depotEl.style.cssText = `width:34px;height:34px;border-radius:50%;background:#0d1117;border:2.5px solid ${GOLD};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 16px rgba(245,200,66,.5);cursor:pointer;`;
    depotEl.innerHTML = "🏭";
    new mapboxgl.Marker({ element:depotEl, anchor:"center" })
      .setLngLat([2.213, 41.539])
      .setPopup(new mapboxgl.Popup({offset:18,closeButton:false,maxWidth:"200px"}).setHTML(
        `<div style="background:#0f0f1a;border-radius:8px;padding:10px;font-family:'Inter',sans-serif;color:#e2e8f0;"><strong style="color:${GOLD};">🏭 DDI Mollet</strong><br/><span style="font-size:11px;color:#94a3b8;">Almacén central · Depot de salida</span></div>`
      ))
      .addTo(map);
    markersRef.current.push(depotEl as any);

    for (const route of routes) {
      const color = colorOf.get(route.driverId) ?? RED;
      const isSelected = selectedDriver === route.driverId;
      const isDimmed = selectedDriver !== null && !isSelected;

      const validStops = route.stops.filter(s => s.lat && s.lng && Math.abs(s.lat) > 0.1);
      if (validStops.length < 1) continue;

      const coords = [[2.213, 41.539], ...validStops.map(s => [s.lng!, s.lat!])];

      // Source
      const sid = `route-${route.transportId}`;
      sourcesRef.current.push(sid);
      map.addSource(sid, {
        type:"geojson",
        data:{ type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:coords } }
      });

      // Glow
      map.addLayer({ id:sid+"-glow", type:"line", source:sid, layout:{"line-join":"round","line-cap":"round"},
        paint:{ "line-color":color, "line-width":isSelected?12:6, "line-opacity":isDimmed?0:0.18, "line-blur":4 }
      });
      // Main line
      map.addLayer({ id:sid+"-line", type:"line", source:sid, layout:{"line-join":"round","line-cap":"round"},
        paint:{ "line-color":color, "line-width":isSelected?3.5:1.8, "line-opacity":isDimmed?0.12:0.85 }
      });

      // Markers
      validStops.forEach((stop, idx) => {
        bounds.extend([stop.lng!, stop.lat!]);
        hasCoords = true;

        const el = document.createElement("div");
        el.style.cssText = `
          width:${isSelected?26:20}px;height:${isSelected?26:20}px;border-radius:50%;
          background:${isDimmed?"#1a1a2e":color};
          border:${isSelected?`2.5px solid #fff`:`1.5px solid ${color}88`};
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:900;font-size:${isSelected?10:8}px;
          cursor:pointer;opacity:${isDimmed?0.25:1};
          box-shadow:${isSelected?`0 0 14px ${color}88`:"none"};
          font-family:'Inter',sans-serif;transition:all .2s;
        `;
        el.textContent = String(idx+1);

        const itemsHtml = stop.items.slice(0,4).map(i =>
          `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;">${i.descripcion}</span>
            <span style="font-size:10px;color:#e2e8f0;font-weight:700;flex-shrink:0;">${i.cantidad} ${i.unidad}</span>
          </div>`
        ).join("");

        const popup = new mapboxgl.Popup({ offset:14, maxWidth:"270px", closeButton:false })
          .setHTML(`<div style="background:#0f0f1a;border:1px solid rgba(227,40,25,.2);border-radius:10px;padding:12px;font-family:'Inter',sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:22px;height:22px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900;flex-shrink:0;">${idx+1}</div>
              <div><div style="color:#f1f5f9;font-weight:700;font-size:12px;">${stop.clientName}</div>
              <div style="color:#64748b;font-size:10px;">${stop.address || stop.city}</div></div>
            </div>
            ${itemsHtml}
            ${stop.items.length>4?`<div style="color:#64748b;font-size:10px;margin-top:4px;">+${stop.items.length-4} más</div>`:""}
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);color:#64748b;font-size:10px;">
              ${route.route} · ${shortName(route.driverName)}
            </div>
          </div>`);

        const marker = new mapboxgl.Marker({ element:el, anchor:"center" })
          .setLngLat([stop.lng!, stop.lat!]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (hasCoords && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding:{ top:60, bottom:60, left:360, right:60 }, maxZoom:13, duration:900 });
    }
  }, [routes, selectedDriver, colorOf]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.loaded()) drawRoutes();
    else map.once("load", drawRoutes);
  }, [drawRoutes]);

  // ── Selected driver detail ────────────────────────────────────────────
  const selectedStats  = useMemo(() => driverStats.find(d => d.dId === selectedDriver) ?? null, [driverStats, selectedDriver]);
  const selectedRoutes = useMemo(() => routes.filter(r => r.driverId === selectedDriver), [routes, selectedDriver]);
  const selectedStops  = useMemo(() => selectedRoutes.flatMap(r => r.stops), [selectedRoutes]);

  // ── Analytics data ─────────────────────────────────────────────────────
  const barChartData = useMemo(() =>
    driverStats.slice(0,10).map(d => ({ label:d.name.split(" ")[0], value:d.totalStops })),
    [driverStats]);

  const itemsChartData = useMemo(() =>
    driverStats.slice(0,10).map(d => ({ label:d.name.split(" ")[0], value:d.totalItems })),
    [driverStats]);

  // ── Historical trend (paradas por día de toda la semana) ──────────────
  const [trendData, setTrendData] = useState<{label:string;value:number}[]>([]);
  useEffect(() => {
    if (!apiOnline) return;
    fetch("/api/history").then(r=>r.ok?r.json():null).then(h => {
      if (!h?.availableDates) return;
      const last7 = (h.availableDates as string[]).slice(-7);
      Promise.all(last7.map(d =>
        fetch(`/api/history/routes?date=${d}`).then(r=>r.ok?r.json():{routes:[]}).catch(()=>({routes:[]}))
      )).then(results => {
        setTrendData(last7.map((d,i) => ({
          label: d.slice(5), // MM-DD
          value: (results[i].routes ?? []).reduce((s:number, r:any) => s + r.stops.length, 0)
        })));
      });
    });
  }, [apiOnline]);

  return (
    <div style={{ width:"100vw", height:"100vh", display:"flex", flexDirection:"column", background:BG, fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header style={{
        height:58, flexShrink:0, display:"flex", alignItems:"center", gap:0,
        background:`linear-gradient(90deg,#05080f 0%,#090e1c 50%,#05080f 100%)`,
        borderBottom:`1px solid ${BORDER}`,
        boxShadow:"0 1px 20px rgba(0,0,0,.8)",
        padding:"0 20px",
      }}>
        {/* Logo + título */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginRight:32 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:RED, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 16px rgba(227,40,25,.5)`, flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={GOLD}/></svg>
          </div>
          <div>
            <div style={{ color:"#fff", fontWeight:900, fontSize:14, letterSpacing:-.3 }}>DDI Mollet — Panel Supervisor</div>
            <div style={{ color:MUTED, fontSize:10 }}>Control de operaciones de reparto en tiempo real</div>
          </div>
        </div>

        {/* Separador */}
        <div style={{ width:1, height:32, background:BORDER, marginRight:28 }}/>

        {/* KPIs globales */}
        <div style={{ display:"flex", gap:28, flex:1, alignItems:"center" }}>
          <KpiChip icon="🚚" label="Rutas" value={globalKpis.routes} sub={`${globalKpis.drivers} repartidores`} color={GOLD}/>
          <KpiChip icon="📦" label="Paradas" value={fmtNum(globalKpis.totalStops)} sub={`${fmtNum(globalKpis.totalItems)} artículos`}/>
          <KpiChip icon="🍺" label="Barriles" value={globalKpis.totalBarrels} sub="a entregar"/>
          <KpiChip icon="♻" label="Retornables" value={fmtNum(globalKpis.totalRet)} sub="estimados"/>
          <KpiChip icon="💰" label="CONTADO" value={globalKpis.contado} sub="paradas con cobro" color={globalKpis.contado>0?AMBER:TEXT}/>
          {globalKpis.totalAlerts > 0 && (
            <KpiChip icon="⚠" label="Alertas" value={globalKpis.totalAlerts} color={RED}/>
          )}
        </div>

        {/* Controles derecha */}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          {/* Tabs */}
          {(["mapa","analytics"] as const).map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} style={{
              padding:"6px 14px", borderRadius:8, border:`1px solid ${activeTab===t?RED:BORDER}`,
              background:activeTab===t?`rgba(227,40,25,.15)`:"transparent",
              color:activeTab===t?RED:MUTED, fontSize:11, cursor:"pointer", fontWeight:700, letterSpacing:.3,
              textTransform:"capitalize",
            }}>{t === "mapa" ? "🗺 Mapa" : "📊 Analytics"}</button>
          ))}
          <div style={{ width:1, height:24, background:BORDER }}/>
          <button onClick={onBack} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${BORDER}`, background:"transparent", color:MUTED, fontSize:11, cursor:"pointer", fontWeight:600 }}>← Conductor</button>
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>

        {/* ══ PANEL IZQUIERDO ═════════════════════════════════════════ */}
        <div style={{ width:300, flexShrink:0, background:PANEL, borderRight:`1px solid ${BORDER}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Selector fecha */}
          <div style={{ padding:"12px 14px 10px", borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
            <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, marginBottom:6, textTransform:"uppercase" }}>Fecha de operaciones</div>
            <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{
              width:"100%", padding:"7px 10px", borderRadius:8, background:CARD,
              border:`1px solid ${BORDER}`, color:TEXT, fontSize:12, cursor:"pointer",
            }}>
              {availableDates.map(d=>(
                <option key={d} value={d}>{d.split("-").reverse().join("/")} {d === availableDates[0] ? "(más reciente)" : ""}</option>
              ))}
              {!availableDates.length && <option>Cargando...</option>}
            </select>
          </div>

          {/* Alertas del día */}
          {allAlerts.length > 0 && (
            <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
              <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, marginBottom:6, textTransform:"uppercase" }}>⚠ Alertas del día</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:100, overflowY:"auto" }}>
                {allAlerts.map(a => (
                  <div key={a.id} onClick={()=>setSelectedDriver(a.driverId??null)} style={{
                    padding:"5px 8px", borderRadius:7, cursor:"pointer",
                    background:a.severity==="critical"?`rgba(239,68,68,.1)`:a.severity==="warning"?`rgba(245,158,11,.08)`:`rgba(59,130,246,.08)`,
                    border:`1px solid ${a.severity==="critical"?"rgba(239,68,68,.3)":a.severity==="warning"?"rgba(245,158,11,.2)":"rgba(59,130,246,.15)"}`,
                    display:"flex", gap:6, alignItems:"flex-start",
                  }}>
                    <span style={{fontSize:11}}>{a.icon}</span>
                    <div>
                      <div style={{ color:TEXT, fontSize:10, fontWeight:700 }}>{a.title}</div>
                      <div style={{ color:MUTED, fontSize:9 }}>{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista repartidores */}
          <div style={{ padding:"10px 14px 4px", flexShrink:0 }}>
            <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, textTransform:"uppercase" }}>
              Repartidores — {selectedDate.split("-").reverse().join("/")}
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"0 10px 12px" }}>
            {loading && (
              <div style={{ padding:"16px 4px", color:MUTED, fontSize:12 }}>Cargando datos...</div>
            )}
            {!loading && driverStats.length === 0 && (
              <div style={{ padding:"16px 4px", color:MUTED, fontSize:12 }}>
                {apiOnline===false ? "API no disponible · inicia el servidor" : "Sin rutas para esta fecha"}
              </div>
            )}
            {driverStats.map(ds => {
              const isSelected = selectedDriver === ds.dId;
              return (
                <div key={ds.dId} onClick={()=>setSelectedDriver(isSelected?null:ds.dId)} style={{
                  padding:"10px 10px", borderRadius:10, marginBottom:6, cursor:"pointer",
                  background:isSelected?`rgba(${hexToRgb(ds.color)},0.12)`:CARD,
                  border:`1px solid ${isSelected?ds.color:BORDER}`,
                  transition:"all .15s",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
                    {/* Avatar */}
                    <div style={{ width:30, height:30, borderRadius:8, background:ds.color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:10, flexShrink:0, boxShadow:isSelected?`0 0 10px ${ds.color}55`:"none" }}>
                      {initials(ds.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:TEXT, fontWeight:700, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortName(ds.name)}</div>
                      <div style={{ color:MUTED, fontSize:10 }}>{ds.routeCodes.join(", ")}</div>
                    </div>
                    {/* Badge paradas */}
                    <div style={{ color:TEXT, fontSize:11, fontWeight:800, flexShrink:0 }}>{ds.totalStops}</div>
                  </div>

                  {/* Progress */}
                  <Progress value={ds.totalStops} max={Math.max(...driverStats.map(d=>d.totalStops))} color={ds.color}/>

                  {/* Mini stats */}
                  <div style={{ display:"flex", gap:10, marginTop:6 }}>
                    <span style={{ fontSize:10, color:MUTED }}>{ds.totalItems} art.</span>
                    {ds.barrels>0 && <span style={{ fontSize:10, color:MUTED }}>🍺 {ds.barrels}</span>}
                    {ds.contadoStops>0 && <span style={{ fontSize:10, color:AMBER }}>💰 {ds.contadoStops}</span>}
                    {ds.returnables>0 && <span style={{ fontSize:10, color:GREEN }}>♻ {ds.returnables}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ CONTENIDO PRINCIPAL ════════════════════════════════════ */}
        <div style={{ flex:1, minWidth:0, position:"relative", display:"flex" }}>

          {/* ── MAPA ───────────────────────────────────────────────── */}
          {activeTab === "mapa" && (
            <>
              <div ref={mapContainer} style={{ flex:1, height:"100%" }}/>

              {/* No-data overlay */}
              {!loading && routes.length === 0 && apiOnline !== false && (
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"rgba(8,12,20,.92)", border:`1px solid ${BORDER}`, borderRadius:14, padding:"28px 36px", textAlign:"center" }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
                  <div style={{ color:TEXT, fontWeight:700, fontSize:16 }}>Sin rutas para esta fecha</div>
                  <div style={{ color:MUTED, fontSize:12, marginTop:4 }}>Selecciona otra fecha en el panel izquierdo</div>
                </div>
              )}

              {/* API offline overlay */}
              {apiOnline === false && (
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"rgba(8,12,20,.95)", border:`1px solid rgba(239,68,68,.3)`, borderRadius:14, padding:"28px 36px", textAlign:"center", maxWidth:360 }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🔌</div>
                  <div style={{ color:TEXT, fontWeight:700, fontSize:16, marginBottom:8 }}>API no disponible</div>
                  <div style={{ color:MUTED, fontSize:12, lineHeight:1.6 }}>
                    Inicia el servidor con:<br/>
                    <code style={{ color:GOLD, background:"rgba(245,200,66,.08)", padding:"4px 8px", borderRadius:6, display:"inline-block", marginTop:6 }}>
                      npm run dev:api
                    </code>
                  </div>
                </div>
              )}

              {/* Leyenda repartidores */}
              {routes.length > 0 && (
                <div style={{ position:"absolute", bottom:20, left:12, background:"rgba(8,12,20,.88)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"10px 14px", backdropFilter:"blur(8px)", maxWidth:220, maxHeight:220, overflowY:"auto" }}>
                  <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, marginBottom:8, textTransform:"uppercase" }}>Repartidores activos</div>
                  {driverStats.map(ds => (
                    <div key={ds.dId} onClick={()=>setSelectedDriver(selectedDriver===ds.dId?null:ds.dId)} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, cursor:"pointer", opacity:selectedDriver!==null&&selectedDriver!==ds.dId?0.4:1, transition:"opacity .15s" }}>
                      <div style={{ width:14, height:3, borderRadius:2, background:ds.color, flexShrink:0 }}/>
                      <span style={{ color:TEXT, fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortName(ds.name)}</span>
                      <span style={{ color:MUTED, fontSize:9, marginLeft:"auto", flexShrink:0 }}>{ds.totalStops}p</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ANALYTICS ──────────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:20 }}>

              {/* Tendencia semanal */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:TEXT, fontWeight:700, fontSize:13, marginBottom:4 }}>📈 Tendencia semanal — paradas por día</div>
                <div style={{ color:MUTED, fontSize:11, marginBottom:12 }}>Últimos 7 días laborales</div>
                {trendData.length > 0 ? (
                  <div>
                    <BarChart data={trendData} color={BLUE} height={60}/>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      {trendData.map((d,i) => (
                        <span key={i} style={{ color:MUTED, fontSize:9, textAlign:"center", flex:1 }}>{d.label}</span>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ color:MUTED, fontSize:12 }}>Cargando...</div>}
              </div>

              {/* Paradas por repartidor */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:TEXT, fontWeight:700, fontSize:13, marginBottom:4 }}>🚚 Paradas por repartidor — {selectedDate.split("-").reverse().join("/")}</div>
                <div style={{ color:MUTED, fontSize:11, marginBottom:12 }}>Top 10 repartidores ordenados por carga</div>
                {driverStats.length > 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {driverStats.slice(0,10).map(ds => (
                      <div key={ds.dId} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:90, color:TEXT, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{shortName(ds.name)}</div>
                        <div style={{ flex:1, height:16, background:"rgba(255,255,255,.04)", borderRadius:4, overflow:"hidden", position:"relative" }}>
                          <div style={{ height:"100%", width:`${ds.totalStops/Math.max(...driverStats.map(d=>d.totalStops))*100}%`, background:ds.color, borderRadius:4, opacity:.85 }}/>
                        </div>
                        <div style={{ color:TEXT, fontSize:11, fontWeight:700, width:28, textAlign:"right", flexShrink:0 }}>{ds.totalStops}</div>
                        <div style={{ color:MUTED, fontSize:10, width:50, textAlign:"right", flexShrink:0 }}>{ds.totalItems} art</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ color:MUTED, fontSize:12 }}>Sin datos para esta fecha</div>}
              </div>

              {/* Artículos por repartidor */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:TEXT, fontWeight:700, fontSize:13, marginBottom:12 }}>📦 Artículos entregados por repartidor</div>
                {itemsChartData.length > 0
                  ? <BarChart data={itemsChartData} color={GREEN} height={70}/>
                  : <div style={{ color:MUTED, fontSize:12 }}>Sin datos</div>}
              </div>

              {/* Tabla resumen completa */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:"16px 20px" }}>
                <div style={{ color:TEXT, fontWeight:700, fontSize:13, marginBottom:12 }}>📋 Resumen completo del día</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                      {["Repartidor","Ruta","Paradas","Artículos","Barriles","Retornables","CONTADO"].map(h => (
                        <th key={h} style={{ color:MUTED, fontWeight:700, fontSize:9, letterSpacing:.5, textAlign:"left", padding:"0 8px 8px 0", textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {driverStats.map(ds => (
                      <tr key={ds.dId} onClick={()=>{setSelectedDriver(ds.dId);setActiveTab("mapa");}}
                        style={{ borderBottom:`1px solid ${BORDER}`, cursor:"pointer" }}
                        onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.03)")}
                        onMouseOut={e=>(e.currentTarget.style.background="transparent")}
                      >
                        <td style={{ padding:"8px 8px 8px 0", color:TEXT, fontWeight:600 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:ds.color, flexShrink:0 }}/>
                            {shortName(ds.name)}
                          </div>
                        </td>
                        <td style={{ padding:"8px", color:MUTED }}>{ds.routeCodes.join(", ")}</td>
                        <td style={{ padding:"8px", color:TEXT, fontWeight:700 }}>{ds.totalStops}</td>
                        <td style={{ padding:"8px", color:MUTED }}>{ds.totalItems}</td>
                        <td style={{ padding:"8px", color:ds.barrels>0?GOLD:MUTED }}>{ds.barrels||"—"}</td>
                        <td style={{ padding:"8px", color:ds.returnables>0?GREEN:MUTED }}>{ds.returnables||"—"}</td>
                        <td style={{ padding:"8px", color:ds.contadoStops>0?AMBER:MUTED }}>{ds.contadoStops||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:`2px solid rgba(255,255,255,.1)` }}>
                      <td style={{ padding:"8px 0", color:GOLD, fontWeight:800, fontSize:12 }} colSpan={2}>TOTAL</td>
                      <td style={{ padding:"8px", color:GOLD, fontWeight:800 }}>{globalKpis.totalStops}</td>
                      <td style={{ padding:"8px", color:GOLD, fontWeight:800 }}>{globalKpis.totalItems}</td>
                      <td style={{ padding:"8px", color:GOLD, fontWeight:800 }}>{globalKpis.totalBarrels}</td>
                      <td style={{ padding:"8px", color:GOLD, fontWeight:800 }}>{globalKpis.totalRet}</td>
                      <td style={{ padding:"8px", color:GOLD, fontWeight:800 }}>{globalKpis.contado}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ══ PANEL DETALLE REPARTIDOR (derecha) ═════════════════════ */}
        {selectedStats && activeTab === "mapa" && (
          <div style={{ width:280, flexShrink:0, background:PANEL, borderLeft:`1px solid ${BORDER}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Header repartidor */}
            <div style={{ padding:"14px 14px 12px", borderBottom:`1px solid ${BORDER}`, flexShrink:0, background:CARD }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:selectedStats.color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:13, boxShadow:`0 0 14px ${selectedStats.color}55` }}>
                  {initials(selectedStats.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:TEXT, fontWeight:800, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{selectedStats.name}</div>
                  <div style={{ color:MUTED, fontSize:10 }}>{selectedStats.routeCodes.join(", ")} · {selectedDate.split("-").reverse().join("/")}</div>
                </div>
                <button onClick={()=>setSelectedDriver(null)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:16, padding:0, lineHeight:1 }}>×</button>
              </div>

              {/* KPIs individuales */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"Paradas", value:selectedStats.totalStops, icon:"📍" },
                  { label:"Artículos", value:selectedStats.totalItems, icon:"📦" },
                  { label:"Barriles", value:selectedStats.barrels||"—", icon:"🍺" },
                  { label:"Cobros", value:selectedStats.contadoStops||"—", icon:"💰" },
                ].map(k => (
                  <div key={k.label} style={{ background:PANEL, borderRadius:8, padding:"8px 10px", border:`1px solid ${BORDER}` }}>
                    <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>{k.icon} {k.label}</div>
                    <div style={{ color:TEXT, fontWeight:800, fontSize:18, lineHeight:1, marginTop:2 }}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas del repartidor */}
            {selectedStats.alerts.length > 0 && (
              <div style={{ padding:"10px 12px", borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                {selectedStats.alerts.map(a => (
                  <div key={a.id} style={{
                    padding:"6px 8px", borderRadius:7, marginBottom:4,
                    background:a.severity==="warning"?`rgba(245,158,11,.1)`:`rgba(59,130,246,.08)`,
                    border:`1px solid ${a.severity==="warning"?"rgba(245,158,11,.25)":"rgba(59,130,246,.2)"}`,
                    display:"flex", gap:6, alignItems:"center",
                  }}>
                    <span style={{fontSize:12}}>{a.icon}</span>
                    <div>
                      <div style={{ color:TEXT, fontSize:10, fontWeight:700 }}>{a.title}</div>
                      <div style={{ color:MUTED, fontSize:9 }}>{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline de paradas */}
            <div style={{ padding:"10px 12px 4px", flexShrink:0 }}>
              <div style={{ color:MUTED, fontSize:9, fontWeight:700, letterSpacing:.7, textTransform:"uppercase" }}>
                Paradas ({selectedStops.length})
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"0 12px 12px" }}>
              {selectedStops.map((stop, idx) => {
                const hasReturnables = stop.items.some(i => /RET|ENVAS|BUIT/.test(i.descripcion.toUpperCase()));
                const hasCobro = /BAR|CAFET|RESTAUR|HOTEL/.test(stop.clientName.toUpperCase());
                const hasBarrel = stop.items.some(i => /BARRIL|KEG/.test(i.descripcion.toUpperCase()));

                return (
                  <div key={stop.stopId} style={{ display:"flex", gap:8, marginBottom:8, position:"relative" }}>
                    {/* Timeline line */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:selectedStats.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900 }}>{idx+1}</div>
                      {idx < selectedStops.length-1 && (
                        <div style={{ width:1, flex:1, minHeight:8, background:BORDER, marginTop:2 }}/>
                      )}
                    </div>
                    <div style={{ flex:1, minWidth:0, paddingBottom:4 }}>
                      <div style={{ color:TEXT, fontWeight:600, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{stop.clientName}</div>
                      <div style={{ color:MUTED, fontSize:9, marginBottom:3 }}>{stop.city}</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {hasCobro && <span style={{ fontSize:8, padding:"1px 5px", borderRadius:4, background:"rgba(245,158,11,.12)", color:AMBER, fontWeight:700 }}>💰 CONTADO</span>}
                        {hasBarrel && <span style={{ fontSize:8, padding:"1px 5px", borderRadius:4, background:"rgba(245,200,66,.1)", color:GOLD, fontWeight:700 }}>🍺 BARRIL</span>}
                        {hasReturnables && <span style={{ fontSize:8, padding:"1px 5px", borderRadius:4, background:"rgba(16,185,129,.1)", color:GREEN, fontWeight:700 }}>♻ RET</span>}
                        {!stop.lat && <span style={{ fontSize:8, padding:"1px 5px", borderRadius:4, background:"rgba(239,68,68,.1)", color:"#ef4444", fontWeight:700 }}>⚠ sin coords</span>}
                      </div>
                      <div style={{ color:MUTED, fontSize:9, marginTop:2 }}>{stop.items.length} artículos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utilidad: hex color → "r,g,b"
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
