import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Smartphone, 
  ArrowLeft, 
  ShieldCheck, 
  Copy, 
  Check, 
  HelpCircle, 
  Search, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Order, formatPHP, PaymentStatus, FulfillmentStatus } from '../types';
import { getOrderByReference } from '../services/orderService';

interface OrderTrackingViewProps {
  order: Order | null;
  onBack: () => void;
  onOpenSupportForOrder: (order: Order) => void;
  onSelectOrder: (order: Order) => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  order: initialOrder,
  onBack,
  onOpenSupportForOrder,
  onSelectOrder
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(initialOrder);
  const [searchRef, setSearchRef] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchRef.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const found = await getOrderByReference(searchRef.trim());
      if (found) {
        setCurrentOrder(found);
        onSelectOrder(found);
      } else {
        setSearchError(`No order found matching "${searchRef.trim()}". Check the reference number.`);
      }
    } catch (err) {
      setSearchError('Error searching order. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 11) return phone;
    return `${phone.substring(0, 4)} ••• •${phone.substring(phone.length - 3)}`;
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Paid & Verified</span>;
      case 'review_required':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">Awaiting Admin Review</span>;
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">Payment Pending</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Payment Failed</span>;
      case 'refunded':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300">Refunded</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">{status}</span>;
    }
  };

  const getFulfillmentStatusBadge = (status: FulfillmentStatus) => {
    switch (status) {
      case 'successful':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Load Delivered ⚡</span>;
      case 'processing':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">Disbursing E-Load...</span>;
      case 'queued':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">Queued for Delivery</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">Delivery Interrupted</span>;
      case 'manual_review':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-300">Manual Review</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-300">Not Started</span>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </button>

        {/* Live Lookup Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-1.5">
          <input
            type="text"
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            placeholder="Track Reference e.g. JLS-202610-..."
            className="w-44 sm:w-64 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="p-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold transition-all shadow-xs"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {searchError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {currentOrder ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
          
          {/* Order Header */}
          <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 p-6 text-slate-950">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-900 bg-white/40 px-2 py-0.5 rounded">
                  Transaction Receipt
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                    {currentOrder.orderReference}
                  </h1>
                  <button
                    onClick={() => copyRef(currentOrder.orderReference)}
                    className="p-1 rounded bg-black/10 hover:bg-black/20 text-slate-950 transition-colors"
                    title="Copy Reference"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-800 font-medium mt-0.5">
                  Placed on {new Date(currentOrder.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] font-semibold text-slate-800 block">Verified Payment</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-950">
                  {formatPHP(currentOrder.sellingPrice + currentOrder.gatewayFee)}
                </span>
              </div>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Real-Time Fulfillment Progress
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step 1: Order Placement */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-start gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Step 1</span>
                  <h4 className="font-extrabold text-sm text-slate-900">Order Placed</h4>
                  <p className="text-[11px] text-slate-500">Authoritative price recorded</p>
                </div>
              </div>

              {/* Step 2: Payment */}
              <div className={`p-3.5 rounded-2xl bg-white border flex items-start gap-3 shadow-xs ${
                currentOrder.paymentStatus === 'paid'
                  ? 'border-emerald-300'
                  : currentOrder.paymentStatus === 'failed'
                  ? 'border-rose-300'
                  : 'border-amber-300'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  currentOrder.paymentStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : currentOrder.paymentStatus === 'failed'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {currentOrder.paymentStatus === 'paid' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : currentOrder.paymentStatus === 'failed' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Step 2</span>
                  <h4 className="font-extrabold text-sm text-slate-900">Payment Verification</h4>
                  <p className="text-[11px] text-slate-600">
                    {currentOrder.paymentStatus === 'paid'
                      ? 'Payment Verified & Approved'
                      : currentOrder.paymentStatus === 'review_required'
                      ? 'Under Admin Review (Ref Logged)'
                      : currentOrder.paymentStatus === 'failed'
                      ? 'Payment Failed / Rejected'
                      : 'Awaiting Payment Proof'}
                  </p>
                </div>
              </div>

              {/* Step 3: Load Delivery */}
              <div className={`p-3.5 rounded-2xl bg-white border flex items-start gap-3 shadow-xs ${
                currentOrder.fulfillmentStatus === 'successful'
                  ? 'border-emerald-300'
                  : currentOrder.fulfillmentStatus === 'processing'
                  ? 'border-blue-300 animate-pulse'
                  : 'border-slate-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  currentOrder.fulfillmentStatus === 'successful'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {currentOrder.fulfillmentStatus === 'successful' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Smartphone className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Step 3</span>
                  <h4 className="font-extrabold text-sm text-slate-900">E-Load Dispatch</h4>
                  <p className="text-[11px] text-slate-600">
                    {currentOrder.fulfillmentStatus === 'successful'
                      ? 'Dispatched via Telco Carrier SMS'
                      : currentOrder.paymentStatus === 'review_required'
                      ? 'Pending Admin Verification'
                      : currentOrder.fulfillmentStatus === 'processing'
                      ? 'Carrier Transmitting Promo...'
                      : 'Queued for Dispatch'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Transaction Breakdown */}
          <div className="p-6 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Recipient & Network
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-500">Network Carrier:</span>
                  <span className="font-extrabold text-slate-900">{currentOrder.networkSnapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Promo Package:</span>
                  <span className="font-extrabold text-slate-900">{currentOrder.productNameSnapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient Mobile:</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {maskPhone(currentOrder.recipientNumber)}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Payment Verification
                </h4>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Status:</span>
                  {getPaymentStatusBadge(currentOrder.paymentStatus)}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway Method:</span>
                  <span className="font-bold uppercase text-slate-800">{currentOrder.paymentGateway}</span>
                </div>
                {currentOrder.paymentReference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Ref:</span>
                    <span className="font-mono font-bold text-slate-800">{currentOrder.paymentReference}</span>
                  </div>
                )}
                {currentOrder.manualPaymentRef && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer Ref:</span>
                    <span className="font-mono font-bold text-slate-800">{currentOrder.manualPaymentRef}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Provider Reference Details */}
            {currentOrder.providerReference && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Carrier Telco Confirmation
                  </span>
                  <h4 className="font-mono font-black text-emerald-950 text-sm">
                    {currentOrder.providerReference}
                  </h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Load successfully sent to recipient SIM card. SMS notification dispatched.
                  </p>
                </div>
                <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
              </div>
            )}

            {/* Failure notice */}
            {currentOrder.failureReason && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px]">Notice:</span>
                <p>{currentOrder.failureReason}</p>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => onOpenSupportForOrder(currentOrder)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Report Issue with this Order</span>
              </button>

              <button
                onClick={onBack}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black transition-all shadow-xs"
              >
                Buy Another Load
              </button>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-extrabold text-slate-800 text-lg">No Order Selected</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Enter your James Load Services Order Reference Number above (e.g. JLS-202610-XXXX) to track your load status in real-time.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 font-bold text-xs text-slate-950"
          >
            Go to Buy Load
          </button>
        </div>
      )}

    </div>
  );
};
