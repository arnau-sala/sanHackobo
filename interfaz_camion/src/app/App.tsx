import React, { useState } from 'react';
import { OverviewScreen } from './components/OverviewScreen';
import { NextStopScreen } from './components/NextStopScreen';

export default function App() {
  const [screen, setScreen] = useState<'overview' | 'nextstop'>('overview');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#080E16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      {/* Screen switcher tabs */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
          zIndex: 100,
          background: 'rgba(8,14,22,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #1E2C40',
          borderRadius: 12,
          padding: '4px 6px',
        }}
      >
        {[
          { id: 'overview' as const, label: '① Vista General de Carga' },
          { id: 'nextstop' as const, label: '② Próxima Parada' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: screen === id ? 700 : 500,
              fontFamily: 'system-ui, sans-serif',
              background: screen === id ? '#CC1122' : 'transparent',
              color: screen === id ? 'white' : '#6B8CAE',
              transition: 'all 0.15s ease',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active screen */}
      <div
        style={{
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #1E2C40',
        }}
      >
        {screen === 'overview' ? (
          <OverviewScreen onSwitch={() => setScreen('nextstop')} />
        ) : (
          <NextStopScreen onSwitch={() => setScreen('overview')} />
        )}
      </div>
    </div>
  );
}
