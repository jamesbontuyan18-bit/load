import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  BellRing, 
  Check, 
  Mail, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { Product, formatPHP } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeToPriceDrop, 
  unsubscribeFromPriceDrop, 
  isProductAlertActive,
  getLocalPriceAlerts
} from '../services/alertService';

interface PriceDropModalProps {
  product: Product;
  onClose: () => void;
  onAlertStatusChanged: () => void;
}

export const PriceDropModal: React.FC<PriceDropModalProps> = ({
  product,
  onClose,
  onAlertStatusChanged
}) => {
  const { currentUser } = useAuth();

  const isAlreadyActive = isProductAlertActive(product.id);
  const existingAlert = getLocalPriceAlerts().find(a => a.productId === product.id);

  const [email, setEmail] = useState(currentUser?.email || existingAlert?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(isAlreadyActive);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await subscribeToPriceDrop({
        productId: product.id,
        productName: product.name,
        network: product.network,
        initialPrice: product.sellingPrice,
        email: email.trim(),
        userId: currentUser?.uid
      });

      setIsSuccess(true);
      onAlertStatusChanged();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to set alert. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true);
    try {
      await unsubscribeFromPriceDrop(product.id);
      setIsSuccess(false);
      onAlertStatusChanged();
      onClose();
    } catch (e) {
      console.warn('Error unsubscribing:', e);
    } finally {
      setIsUnsubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 p-5 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-950/10 flex items-center justify-center">
              <BellRing className="w-5 h-5 text-slate-950 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Price Drop Alert</h3>
              <p className="text-[11px] text-slate-800 font-medium">Automatic Email Notification</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-950" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Product Snapshot Card */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                {product.network}
              </span>
              <h4 className="font-black text-slate-900 text-sm mt-1">{product.name}</h4>
              <p className="text-[11px] text-slate-500">{product.validity || 'Prepaid Load'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold">Current Price</span>
              <span className="font-black text-lg text-slate-900">{formatPHP(product.sellingPrice)}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div>
                <h4 className="font-extrabold text-base text-slate-900">Price Alert Active!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                  We will send an automatic email alert to <span className="font-semibold text-slate-900">{email}</span> if the price of <span className="font-bold">{product.name}</span> drops below {formatPHP(product.sellingPrice)}.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 font-black text-xs text-slate-950 transition-all shadow-xs"
                >
                  Done
                </button>
                <button
                  type="button"
                  disabled={isUnsubscribing}
                  onClick={handleUnsubscribe}
                  className="w-full py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors"
                >
                  {isUnsubscribing ? 'Removing alert...' : 'Turn Off Price Alert'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-4 text-xs">
              <div>
                <p className="text-slate-600 mb-2 leading-relaxed">
                  Never miss a reseller promo discount. Get an instant email alert whenever the selling price of this promo decreases.
                </p>
                <label className="block font-bold text-slate-700 mb-1">
                  Alert Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <TrendingDown className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Triggers automatically if the reseller price drops below <strong>{formatPHP(product.sellingPrice)}</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 font-black text-xs text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>Set Price Drop Alert</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
