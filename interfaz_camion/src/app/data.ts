export const BRANDS = {
  estrellaDamm:  { name: 'Estrella Damm',      top: '#D4A020', front: '#9A7412', side: '#6A5010', abbr: 'ED',  isBarrel: false },
  xibeca:        { name: 'Xibeca',              top: '#2E8A2E', front: '#1C681C', side: '#124C12', abbr: 'XIB', isBarrel: false },
  dammLemon:     { name: 'Damm Lemon',          top: '#F0D800', front: '#C0A000', side: '#907000', abbr: 'DL',  isBarrel: false },
  freeDamm:      { name: 'Free Damm',           top: '#00A8D0', front: '#0078A0', side: '#005070', abbr: 'FD',  isBarrel: false },
  nestea:        { name: 'Nestea',              top: '#E87018', front: '#A84E10', side: '#783808', abbr: 'NST', isBarrel: false },
  cacaolat:      { name: 'Cacaolat',            top: '#8A4210', front: '#5A2808', side: '#3A1805', abbr: 'CAC', isBarrel: false },
  aguaVeri:      { name: 'Agua Verí',           top: '#20B0E8', front: '#1680B0', side: '#105878', abbr: 'AV',  isBarrel: false },
  barrilED30:    { name: 'Barril ED 30L',       top: '#606060', front: '#3A3A3A', side: '#252525', abbr: 'B30', isBarrel: true  },
  barrilVollDamm:{ name: 'Barril Voll-Damm 30L',top: '#507080', front: '#304858', side: '#203040', abbr: 'VD',  isBarrel: true  },
  retornable:    { name: 'Retornables',         top: '#3A4050', front: '#282E3A', side: '#1C2230', abbr: 'RET', isBarrel: false },
} as const;

export type BrandKey = keyof typeof BRANDS;

export interface ProductInfo { brand: string; qty: number; unit: string; }

export interface PalletInfo {
  id: string;
  x0: number; x1: number;
  y0: number; y1: number;
  stops: string;
  sideStr: string;
  occupancy: number;
  cols: [BrandKey, BrandKey];
  products: ProductInfo[];
  totalItems: string;
  typeLabel: string;
  accentColor: string;
}

export const INITIAL_PALLET_DATA: PalletInfo[] = [
  {
    id: 'P1', x0: 0.15, x1: 2.75, y0: 0.3, y1: 2.7,
    stops: 'Paradas 1–4', sideStr: 'Lateral izquierdo', occupancy: 82,
    cols: ['estrellaDamm', 'estrellaDamm'], typeLabel: 'Cajas', accentColor: '#D4A020',
    products: [
      { brand: 'Estrella Damm 33cl', qty: 18, unit: 'cajas ×24' },
      { brand: 'Estrella Damm Llauna', qty: 4, unit: 'cajas ×24' },
    ],
    totalItems: '528 uds.',
  },
  {
    id: 'P2', x0: 0.15, x1: 2.75, y0: 3.0, y1: 5.4,
    stops: 'Paradas 5–8', sideStr: 'Lateral izquierdo', occupancy: 75,
    cols: ['xibeca', 'freeDamm'], typeLabel: 'Mixto', accentColor: '#2E8A2E',
    products: [
      { brand: 'Xibeca 33cl', qty: 12, unit: 'cajas ×24' },
      { brand: 'Free Damm 33cl', qty: 8, unit: 'cajas ×24' },
    ],
    totalItems: '480 uds.',
  },
  {
    id: 'P3', x0: 0.15, x1: 2.75, y0: 5.7, y1: 8.1,
    stops: 'Paradas 9–12', sideStr: 'Lateral izquierdo', occupancy: 90,
    cols: ['barrilED30', 'barrilVollDamm'], typeLabel: 'Barriles', accentColor: '#8B5CF6',
    products: [
      { brand: 'Barril Estrella Damm 30L', qty: 4, unit: 'uds.' },
      { brand: 'Barril Voll-Damm 30L', qty: 2, unit: 'uds.' },
    ],
    totalItems: '6 barriles',
  },
  {
    id: 'P4', x0: 0.15, x1: 2.75, y0: 8.4, y1: 10.8,
    stops: 'Paradas 13–18', sideStr: 'Lateral izquierdo', occupancy: 45,
    cols: ['retornable', 'retornable'], typeLabel: 'Retornables', accentColor: '#10B981',
    products: [
      { brand: 'Cajas vacías Estrella Damm', qty: 24, unit: 'cajas' },
      { brand: 'Cajas vacías Xibeca', qty: 12, unit: 'cajas' },
    ],
    totalItems: '36 cajas vacías',
  },
  {
    id: 'P5', x0: 5.25, x1: 7.85, y0: 0.3, y1: 2.7,
    stops: 'Paradas 1–4', sideStr: 'Lateral derecho', occupancy: 88,
    cols: ['estrellaDamm', 'aguaVeri'], typeLabel: 'Cajas', accentColor: '#3B82F6',
    products: [
      { brand: 'Estrella Damm 33cl', qty: 4, unit: 'cajas ×24' },
      { brand: 'Agua Verí 50cl', qty: 2, unit: 'cajas ×12' },
    ],
    totalItems: '120 uds.',
  },
  {
    id: 'P6', x0: 5.25, x1: 7.85, y0: 3.0, y1: 5.4,
    stops: 'Paradas 5–8', sideStr: 'Lateral derecho', occupancy: 70,
    cols: ['dammLemon', 'nestea'], typeLabel: 'Mixto', accentColor: '#F59E0B',
    products: [
      { brand: 'Damm Lemon 33cl', qty: 10, unit: 'cajas ×24' },
      { brand: 'Nestea Limón', qty: 6, unit: 'cajas ×24' },
    ],
    totalItems: '384 uds.',
  },
  {
    id: 'P7', x0: 5.25, x1: 7.85, y0: 5.7, y1: 8.1,
    stops: 'Paradas 9–12', sideStr: 'Lateral derecho', occupancy: 85,
    cols: ['barrilED30', 'barrilED30'], typeLabel: 'Barriles', accentColor: '#8B5CF6',
    products: [
      { brand: 'Barril Estrella Damm 30L', qty: 6, unit: 'uds.' },
      { brand: 'Barril Voll-Damm 30L', qty: 2, unit: 'uds.' },
    ],
    totalItems: '8 barriles',
  },
  {
    id: 'P8', x0: 5.25, x1: 7.85, y0: 8.4, y1: 10.8,
    stops: 'Paradas 13–18', sideStr: 'Lateral derecho', occupancy: 30,
    cols: ['cacaolat', 'nestea'], typeLabel: 'Mixto', accentColor: '#10B981',
    products: [
      { brand: 'Cacaolat 200ml', qty: 8, unit: 'cajas ×20' },
      { brand: 'Nestea Melocotón', qty: 4, unit: 'cajas ×24' },
    ],
    totalItems: '256 uds.',
  },
];
