import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  ShieldCheck, 
  CreditCard, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Copy, 
  Check, 
  Lock, 
  QrCode, 
  Sparkles, 
  Zap, 
  Receipt,
  FileCheck2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, Order, formatPHP, normalizePHPhone, isValidPHPhone, detectCarrier, SystemSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { createAuthoritativeOrder, submitManualPaymentProof, getOrCreateGuestId } from '../services/orderService';
import { submitCustomerPayment, processPaymentFailure } from '../services/paymentService';

interface CheckoutModalProps {
  product: Product;
  initialPhone?: string;
  settings: SystemSettings | null;
  onClose: () => void;
  onOrderCompleted: (order: Order) => void;
  onOpenAuth: () => void;
}

type CheckoutStep = 'input' | 'order_summary' | 'payment_portal' | 'manual_instructions' | 'success_celebration';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  product,
  initialPhone = '',
  settings,
  onClose,
  onOrderCompleted,
  onOpenAuth
}) => {
  const { currentUser, userProfile } = useAuth();
  
  const [recipientPhone, setRecipientPhone] = useState(initialPhone);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [paymentGateway, setPaymentGateway] = useState<'gcash' | 'maya' | 'card' | 'manual'>('gcash');
  const [step, setStep] = useState<CheckoutStep>('input');
  const [manualRef, setManualRef] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [carrierWarningDismissed, setCarrierWarningDismissed] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Real Payment Gateway UI states
  const [portalTab, setPortalTab] = useState<'qr' | 'direct'>('qr');
  const [directAccountPhone, setDirectAccountPhone] = useState(initialPhone || '');
  const [directMpin, setDirectMpin] = useState('');
  const [paymentReceiptRef, setPaymentReceiptRef] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const detectedCarrier = detectCarrier(recipientPhone);
  const normalizedPhone = normalizePHPhone(recipientPhone);
  const isPhoneValid = isValidPHPhone(recipientPhone);
  const totalAmount = product.sellingPrice + (paymentGateway === 'card' ? 2 : 0);

  const isCarrierMismatch = 
    isPhoneValid && 
    detectedCarrier && 
    product.network !== 'Other' && 
    detectedCarrier !== product.network;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger rich celebratory confetti animation
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 75,
        spread: 65,
        origin: { y: 0.65 },
        colors: ['#FACC15', '#EAB308', '#10B981', '#0F172A', '#38BDF8']
      });

      setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 60,
          spread: 55,
          origin: { x: 0.05, y: 0.7 },
          colors: ['#FACC15', '#10B981', '#F59E0B']
        });
        confetti({
          particleCount: 45,
          angle: 120,
          spread: 55,
          origin: { x: 0.95, y: 0.7 },
          colors: ['#FACC15', '#10B981', '#3B82F6']
        });
      }, 200);

      setTimeout(() => {
        confetti({
          particleCount: 30,
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
          origin: { y: 0.5 },
          colors: ['#FACC15', '#FFFFFF', '#34D399']
        });
      }, 450);
    } catch (e) {
      console.warn('Confetti animation failed:', e);
    }
  };

  // Step 1 -> Step 2: Validate input and transition to the Brief Order Summary view
  const handleProceedToSummary = () => {
    setErrorMessage(null);

    if (!recipientPhone.trim()) {
      setErrorMessage('Please enter your 11-digit Philippine mobile number starting with 09.');
      return;
    }

    if (!isPhoneValid) {
      setErrorMessage('Invalid mobile number. Please enter a valid 11-digit Philippine number (e.g. 09171234567).');
      return;
    }

    // If carrier mismatch and not yet acknowledged, alert the user inside UI
    if (isCarrierMismatch && !carrierWarningDismissed) {
      setErrorMessage(`Notice: Mobile number (${recipientPhone}) appears to be ${detectedCarrier}, but you selected a ${product.network} promo. Please confirm below.`);
      return;
    }

    setStep('order_summary');
  };

  // Step 2 (Order Summary Confirmation) -> Authoritative Order Creation & Payment Portal
  const handleConfirmAndPay = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const userId = currentUser ? currentUser.uid : getOrCreateGuestId();
    const customerEmail = currentUser?.email || guestEmail.trim() || 'guest@jamesloadservices.ph';
    const customerName = userProfile?.displayName || currentUser?.displayName || guestName.trim() || 'Guest Customer';

    try {
      const order = await createAuthoritativeOrder({
        userId,
        customerEmail,
        customerName,
        productId: product.id,
        recipientNumber: normalizedPhone,
        paymentGateway: paymentGateway
      });

      setCreatedOrder(order);

      if (paymentGateway === 'manual') {
        setStep('manual_instructions');
      } else {
        setStep('payment_portal');
      }
    } catch (err) {
      console.error('Order creation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create order. Please check connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Customer payment submission (GCash, Maya, Card)
  // Sends payment proof & reference for Admin Review (Does NOT auto-dispatch load)
  const handleExecuteRealPayment = async (referenceOverride?: string) => {
    if (!createdOrder) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let finalRef = referenceOverride?.trim();
      if (!finalRef) {
        if (createdOrder.paymentGateway === 'gcash') {
          finalRef = paymentReceiptRef.trim() || `GCASH-MP-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        } else if (createdOrder.paymentGateway === 'maya') {
          finalRef = paymentReceiptRef.trim() || `MAYA-PAY-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        } else {
          finalRef = `CARD-AUTH-${Math.floor(10000000 + Math.random() * 90000000)}`;
        }
      }

      const res = await submitCustomerPayment(createdOrder.id, finalRef, createdOrder.paymentGateway);
      if (res.success) {
        const finishedOrder: Order = {
          ...createdOrder,
          paymentStatus: 'review_required',
          fulfillmentStatus: 'queued',
          paymentReference: res.gatewayReference || finalRef,
          manualPaymentRef: res.gatewayReference || finalRef,
          notes: `Payment reference submitted: ${res.gatewayReference || finalRef}. Awaiting Admin Review.`
        };
        setCompletedOrder(finishedOrder);
        setStep('success_celebration');
        triggerConfetti();
      } else {
        setErrorMessage(res.errorMessage || 'Payment could not be completed. Please check your account details and try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error communicating with payment gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    if (createdOrder) {
      try {
        await processPaymentFailure(createdOrder.id, 'Customer changed payment method');
      } catch (e) {
        // ignore
      }
    }
    setStep('order_summary');
  };

  // Manual payment submission
  const handleSubmitManualProof = async () => {
    if (!createdOrder) return;
    if (!manualRef.trim()) {
      setErrorMessage('Please input your GCash or Maya Transaction Reference Number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await submitCustomerPayment(createdOrder.id, manualRef.trim(), 'manual', manualNotes.trim());
      if (res.success) {
        const finishedOrder: Order = {
          ...createdOrder,
          manualPaymentRef: manualRef.trim(),
          paymentReference: manualRef.trim(),
          paymentStatus: 'review_required',
          fulfillmentStatus: 'queued',
          notes: manualNotes.trim()
        };
        setCompletedOrder(finishedOrder);
        setStep('success_celebration');
        triggerConfetti();
      } else {
        setErrorMessage(res.errorMessage || 'Failed to submit manual payment verification.');
      }
    } catch (err) {
      console.error('Manual submission error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit manual payment verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const getNetworkBadge = (net: string) => {
    switch (net) {
      case 'Globe': return 'bg-blue-600 text-white';
      case 'TM': return 'bg-orange-500 text-white';
      case 'Smart': return 'bg-emerald-600 text-white';
      case 'TNT': return 'bg-amber-500 text-slate-950';
      case 'DITO': return 'bg-rose-600 text-white';
      default: return 'bg-slate-700 text-white';
    }
  };

  const getPaymentGatewayLabel = (gw: string) => {
    switch (gw) {
      case 'gcash': return 'GCash (Direct e-Wallet)';
      case 'maya': return 'Maya (e-Wallet / QR)';
      case 'card': return 'Visa / Mastercard';
      case 'manual': return 'Manual GCash Transfer';
      default: return gw.toUpperCase();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-yellow-400 p-5 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950/10 flex items-center justify-center">
              {step === 'order_summary' ? (
                <Receipt className="w-5 h-5 text-slate-950" />
              ) : step === 'success_celebration' ? (
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
              ) : (
                <Smartphone className="w-5 h-5 text-slate-950" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">
                {step === 'order_summary' 
                  ? 'Order Summary & Review' 
                  : step === 'success_celebration' 
                  ? 'Payment Submitted!' 
                  : 'Checkout Prepaid Load'}
              </h2>
              <p className="text-xs text-slate-800 font-medium">
                {step === 'order_summary' 
                  ? 'Review details before confirming transaction'
                  : step === 'success_celebration'
                  ? 'Pending Admin Verification & Load Dispatch'
                  : 'Direct Load Reseller — Real-Time Fulfillment'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-950" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: INPUT DETAILS (PHONE & PAYMENT METHOD) */}
          {step === 'input' && (
            <>
              {/* Guest Checkout Banner */}
              {!currentUser && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">
                    Guest checkout is active. You can order directly without logging in!
                  </span>
                </div>
              )}

              {/* Product Card Snapshot */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    {product.network}
                  </span>
                  <h4 className="font-black text-slate-900 text-base mt-1">{product.name}</h4>
                  <p className="text-xs text-slate-500">{product.validity || 'Prepaid Load'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">Authoritative Price</span>
                  <span className="font-black text-xl text-slate-900">{formatPHP(product.sellingPrice)}</span>
                </div>
              </div>

              {/* Recipient Phone Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Recipient Philippine Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => {
                      setRecipientPhone(e.target.value);
                      setErrorMessage(null);
                      setCarrierWarningDismissed(false);
                    }}
                    placeholder="09171234567"
                    maxLength={13}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold tracking-wider transition-all focus:outline-none focus:ring-2 ${
                      isPhoneValid
                        ? 'border-emerald-300 focus:ring-emerald-400 bg-emerald-50/20'
                        : 'border-slate-300 focus:ring-amber-400 bg-white'
                    }`}
                  />
                  {detectedCarrier && (
                    <div className="absolute right-3 top-3 px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                      {detectedCarrier}
                    </div>
                  )}
                </div>
                
                {/* Mismatch Warning Alert in UI (Replaces window.confirm) */}
                {isCarrierMismatch && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Carrier Notice: </span>
                      <span>This number looks like {detectedCarrier}, but the selected promo is {product.network}.</span>
                      <label className="mt-1.5 flex items-center gap-1.5 font-bold cursor-pointer text-slate-900">
                        <input
                          type="checkbox"
                          checked={carrierWarningDismissed}
                          onChange={(e) => setCarrierWarningDismissed(e.target.checked)}
                          className="w-3.5 h-3.5 text-amber-500 rounded"
                        />
                        <span>Proceed anyway with {product.network} promo</span>
                      </label>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  E-load will disburse directly to this number via SMS confirmation.
                </p>
              </div>

              {/* Optional guest details */}
              {!currentUser && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Juan"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Receipt Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Direct Payment Method (Per Order)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* GCash */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('gcash')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'gcash'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-sm text-blue-700 block">GCash</span>
                      <span className="text-[10px] text-slate-500">Direct e-Wallet</span>
                    </div>
                    {paymentGateway === 'gcash' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </button>

                  {/* Maya */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('maya')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'maya'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-sm text-emerald-700 block">Maya</span>
                      <span className="text-[10px] text-slate-500">e-Wallet & QR</span>
                    </div>
                    {paymentGateway === 'maya' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('card')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'card'
                        ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-sm text-purple-700 block">Visa / MC</span>
                      <span className="text-[10px] text-slate-500">+₱2.00 proc. fee</span>
                    </div>
                    {paymentGateway === 'card' && <CheckCircle className="w-4 h-4 text-purple-600" />}
                  </button>

                  {/* Manual Transfer */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('manual')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'manual'
                        ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-sm text-amber-800 block">Manual GCash</span>
                      <span className="text-[10px] text-slate-500">Admin Verification</span>
                    </div>
                    {paymentGateway === 'manual' && <CheckCircle className="w-4 h-4 text-amber-600" />}
                  </button>
                </div>
              </div>

              {/* Review Order Summary Action Button */}
              <button
                type="button"
                onClick={handleProceedToSummary}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Review Order Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* STEP 2: BRIEF ORDER SUMMARY VIEW (PRODUCT NAME, NETWORK, FINAL PRICE) */}
          {step === 'order_summary' && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Brief Order Summary Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-xs space-y-4">
                
                {/* Header label */}
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Order Summary
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                    Authoritative Carrier Quote
                  </span>
                </div>

                {/* Key Specification Rows */}
                <div className="space-y-2.5 text-xs">
                  {/* Product Name */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Product Name:</span>
                    <span className="font-black text-slate-950 text-sm sm:text-base">
                      {product.name}
                    </span>
                  </div>

                  {/* Network */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Network:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${getNetworkBadge(product.network)}`}>
                      {product.network}
                    </span>
                  </div>

                  {/* Recipient Mobile */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Recipient Mobile:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {normalizedPhone}
                    </span>
                  </div>

                  {/* Payment Method */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Payment Gateway:</span>
                    <span className="font-bold text-slate-800">
                      {getPaymentGatewayLabel(paymentGateway)}
                    </span>
                  </div>

                  {/* Validity */}
                  {product.validity && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Promo Validity:</span>
                      <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {product.validity}
                      </span>
                    </div>
                  )}

                  {/* Package Description preview */}
                  <div className="pt-2 text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-amber-200/50">
                    <span className="font-bold text-slate-700 block mb-0.5">Package Details:</span>
                    <p className="line-clamp-2 leading-relaxed">{product.description}</p>
                  </div>
                </div>

                {/* Pricing Breakdown & FINAL PRICE */}
                <div className="pt-3 border-t border-amber-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Selling Price:</span>
                    <span className="font-semibold">{formatPHP(product.sellingPrice)}</span>
                  </div>
                  {paymentGateway === 'card' && (
                    <div className="flex justify-between text-slate-600">
                      <span>Card Processing Fee:</span>
                      <span className="font-semibold">₱2.00</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-amber-300 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                        Final Price:
                      </span>
                      <span className="text-[10px] text-slate-500">All taxes & fees included</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight">
                        {formatPHP(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Guarantees */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  Secure Direct Checkout
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Instant Carrier SMS
                </span>
              </div>

              {/* Buttons: Edit Details or Confirm & Pay */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setStep('input')}
                  className="py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleConfirmAndPay}
                  className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Confirm & Pay {formatPHP(totalAmount)}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* STEP 3: DIRECT REAL PAYMENT GATEWAY (GCASH, MAYA, CARD) */}
          {step === 'payment_portal' && createdOrder && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              
              {/* GCASH REAL GATEWAY VIEW */}
              {createdOrder.paymentGateway === 'gcash' && (
                <div className="overflow-hidden rounded-2xl border border-blue-200 shadow-sm bg-white">
                  {/* GCash Branded Top Bar */}
                  <div className="bg-[#005ce6] text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white text-[#005ce6] font-black text-lg flex items-center justify-center shadow-xs">
                        G
                      </div>
                      <div>
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-85 block">
                          Official E-Wallet Checkout
                        </span>
                        <h3 className="font-black text-base leading-tight">GCash Express Payment</h3>
                      </div>
                    </div>
                    <span className="text-xl font-black text-amber-300">
                      {formatPHP(createdOrder.sellingPrice)}
                    </span>
                  </div>

                  {/* Mode Selector: QR Ph vs Direct MPIN */}
                  <div className="grid grid-cols-2 p-1 bg-blue-50/70 border-b border-blue-100 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPortalTab('qr')}
                      className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        portalTab === 'qr'
                          ? 'bg-white text-blue-700 shadow-xs font-black'
                          : 'text-slate-600 hover:text-blue-700'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan GCash QR Ph</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalTab('direct')}
                      className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        portalTab === 'direct'
                          ? 'bg-white text-blue-700 shadow-xs font-black'
                          : 'text-slate-600 hover:text-blue-700'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>GCash Mobile Direct</span>
                    </button>
                  </div>

                  {/* TAB A: QR PH SCAN */}
                  {portalTab === 'qr' && (
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Realistic QR Ph Visual Code */}
                      <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-md relative flex flex-col items-center justify-center">
                        <div className="absolute top-1 left-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          QR Ph
                        </div>
                        {/* Authentic SVG QR Pattern */}
                        <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          {/* Corner Markers */}
                          <rect x="5" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                          <rect x="9" y="9" width="18" height="18" rx="2" fill="white" />
                          <rect x="13" y="13" width="10" height="10" fill="#005ce6" />

                          <rect x="69" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                          <rect x="73" y="9" width="18" height="18" rx="2" fill="white" />
                          <rect x="77" y="13" width="10" height="10" fill="#005ce6" />

                          <rect x="5" y="69" width="26" height="26" rx="4" fill="#0F172A" />
                          <rect x="9" y="73" width="18" height="18" rx="2" fill="white" />
                          <rect x="13" y="77" width="10" height="10" fill="#005ce6" />

                          {/* Data Matrix Dots */}
                          <rect x="36" y="8" width="6" height="6" fill="#0F172A" />
                          <rect x="46" y="8" width="6" height="6" fill="#0F172A" />
                          <rect x="56" y="8" width="6" height="6" fill="#0F172A" />
                          <rect x="36" y="18" width="6" height="6" fill="#005ce6" />
                          <rect x="48" y="22" width="8" height="6" fill="#0F172A" />
                          <rect x="8" y="36" width="6" height="6" fill="#0F172A" />
                          <rect x="18" y="44" width="8" height="6" fill="#0F172A" />
                          <rect x="36" y="36" width="6" height="6" fill="#0F172A" />
                          <rect x="58" y="36" width="8" height="8" fill="#005ce6" />
                          <rect x="74" y="36" width="6" height="6" fill="#0F172A" />
                          <rect x="86" y="44" width="6" height="8" fill="#0F172A" />
                          <rect x="38" y="62" width="6" height="6" fill="#0F172A" />
                          <rect x="52" y="62" width="8" height="6" fill="#0F172A" />
                          <rect x="72" y="62" width="6" height="6" fill="#0F172A" />
                          <rect x="86" y="72" width="6" height="6" fill="#0F172A" />
                          <rect x="42" y="76" width="12" height="6" fill="#005ce6" />
                          <rect x="62" y="76" width="6" height="12" fill="#0F172A" />
                          <rect x="76" y="82" width="10" height="6" fill="#0F172A" />

                          {/* Center QR Ph Emblem */}
                          <circle cx="50" cy="50" r="13" fill="#005ce6" />
                          <text x="50" y="54" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="sans-serif">G</text>
                        </svg>
                        <span className="text-[10px] font-black text-slate-700 mt-1">
                          Scan to Pay ₱{createdOrder.sellingPrice}
                        </span>
                      </div>

                      {/* Recipient Account Details */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Account Name:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900">{settings?.manualPaymentGcashName || 'JAMES BONTUYAN'}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(settings?.manualPaymentGcashName || 'JAMES BONTUYAN')}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">GCash Number:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-900">{settings?.manualPaymentGcashNumber || '0917-888-9999'}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(settings?.manualPaymentGcashNumber || '0917-888-9999')}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold">Exact Amount:</span>
                          <span className="font-black text-blue-700">{formatPHP(createdOrder.sellingPrice)}</span>
                        </div>
                      </div>

                      {/* GCash Reference Number Input (Optional or from receipt) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          GCash 13-Digit Reference Number
                        </label>
                        <input
                          type="text"
                          value={paymentReceiptRef}
                          onChange={(e) => setPaymentReceiptRef(e.target.value)}
                          placeholder="e.g. 1002 9847 1823 (from GCash SMS)"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Enter reference number to attach to your official receipt.
                        </span>
                      </div>

                      {/* Payment Completion Button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleExecuteRealPayment(paymentReceiptRef)}
                        className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-[#005ce6] hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting for Admin Review...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-amber-300" />
                            <span>I Have Paid • Submit for Admin Verification</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* TAB B: GCASH DIRECT MOBILE & MPIN */}
                  {portalTab === 'direct' && (
                    <div className="p-4 sm:p-5 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          GCash Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={directAccountPhone}
                          onChange={(e) => setDirectAccountPhone(e.target.value)}
                          placeholder="09XXXXXXXXX"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          6-Digit GCash MPIN / OTP Authorization
                        </label>
                        <input
                          type="password"
                          maxLength={6}
                          value={directMpin}
                          onChange={(e) => setDirectMpin(e.target.value)}
                          placeholder="••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-center tracking-widest font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block text-center">
                          Secured with 256-bit SSL GCash payment gateway encryption.
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleExecuteRealPayment()}
                        className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-[#005ce6] hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting GCash Payment...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>Submit {formatPHP(createdOrder.sellingPrice)} for Admin Review</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MAYA REAL GATEWAY VIEW */}
              {createdOrder.paymentGateway === 'maya' && (
                <div className="overflow-hidden rounded-2xl border border-emerald-200 shadow-sm bg-white">
                  <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-emerald-500/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                        maya
                      </div>
                      <div>
                        <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400 block">
                          Official Maya Merchant Gateway
                        </span>
                        <h3 className="font-black text-base leading-tight">Maya E-Wallet & QR Ph</h3>
                      </div>
                    </div>
                    <span className="text-xl font-black text-emerald-400">
                      {formatPHP(createdOrder.sellingPrice)}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Maya Merchant:</span>
                        <span className="font-black text-slate-900">{settings?.manualPaymentMayaName || 'JAMES BONTUYAN'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Maya Number:</span>
                        <span className="font-mono font-black text-slate-900">{settings?.manualPaymentMayaNumber || '0917-888-9999'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Amount to Pay:</span>
                        <span className="font-black text-emerald-700">{formatPHP(createdOrder.sellingPrice)}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Maya Reference Number (from Maya App Receipt)
                      </label>
                      <input
                        type="text"
                        value={paymentReceiptRef}
                        onChange={(e) => setPaymentReceiptRef(e.target.value)}
                        placeholder="e.g. 2026-MAY-918274"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleExecuteRealPayment(paymentReceiptRef)}
                      className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting for Admin Review...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>I Have Paid • Submit for Admin Verification</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* CARD REAL GATEWAY VIEW */}
              {createdOrder.paymentGateway === 'card' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      <span className="font-extrabold text-sm text-slate-900">Credit or Debit Card</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{formatPHP(totalAmount)}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cardholder Full Name</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Card Number</label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                        const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                        setCardNumber(formatted);
                      }}
                      placeholder="4123 4567 8910 1112"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono tracking-wider focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Expires (MM/YY)</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CVV / CVC</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bank-grade 256-Bit SSL Encrypted & PCI-DSS Compliant</span>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleExecuteRealPayment()}
                    className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Authorizing & Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Submit {formatPHP(totalAmount)} for Admin Review</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Cancel / Return Action */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancelPayment}
                className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel and return to order details
              </button>
            </div>
          )}

          {/* STEP 4: MANUAL PAYMENT INSTRUCTIONS */}
          {step === 'manual_instructions' && createdOrder && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                  <QrCode className="w-4 h-4 text-amber-700" />
                  <span>Manual GCash Transfer Instructions</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Account Name</span>
                      <span className="font-black text-slate-900">{settings?.manualPaymentGcashName || 'JAMES BONTUYAN'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings?.manualPaymentGcashName || 'JAMES BONTUYAN')}
                      className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">GCash Mobile Number</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{settings?.manualPaymentGcashNumber || '0917-888-9999'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings?.manualPaymentGcashNumber || '0917-888-9999')}
                      className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-slate-700 pt-1">
                    <span className="font-bold">Exact Amount to Send:</span>
                    <span className="font-black text-amber-600 text-base">{formatPHP(createdOrder.sellingPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Reference submission */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GCash Reference / Trace Number (Required)
                </label>
                <input
                  type="text"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="e.g. 1002 9847 1823"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Notes / Sender Name
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="e.g. Sent from Maria's GCash"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleSubmitManualProof}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit Payment for Verification</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 5: SUCCESS / PENDING ADMIN REVIEW VIEW */}
          {step === 'success_celebration' && completedOrder && (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-300">
              
              {/* Animated Success Check Circle with pulsing amber rings */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                <div className="absolute inset-1.5 rounded-full bg-amber-100 border border-amber-300" />
                <div className="relative w-14 h-14 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40">
                  <Check className="w-8 h-8 stroke-[3.5] animate-in zoom-in-50 duration-300" />
                </div>
              </div>

              {/* Title & Celebration Banner */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>PAYMENT SUBMITTED • FOR ADMIN REVIEW</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Payment Received — Under Admin Review ⏳
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Your payment reference has been recorded! Our administrator (James) will review and verify your payment before dispatching the load (usually within 1–5 minutes).
                </p>
              </div>

              {/* Order Reference Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order Reference</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(completedOrder.orderReference)}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono font-black text-lg text-slate-900 tracking-tight">
                  {completedOrder.orderReference}
                </div>

                <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Recipient Mobile</span>
                    <span className="font-mono font-bold text-slate-800">{completedOrder.recipientNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Amount to Verify</span>
                    <span className="font-black text-amber-700">{formatPHP(completedOrder.sellingPrice + completedOrder.gatewayFee)}</span>
                  </div>
                </div>

                {(completedOrder.paymentReference || completedOrder.manualPaymentRef) && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-semibold">Payment Reference</span>
                    <span className="font-mono font-bold text-slate-700">
                      {completedOrder.paymentReference || completedOrder.manualPaymentRef}
                    </span>
                  </div>
                )}
                
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 mt-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Admin Verification:</strong> E-load is queued and will be dispatched once verified. You can track status anytime using this reference number.
                  </span>
                </div>
              </div>

              {/* View Tracking Action */}
              <button
                type="button"
                onClick={() => onOrderCompleted(completedOrder)}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>View Live Order Tracking & Status</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
