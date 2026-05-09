/**
 * SupervisorView — panel de supervisor DDI Mollet.
 *
 * Pantalla completa Mapbox dark con:
 * - Panel izquierdo: selector de fecha, lista de repartidores, paradas del seleccionado
 * - Mapa: polylines por repartidor (colores distintos), marcadores numerados, popups
 * - Datos reales del historial de rutas (API /api/history/routes)
 * - Fallback offline: muestra aviso si la API no responde
 */
import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN ?? "";

const DRIVER_COLORS = [
  "#E32819","#F5C842","#3B82F6","#10B981","#8B5CF6",
  "#F97316","#06B6D4","#EC4899","#84CC16","#A855F7",
  "#14B8A6","#F59E0B","#EF4444","#6366F1","#22D3EE",
  "#4ADE80","#FB923C","#E879F9",
];

// ── Types ──────────────────────────────────────────────────────────────────
type HistoryStop = {
  stopId: string;
  deliveryId: number;
  sequence: number;
  clientId: number;
  clientName: string;
  address: string;
  city: string;
  cp: string;
  lat: number | null;
  lng: number | null;
  items: Array<{ material: string; descripcion: string; cantidad: number; unidad: string }>;
};

type RouteHistory = {
  transportId: number;
  date: string;
  route: string;
  driverId: number;
  driverName: string;
  stops: HistoryStop[];
};

type DriverSummary = {
  id: number;
  name: string;
  routes: string[];
  totalDeliveries: number;
};

// ── Constants ──────────────────────────────────────────────────────────────
const BG    = "#0d1117";
const CARD  = "#0f0f1a";
const PANEL = "#0a0a14";
const RED   = "#E32819";
const GOLD  = "#F5C842";
const LINE  = "rgba(227,40,25,.18)";
const MUTED = "rgba(255,255,255,.45)";

