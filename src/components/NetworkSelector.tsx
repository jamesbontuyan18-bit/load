import React from 'react';
import { TelcoNetwork } from '../types';

interface NetworkSelectorProps {
  selectedNetwork: TelcoNetwork | 'ALL';
  onSelectNetwork: (net: TelcoNetwork | 'ALL') => void;
}

export const NETWORKS: { id: TelcoNetwork | 'ALL'; label: string; color: string; bgActive: string; textActive: string; border: string }[] = [
  { id: 'ALL', label: 'All Networks', color: 'bg-slate-700', bgActive: 'bg-slate-900', textActive: 'text-white', border: 'border-slate-300' },
  { id: 'Globe', label: 'Globe', color: 'bg-blue-600', bgActive: 'bg-blue-600', textActive: 'text-white', border: 'border-blue-200' },
  { id: 'TM', label: 'TM (Touch Mobile)', color: 'bg-orange-500', bgActive: 'bg-orange-500', textActive: 'text-white', border: 'border-orange-200' },
  { id: 'Smart', label: 'Smart', color: 'bg-emerald-600', bgActive: 'bg-emerald-600', textActive: 'text-white', border: 'border-emerald-200' },
  { id: 'TNT', label: 'TNT (Talk \'N Text)', color: 'bg-amber-500', bgActive: 'bg-amber-500', textActive: 'text-slate-950', border: 'border-amber-300' },
  { id: 'DITO', label: 'DITO', color: 'bg-rose-600', bgActive: 'bg-rose-600', textActive: 'text-white', border: 'border-rose-200' },
];

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  selectedNetwork,
  onSelectNetwork
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {NETWORKS.map(net => {
        const isSelected = selectedNetwork === net.id;
        return (
          <button
            key={net.id}
            onClick={() => onSelectNetwork(net.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 border shadow-xs ${
              isSelected
                ? `${net.bgActive} ${net.textActive} border-transparent scale-[1.02] shadow-md ring-2 ring-amber-400/30`
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
          >
            {net.id !== 'ALL' && (
              <span className={`w-2.5 h-2.5 rounded-full ${net.color}`} />
            )}
            {net.label}
          </button>
        );
      })}
    </div>
  );
};
