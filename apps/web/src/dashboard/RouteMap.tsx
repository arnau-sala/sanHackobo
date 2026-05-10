/**
 * RouteMap — navegación en tiempo real con camión Damm animado.
 * Marca: rojo #E32819, dorado #F5C842, blanco, negro.
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { InputData, RoutePlan } from "@damm/optimizer-load";
import { parkingCoord, type LngLat } from "./parkingZones";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

type Coord = LngLat;

interface RouteMapProps {
  routePlan: RoutePlan;
  inputData: InputData;
  currentStopId: string;
  deliveredStopIds: Set<string>;
  startCoord?: Coord;
  onArrived: () => void;
  onSelectStop: (stopId: string) => void;
}

/* ─── SVG camión Damm 3D isométrico ──────────────────────────────────────── */
const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 56" width="96" height="56">
  <defs>
    <filter id="ts"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#00000088"/></filter>
    <linearGradient id="cabRed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF3A28"/>
      <stop offset="100%" stop-color="#B01000"/>
    </linearGradient>
    <linearGradient id="trailerRed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E32819"/>
      <stop offset="100%" stop-color="#9A1A0A"/>
    </linearGradient>
    <linearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF6B55"/>
      <stop offset="100%" stop-color="#C82010"/>
    </linearGradient>
  </defs>

  <!-- Trailer body (isometric left face - dark) -->
  <polygon points="4,14 4,42 48,42 48,14" fill="url(#trailerRed)" filter="url(#ts)"/>
  <!-- Trailer top -->
  <polygon points="4,14 48,14 56,8 12,8" fill="url(#roofGrad)"/>
  <!-- Trailer right face -->
  <polygon points="48,14 48,42 56,36 56,8" fill="#7A1008"/>

  <!-- White band on trailer -->
  <polygon points="4,20 48,20 48,34 4,34" fill="white" opacity=".92"/>

  <!-- Estrella Damm logo zona -->
  <!-- Estrella (star) -->
  <g transform="translate(26,27)">
    <polygon points="0,-7 1.6,-2.2 6.7,-2.2 2.7,0.8 4.1,5.7 0,2.9 -4.1,5.7 -2.7,0.8 -6.7,-2.2 -1.6,-2.2" fill="#F5C842"/>
  </g>
  <!-- ESTRELLA DAMM text -->
  <text x="26" y="22" font-size="4.2" font-weight="900" fill="#E32819" text-anchor="middle" font-family="Arial,sans-serif" letter-spacing=".3">ESTRELLA DAMM</text>
  <text x="26" y="37.5" font-size="3.2" font-weight="700" fill="#E32819" text-anchor="middle" font-family="Arial,sans-serif" letter-spacing=".5">BARCELONA 1876</text>

  <!-- Cab body -->
  <polygon points="48,16 48,42 72,42 72,16" fill="url(#cabRed)" filter="url(#ts)"/>
  <!-- Cab top -->
  <polygon points="48,16 72,16 78,10 54,10" fill="url(#roofGrad)"/>
  <!-- Cab right face -->
  <polygon points="72,16 72,42 78,36 78,10" fill="#8B1208"/>

  <!-- Windshield -->
  <polygon points="50,18 70,18 70,30 50,30" fill="#A8D8F0" opacity=".88"/>
  <!-- Windshield glare -->
  <polygon points="52,19 60,19 58,22 50,22" fill="white" opacity=".35"/>

  <!-- Cab door line -->
  <line x1="60" y1="30" x2="60" y2="42" stroke="#9A1A0A" stroke-width=".8"/>
  <!-- Door handle -->
  <rect x="62" y="36" width="4" height="1.5" rx=".6" fill="#F5C842"/>

  <!-- Headlight -->
  <rect x="70" y="26" width="3" height="5" rx="1" fill="#FFF9C4" opacity=".95"/>

  <!-- Front bumper -->
  <rect x="72" y="38" width="6" height="4" rx="1" fill="#555"/>

  <!-- Wheels (6 total, isometric) -->
  <!-- Rear trailer wheels -->
  <ellipse cx="14" cy="43" rx="5" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="14" cy="43" rx="3" ry="2.2" fill="#333"/>
  <ellipse cx="14" cy="43" rx="1.2" ry=".9" fill="#555"/>

  <ellipse cx="26" cy="43" rx="5" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="26" cy="43" rx="3" ry="2.2" fill="#333"/>
  <ellipse cx="26" cy="43" rx="1.2" ry=".9" fill="#555"/>

  <ellipse cx="38" cy="43" rx="5" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="38" cy="43" rx="3" ry="2.2" fill="#333"/>
  <ellipse cx="38" cy="43" rx="1.2" ry=".9" fill="#555"/>

  <!-- Cab rear wheel -->
  <ellipse cx="55" cy="43" rx="5" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="55" cy="43" rx="3" ry="2.2" fill="#333"/>
  <ellipse cx="55" cy="43" rx="1.2" ry=".9" fill="#555"/>

  <!-- Cab front wheel -->
  <ellipse cx="68" cy="43" rx="5" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="68" cy="43" rx="3" ry="2.2" fill="#333"/>
  <ellipse cx="68" cy="43" rx="1.2" ry=".9" fill="#555"/>

  <!-- Mud flaps -->
  <rect x="44" y="38" width="2" height="5" fill="#222"/>
