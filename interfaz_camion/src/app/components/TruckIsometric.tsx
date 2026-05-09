import React, { useState, useRef } from 'react';
import { usePallets } from '../store';

// ── Isometric projection ─────────────────────────────────────────────────────
const SCALE = 17;
const OX = 370;
const OY = 158;

function iso(x: number, y: number, z: number): [number, number] {
  return [
    OX + (x - y) * SCALE * 0.866,
    OY + (x + y) * SCALE * 0.5 - z * SCALE,
  ];
}
function pts(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

// ── Truck dimensions ──────────────────────────────────────────────────────────
const TW = 8, TD = 12, TH = 4.5;
const BASE_H = 0.30;   // wooden pallet base height
const Z1 = 1.42;       // total pallet + cargo height
const LAYER_H = (Z1 - BASE_H) / 2; // box layer height ≈ 0.56

// ── Brand definitions ────────────────────────────────────────────────────────
import { BRANDS, BrandKey, PalletInfo, ProductInfo } from '../data';

// ── Wooden pallet base renderer ───────────────────────────────────────────────
function WoodenBase({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  const plankYs: number[] = [];
  for (let yl = y0 + 0.28; yl < y1 - 0.05; yl += 0.28) plankYs.push(yl);

  return (
    <>
      {/* Right face */}
      <polygon points={pts([iso(x1,y0,0), iso(x1,y1,0), iso(x1,y1,BASE_H), iso(x1,y0,BASE_H)])} fill="#5C3A10" />
      {/* Right face stringer horizontal lines */}
      {[BASE_H*0.35, BASE_H*0.68].map((sz, i) => (
        <line key={`rs${i}`} x1={iso(x1,y0,sz)[0]} y1={iso(x1,y0,sz)[1]} x2={iso(x1,y1,sz)[0]} y2={iso(x1,y1,sz)[1]} stroke="#3A2208" strokeWidth="0.8" />
      ))}
      {/* Right face vertical board separators */}
      {[x0+(x1-x0)*0.33, x0+(x1-x0)*0.66].map((xv, i) => (
        <line key={`rv${i}`} x1={iso(xv,y0,0)[0]} y1={iso(xv,y0,0)[1]} x2={iso(xv,y0,BASE_H)[0]} y2={iso(xv,y0,BASE_H)[1]} stroke="#3A2208" strokeWidth="0.6" opacity={0.5} />
      ))}

      {/* Front face */}
      <polygon points={pts([iso(x0,y0,0), iso(x1,y0,0), iso(x1,y0,BASE_H), iso(x0,y0,BASE_H)])} fill="#6E4618" />
      {/* Front face stringer lines */}
      {[BASE_H*0.35, BASE_H*0.68].map((sz, i) => (
        <line key={`fs${i}`} x1={iso(x0,y0,sz)[0]} y1={iso(x0,y0,sz)[1]} x2={iso(x1,y0,sz)[0]} y2={iso(x1,y0,sz)[1]} stroke="#4A3010" strokeWidth="0.8" />
      ))}
      {/* Front face vertical board gaps */}
      {[x0+(x1-x0)*0.33, x0+(x1-x0)*0.66].map((xv, i) => (
        <line key={`fv${i}`} x1={iso(xv,y0,0)[0]} y1={iso(xv,y0,0)[1]} x2={iso(xv,y0,BASE_H)[0]} y2={iso(xv,y0,BASE_H)[1]} stroke="#4A3010" strokeWidth="0.9" />
      ))}

      {/* Top face (pallet deck) */}
      <polygon points={pts([iso(x0,y0,BASE_H), iso(x1,y0,BASE_H), iso(x1,y1,BASE_H), iso(x0,y1,BASE_H)])} fill="#7A5020" />
      {/* Deck plank lines running across width (x direction) at y intervals */}
      {plankYs.map((yl, i) => (
        <line key={`pl${i}`}
          x1={iso(x0+0.04, yl, BASE_H)[0]} y1={iso(x0+0.04, yl, BASE_H)[1]}
          x2={iso(x1-0.04, yl, BASE_H)[0]} y2={iso(x1-0.04, yl, BASE_H)[1]}
          stroke="#5A3C14" strokeWidth="0.7"
        />
      ))}
      {/* Deck board gap line at x center (stringer gap) */}
      <line
        x1={iso((x0+x1)/2, y0+0.04, BASE_H)[0]} y1={iso((x0+x1)/2, y0+0.04, BASE_H)[1]}
        x2={iso((x0+x1)/2, y1-0.04, BASE_H)[0]} y2={iso((x0+x1)/2, y1-0.04, BASE_H)[1]}
        stroke="#5A3C14" strokeWidth="0.5"
      />
    </>
  );
}

// ── Cargo column renderer (boxes) ─────────────────────────────────────────────
function BoxStack({ x0, x1, y0, y1, zBase, zTop, brandKey }: {
  x0: number; x1: number; y0: number; y1: number;
  zBase: number; zTop: number; brandKey: BrandKey;
}) {
  const brand = BRANDS[brandKey];
  const layers = 2;
  const lh = (zTop - zBase) / layers;
  const xMid = (x0 + x1) / 2;

  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const lz0 = zBase + i * lh + (i > 0 ? 0.025 : 0);
        const lz1 = zBase + (i + 1) * lh - 0.025;
        const [faceCx, faceCy] = iso(xMid, y0, (lz0 + lz1) / 2);
        return (
          <React.Fragment key={i}>
            {/* Right face */}
            <polygon points={pts([iso(x1,y0,lz0),iso(x1,y1,lz0),iso(x1,y1,lz1),iso(x1,y0,lz1)])} fill={brand.side} />
            {/* Right face individual box separator */}
            <line x1={iso(x1,(y0+y1)/2,lz0)[0]} y1={iso(x1,(y0+y1)/2,lz0)[1]} x2={iso(x1,(y0+y1)/2,lz1)[0]} y2={iso(x1,(y0+y1)/2,lz1)[1]} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
            {/* Front face */}
            <polygon points={pts([iso(x0,y0,lz0),iso(x1,y0,lz0),iso(x1,y0,lz1),iso(x0,y0,lz1)])} fill={brand.front} />
            {/* Front face center divider */}
            <line x1={iso(xMid,y0,lz0)[0]} y1={iso(xMid,y0,lz0)[1]} x2={iso(xMid,y0,lz1)[0]} y2={iso(xMid,y0,lz1)[1]} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
            {/* Brand logo/abbreviation on front face */}
            {(() => {
              if (brandKey === 'estrellaDamm') {
                return (
                  <g transform={`translate(${faceCx}, ${faceCy}) scale(0.6)`}>
                    <polygon points="0,-5 1.5,-1.5 5,-1.5 2,0.8 3,4.5 0,2.5 -3,4.5 -2,0.8 -5,-1.5 -1.5,-1.5" fill="#E32636" />
                  </g>
                );
              } else if (brandKey === 'dammLemon') {
                return (
                  <g transform={`translate(${faceCx}, ${faceCy}) scale(0.6)`}>
                    <circle cx="0" cy="0" r="3.5" fill="#FFE100" />
                    <circle cx="0" cy="0" r="2.5" fill="#FFF" opacity="0.3" />
                  </g>
                );
              } else if (brandKey === 'freeDamm') {
                return (
                  <text x={faceCx} y={faceCy + 2.5} textAnchor="middle"
                    fill="#000" fontSize="7" fontWeight="900"
                    fontFamily="system-ui, sans-serif" style={{ userSelect: 'none' }}>
                    0,0
                  </text>
                );
              } else if (brandKey === 'cacaolat') {
                return (
                  <g transform={`translate(${faceCx}, ${faceCy}) scale(0.6)`}>
                    <ellipse cx="0" cy="0" rx="2.5" ry="4" fill="#F0D800" />
                    <text x="0" y="1.5" textAnchor="middle" fill="#5A2808" fontSize="4" fontWeight="bold">C</text>
                  </g>
                );
              } else {
                return (
                  <text x={faceCx} y={faceCy + 2.5} textAnchor="middle"
                    fill="rgba(255,255,255,0.85)" fontSize="6.5" fontWeight="800"
                    fontFamily="system-ui, sans-serif" style={{ userSelect: 'none', letterSpacing: '0.3px' }}>
                    {brand.abbr}
                  </text>
                );
              }
            })()}
            {/* Top face */}
            <polygon points={pts([iso(x0,y0,lz1),iso(x1,y0,lz1),iso(x1,y1,lz1),iso(x0,y1,lz1)])} fill={brand.top} />
            {/* Top face box grid lines */}
            <line x1={iso(xMid,y0+0.03,lz1)[0]} y1={iso(xMid,y0+0.03,lz1)[1]} x2={iso(xMid,y1-0.03,lz1)[0]} y2={iso(xMid,y1-0.03,lz1)[1]} stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
            <line x1={iso(x0+0.03,(y0+y1)/2,lz1)[0]} y1={iso(x0+0.03,(y0+y1)/2,lz1)[1]} x2={iso(x1-0.03,(y0+y1)/2,lz1)[0]} y2={iso(x1-0.03,(y0+y1)/2,lz1)[1]} stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Barrel column renderer ────────────────────────────────────────────────────
function BarrelPair({ x0, x1, y0, y1, zBase, zTop, brandKey }: {
  x0: number; x1: number; y0: number; y1: number;
  zBase: number; zTop: number; brandKey: BrandKey;
}) {
  const brand = BRANDS[brandKey];
  const yMid = (y0 + y1) / 2;
  const slots = [{ by0: y0 + 0.05, by1: yMid - 0.05 }, { by0: yMid + 0.05, by1: y1 - 0.05 }];

  return (
    <>
      {slots.map(({ by0, by1 }, si) => {
        const bz0 = zBase, bz1 = zTop;
        const [ocx, ocy] = iso((x0+x1)/2, (by0+by1)/2, bz1);
        // Ellipse axes in iso space
        const [ex0] = iso(x0, (by0+by1)/2, bz1);
        const [ex1] = iso(x1, (by0+by1)/2, bz1);
        const [, ey0] = iso((x0+x1)/2, by0, bz1);
        const [, ey1] = iso((x0+x1)/2, by1, bz1);
        const rx = Math.abs(ex1 - ex0) * 0.4;
        const ry = Math.abs(ey1 - ey0) * 0.4;
        const HOOPS = [0.22, 0.5, 0.78];

        return (
          <React.Fragment key={si}>
            {/* Barrel body – right face */}
            <polygon points={pts([iso(x1,by0,bz0),iso(x1,by1,bz0),iso(x1,by1,bz1),iso(x1,by0,bz1)])} fill={brand.side} />
            {/* Metal hoops on right face */}
            {HOOPS.map((r, hi) => {
              const hz = bz0 + r*(bz1-bz0), bh = 0.04;
              return <polygon key={hi} points={pts([iso(x1,by0,hz-bh),iso(x1,by1,hz-bh),iso(x1,by1,hz+bh),iso(x1,by0,hz+bh)])} fill="#B0B0B0" opacity={0.65} />;
            })}
            {/* Barrel body – front face */}
            <polygon points={pts([iso(x0,by0,bz0),iso(x1,by0,bz0),iso(x1,by0,bz1),iso(x0,by0,bz1)])} fill={brand.front} />
            {/* Metal hoops on front face */}
            {HOOPS.map((r, hi) => {
              const hz = bz0 + r*(bz1-bz0), bh = 0.04;
              return <polygon key={hi} points={pts([iso(x0,by0,hz-bh),iso(x1,by0,hz-bh),iso(x1,by0,hz+bh),iso(x0,by0,hz+bh)])} fill="#B8B8B8" opacity={0.65} />;
            })}
            {/* Barrel label on front */}
            {(() => {
              const [cx, cy] = iso((x0+x1)/2, by0, (bz0+bz1)/2);
              if (brandKey === 'barrilED30') {
                return (
                  <g transform={`translate(${cx}, ${cy}) scale(0.7)`}>
                    <polygon points="0,-5 1.5,-1.5 5,-1.5 2,0.8 3,4.5 0,2.5 -3,4.5 -2,0.8 -5,-1.5 -1.5,-1.5" fill="#E32636" />
                  </g>
                );
              }
              return <text x={cx} y={cy+2.5} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="6" fontWeight="800" fontFamily="system-ui, sans-serif" style={{ userSelect: 'none' }}>{brand.abbr}</text>;
            })()}
            {/* Top face */}
            <polygon points={pts([iso(x0,by0,bz1),iso(x1,by0,bz1),iso(x1,by1,bz1),iso(x0,by1,bz1)])} fill={brand.top} />
            {/* Barrel top oval */}
            <ellipse cx={ocx} cy={ocy} rx={rx} ry={ry} fill={brand.top} stroke="#C0C0C0" strokeWidth="1.0" opacity={0.8} />
            {/* Bung hole */}
            <circle cx={ocx} cy={ocy} r={2.2} fill="#1A1A1A" opacity={0.7} />
            <circle cx={ocx} cy={ocy} r={1.1} fill="#888888" />
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Full pallet group ─────────────────────────────────────────────────────────
function PalletGroup({
  pallet, highlighted, dimmed, onPointerDown, dragging
}: {
  pallet: PalletInfo; highlighted: boolean; dimmed: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  dragging?: boolean;
}) {
  const { x0, x1, y0, y1, cols } = pallet;
  const midX = (x0 + x1) / 2;
  const gap = 0.07;
  const col1x0 = x0 + 0.06, col1x1 = midX - gap / 2;
  const col2x0 = midX + gap / 2, col2x1 = x1 - 0.06;
  const cy0 = y0 + 0.06, cy1 = y1 - 0.06;
  const opacity = dimmed ? 0.12 : 1;

  const CargoRenderer = ({ bk, cx0, cx1 }: { bk: BrandKey; cx0: number; cx1: number }) => {
    return BRANDS[bk].isBarrel
      ? <BarrelPair x0={cx0} x1={cx1} y0={cy0} y1={cy1} zBase={BASE_H} zTop={Z1} brandKey={bk} />
      : <BoxStack x0={cx0} x1={cx1} y0={cy0} y1={cy1} zBase={BASE_H} zTop={Z1} brandKey={bk} />;
  };

  return (
    <g opacity={opacity} onPointerDown={onPointerDown} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
      {/* Floor shadow */}
      <polygon
        points={pts([iso(x0+0.1,y0+0.1,0.01),iso(x1-0.1,y0+0.1,0.01),iso(x1-0.1,y1-0.1,0.01),iso(x0+0.1,y1-0.1,0.01)])}
        fill="rgba(0,0,0,0.5)"
      />

      {/* Wooden base */}
      <WoodenBase x0={x0} x1={x1} y0={y0} y1={y1} />

      {/* Cargo columns */}
      <CargoRenderer bk={cols[0]} cx0={col1x0} cx1={col1x1} />
      <CargoRenderer bk={cols[1]} cx0={col2x0} cx1={col2x1} />

      {/* Column separator line on top */}
      <line
        x1={iso(midX, y0+0.04, Z1)[0]} y1={iso(midX, y0+0.04, Z1)[1]}
        x2={iso(midX, y1-0.04, Z1)[0]} y2={iso(midX, y1-0.04, Z1)[1]}
        stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"
      />

      {/* Highlight glow (screen 2) */}
      {highlighted && (
        <>
          <polygon points={pts([
            iso(x0-0.18,y0-0.18,Z1+0.1), iso(x1+0.18,y0-0.18,Z1+0.1),
            iso(x1+0.18,y1+0.18,Z1+0.1), iso(x0-0.18,y1+0.18,Z1+0.1),
          ])} fill="none" stroke="#F59E0B" strokeWidth="2.5" opacity={0.9} />
          <polygon points={pts([
            iso(x0-0.32,y0-0.32,Z1+0.18), iso(x1+0.32,y0-0.32,Z1+0.18),
            iso(x1+0.32,y1+0.32,Z1+0.18), iso(x0-0.32,y1+0.32,Z1+0.18),
          ])} fill="none" stroke="#F59E0B" strokeWidth="1" opacity={0.35} />
        </>
      )}

      {/* Pallet ID label */}
      {(() => {
        const [lx, ly] = iso((x0+x1)/2, (y0+y1)/2, Z1 + 0.18);
        return (
          <text x={lx} y={ly+3} textAnchor="middle" fill="white" fontSize="9.5" fontWeight="900"
            fontFamily="system-ui, sans-serif"
            style={{ userSelect: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}>
            {pallet.id}
          </text>
        );
      })()}
    </g>
  );
}

// ── Pallet info popup ─────────────────────────────────────────────────────────
function PalletPopup({ pallet, onClose }: { pallet: PalletInfo; onClose: () => void }) {
  const isLeft = (pallet.x0 + pallet.x1) / 2 < 4;
  const [anchorX, anchorY] = isLeft
    ? iso(pallet.x1, (pallet.y0 + pallet.y1) / 2, Z1)
    : iso(pallet.x0, (pallet.y0 + pallet.y1) / 2, Z1);

  const popW = 196, popH = 178;
  const rawX = isLeft ? anchorX + 10 : anchorX - popW - 10;
  const rawY = anchorY - popH / 2;
  const fx = Math.max(4, Math.min(680 - popW - 4, rawX));
  const fy = Math.max(4, Math.min(400 - popH - 4, rawY));

  const col0Brand = BRANDS[pallet.cols[0]];
  const col1Brand = BRANDS[pallet.cols[1]];

  return (
    <foreignObject x={fx} y={fy} width={popW} height={popH} style={{ overflow: 'visible' }}>
      {/* @ts-ignore */}
      <div xmlns="http://www.w3.org/1999/xhtml" style={{
        background: '#FFFFFF',
        border: `1.5px solid ${pallet.accentColor}55`,
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#111827',
        boxShadow: `0 8px 28px rgba(0,0,0,0.15), 0 0 0 1px ${pallet.accentColor}22`,
        width: popW, height: popH,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 26, height: 26, background: pallet.accentColor,
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900, color: '#FFFFFF', flexShrink: 0,
            }}>{pallet.id}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{pallet.typeLabel}</div>
              <div style={{ fontSize: 9, color: '#4B5563' }}>{pallet.sideStr} · {pallet.stops}</div>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280',
            cursor: 'pointer', width: 20, height: 20, borderRadius: 5,
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>×</button>
        </div>

        {/* Brand indicators */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[col0Brand, col1Brand].map((b, i) => (
            <div key={i} style={{
              flex: 1, background: `${b.top}18`, border: `1px solid ${b.top}40`,
              borderRadius: 6, padding: '4px 6px', textAlign: 'center',
            }}>
              <div style={{ width: 10, height: 10, background: b.top, borderRadius: 3, margin: '0 auto 3px' }} />
              <div style={{ fontSize: 8, color: '#374151', fontWeight: 700, lineHeight: 1 }}>{b.abbr}</div>
            </div>
          ))}
        </div>

        {/* Products */}
        <div style={{ marginBottom: 8 }}>
          {pallet.products.map((prod, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, background: BRANDS[pallet.cols[Math.min(i, 1)]].top, borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#111827', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.brand}</div>
                <div style={{ fontSize: 8.5, color: '#4B5563' }}>{prod.qty} {prod.unit}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #E5E7EB', paddingTop: 7,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#4B5563' }}>Total: {pallet.totalItems}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: pallet.accentColor, fontWeight: 700 }}>
              {Math.round((pallet.occupancy / 100) * (pallet.typeLabel === 'Barriles' ? 20 : 60))}/{pallet.typeLabel === 'Barriles' ? '20' : '60'} {pallet.typeLabel === 'Barriles' ? 'ud' : 'cj'}
            </span>
            <div style={{ width: 38, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pallet.occupancy}%`, height: '100%', background: pallet.accentColor, borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>
    </foreignObject>
  );
}

// ── Truck Cabin (Front of truck, drawn behind trailer) ────────────────────────
function TruckCabin() {
  const cx0 = 0.5, cx1 = 7.5, cy0 = -3.5, cy1 = -0.2, cz0 = 0, cz1 = 3.2, czChassis = 0.5;
  
  // Calculate center points for the deflector face to place the logo
  const [logoX, logoY] = iso((cx0 + cx1) / 2, cy0 + (cy1 - cy0) * 0.5, cz1 + 0.65);

  return (
    <g className="truck-cabin">
      {/* Chassis right and front */}
      <polygon points={pts([iso(cx1,cy0,0),iso(cx1,cy1,0),iso(cx1,cy1,czChassis),iso(cx1,cy0,czChassis)])} fill="#1F2937" />
      <polygon points={pts([iso(cx0,cy0,0),iso(cx1,cy0,0),iso(cx1,cy0,czChassis),iso(cx0,cy0,czChassis)])} fill="#030712" />
      
      {/* Cab right and front */}
      <polygon points={pts([iso(cx1,cy0,czChassis),iso(cx1,cy1,czChassis),iso(cx1,cy1,cz1),iso(cx1,cy0,cz1)])} fill="#A30D1B" />
      <polygon points={pts([iso(cx0,cy0,czChassis),iso(cx1,cy0,czChassis),iso(cx1,cy0,cz1),iso(cx0,cy0,cz1)])} fill="#CC1122" />
      
      {/* Windshield (Front) */}
      <polygon points={pts([iso(cx0+0.5,cy0,czChassis+1.0),iso(cx1-0.5,cy0,czChassis+1.0),iso(cx1-0.5,cy0,cz1-0.4),iso(cx0+0.5,cy0,cz1-0.4)])} fill="#1E3A8A" opacity={0.8} />
      {/* Side Window (Right) */}
      <polygon points={pts([iso(cx1,cy0+0.4,czChassis+1.0),iso(cx1,cy1-0.6,czChassis+1.0),iso(cx1,cy1-0.6,cz1-0.4),iso(cx1,cy0+0.4,cz1-0.4)])} fill="#1E3A8A" opacity={0.8} />
      
      {/* Grill (Front) */}
      <polygon points={pts([iso(cx0+2.5,cy0,czChassis+0.1),iso(cx1-2.5,cy0,czChassis+0.1),iso(cx1-2.5,cy0,czChassis+0.8),iso(cx0+2.5,cy0,czChassis+0.8)])} fill="#000000" />
      {/* Headlights */}
      <polygon points={pts([iso(cx0+0.8,cy0,czChassis+0.3),iso(cx0+1.8,cy0,czChassis+0.3),iso(cx0+1.8,cy0,czChassis+0.6),iso(cx0+0.8,cy0,czChassis+0.6)])} fill="#FDF08B" />
      <polygon points={pts([iso(cx1-1.8,cy0,czChassis+0.3),iso(cx1-0.8,cy0,czChassis+0.3),iso(cx1-0.8,cy0,czChassis+0.6),iso(cx1-1.8,cy0,czChassis+0.6)])} fill="#FDF08B" />

      {/* Roof Deflector */}
      <polygon points={pts([iso(cx0,cy0,cz1),iso(cx1,cy0,cz1),iso(cx1,cy1,cz1+1.3),iso(cx0,cy1,cz1+1.3)])} fill="#E61527" />
      <polygon points={pts([iso(cx1,cy0,cz1),iso(cx1,cy1,cz1),iso(cx1,cy1,cz1+1.3)])} fill="#8A0B17" />
      
      {/* Front Wheel (Right) */}
      <polygon points={pts([
        iso(cx1, cy0+0.6, 0.4), iso(cx1, cy0+1.6, 0.4), 
        iso(cx1, cy0+1.6, -0.6), iso(cx1, cy0+0.6, -0.6)
      ])} fill="#111827" />
      <polygon points={pts([
        iso(cx1, cy0+0.9, 0.1), iso(cx1, cy0+1.3, 0.1), 
        iso(cx1, cy0+1.3, -0.3), iso(cx1, cy0+0.9, -0.3)
      ])} fill="#9CA3AF" />
    </g>
  );
}

// ── Main TruckIsometric component ────────────────────────────────────────────
export interface TruckIsometricProps {
  highlightPallets?: string[];
  dimOthers?: boolean;
  showCallout?: boolean;
}

export function TruckIsometric({
  highlightPallets = [], dimOthers = false, showCallout = false,
}: TruckIsometricProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { pallets, updatePallet } = usePallets();
  
  const [dragState, setDragState] = useState<{
    id: string; startX: number; startY: number; initX0: number; initX1: number; initY0: number; initY1: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const handlePointerDown = (e: React.PointerEvent, pallet: PalletInfo) => {
    e.stopPropagation();
    setSelectedId(pallet.id === selectedId ? null : pallet.id);
    
    // Check if e.target is an SVGElement before capturing
    if (e.target instanceof SVGElement) {
      e.target.setPointerCapture(e.pointerId);
    }
    
    setDragState({
      id: pallet.id,
      startX: e.clientX,
      startY: e.clientY,
      initX0: pallet.x0,
      initX1: pallet.x1,
      initY0: pallet.y0,
      initY1: pallet.y1,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const scaleX = 680 / svgRect.width;
    const scaleY = 400 / svgRect.height;
    const dx_svg = (e.clientX - dragState.startX) * scaleX;
    const dy_svg = (e.clientY - dragState.startY) * scaleY;

    // Inverse of iso mapping (Z is assumed constant for the pallet base)
    // d_isoX = 0.5 * (dx_svg / (SCALE * 0.866) + dy_svg / (SCALE * 0.5))
    // d_isoY = 0.5 * (dy_svg / (SCALE * 0.5) - dx_svg / (SCALE * 0.866))
    const s_dx = dx_svg / (17 * 0.866);
    const s_dy = dy_svg / (17 * 0.5);
    const d_isoX = 0.5 * (s_dx + s_dy);
    const d_isoY = 0.5 * (s_dy - s_dx);

    updatePallet(dragState.id, {
      x0: dragState.initX0 + d_isoX,
      x1: dragState.initX1 + d_isoX,
      y0: dragState.initY0 + d_isoY,
      y1: dragState.initY1 + d_isoY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState && e.target instanceof SVGElement) {
      e.target.releasePointerCapture(e.pointerId);
    }
    setDragState(null);
  };

  const sorted = [...pallets].sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0));
  const selectedPallet = pallets.find((p) => p.id === selectedId) ?? null;

  // Callout for P5
  const p5 = pallets.find((p) => p.id === 'P5')!;
  const [p5cx, p5cy] = iso((p5.x0 + p5.x1) / 2, (p5.y0 + p5.y1) / 2, Z1 + 0.9);
  const cbx = p5cx + 58, cby = p5cy - 36;

  return (
    <svg
      ref={svgRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={() => setSelectedId(null)}
      viewBox="0 0 680 400"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#1C2B3E" />
          <stop offset="100%" stopColor="#121C28" />
        </linearGradient>
        <linearGradient id="backGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F1520" />
          <stop offset="100%" stopColor="#0A1018" />
        </linearGradient>
        <marker id="arr" markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#F59E0B" />
        </marker>
      </defs>

      {/* ── TRUCK CABIN (Front of truck) ── */}
      <TruckCabin />

      {/* ── TRAILER FRONT WALL (Behind pallets) ── */}
      <polygon points={pts([iso(0,0,0),iso(TW,0,0),iso(TW,0,TH),iso(0,0,TH)])} fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />
      {[1,2,3,4,5,6,7].map(x => (
        <line key={`fw${x}`} x1={iso(x,0,0)[0]} y1={iso(x,0,0)[1]} x2={iso(x,0,TH)[0]} y2={iso(x,0,TH)[1]} stroke="#E5E7EB" strokeWidth="1" />
      ))}

      {/* ── BACKGROUND / WALLS (Clean & Light) ── */}
      {/* ── FLOOR ── */}
      <polygon points={pts([iso(-0.1,-0.1,-0.1),iso(TW+0.1,-0.1,-0.1),iso(TW+0.1,TD+0.1,-0.1),iso(-0.1,TD+0.1,-0.1)])} fill="#D1D5DB" />
      <polygon points={pts([iso(0,0,0),iso(TW,0,0),iso(TW,TD,0),iso(0,TD,0)])} fill="#F9FAFB" />
      {/* Centre aisle dashed */}
      <line x1={iso(4,0,0.02)[0]} y1={iso(4,0,0.02)[1]} x2={iso(4,TD,0.02)[0]} y2={iso(4,TD,0.02)[1]}
        stroke="#E5E7EB" strokeWidth="1.1" strokeDasharray="5,5" />

      {/* ── PALLETS (back → front) ── */}
      {sorted.map((pallet) => {
        const isHighlighted = highlightPallets.includes(pallet.id);
        const shouldDim = dimOthers ? highlightPallets.length > 0 && !isHighlighted : false;
        return (
          <PalletGroup
            key={pallet.id}
            pallet={pallet}
            highlighted={isHighlighted}
            dimmed={shouldDim}
            onPointerDown={(e) => handlePointerDown(e, pallet)}
            dragging={dragState?.id === pallet.id}
          />
        );
      })}



      {/* ── CALLOUT (Screen 2 P5) ── */}
      {showCallout && highlightPallets.includes('P5') && (
        <g>
          <line x1={cbx+2} y1={cby+18} x2={p5cx+2} y2={p5cy+2}
            stroke="#F59E0B" strokeWidth="1.5" markerEnd="url(#arr)" />
          <rect x={cbx-4} y={cby-11} width={88} height={26} rx={6}
            fill="#0B1622" stroke="#F59E0B" strokeWidth="1.5" />
          <text x={cbx+40} y={cby+4} textAnchor="middle"
            fill="#F59E0B" fontSize="9.5" fontWeight="800"
            fontFamily="system-ui, sans-serif">↓ Recoger aquí</text>
        </g>
      )}

      {/* ── POPUP ── */}
      {selectedPallet && (
        <PalletPopup pallet={selectedPallet} onClose={() => setSelectedId(null)} />
      )}
    </svg>
  );
}