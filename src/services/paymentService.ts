import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Order, PaymentRecord } from '../types';
import { recordLedgerEntry, recordAdminAuditLog } from './ledgerService';
import { executeLoadFulfillment } from './providerService';

export interface PaymentProcessResult {
  success: boolean;
  gatewayReference?: string;
  errorMessage?: string;
}

/**
 * Direct Payment Gateway Service
/**
 * Customer Payment Submission
 * When customer completes checkout (GCash, Maya, QR Ph, Card, or Manual Transfer),
 * the payment reference is saved and marked for ADMIN REVIEW.
 * The e-load is deliberately NOT dispatched automatically until verified and approved by the admin.
 */
export async function submitCustomerPayment(
  orderId: string,
  gatewayRef?: string,
  gatewayName?: string,
  notes?: string
): Promise<PaymentProcessResult> {
  const orderDocRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderDocRef);

  if (!snap.exists()) {
    return { success: false, errorMessage: 'Order not found' };
  }

  const order = { id: snap.id, ...snap.data() } as Order;
  const now = new Date().toISOString();
  const effectiveGateway = (gatewayName || order.paymentGateway || 'payment').toUpperCase();
  const paymentReference = (gatewayRef && gatewayRef.trim()) 
    ? gatewayRef.trim() 
    : `${effectiveGateway}-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  const paymentId = `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const paymentDoc: PaymentRecord = {
    id: paymentId,
    orderId: order.id,
    orderReference: order.orderReference,
    userId: order.userId,
    gateway: order.paymentGateway,
    gatewayReference: paymentReference,
    amount: order.sellingPrice + order.gatewayFee,
    currency: 'PHP',
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  try {
    try {
      await setDoc(doc(db, 'payments', paymentId), paymentDoc);
    } catch (pmtErr) {
      console.warn('Could not write payments document, continuing order update:', pmtErr);
    }

    const orderNotes = notes?.trim() || `Customer submitted payment via ${effectiveGateway}. Reference: ${paymentReference}. Awaiting Admin Review.`;

    // Set order to review_required and queue fulfillment (NO automatic telco dispatch)
    await updateDoc(orderDocRef, {
      paymentStatus: 'review_required',
      fulfillmentStatus: 'queued',
      paymentReference: paymentReference,
      manualPaymentRef: paymentReference,
      notes: orderNotes,
      updatedAt: now
    });

    return {
      success: true,
      gatewayReference: paymentReference
    };
  } catch (error) {
    console.error('Error during customer payment submission:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Failed to submit payment reference. Please try again.'
    };
  }
}

/**
 * Direct Payment Gateway Service (Legacy/Direct wrapper)
 * Now sets status to review_required to ensure all customer payments undergo Admin Review.
 */
export async function processPaymentSuccess(orderId: string, gatewayRef?: string): Promise<PaymentProcessResult> {
  return submitCustomerPayment(orderId, gatewayRef);
}

export async function processPaymentFailure(orderId: string, reason: string): Promise<void> {
  const orderDocRef = doc(db, 'orders', orderId);
  const now = new Date().toISOString();

  await updateDoc(orderDocRef, {
    paymentStatus: 'failed',
    failureReason: reason,
    updatedAt: now
  });
}

/**
 * Admin Verification & Approval
 * ONLY the administrator can approve the payment and trigger the authoritative telco e-load dispatch.
 */
export async function adminApproveManualPayment(orderId: string, adminUid: string, adminEmail: string): Promise<void> {
  const orderDocRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderDocRef);
  if (!snap.exists()) throw new Error('Order not found');

  const order = { id: snap.id, ...snap.data() } as Order;
  const now = new Date().toISOString();
  const gatewayRef = order.paymentReference || order.manualPaymentRef || `APPV-${order.paymentGateway.toUpperCase()}-${Date.now()}`;

  // 1. Update order payment status to 'paid'
  await updateDoc(orderDocRef, {
    paymentStatus: 'paid',
    paymentReference: gatewayRef,
    paidAt: now,
    updatedAt: now,
    notes: `Payment verified and approved by admin (${adminEmail}) on ${new Date().toLocaleTimeString('en-PH')}`
  });

  // 2. Record Gross Sale in financial ledger
  await recordLedgerEntry({
    orderId: order.id,
    orderReference: order.orderReference,
    entryType: 'GROSS_SALE',
    amountInPHP: order.sellingPrice,
    sourceReference: gatewayRef,
    description: `Admin approved: ${order.productNameSnapshot} (${order.orderReference})`
  }).catch(e => console.warn('Ledger error on gross sale:', e));

  // 3. Record Gateway Fee if applicable
  if (order.gatewayFee > 0) {
    await recordLedgerEntry({
      orderId: order.id,
      orderReference: order.orderReference,
      entryType: 'GATEWAY_FEE',
      amountInPHP: order.gatewayFee,
      sourceReference: gatewayRef,
      description: `Processing fee for ${order.paymentGateway.toUpperCase()} payment`
    }).catch(e => console.warn('Ledger error on fee:', e));
  }

  // 4. Record audit log
  await recordAdminAuditLog({
    adminUid,
    adminEmail,
    action: 'APPROVE_MANUAL_PAYMENT',
    targetType: 'order',
    targetId: order.id,
    details: `Admin verified and approved payment for order ${order.orderReference}. Ref: ${gatewayRef}`
  }).catch(e => console.warn('Audit log error:', e));

  // 5. Authoritatively disburse e-load to recipient mobile number
  await executeLoadFulfillment(order.id, true, adminUid);
}

export async function adminRejectManualPayment(orderId: string, adminUid: string, adminEmail: string, reason: string): Promise<void> {
  const orderDocRef = doc(db, 'orders', orderId);
  const now = new Date().toISOString();

  await updateDoc(orderDocRef, {
    paymentStatus: 'failed',
    failureReason: reason,
    updatedAt: now,
    notes: `Manual payment rejected: ${reason}`
  });

  await recordAdminAuditLog({
    adminUid,
    adminEmail,
    action: 'REJECT_MANUAL_PAYMENT',
    targetType: 'order',
    targetId: orderId,
    details: `Rejected manual payment for order ${orderId}. Reason: ${reason}`
  });
}

export async function adminProcessRefund(orderId: string, adminUid: string, adminEmail: string, reason: string): Promise<void> {
  const orderDocRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderDocRef);
  if (!snap.exists()) throw new Error('Order not found');

  const order = { id: snap.id, ...snap.data() } as Order;
  const now = new Date().toISOString();
  const refundRef = `REFUND-${Date.now()}`;

  await updateDoc(orderDocRef, {
    paymentStatus: 'refunded',
    notes: `Order refunded by admin. Reason: ${reason}`,
    updatedAt: now
  });

  // Record reversal entry in ledger
  await recordLedgerEntry({
    orderId: order.id,
    orderReference: order.orderReference,
    entryType: 'REFUND',
    amountInPHP: order.sellingPrice,
    sourceReference: refundRef,
    description: `Refund for order ${order.orderReference}: ${reason}`
  });

  await recordAdminAuditLog({
    adminUid,
    adminEmail,
    action: 'PROCESS_REFUND',
    targetType: 'order',
    targetId: order.id,
    details: `Processed refund of ₱${order.sellingPrice} for ${order.orderReference}. Reason: ${reason}`
  });
}
