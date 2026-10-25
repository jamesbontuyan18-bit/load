import React, { useState } from 'react';
import { X, Search, Smartphone, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Order } from '../types';
import { getOrderByReference } from '../services/orderService';

interface TrackOrderModalProps {
  onClose: () => void;
  onOrderFound: (order: Order) => void;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({
  onClose,
  onOrderFound
}) => {
  const [refInput, setRefInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  React.useEffect(() => {
    // Load recent guest orders on device to make tracking effortless
    const loadRecent = async () => {
      try {
        const guestOrders = await import('../services/orderService').then(m => m.getGuestOrders());
        if (guestOrders && guestOrders.length > 0) {
          setRecentOrders(guestOrders.slice(0, 3));
        }
      } catch (e) {
        // ignore
      }
    };
    loadRecent();
  }, []);

  const handleTrackWithRef = async (targetRef: string) => {
    const clean = targetRef.trim();
    if (!clean) return;

    setIsLoading(true);
    setError(null);
    try {
      const order = await getOrderByReference(clean);
      if (order) {
        onOrderFound(order);
        onClose();
      } else {
        setError(`No order found for "${clean.toUpperCase()}". Please verify the code on your receipt.`);
      }
    } catch (err: any) {
      console.error('Error tracking order:', err);
      setError(err?.message || 'Error looking up order. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleTrackWithRef(refInput);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200">
        
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-base">Track Your E-Load Order</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTrack} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Enter the unique Order Reference from your checkout receipt or SMS:
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Order Reference Number
            </label>
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="e.g. JLS-202610-8A7B2"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none"
              required
            />
          </div>

          {recentOrders.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Recent orders on this device:
              </span>
              <div className="flex flex-col gap-1.5">
                {recentOrders.map((ro) => (
                  <button
                    key={ro.id}
                    type="button"
                    onClick={() => {
                      setRefInput(ro.orderReference || ro.id);
                      handleTrackWithRef(ro.orderReference || ro.id);
                    }}
                    className="w-full text-left p-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-xs flex items-center justify-between text-slate-800 transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-900 block">{ro.orderReference}</span>
                      <span className="text-[10px] text-slate-500">{ro.productNameSnapshot} • {ro.recipientNumber}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !refInput.trim()}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Search Status</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
