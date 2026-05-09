import React from 'react';
import { TruckIsometric } from './TruckIsometric';
import {
  Clock, MapPin, Truck, Package, RotateCcw,
  MessageCircle, CheckCircle, ArrowLeft, ChevronDown, MousePointerClick,
} from 'lucide-react';

const DAMM_RED = '#CC1122';

export function NextStopScreen({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="flex flex-col" style={{
      width: 1280, height: 800, background: '#111927',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: 'white', overflow: 'hidden',
    }}>
      {/* ── COMPACT HEADER ── */}
      <header className="flex items-center justify-between px-6"
        style={{ height: 52, background: '#0D1520', borderBottom: '1px solid #1E2C40', flexShrink: 0 }}>
        <button onClick={onSwitch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{ background: '#1A2535', border: '1px solid #2A3D55', color: '#8AABCC', cursor: 'pointer' }}>
          <ArrowLeft size={13} />
          <span className="text-xs font-semibold">Vista general</span>
        </button>

        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="text-xs" style={{ color: '#4A6480' }}>Siguiente entrega</div>
            <div className="text-lg font-black" style={{ color: 'white', lineHeight: 1.1 }}>BAR EL TUPÍ</div>
          </div>
          <div style={{ width: 1, height: 28, background: '#1E2C40' }} />
          <span className="text-sm font-bold px-3 py-1 rounded-lg"
            style={{ background: `${DAMM_RED}22`, color: DAMM_RED, border: `1px solid ${DAMM_RED}44` }}>
            #04 de 18
          </span>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#1A2510', border: '1px solid #F59E0B44' }}>
            <Clock size={12} color="#F59E0B" />
            <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>ETA 09:35</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={11} color="#4A6480" />
            <span className="text-xs" style={{ color: '#6B8CAE' }}>Av. Nostra Senyora de Montserrat</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#1A2535' }}>
          <Truck size={12} color="#4A6480" />
          <span className="text-xs" style={{ color: '#6B8CAE' }}>V235045</span>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex flex-1" style={{ overflow: 'hidden', minHeight: 0 }}>

        {/* ── TRUCK VIEW ── */}
        <div className="flex-1 relative flex flex-col" style={{ padding: '12px 10px 10px 14px', minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 3, height: 18, background: DAMM_RED, borderRadius: 2 }} />
            <span className="text-xs font-bold" style={{ color: '#C8D8E8', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Vista de carga
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold"
              style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44' }}>
              P5 ACTIVO
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg ml-2"
              style={{ background: '#1A2535', border: '1px solid #2A3D55' }}>
              <MousePointerClick size={10} color="#6B8CAE" />
              <span className="text-xs" style={{ color: '#6B8CAE', fontSize: 10 }}>Toca cualquier palet para ver contenido</span>
            </div>
          </div>

          <div className="rounded-2xl relative flex-1" style={{
            background: '#FFFFFF',
            border: '1px solid #1E2C40', overflow: 'visible', minHeight: 0,
          }}>
            <TruckIsometric highlightPallets={["P5"]} dimOthers showCallout />

            {/* P5 badge */}
            <div className="absolute top-4 right-4 px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(11,22,34,0.95)', border: '2px solid #F59E0B', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-lg font-black text-sm"
                  style={{ width: 32, height: 32, background: '#F59E0B', color: '#0D1520' }}>P5</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: '#F59E0B' }}>Recoger en P5</div>
                  <div className="text-xs" style={{ color: '#6B8CAE' }}>Lateral derecho</div>
                </div>
              </div>
            </div>

            {/* Location badge */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: 'rgba(11,22,34,0.92)', border: '1px solid #F59E0B44', backdropFilter: 'blur(8px)' }}>
              <MapPin size={12} color="#F59E0B" />
              <span className="text-sm font-semibold" style={{ color: '#E2EAF4' }}>
                Lateral derecho · Nivel inferior
              </span>
              <ChevronDown size={12} color="#F59E0B" />
            </div>
          </div>
        </div>

        {/* ── SIDE PANEL ── */}
        <div className="flex flex-col"
          style={{ width: 310, flexShrink: 0, background: '#0D1520', borderLeft: '1px solid #1E2C40', padding: '14px 16px', gap: 12 }}>

          {/* Descargar */}
          <div>
            <div className="text-xs font-bold mb-3"
              style={{ color: '#4A6480', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Descargar
            </div>
            <div className="flex flex-col gap-2">
              {[
                { qty: '4', label: 'cajas Estrella Damm', color: '#D4A020' },
                { qty: '1', label: 'barril ED30',          color: '#606060' },
                { qty: '2', label: 'cajas Agua Verí',      color: '#20B0E8' },
              ].map(({ qty, label, color }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: '#142030', border: `1px solid ${color}25` }}>
                  <div className="rounded-lg flex items-center justify-center font-black text-sm"
                    style={{ width: 32, height: 32, background: `${color}22`, color, flexShrink: 0 }}>
                    {qty}×
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'white' }}>{label}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Package size={10} color={color} />
                      <span className="text-xs" style={{ color: '#4A6480' }}>P5 · Nivel inferior</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: '#1E2C40' }} />

          {/* Retornables */}
          <div>
            <div className="text-xs font-bold mb-2"
              style={{ color: '#4A6480', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Retornables
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: '#0E2212', border: '1px solid #15532244' }}>
              <div className="rounded-lg flex items-center justify-center font-black text-sm"
                style={{ width: 32, height: 32, background: '#10B98122', color: '#10B981', flexShrink: 0 }}>3×</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#10B981' }}>Recoger 3 cajas vacías</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <RotateCcw size={10} color="#10B981" />
                  <span className="text-xs" style={{ color: '#4A6480' }}>Dejar en zona de retornables</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: '#1E2C40' }} />

          {/* Location */}
          <div className="rounded-xl p-3" style={{ background: '#0A1828', border: '1px solid #F59E0B22' }}>
            <div className="text-xs font-semibold mb-2"
              style={{ color: '#4A6480', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Dónde recoger
            </div>
            {[
              { label: 'Palet',    value: 'P5',              highlight: true },
              { label: 'Acceso',   value: 'Lateral derecho', highlight: false },
              { label: 'Nivel',    value: 'Inferior',        highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: '#4A6480' }}>{label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    background: highlight ? '#F59E0B22' : '#1A2535',
                    color: highlight ? '#F59E0B' : '#C8D8E8',
                    border: highlight ? '1px solid #F59E0B44' : '1px solid transparent',
                  }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-auto">
            <button
              className="flex items-center justify-center gap-2.5 rounded-xl py-3.5 w-full font-bold text-base transition-all hover:opacity-90 active:scale-95"
              style={{ background: DAMM_RED, color: 'white', border: 'none', cursor: 'pointer' }}>
              <CheckCircle size={17} />
              Confirmar descarga
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 w-full text-sm transition-all hover:opacity-80"
              style={{ background: '#1A2535', color: '#8AABCC', border: '1px solid #2A3D55', cursor: 'pointer' }}>
              <MessageCircle size={13} />
              Hablar con copiloto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
