import React, { useState } from 'react';
import { TruckIsometric } from './TruckIsometric';
import { usePallets } from '../store';
import {
  Clock, MapPin, Truck, User, Package, RotateCcw,
  MessageCircle, Play, ChevronRight, Zap, BarChart2,
  Navigation, MousePointerClick, ChevronDown, ListOrdered
} from 'lucide-react';

const DAMM_RED = '#CC1122';

const ORDERS = [
  {
    id: 'b1',
    name: 'Mussol',
    address: 'C/ Aragó, 261',
    time: '09:15',
    pallets: ['P3', 'P4'],
    items: [
      { label: '8 cajas Estrella Damm', color: '#D4A020' },
      { label: '3 barriles ED30', color: '#606060' },
    ]
  },
  {
    id: 'b2',
    name: 'Bar Pepe',
    address: 'C/ València, 150',
    time: '09:40',
    pallets: ['P1'],
    items: [
      { label: '2 cajas Estrella Damm', color: '#D4A020' },
      { label: '1 caja Agua Verí', color: '#20B0E8' },
    ]
  },
  {
    id: 'b3',
    name: 'Cerveseria Catalana',
    address: 'C/ Mallorca, 236',
    time: '10:10',
    pallets: ['P7', 'P8'],
    items: [
      { label: '12 cajas Estrella Damm', color: '#D4A020' },
      { label: '6 barriles ED30', color: '#606060' },
      { label: '4 cajas Free Damm', color: '#2E8A2E' },
    ]
  }
];

function OccupancyBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ background: '#1A2535', borderRadius: 3, height: 4, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

