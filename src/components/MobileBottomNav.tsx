import React from 'react';
import { Zap, Clock, Search, HelpCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenTrackModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenTrackModal
}) => {
  const { currentUser, isAdmin } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg flex items-center justify-around">
      <button
        onClick={() => setCurrentTab('buy')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
          currentTab === 'buy' ? 'text-amber-600 font-bold' : 'text-slate-500'
        }`}
      >
        <div className={`p-1 rounded-lg ${currentTab === 'buy' ? 'bg-amber-100 text-amber-700' : ''}`}>
          <Zap className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5">Buy Load</span>
      </button>

      <button
        onClick={onOpenTrackModal}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 transition-colors"
      >
        <div className="p-1 rounded-lg">
          <Search className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5">Track</span>
      </button>

      <button
        onClick={() => setCurrentTab('history')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
          currentTab === 'history' ? 'text-amber-600 font-bold' : 'text-slate-500'
        }`}
      >
        <div className={`p-1 rounded-lg ${currentTab === 'history' ? 'bg-amber-100 text-amber-700' : ''}`}>
          <Clock className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5">Orders</span>
      </button>

      <button
        onClick={() => setCurrentTab('support')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
          currentTab === 'support' ? 'text-amber-600 font-bold' : 'text-slate-500'
        }`}
      >
        <div className={`p-1 rounded-lg ${currentTab === 'support' ? 'bg-amber-100 text-amber-700' : ''}`}>
          <HelpCircle className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5">Support</span>
      </button>

      {isAdmin && (
        <button
          onClick={() => setCurrentTab('admin')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${
            currentTab === 'admin' ? 'text-slate-950 font-bold' : 'text-slate-500'
          }`}
        >
          <div className={`p-1 rounded-lg ${currentTab === 'admin' ? 'bg-slate-900 text-amber-400' : ''}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Admin</span>
        </button>
      )}
    </nav>
  );
};
