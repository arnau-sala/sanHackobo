import { useState, useEffect } from 'react';
import { INITIAL_PALLET_DATA, PalletInfo } from './data';

let pallets = [...INITIAL_PALLET_DATA];
const listeners = new Set<() => void>();

export const usePallets = () => {
  const [data, setData] = useState(pallets);

  useEffect(() => {
    const listener = () => setData([...pallets]);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const updatePallet = (id: string, updates: Partial<PalletInfo>) => {
    pallets = pallets.map(p => p.id === id ? { ...p, ...updates } : p);
    listeners.forEach(l => l());
  };

  return { pallets, updatePallet };
};