function KPICard({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
      style={{ background: '#1E2C40', border: '1px solid #2A3D55' }}>
      <div className="p-1.5 rounded-lg" style={{ background: accent ? `${DAMM_RED}22` : '#2A3D5540' }}>
        <Icon size={14} color={accent ? DAMM_RED : '#6B8CAE'} />
      </div>
      <div>
        <div className="text-xs" style={{ color: '#6B8CAE', lineHeight: 1.2 }}>{label}</div>
        <div className="text-sm font-bold" style={{ color: accent ? '#FFFFFF' : '#C8D8E8', lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}

const typeColors: Record<string, string> = {
  Cajas: '#D4A020', Mixto: '#2E8A2E', Barriles: '#8B5CF6', Retornables: '#10B981',
};

export function OverviewScreen({ onSwitch }: { onSwitch: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(ORDERS[0].id);
  const { pallets } = usePallets();

  return (
    <div className="flex flex-col" style={{
      width: 1280, height: 800, background: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827', overflow: 'hidden',
    }}>
      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-6"
        style={{ height: 54, background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, background: DAMM_RED }}>
            <Truck size={18} color="white" />
          </div>
          <div>
            <div className="text-sm font-black" style={{ color: '#111827', letterSpacing: '0.5px' }}>
              DAMM <span style={{ color: DAMM_RED }}>SMART</span> TRUCK COPILOT
            </div>
            <div className="text-xs" style={{ color: '#4B5563' }}>Sistema de gestión de carga · Cabina</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#F3F4F6' }}>
            <Navigation size={12} color={DAMM_RED} />
            <span className="text-xs font-bold" style={{ color: '#111827' }}>Ruta DR0027</span>
            <span className="text-xs" style={{ color: '#4B5563' }}>· 18 entregas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <User size={12} color="#6B7280" />
            <span className="text-xs" style={{ color: '#4B5563' }}>Fran Romero</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck size={12} color="#6B7280" />
            <span className="text-xs" style={{ color: '#4B5563' }}>V235045</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
            <div className="rounded-full" style={{ width: 6, height: 6, background: '#059669' }} />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>Carga preparada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} color={DAMM_RED} />
            <span className="text-sm font-bold" style={{ color: '#111827' }}>08:45</span>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex flex-1" style={{ overflow: 'hidden', minHeight: 0 }}>

        {/* ── TRUCK PANEL ── */}
        <div className="flex flex-col flex-1" style={{ padding: '12px 10px 8px 14px', minWidth: 0, background: '#FFFFFF' }}>
          {/* Title bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div style={{ width: 3, height: 18, background: DAMM_RED, borderRadius: 2 }} />
              <span className="text-xs font-bold" style={{ color: '#111827', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Carga del camión
              </span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#4B5563' }}>
                8 palets · DR0027
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FEF3C7' }}>
              <MousePointerClick size={11} color="#D97706" />
              <span className="text-xs" style={{ color: '#92400E' }}>Toca un palet para ver contenido</span>
            </div>
          </div>

          {/* Truck SVG */}
          <div className="flex-1 rounded-2xl relative" style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB', overflow: 'visible', minHeight: 0,
          }}>
            <TruckIsometric 
              highlightPallets={[]} 
              dimOthers={false} 
            />
          </div>

          {/* Pallet grid */}
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {pallets.map((pallet) => {
              const color = typeColors[pallet.typeLabel] ?? '#6B8CAE';
              const maxCap = pallet.typeLabel === 'Barriles' ? 20 : 60;
              const count = Math.round((pallet.occupancy / 100) * maxCap);
              const unit = pallet.typeLabel === 'Barriles' ? 'barriles' : 'cajas';
              return (
                <div key={pallet.id} className="rounded-lg px-2 py-2"
                  style={{ background: '#FFFFFF', border: `1px solid ${color}40`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color }}>{pallet.id}</span>
                    <span className="text-xs font-semibold" style={{ color: '#111827', fontSize: '0.65rem' }}>{count}/{maxCap} {unit}</span>
                  </div>
                  <OccupancyBar value={pallet.occupancy} color={color} />
                  <div className="mt-1" style={{ color: '#4B5563', fontSize: 9 }}>{pallet.typeLabel}</div>
                  <div style={{ color: '#6B7280', fontSize: 9 }}>{pallet.stops}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ORDERS LIST PANEL ── */}
        <div className="flex flex-col"
          style={{ width: 340, flexShrink: 0, background: '#F9FAFB', borderLeft: '1px solid #E5E7EB', padding: '14px 16px', gap: 10, overflowY: 'auto' }}>
          
          <div className="flex items-center gap-2 mb-2">
            <ListOrdered size={14} color={DAMM_RED} />
            <span className="text-xs font-bold" style={{ color: '#111827', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Comandas (Próximas entregas)
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ORDERS.map((order, idx) => {
              const isSelected = selectedOrder === order.id;
              return (
                <div 
                  key={order.id}
                  onClick={() => setSelectedOrder(isSelected ? null : order.id)}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{ 
                    background: isSelected ? '#FFFFFF' : '#F3F4F6', 
                    border: isSelected ? `1px solid ${DAMM_RED}` : '1px solid #E5E7EB',
                    boxShadow: isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {/* Header */}
                  <div className="px-4 py-3 flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold mb-1" style={{ color: DAMM_RED }}>
                        Parada #{String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="text-base font-black" style={{ color: '#111827' }}>{order.name}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <MapPin size={11} color="#6B7280" />
                        <span className="text-xs" style={{ color: '#4B5563' }}>{order.address}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        <Clock size={11} color="#D97706" />
                        <span className="text-xs font-bold" style={{ color: '#D97706' }}>{order.time}</span>
                      </div>
                      <ChevronDown 
                        size={16} 
                        color="#6B7280" 
                        style={{ transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} 
                      />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isSelected && (
                    <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: '#F3F4F6' }}>
                      <div className="text-xs font-semibold mb-2 mt-2" style={{ color: '#6B7280', textTransform: 'uppercase' }}>
                        Cajas a recoger
                      </div>
                      <div className="flex flex-col gap-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2.5">
                            <div className="rounded-md flex items-center justify-center"
                              style={{ width: 22, height: 22, background: `${item.color}18`, border: `1px solid ${item.color}30`, flexShrink: 0 }}>
                              <Package size={10} color={item.color} />
                            </div>
                            <span className="text-sm font-medium" style={{ color: '#374151' }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px dashed #E5E7EB' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: '#6B7280' }}>Ubicación:</span>
                          {order.pallets.map(p => (
                            <span key={p} className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                              Palet {p}
                            </span>
                          ))}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onSwitch(); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                          style={{ background: DAMM_RED, color: 'white', border: 'none', cursor: 'pointer' }}>
                          <Play size={10} fill="white" />
                          Iniciar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPI BAR ── */}
      <footer className="flex items-center gap-3 px-6"
        style={{ height: 58, background: '#F9FAFB', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
        <span className="text-xs font-semibold mr-1" style={{ color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>KPIs</span>
        <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
        <KPICard icon={Truck} label="Ocupación camión" value="78%" accent />
        <KPICard icon={Zap} label="Acceso directo" value="86%" />
        <KPICard icon={RotateCcw} label="Retornables" value="Espacio reservado" />
        <KPICard icon={BarChart2} label="Búsqueda estimada" value="Baja ↓" />
        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-full" style={{ width: 6, height: 6, background: '#059669' }} />
          <span className="text-xs" style={{ color: '#6B7280' }}>Sistema operativo · Sync 08:43</span>
        </div>
      </footer>
    </div>
  );
}
