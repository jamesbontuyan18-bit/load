import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  ShieldCheck, 
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
import { createAuthoritativeOrder, getOrCreateGuestId } from '../services/orderService';
import { submitCustomerPayment, processPaymentFailure } from '../services/paymentService';

interface CheckoutModalProps {
  product: Product;
  initialPhone?: string;
  settings: SystemSettings | null;
  onClose: () => void;
  onOrderCompleted: (order: Order) => void;
  onOpenAuth: () => void;
}

type CheckoutStep = 'input' | 'order_summary' | 'manual_payment' | 'success_celebration';

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
  const [paymentGateway, setPaymentGateway] = useState<'gcash' | 'maya'>('gcash');
  const [step, setStep] = useState<CheckoutStep>('input');
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [senderNotes, setSenderNotes] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [carrierWarningDismissed, setCarrierWarningDismissed] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const detectedCarrier = detectCarrier(recipientPhone);
  const normalizedPhone = normalizePHPhone(recipientPhone);
  const isPhoneValid = isValidPHPhone(recipientPhone);
  const totalAmount = product.sellingPrice;

  // Maya recipient details strictly specified: 09355883709, JAMES HOPE BONTUYAN
  const mayaRecipientNumber = settings?.manualPaymentMayaNumber || '09355883709';
  const mayaRecipientName = settings?.manualPaymentMayaName || 'JAMES HOPE BONTUYAN';

  // GCash recipient details
  const gcashRecipientNumber = settings?.manualPaymentGcashNumber || '09355883709';
  const gcashRecipientName = settings?.manualPaymentGcashName || 'JAMES HOPE BONTUYAN';

  const isCarrierMismatch = 
    isPhoneValid && 
    detectedCarrier && 
    product.network !== 'Other' && 
    detectedCarrier !== product.network;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Confetti celebratory animation
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#FACC15', '#EAB308', '#10B981', '#0F172A', '#38BDF8']
      });

      setTimeout(() => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 50,
          origin: { x: 0.05, y: 0.7 },
          colors: ['#FACC15', '#10B981', '#F59E0B']
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 50,
          origin: { x: 0.95, y: 0.7 },
          colors: ['#FACC15', '#10B981', '#3B82F6']
        });
      }, 200);
    } catch (e) {
      console.warn('Confetti animation failed:', e);
    }
  };

  // Step 1 -> Step 2: Validate phone number and show order summary
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

    if (isCarrierMismatch && !carrierWarningDismissed) {
      setErrorMessage(`Notice: Mobile number (${recipientPhone}) appears to be ${detectedCarrier}, but you selected a ${product.network} promo. Please confirm below.`);
      return;
    }

    setStep('order_summary');
  };

  // Step 2 -> Step 3: Create Authoritative Order and route to Manual Payment screen
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
      setStep('manual_payment');
    } catch (err) {
      console.error('Order creation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create order. Please check connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 -> Step 4: Submit manual payment reference number for Admin Review
  const handleSubmitManualPayment = async () => {
    if (!createdOrder) return;
    const trimmedRef = paymentRefNumber.trim();

    if (!trimmedRef) {
      setErrorMessage(`Please enter your ${paymentGateway === 'maya' ? 'Maya' : 'GCash'} Transaction Reference Number.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await submitCustomerPayment(
        createdOrder.id,
        trimmedRef,
        createdOrder.paymentGateway,
        senderNotes.trim()
      );

      if (res.success) {
        const finishedOrder: Order = {
          ...createdOrder,
          paymentStatus: 'review_required',
          fulfillmentStatus: 'queued',
          paymentReference: trimmedRef,
          manualPaymentRef: trimmedRef,
          notes: senderNotes.trim() || `Customer submitted manual ${createdOrder.paymentGateway.toUpperCase()} payment ref: ${trimmedRef}. Pending Admin Review.`
        };
        setCompletedOrder(finishedOrder);
        setStep('success_celebration');
        triggerConfetti();
      } else {
        setErrorMessage(res.errorMessage || 'Failed to submit payment verification. Please try again.');
      }
    } catch (err) {
      console.error('Payment submission error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting payment verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    if (createdOrder) {
      try {
        await processPaymentFailure(createdOrder.id, 'Customer returned to change payment details');
      } catch (e) {
        // ignore
      }
    }
    setStep('order_summary');
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

  const activeRecipientName = paymentGateway === 'maya' ? mayaRecipientName : gcashRecipientName;
  const activeRecipientNumber = paymentGateway === 'maya' ? mayaRecipientNumber : gcashRecipientNumber;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`p-5 text-slate-950 flex items-center justify-between ${
          step === 'manual_payment' && paymentGateway === 'maya'
            ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400'
            : step === 'manual_payment' && paymentGateway === 'gcash'
            ? 'bg-gradient-to-r from-blue-400 via-sky-300 to-blue-400'
            : 'bg-gradient-to-r from-amber-400 to-yellow-400'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950/10 flex items-center justify-center">
              {step === 'order_summary' ? (
                <Receipt className="w-5 h-5 text-slate-950" />
              ) : step === 'success_celebration' ? (
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
              ) : step === 'manual_payment' ? (
                <QrCode className="w-5 h-5 text-slate-950" />
              ) : (
                <Smartphone className="w-5 h-5 text-slate-950" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">
                {step === 'order_summary' 
                  ? 'Order Summary & Review' 
                  : step === 'manual_payment'
                  ? `Manual ${paymentGateway === 'maya' ? 'Maya' : 'GCash'} Payment`
                  : step === 'success_celebration' 
                  ? 'Payment Submitted!' 
                  : 'Checkout Prepaid Load'}
              </h2>
              <p className="text-xs text-slate-800 font-medium">
                {step === 'order_summary' 
                  ? 'Review details before proceeding'
                  : step === 'manual_payment'
                  ? 'Direct transfer • Admin verifies before dispatching load'
                  : step === 'success_celebration'
                  ? 'Pending Admin Verification & Load Dispatch'
                  : 'Manual Payment via GCash & Maya'}
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
                
                {/* Mismatch Warning Alert in UI */}
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
                  E-load will disburse directly to this number via SMS confirmation upon admin review.
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

              {/* Payment Method Selector: ONLY GCash and Maya (Manual) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Manual Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* GCash */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('gcash')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'gcash'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span className="font-extrabold text-sm text-blue-700">GCash</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Manual Transfer / QR</span>
                    </div>
                    {paymentGateway === 'gcash' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </button>

                  {/* Maya */}
                  <button
                    type="button"
                    onClick={() => setPaymentGateway('maya')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      paymentGateway === 'maya'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span className="font-extrabold text-sm text-emerald-700">Maya</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Manual Transfer / QR</span>
                    </div>
                    {paymentGateway === 'maya' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  </button>
                </div>

                <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Manual Verification: Pay directly to <strong>{activeRecipientName}</strong>. Admin James will verify your reference before loading.
                  </span>
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

          {/* STEP 2: BRIEF ORDER SUMMARY VIEW */}
          {step === 'order_summary' && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-xs space-y-4">
                
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Order Summary
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                    Manual Verification Order
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Product Name:</span>
                    <span className="font-black text-slate-950 text-sm sm:text-base">
                      {product.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Network:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${getNetworkBadge(product.network)}`}>
                      {product.network}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Recipient Mobile:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {normalizedPhone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Payment Method:</span>
                    <span className="font-bold text-slate-800">
                      {paymentGateway === 'maya' ? 'Maya (Manual Transfer)' : 'GCash (Manual Transfer)'}
                    </span>
                  </div>

                  {product.validity && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Promo Validity:</span>
                      <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {product.validity}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-amber-200/50">
                    <span className="font-bold text-slate-700 block mb-0.5">Package Details:</span>
                    <p className="line-clamp-2 leading-relaxed">{product.description}</p>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="pt-3 border-t border-amber-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Load Package Price:</span>
                    <span className="font-semibold">{formatPHP(product.sellingPrice)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Processing Fee:</span>
                    <span className="font-semibold text-emerald-600">₱0.00 (Free)</span>
                  </div>
                  <div className="pt-2 border-t border-amber-300 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                        Total Amount to Transfer:
                      </span>
                      <span className="text-[10px] text-slate-500">Payable via {paymentGateway.toUpperCase()}</span>
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
                  Manual Verification Security
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Fast Admin Approval
                </span>
              </div>

              {/* Action Buttons */}
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
                      <QrCode className="w-4 h-4" />
                      <span>Proceed to {paymentGateway === 'maya' ? 'Maya' : 'GCash'} Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* STEP 3: MANUAL PAYMENT INSTRUCTIONS & PROOF SUBMISSION */}
          {step === 'manual_payment' && createdOrder && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Payment Target Card */}
              <div className={`overflow-hidden rounded-2xl border shadow-xs ${
                paymentGateway === 'maya' 
                  ? 'border-emerald-200 bg-emerald-50/40' 
                  : 'border-blue-200 bg-blue-50/40'
              }`}>
                {/* Header banner */}
                <div className={`p-3 text-white flex items-center justify-between ${
                  paymentGateway === 'maya' ? 'bg-slate-950' : 'bg-[#005ce6]'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                      paymentGateway === 'maya' ? 'bg-emerald-500 text-slate-950' : 'bg-white text-[#005ce6]'
                    }`}>
                      {paymentGateway === 'maya' ? 'maya' : 'G'}
                    </div>
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {paymentGateway === 'maya' ? 'Maya Manual Transfer' : 'GCash Manual Transfer'}
                    </span>
                  </div>
                  <span className={`font-mono font-black text-sm ${
                    paymentGateway === 'maya' ? 'text-emerald-400' : 'text-amber-300'
                  }`}>
                    {formatPHP(createdOrder.sellingPrice)}
                  </span>
                </div>

                <div className="p-4 space-y-3.5">
                  
                  {/* QR Ph Graphic */}
                  <div className="w-44 h-44 mx-auto bg-white p-2.5 rounded-2xl border-2 border-slate-900 shadow-sm relative flex flex-col items-center justify-center">
                    <div className="absolute top-1 left-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      QR Ph
                    </div>
                    <svg className="w-32 h-32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                      <rect x="9" y="9" width="18" height="18" rx="2" fill="white" />
                      <rect x="13" y="13" width="10" height="10" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />

                      <rect x="69" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                      <rect x="73" y="9" width="18" height="18" rx="2" fill="white" />
                      <rect x="77" y="13" width="10" height="10" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />

                      <rect x="5" y="69" width="26" height="26" rx="4" fill="#0F172A" />
                      <rect x="9" y="73" width="18" height="18" rx="2" fill="white" />
                      <rect x="13" y="77" width="10" height="10" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />

                      <rect x="36" y="8" width="6" height="6" fill="#0F172A" />
                      <rect x="46" y="8" width="6" height="6" fill="#0F172A" />
                      <rect x="56" y="8" width="6" height="6" fill="#0F172A" />
                      <rect x="36" y="18" width="6" height="6" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />
                      <rect x="48" y="22" width="8" height="6" fill="#0F172A" />
                      <rect x="8" y="36" width="6" height="6" fill="#0F172A" />
                      <rect x="18" y="44" width="8" height="6" fill="#0F172A" />
                      <rect x="36" y="36" width="6" height="6" fill="#0F172A" />
                      <rect x="58" y="36" width="8" height="8" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />
                      <rect x="74" y="36" width="6" height="6" fill="#0F172A" />
                      <rect x="86" y="44" width="6" height="8" fill="#0F172A" />
                      <rect x="38" y="62" width="6" height="6" fill="#0F172A" />
                      <rect x="52" y="62" width="8" height="6" fill="#0F172A" />
                      <rect x="72" y="62" width="6" height="6" fill="#0F172A" />
                      <rect x="86" y="72" width="6" height="6" fill="#0F172A" />
                      <rect x="42" y="76" width="12" height="6" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />
                      <rect x="62" y="76" width="6" height="12" fill="#0F172A" />
                      <rect x="76" y="82" width="10" height="6" fill="#0F172A" />

                      <circle cx="50" cy="50" r="13" fill={paymentGateway === 'maya' ? '#10B981' : '#005ce6'} />
                      <text x="50" y="54" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="sans-serif">
                        {paymentGateway === 'maya' ? 'M' : 'G'}
                      </text>
                    </svg>
                    <span className="text-[9px] font-bold text-slate-600 mt-1">
                      Scan or Send to Number Below
                    </span>
                  </div>

                  {/* Recipient Account Details with 1-click Copy */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2.5">
                    
                    {/* Account Name */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">Account Name:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900">{activeRecipientName}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeRecipientName, 'name')}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Copy Name"
                        >
                          {copiedKey === 'name' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Account Number */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold">
                        {paymentGateway === 'maya' ? 'Maya Number:' : 'GCash Number:'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900 text-sm">{activeRecipientNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeRecipientNumber, 'number')}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Copy Number"
                        >
                          {copiedKey === 'number' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Exact Amount */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-slate-500 font-semibold">Exact Amount to Send:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black text-base ${paymentGateway === 'maya' ? 'text-emerald-700' : 'text-blue-700'}`}>
                          {formatPHP(createdOrder.sellingPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(createdOrder.sellingPrice.toString(), 'amount')}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Copy Amount"
                        >
                          {copiedKey === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Transfer Steps */}
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                    <span className="font-bold block text-slate-900">How to Pay:</span>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-600 leading-relaxed">
                      <li>Open your <strong>{paymentGateway === 'maya' ? 'Maya' : 'GCash'}</strong> app and select Send Money or Scan QR.</li>
                      <li>Send exactly <strong>{formatPHP(createdOrder.sellingPrice)}</strong> to <strong>{activeRecipientNumber}</strong> ({activeRecipientName}).</li>
                      <li>Copy the <strong>Transaction Reference Number</strong> from your SMS or app receipt.</li>
                      <li>Paste the Reference Number below and submit for admin review.</li>
                    </ol>
                  </div>

                </div>
              </div>

              {/* Reference Number Input (Required) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {paymentGateway === 'maya' ? 'Maya' : 'GCash'} Transaction Reference Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => {
                    setPaymentRefNumber(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder={paymentGateway === 'maya' ? 'e.g. 2026-MAY-918274 or 12-digit ref' : 'e.g. 1002 9847 1823'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Required: James will verify this reference in his {paymentGateway === 'maya' ? 'Maya' : 'GCash'} account before disbursing your load.
                </span>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sender Name or Notes (Optional)
                </label>
                <input
                  type="text"
                  value={senderNotes}
                  onChange={(e) => setSenderNotes(e.target.value)}
                  placeholder="e.g. Sent from Juan's account"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>

              {/* Submit for Admin Review Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSubmitManualPayment}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting for Admin Review...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Submit Payment for Admin Review (James Bontuyan)</span>
                  </>
                )}
              </button>

              {/* Return to summary */}
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancelPayment}
                className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel and return to order summary
              </button>

            </div>
          )}

          {/* STEP 4: SUCCESS / PENDING ADMIN REVIEW VIEW */}
          {step === 'success_celebration' && completedOrder && (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-300">
              
              {/* Animated Success Check Circle with pulsing rings */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                <div className="absolute inset-1.5 rounded-full bg-amber-100 border border-amber-300" />
                <div className="relative w-14 h-14 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40">
                  <Check className="w-8 h-8 stroke-[3.5] animate-in zoom-in-50 duration-300" />
                </div>
              </div>

              {/* Title & Banner */}
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
                    onClick={() => copyToClipboard(completedOrder.orderReference, 'order_ref')}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
                  >
                    {copiedKey === 'order_ref' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'order_ref' ? 'Copied' : 'Copy'}</span>
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
                    <span className="font-black text-amber-700">{formatPHP(completedOrder.sellingPrice)}</span>
                  </div>
                </div>

                {(completedOrder.paymentReference || completedOrder.manualPaymentRef) && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-semibold">Submitted Reference</span>
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