// ── Main Component ─────────────────────────────────────────────────────────
export function SupervisorView({ onBack }: { onBack: () => void }) {
  const mapRef     = useRef<mapboxgl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const linesRef   = useRef<string[]>([]); // layer ids to remove

  const [routes,      setRoutes]      = useState<RouteHistory[]>([]);
  const [drivers,     setDrivers]     = useState<DriverSummary[]>([]);
  const [selectedDate,setSelectedDate]= useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [apiOnline,   setApiOnline]   = useState<boolean | null>(null);
  const [loading,     setLoading]     = useState(true);

  // ── API fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [driversRes, histRes] = await Promise.all([
          fetch("/api/history/drivers"),
          fetch("/api/history"),
        ]);
        if (!driversRes.ok || !histRes.ok) throw new Error("API error");
        const driversData = await driversRes.json();
        const histData    = await histRes.json();

        setDrivers(driversData);
        setApiOnline(true);

        // Carga la fecha más reciente
        if (histData.availableDates?.length) {
          const latest = histData.availableDates[histData.availableDates.length - 1];
          setSelectedDate(latest);
        }
      } catch {
        setApiOnline(false);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // ── Fetch routes for selected date ─────────────────────────────────────
  useEffect(() => {
    if (!selectedDate || !apiOnline) return;
    fetch(`/api/history/routes?date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { setRoutes(d.routes ?? []); setSelectedDriver(null); })
      .catch(() => setRoutes([]));
  }, [selectedDate, apiOnline]);

  // ── Available dates from drivers (API summary) ─────────────────────────
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  useEffect(() => {
    if (!apiOnline) return;
    fetch("/api/history")
      .then(r => r.json())
      .then(d => setAvailableDates((d.availableDates ?? []).reverse()))
      .catch(() => {});
  }, [apiOnline]);

  // ── Driver color map ───────────────────────────────────────────────────
  const driverColorMap = useMemo(() => {
    const map = new Map<number, string>();
    const uniqueIds = [...new Set(routes.map(r => r.driverId))].sort();
    uniqueIds.forEach((id, i) => map.set(id, DRIVER_COLORS[i % DRIVER_COLORS.length]));
    return map;
  }, [routes]);

  // ── Init map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [2.213, 41.539],
      zoom: 10,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ── Draw routes on map ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function draw() {
      // Cleanup previous
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      for (const id of linesRef.current) {
        if (map!.getLayer(id)) map!.removeLayer(id);
        if (map!.getSource(id)) map!.removeSource(id);
      }
      linesRef.current = [];

      if (routes.length === 0) return;

      const bounds = new mapboxgl.LngLatBounds();
      let hasCoords = false;

      for (const route of routes) {
        const color = driverColorMap.get(route.driverId) ?? RED;
        const isSelected = selectedDriver === route.driverId;
        const opacity = selectedDriver === null ? 0.75 : isSelected ? 1 : 0.2;
        const lineWidth = isSelected ? 4 : 2;

        const validStops = route.stops.filter(s => s.lat && s.lng && s.lat !== 0 && s.lng !== 0);
        if (validStops.length === 0) continue;

        // Draw polyline
        const coords = validStops.map(s => [s.lng!, s.lat!]);
        const sourceId = `route-${route.transportId}`;
        linesRef.current.push(sourceId);

        if (!map!.getSource(sourceId)) {
          map!.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          });
          map!.addLayer({
            id: sourceId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": color, "line-width": lineWidth, "line-opacity": opacity },
          });
        }

        // Draw markers
        validStops.forEach((stop, idx) => {
          bounds.extend([stop.lng!, stop.lat!]);
          hasCoords = true;

          const el = document.createElement("div");
          el.style.cssText = `
            width:28px;height:28px;border-radius:50%;
            background:${color};
            border:2px solid ${isSelected ? "#fff" : "rgba(255,255,255,.4)"};
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-weight:900;font-size:11px;
            cursor:pointer;
            opacity:${selectedDriver === null || isSelected ? 1 : 0.3};
            box-shadow:0 2px 8px rgba(0,0,0,.5);
            font-family:'Inter',sans-serif;
          `;
          el.textContent = String(idx + 1);

          const itemsHtml = stop.items.slice(0, 5).map(i =>
            `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#94a3b8;padding:2px 0;">
              <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.descripcion}</span>
              <span style="color:#e2e8f0;font-weight:600;flex-shrink:0;">${i.cantidad} ${i.unidad}</span>
            </div>`
          ).join("");

          const moreItems = stop.items.length > 5 ? `<div style="color:#64748b;font-size:10px;margin-top:4px;">+${stop.items.length - 5} artículos más</div>` : "";

          const popup = new mapboxgl.Popup({ offset: 14, maxWidth: "260px", closeButton: false })
            .setHTML(`
              <div style="background:#0f0f1a;border:1px solid rgba(227,40,25,.2);border-radius:10px;padding:12px;font-family:'Inter',sans-serif;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  <div style="width:22px;height:22px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;">${idx + 1}</div>
                  <div>
                    <div style="color:#f1f5f9;font-weight:700;font-size:13px;">${stop.clientName}</div>
                    <div style="color:#64748b;font-size:11px;">${stop.address}, ${stop.city}</div>
                  </div>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:8px;">
                  <div style="color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:.5px;margin-bottom:4px;">ARTÍCULOS</div>
                  ${itemsHtml}
                  ${moreItems}
                </div>
                <div style="margin-top:8px;color:#64748b;font-size:10px;">
                  Ruta ${route.route} · ${route.driverName}
                </div>
              </div>
            `);

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([stop.lng!, stop.lat!])
            .setPopup(popup)
            .addTo(map!);

          markersRef.current.push(marker);
        });
      }

      if (hasCoords && !bounds.isEmpty()) {
        map!.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      }
    }

    if (map.loaded()) {
      draw();
    } else {
      map.once("load", draw);
    }
  }, [routes, selectedDriver, driverColorMap]);

  // ── Selected driver routes ─────────────────────────────────────────────
  const selectedRoutes = useMemo(() =>
    routes.filter(r => r.driverId === selectedDriver),
    [routes, selectedDriver]);

  const driverRouteMap = useMemo(() => {
    const map = new Map<number, RouteHistory[]>();
    for (const r of routes) {
      if (!map.has(r.driverId)) map.set(r.driverId, []);
      map.get(r.driverId)!.push(r);
    }
    return map;
  }, [routes]);

  // Stats for the day
  const totalStopsDay = useMemo(() => routes.reduce((s, r) => s + r.stops.length, 0), [routes]);
  const totalItemsDay = useMemo(() => routes.reduce((s, r) => s + r.stops.reduce((ss, st) => ss + st.items.length, 0), 0), [routes]);
  const stopsWithCoords = useMemo(() => routes.reduce((s, r) => s + r.stops.filter(st => st.lat && st.lng && st.lat !== 0).length, 0), [routes]);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <header style={{
        height: 52, flexShrink: 0, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 20px",
        background: `linear-gradient(90deg,#080010 0%,#0d0016 60%,#080010 100%)`,
        borderBottom: `1px solid ${LINE}`,
        boxShadow: "0 2px 20px rgba(0,0,0,.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: RED, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px rgba(227,40,25,.5)` }}>
            <svg width="20" height="20" viewBox="0 0 22 22"><polygon points="11,1 13.5,8 21,8 15,13 17.5,20 11,15.5 4.5,20 7,13 1,8 8.5,8" fill={GOLD} /></svg>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Supervisor · DDI Mollet</div>
            <div style={{ color: MUTED, fontSize: 11 }}>
              {apiOnline === false ? "⚠ API offline · sin datos reales" : `${routes.length} rutas · ${totalStopsDay} paradas · ${totalItemsDay} líneas`}
            </div>
          </div>
        </div>

        {/* KPIs día */}
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Rutas hoy", value: routes.length },
            { label: "Repartidores", value: driverRouteMap.size },
            { label: "Con coords", value: `${stopsWithCoords}/${totalStopsDay}` },
          ].map(k => (
            <div key={k.label} style={{ textAlign: "center" }}>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: 17, lineHeight: 1 }}>{k.value}</div>
              <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <button onClick={onBack} style={{
          padding: "6px 16px", borderRadius: 8,
          border: `1px solid rgba(255,255,255,.1)`, background: "transparent",
          color: MUTED, fontSize: 12, cursor: "pointer", fontWeight: 600,
        }}>← Conductor</button>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>

        {/* ── Panel izquierdo ── */}
        <div style={{ width: 320, flexShrink: 0, background: PANEL, borderRight: `1px solid ${LINE}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Selector de fecha */}
          <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>FECHA</div>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                background: CARD, border: `1px solid rgba(255,255,255,.1)`,
                color: "#e2e8f0", fontSize: 13, cursor: "pointer",
              }}
            >
              {availableDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
              {availableDates.length === 0 && <option value="">Cargando...</option>}
            </select>
          </div>

          {/* Lista repartidores del día */}
          <div style={{ flexShrink: 0, padding: "10px 14px 6px", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>REPARTIDORES HOY</div>
            {loading && <div style={{ color: MUTED, fontSize: 12, padding: "8px 0" }}>Cargando...</div>}
            {!loading && driverRouteMap.size === 0 && (
              <div style={{ color: MUTED, fontSize: 12, padding: "8px 0" }}>
                {apiOnline === false ? "API no disponible" : "Sin datos para esta fecha"}
              </div>
            )}
            {[...driverRouteMap.entries()].map(([dId, dRoutes]) => {
              const color = driverColorMap.get(dId) ?? RED;
              const isSelected = selectedDriver === dId;
              const name = dRoutes[0]?.driverName ?? `Repartidor ${dId}`;
              const routeCodes = [...new Set(dRoutes.map(r => r.route))].join(", ");
              const stopsCount = dRoutes.reduce((s, r) => s + r.stops.length, 0);

              return (
                <div
                  key={dId}
                  onClick={() => setSelectedDriver(isSelected ? null : dId)}
                  style={{
                    padding: "8px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer",
                    background: isSelected ? `${color}18` : "transparent",
                    border: `1px solid ${isSelected ? color : "transparent"}`,
                    display: "flex", alignItems: "center", gap: 10,
                    transition: "all .15s",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: isSelected ? "#fff" : "#e2e8f0", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ color: MUTED, fontSize: 10 }}>{routeCodes} · {stopsCount} paradas</div>
                  </div>
                  {isSelected && <span style={{ color: color, fontSize: 10, fontWeight: 700 }}>●</span>}
                </div>
              );
            })}
          </div>

          {/* Paradas del repartidor seleccionado */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
            {selectedDriver && (
              <>
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>
                  PARADAS — {routes.find(r => r.driverId === selectedDriver)?.driverName}
                </div>
                {selectedRoutes.flatMap(r => r.stops).map((stop, idx) => {
                  const color = driverColorMap.get(selectedDriver) ?? RED;
                  const hasCoords = stop.lat && stop.lng && stop.lat !== 0;
                  return (
                    <div key={stop.stopId} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: hasCoords ? color : "#2a2a3a",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1,
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stop.clientName}</div>
                        <div style={{ color: MUTED, fontSize: 10 }}>{stop.city} · {stop.items.length} artículo{stop.items.length !== 1 ? "s" : ""}</div>
                        {!hasCoords && <div style={{ color: "#f59e0b", fontSize: 9, marginTop: 1 }}>⚠ sin coords</div>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {!selectedDriver && !loading && driverRouteMap.size > 0 && (
              <div style={{ color: MUTED, fontSize: 12, paddingTop: 8 }}>
                Haz click en un repartidor para ver sus paradas
              </div>
            )}
          </div>
        </div>

        {/* ── Mapa ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

          {/* Leyenda */}
          {routes.length > 0 && (
            <div style={{
              position: "absolute", bottom: 24, left: 12,
              background: "rgba(13,17,23,.85)", border: `1px solid ${LINE}`,
              borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(8px)",
              maxWidth: 220,
            }}>
              <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 6 }}>REPARTIDORES</div>
              {[...driverRouteMap.keys()].slice(0, 8).map(dId => {
                const color = driverColorMap.get(dId) ?? RED;
                const name = routes.find(r => r.driverId === dId)?.driverName ?? String(dId);
                return (
                  <div key={dId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ color: "#e2e8f0", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name.split(" ")[0]} {name.split(" ")[1] ?? ""}</span>
                  </div>
                );
              })}
              {driverRouteMap.size > 8 && <div style={{ color: MUTED, fontSize: 10 }}>+{driverRouteMap.size - 8} más</div>}
            </div>
          )}

          {/* Aviso sin datos */}
          {!loading && apiOnline === false && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "rgba(13,17,23,.9)", border: `1px solid rgba(245,158,11,.3)`,
              borderRadius: 12, padding: "20px 28px", textAlign: "center",
            }}>
              <div style={{ color: "#f59e0b", fontSize: 28, marginBottom: 8 }}>⚠</div>
              <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>API no disponible</div>
              <div style={{ color: MUTED, fontSize: 12 }}>Inicia el backend: <code style={{ color: GOLD }}>npm run dev --workspace=apps/api</code></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