</svg>`;

const PARKING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
  <rect width="44" height="44" rx="10" fill="#E32819"/>
  <rect x="2" y="2" width="40" height="40" rx="8" fill="none" stroke="#F5C842" stroke-width="2"/>
  <text x="22" y="30" font-size="24" font-weight="900" fill="white" text-anchor="middle" font-family="Arial,sans-serif">P</text>
</svg>`;

/* ─── helpers ────────────────────────────────────────────────────────────── */
async function fetchRoute(a: Coord, b: Coord): Promise<{
  coords: Coord[];
  steps: Array<{ maneuver?: { type?: string; instruction?: string }; distance?: number }>;
} | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}` +
      `?geometries=geojson&overview=full&steps=true&language=es&access_token=${mapboxgl.accessToken}`,
    );
    const d = await res.json() as {
      routes?: Array<{
        geometry: { coordinates: Coord[] };
        legs: Array<{ steps: Array<{ maneuver?: { type?: string; instruction?: string }; distance?: number }> }>;
      }>;
    };
    if (!d.routes?.[0]) return null;
    return { coords: d.routes[0].geometry.coordinates, steps: d.routes[0].legs.flatMap((l) => l.steps) };
  } catch { return null; }
}

function distM(a: Coord, b: Coord): number {
  const R = 6371000, dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function interp(coords: Coord[], t: number): { pos: Coord; bearing: number } {
  if (!coords.length) return { pos: [0, 0], bearing: 0 };
  if (t <= 0) return { pos: coords[0], bearing: 0 };
  if (t >= 1) return { pos: coords[coords.length - 1], bearing: 0 };
  let total = 0;
  const segs = coords.slice(1).map((c, i) => { const d = distM(coords[i], c); total += d; return d; });
  let acc = 0, tgt = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= tgt) {
      const f = (tgt - acc) / segs[i], [ax, ay] = coords[i], [bx, by] = coords[i + 1];
      return { pos: [ax + (bx - ax) * f, ay + (by - ay) * f], bearing: Math.atan2(bx - ax, by - ay) * 180 / Math.PI };
    }
    acc += segs[i];
  }
  return { pos: coords[coords.length - 1], bearing: 0 };
}

function mIcon(type = "") {
  if (type.includes("turn-right")) return "↱"; if (type.includes("turn-left")) return "↰";
  if (type.includes("roundabout")) return "⟳"; if (type.includes("merge"))     return "⤵";
  if (type.includes("arrive"))     return "📍"; return "⬆";
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export function RouteMap({ routePlan, inputData, currentStopId, deliveredStopIds, startCoord, onArrived, onSelectStop }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const truckRef     = useRef<mapboxgl.Marker | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);
  const animRef      = useRef(0);
  const tRef         = useRef(0);       // progreso 0→1
  const tLastRef     = useRef(0);
  const arrivedRef   = useRef(false);
  const destRef      = useRef<Coord | null>(null);
  const speedRef     = useRef(3);       // ref para que el loop lea siempre el valor actual

  const [nav, setNav]         = useState({ icon: "⬆", txt: "Calculando ruta…", sub: "" });
  const [eta, setEta]         = useState("");
  const [speed, setSpeed]     = useState(3);
  const [ready, setReady]     = useState(false);
  const [arriving, setArriving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Sincronizar ref con state para que el loop de animación siempre lea el valor correcto
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const stopById = new Map(inputData.stops.map((s) => [s.id, s]));
  const sorted   = [...routePlan.stops].sort((a, b) => a.sequence - b.sequence);
  const curRS    = sorted.find((s) => s.stopId === currentStopId);
  const curStop  = stopById.get(currentStopId);

  /* ── Init mapa ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      setMapError("Falta VITE_MAPBOX_TOKEN. Añade la clave de Mapbox en apps/web/.env para ver la ruta.");
      return;
    }
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [2.305, 41.924], zoom: 13, pitch: 50,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    const sid = "damm-map-css";
    if (!document.getElementById(sid)) {
      const s = document.createElement("style"); s.id = sid;
      s.textContent = `
        @keyframes dammPulse { 0%,100%{box-shadow:0 0 0 0 rgba(227,40,25,.7)} 60%{box-shadow:0 0 0 18px rgba(227,40,25,0)} }
        @keyframes parkBlink { 0%,100%{opacity:1} 50%{opacity:.55} }
        .truck-damm { animation: dammPulse 2s infinite; border-radius: 6px; }
        .park-active { animation: parkBlink .8s infinite; }
      `;
      document.head.appendChild(s);
    }
    return () => { cancelAnimationFrame(animRef.current); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  /* ── Reconstruir marcadores + ruta cuando cambia parada ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cancelAnimationFrame(animRef.current);
    tRef.current = 0; arrivedRef.current = false; destRef.current = null;
    setReady(false); setArriving(false);
    markersRef.current.forEach((m) => m.remove()); markersRef.current = [];

    const rmLayers = (...ids: string[]) => ids.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    const stopsOk  = sorted.filter((rs) => { const s = stopById.get(rs.stopId); return s?.lat && s?.lng; });
    const pending  = stopsOk.filter((rs) => !deliveredStopIds.has(rs.stopId));
    const done     = stopsOk.filter((rs) =>  deliveredStopIds.has(rs.stopId));

    const setup = () => {
      rmLayers("route-pending","route-casing","route-done");
      const bounds = new mapboxgl.LngLatBounds();

      /* Marcadores de parada */
      for (const rs of stopsOk) {
        const stop  = stopById.get(rs.stopId)!;
        const isAct = rs.stopId === currentStopId;
        const isDone= deliveredStopIds.has(rs.stopId);
        const color = isDone ? "#6b7280" : isAct ? "#E32819" : "#1d3461";
        const size  = isAct ? 48 : isDone ? 26 : 34;

        const el = document.createElement("div");
        el.style.cssText = `
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-weight:900;font-size:${isAct ? 17 : 12}px;
          border:${isAct ? "3px solid #F5C842" : "2px solid rgba(255,255,255,.7)"};
          box-shadow:0 3px 12px rgba(0,0,0,.55);
          cursor:pointer;opacity:${isDone ? .45 : 1};`;
        el.textContent = String(rs.sequence);

        const popup = new mapboxgl.Popup({ offset: 32, closeButton: false, maxWidth: "230px" })
          .setHTML(`<div style="font-family:system-ui;padding:3px 0">
            <b style="font-size:13px;color:#E32819">#${rs.sequence} ${rs.clientName ?? stop.clientName}</b><br>
            <span style="color:#6b7280;font-size:11px">${stop.address ?? ""}</span>
            ${rs.arrivalEta ? `<br><span style="color:#1d4ed8;font-size:11px">ETA: ${rs.arrivalEta}</span>` : ""}
            ${isDone ? `<br><span style="color:#059669;font-size:11px;font-weight:700">✓ Entregada</span>` : ""}
          </div>`);

        const m = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng!, stop.lat!]).setPopup(popup).addTo(map);
        el.addEventListener("click", () => { onSelectStop(rs.stopId); m.togglePopup(); });
        markersRef.current.push(m);
        if (!isDone) bounds.extend([stop.lng!, stop.lat!]);

        /* Zona P */
        if (!isDone) {
          const [pLng, pLat] = parkingCoord(rs.stopId, stop.lat!, stop.lng!);
          const pEl = document.createElement("div");
          pEl.innerHTML = PARKING_SVG;
          pEl.className = isAct ? "park-active" : "";
          pEl.style.cssText = "cursor:pointer;filter:drop-shadow(0 3px 8px rgba(0,0,0,.6));";
          const pPopup = new mapboxgl.Popup({ offset: 26, closeButton: false, maxWidth: "210px" })
            .setHTML(`<div style="font-family:system-ui">
              <b style="color:#E32819">🅿 Zona descarga oficial</b><br>
              <span style="font-size:12px;font-weight:600">${stop.clientName}</span><br>
              <span style="color:#6b7280;font-size:11px">${stop.address ?? ""}</span>
            </div>`);
          const pm = new mapboxgl.Marker({ element: pEl, anchor: "center" })
            .setLngLat([pLng, pLat]).setPopup(pPopup).addTo(map);
          pEl.addEventListener("click", () => pm.togglePopup());
          markersRef.current.push(pm);
          if (isAct) { destRef.current = [pLng, pLat]; bounds.extend([pLng, pLat]); }
        }
      }

      /* Ruta completada gris */
      if (done.length > 1) {
        const dc = done.map((rs) => { const s = stopById.get(rs.stopId)!; return [s.lng!, s.lat!] as Coord; });
        map.addSource("route-done", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: dc } } });
        map.addLayer({ id: "route-done", type: "line", source: "route-done", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#9ca3af", "line-width": 3, "line-opacity": .4, "line-dasharray": [2, 4] } });
      }

      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: { top: 110, bottom: 220, left: 60, right: 60 }, maxZoom: 16, duration: 800 });

      /* Ruta activa: origen → zona P */
      const dest = destRef.current;
      if (dest && curStop?.lat && curStop?.lng) {
        const origin: Coord = startCoord ?? [curStop.lng!, curStop.lat!];
        void fetchRoute(origin, dest).then((result) => {
          if (!mapRef.current) return;
          const m2 = mapRef.current;
          rmLayers("route-pending", "route-casing");
          const coords = result?.coords ?? [origin, dest];

          m2.addSource("route-pending", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } });
          m2.addLayer({ id: "route-casing", type: "line", source: "route-pending", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#fff", "line-width": 11, "line-opacity": .25 } }, "road-label");
          m2.addLayer({ id: "route-pending", type: "line", source: "route-pending", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#E32819", "line-width": 6, "line-opacity": .9 } }, "road-label");

          /* Camión */
          if (!truckRef.current) {
            const el = document.createElement("div");
            el.className = "truck-damm"; el.innerHTML = TRUCK_SVG;
            el.style.cssText = "width:96px;height:56px;";
            truckRef.current = new mapboxgl.Marker({ element: el, anchor: "center", rotationAlignment: "map" })
              .setLngLat(coords[0]).addTo(m2);
          } else {
            truckRef.current.setLngLat(coords[0]);
          }
          m2.easeTo({ center: coords[0], zoom: 15, pitch: 55, duration: 700 });

          if (curRS?.arrivalEta) setEta(curRS.arrivalEta);
          if (result?.steps?.[0]) {
            const st = result.steps[0];
            setNav({ icon: mIcon(st.maneuver?.type), txt: st.maneuver?.instruction ?? "Continúa recto", sub: st.distance ? `en ${Math.round(st.distance)} m` : "" });
          }

          setReady(true);
          startAnim(coords, result?.steps ?? [], dest);
        });
      }
    };

    if (map.isStyleLoaded()) setup(); else map.once("load", setup);
    return () => { cancelAnimationFrame(animRef.current); };
  }, [currentStopId, deliveredStopIds]);

  /* ── Animación ── */
  function startAnim(
    coords: Coord[],
    steps: Array<{ maneuver?: { type?: string; instruction?: string }; distance?: number }>,
    dest: Coord,
  ) {
    cancelAnimationFrame(animRef.current);
    tRef.current = 0; arrivedRef.current = false; tLastRef.current = 0;
    const DURATION = 140000; // 140 s a ×1 (~realista)

    const tick = (now: number) => {
      if (!tLastRef.current) tLastRef.current = now;
      const dt = now - tLastRef.current; tLastRef.current = now;
      // speedRef.current siempre tiene el valor actual del slider
      tRef.current = Math.min(1, tRef.current + (dt / DURATION) * speedRef.current);

      const { pos, bearing } = interp(coords, tRef.current);
      truckRef.current?.setLngLat(pos);
      truckRef.current?.setRotation(bearing);

      if (mapRef.current && tRef.current < 0.97) {
        mapRef.current.easeTo({ center: pos, bearing, pitch: 55, zoom: 16, duration: 200 });
      }

      const dist = distM(pos, dest);
      if (dist < 30 && !arrivedRef.current) {
        arrivedRef.current = true;
        setArriving(true);
        setNav({ icon: "🅿", txt: "Aparca en zona de descarga", sub: "" });
        truckRef.current?.setLngLat(dest);
        mapRef.current?.easeTo({ center: dest, zoom: 17, pitch: 40, duration: 600 });
        setTimeout(onArrived, 2000);
        return;
      }
      if (dist < 250) {
        setNav({ icon: "🅿", txt: `Zona descarga en ${Math.round(dist)} m`, sub: "" });
      } else if (steps.length) {
        const idx = Math.min(Math.floor(tRef.current * steps.length), steps.length - 1);
        const st = steps[idx];
        setNav({ icon: mIcon(st.maneuver?.type), txt: st.maneuver?.instruction ?? "Continúa recto", sub: st.distance ? `en ${Math.round(st.distance)} m` : "" });
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }

  const totalDone    = deliveredStopIds.size;
  const totalPending = sorted.length - totalDone;
  const pct          = Math.round((totalDone / sorted.length) * 100);

  /* ─── UI ──────────────────────────────────────────────────────────────── */
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 500, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {mapError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 25,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,.92)",
          padding: 20,
        }}>
          <div style={{
            maxWidth: 420,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            boxShadow: "0 20px 40px rgba(17,24,39,.08)",
            padding: "18px 20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🗺️</div>
            <div style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>No se puede mostrar la ruta</div>
            <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.5 }}>{mapError}</div>
          </div>
        </div>
      )}

      {/* ── Barra navegación superior (marca Damm) ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        background: arriving
          ? "linear-gradient(135deg,#065f46 0%,#047857 100%)"
          : "linear-gradient(135deg,#1a0000 0%,#E32819 60%,#c01000 100%)",
        padding: "11px 20px",
        boxShadow: "0 4px 24px rgba(0,0,0,.6)",
        display: "flex", alignItems: "center", gap: 16,
        transition: "background .5s",
      }}>
        {/* Icono maniobra */}
        <div style={{ width: 54, height: 54, borderRadius: 14, background: "rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, border: "1px solid rgba(245,200,66,.3)" }}>
          {nav.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: .2 }}>{nav.txt}</div>
          {nav.sub && <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12, marginTop: 2 }}>{nav.sub}</div>}
        </div>
        {/* ETA + contador */}
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          {eta && <div style={{ color: "#F5C842", fontWeight: 800, fontSize: 15 }}>ETA {eta}</div>}
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 11, marginTop: 1 }}>
            Parada #{curRS?.sequence} · {totalDone}/{sorted.length} ✓
          </div>
        </div>
      </div>

      {/* ── Barra progreso ── */}
      <div style={{
        position: "absolute", top: 76, left: 0, right: 0, zIndex: 19,
        background: "rgba(10,0,0,.82)", backdropFilter: "blur(8px)",
        padding: "7px 20px", display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{totalDone} ✓ entregadas</span>
        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#E32819,#F5C842)", borderRadius: 3, transition: "width .6s" }} />
        </div>
        <span style={{ color: "#F5C842", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{totalPending} pendientes</span>
      </div>

      {/* ── Card destino ── */}
      <div style={{
        position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
        background: "rgba(8,0,0,.95)",
        border: `1.5px solid ${arriving ? "rgba(16,185,129,.7)" : "rgba(227,40,25,.7)"}`,
        borderRadius: 20, padding: "16px 22px",
        display: "flex", alignItems: "center", gap: 16,
        zIndex: 20, minWidth: 300, maxWidth: 440,
        boxShadow: `0 10px 40px rgba(0,0,0,.8), 0 0 0 1px ${arriving ? "rgba(16,185,129,.2)" : "rgba(227,40,25,.2)"}`,
        transition: "border-color .4s, box-shadow .4s",
      }}>
        <div style={{ width: 50, height: 50, borderRadius: "50%", flexShrink: 0, background: arriving ? "#059669" : "#E32819", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, border: "2px solid #F5C842", transition: "background .4s" }}>
          {arriving ? "🅿" : curRS?.sequence}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: arriving ? "#10b981" : "#E32819", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
            {arriving ? "¡Llegado! Aparca aquí" : "Próximo cliente"}
          </div>
          <div style={{ color: "#f9fafb", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {curRS?.clientName ?? curStop?.clientName}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {curStop?.address}
          </div>
        </div>
        {curRS?.serviceMinutes && !arriving && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ color: "#F5C842", fontWeight: 800, fontSize: 18 }}>{curRS.serviceMinutes}<span style={{ fontSize: 10, color: "#9ca3af" }}> min</span></div>
            <div style={{ color: "#6b7280", fontSize: 9, textTransform: "uppercase", letterSpacing: .5 }}>servicio</div>
          </div>
        )}
      </div>

      {/* ── Control velocidad — FUNCIONAL vía speedRef ── */}
      <div style={{
        position: "absolute", bottom: 100, right: 14, zIndex: 20,
        background: "rgba(8,0,0,.9)", border: "1px solid rgba(227,40,25,.4)",
        borderRadius: 12, padding: "10px 14px",
      }}>
        <div style={{ color: "#F5C842", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          Velocidad
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 3, 6, 15].map((v) => (
            <button key={v} onClick={() => setSpeed(v)} style={{
              width: 36, height: 36, borderRadius: 8,
              border: `1.5px solid ${speed === v ? "#E32819" : "#374151"}`,
              background: speed === v ? "#E32819" : "rgba(255,255,255,.05)",
              color: speed === v ? "#fff" : "#9ca3af",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{v}×</button>
          ))}
        </div>
      </div>

      {/* ── Spinner ── */}
      {!ready && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(8,0,0,.95)", border: "1px solid rgba(227,40,25,.5)", borderRadius: 16, padding: "18px 32px", zIndex: 30, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>🗺️</div>
          <div>
            <div style={{ color: "#E32819", fontWeight: 800, fontSize: 14 }}>Calculando ruta</div>
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>Mapbox Directions API…</div>
          </div>
        </div>
      )}
    </div>
  );
}
