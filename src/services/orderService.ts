import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Order, 
  Product, 
  PaymentStatus, 
  FulfillmentStatus, 
  normalizePHPhone, 
  isValidPHPhone 
} from '../types';
import { fetchProductById } from './catalogService';

const GUEST_ORDERS_KEY = 'jls_guest_orders';
const GUEST_ID_KEY = 'jls_guest_id';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest-anonymous';
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

export function saveGuestOrderId(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) || '[]');
    if (!existing.includes(orderId)) {
      existing.unshift(orderId);
      localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(existing.slice(0, 50)));
    }
  } catch (e) {
    console.error('Error saving guest order id:', e);
  }
}

export function getGuestOrderIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export async function getGuestOrders(): Promise<Order[]> {
  const ids = getGuestOrderIds();
  if (ids.length === 0) return [];
  
  const orders: Order[] = [];
  for (const id of ids) {
    try {
      const ord = await getOrderById(id);
      if (ord) orders.push(ord);
    } catch (e) {
      console.warn('Failed to load guest order:', id, e);
    }
  }
  return orders;
}

// Reference generator: JLS-YYYYMM-XXXXX
export function generateOrderReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 5; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `JLS-${year}${month}-${rand}`;
}

export interface CreateOrderParams {
  userId: string;
  customerEmail: string;
  customerName: string;
  productId: string;
  recipientNumber: string;
  paymentGateway: 'gcash' | 'maya' | 'card' | 'manual';
  clientClaimedPrice?: number;
  idempotencyKey?: string;
}

export async function createAuthoritativeOrder(params: CreateOrderParams): Promise<Order> {
  const normalizedPhone = normalizePHPhone(params.recipientNumber);
  if (!isValidPHPhone(normalizedPhone)) {
    throw new Error('Invalid Philippine mobile number. Must be 11 digits starting with 09.');
  }

  // Authoritative price check
  const product = await fetchProductById(params.productId);
  if (!product) {
    throw new Error('Selected load promo or package is no longer available.');
  }
  if (!product.isActive) {
    throw new Error('This product is temporarily disabled by the operator.');
  }

  // Price is ALWAYS derived authoritatively from product record, never trusting client input
  const authoritativeSellingPrice = product.sellingPrice;
  const authoritativeProviderCost = product.providerCost;
  
  // Transparent payment processing fee (₱0 for direct e-wallets, or nominal ₱2 for card if applicable)
  const gatewayFee = params.paymentGateway === 'card' ? 2 : 0;

  const now = new Date().toISOString();
  const orderRef = generateOrderReference();
  const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const orderData: Order = {
    id: orderId,
    orderReference: orderRef,
    userId: params.userId,
    customerEmail: params.customerEmail,
    customerName: params.customerName || 'Customer',
    productId: product.id,
    productNameSnapshot: product.name,
    networkSnapshot: product.network,
    faceValueSnapshot: product.faceValue,
    recipientNumber: normalizedPhone,
    sellingPrice: authoritativeSellingPrice,
    providerCost: authoritativeProviderCost,
    gatewayFee: gatewayFee,
    currency: 'PHP',
    paymentGateway: params.paymentGateway,
    paymentStatus: 'pending',
    fulfillmentStatus: 'not_started',
    idempotencyKey: params.idempotencyKey || `idem-${orderId}`,
    createdAt: now,
    updatedAt: now
  };

  try {
    const docRef = doc(db, 'orders', orderId);
    await setDoc(docRef, orderData);
    if (params.userId.startsWith('guest-')) {
      saveGuestOrderId(orderId);
    }
    return orderData;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
  }
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    const docRef = doc(db, 'orders', orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Order;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `orders/${orderId}`);
  }
}

export async function getOrderByReference(orderReference: string): Promise<Order | null> {
  if (!orderReference || !orderReference.trim()) return null;

  // Sanitize input: handle unicode dashes (–, —, −), remove leading #, normalize uppercase
  const rawClean = orderReference.trim();
  const cleanRef = rawClean
    .replace(/^[#]/, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-') // en-dash, em-dash, minus, etc.
    .replace(/\s+/g, '')
    .toUpperCase();

  // 1. Direct Order Document ID lookup (e.g. ord-1729...)
  if (cleanRef.toLowerCase().startsWith('ord-') || cleanRef.length > 20) {
    try {
      const direct = await getOrderById(cleanRef.toLowerCase());
      if (direct) return direct;
    } catch (e) {
      console.warn('Direct order id lookup failed:', e);
    }
  }

  // 2. Query Firestore by orderReference
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('orderReference', '==', cleanRef), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Order;
    }

    // If not found, try formatted variation (e.g. if user omitted 'JLS-')
    if (!cleanRef.startsWith('JLS-') && cleanRef.includes('-')) {
      const prefixed = `JLS-${cleanRef}`;
      const q2 = query(ordersCol, where('orderReference', '==', prefixed), limit(1));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        const docSnap2 = snap2.docs[0];
        return { id: docSnap2.id, ...docSnap2.data() } as Order;
      }
    }
  } catch (error) {
    console.error('Firestore query in getOrderByReference encountered an error:', error);
  }

  // 3. Fallback: Check local guest orders in this browser session
  try {
    const guestOrderIds = getGuestOrderIds();
    for (const gid of guestOrderIds) {
      const guestOrder = await getOrderById(gid);
      if (guestOrder) {
        const normalizedLocalRef = guestOrder.orderReference?.replace(/[\u2010-\u2015\u2212]/g, '-').toUpperCase();
        if (normalizedLocalRef === cleanRef || guestOrder.id === cleanRef || guestOrder.id.toLowerCase() === rawClean.toLowerCase()) {
          return guestOrder;
        }
      }
    }
  } catch (localErr) {
    console.warn('Guest orders lookup fallback error:', localErr);
  }

  return null;
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('userId', '==', userId));
    const snap = await getDocs(q);
    const orders: Order[] = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() } as Order));
    // Sort descending by creation date
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const ordersCol = collection(db, 'orders');
    const snap = await getDocs(ordersCol);
    const orders: Order[] = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() } as Order));
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function submitManualPaymentProof(
  orderId: string, 
  referenceNumber: string, 
  notes?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, {
      manualPaymentRef: referenceNumber,
      paymentStatus: 'review_required',
      notes: notes || 'Customer submitted manual payment reference for verification',
      updatedAt: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

// State machine validation
export function isValidPaymentTransition(current: PaymentStatus, target: PaymentStatus): boolean {
  const allowedTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ['processing', 'paid', 'review_required', 'failed', 'cancelled', 'expired'],
    processing: ['paid', 'failed', 'cancelled', 'expired', 'review_required'],
    review_required: ['paid', 'failed', 'cancelled'],
    paid: ['refund_pending', 'refunded'],
    failed: ['pending'], // allow retry
    cancelled: [],
    expired: [],
    refund_pending: ['refunded', 'paid'],
    refunded: []
  };
  return allowedTransitions[current]?.includes(target) ?? false;
}

export function isValidFulfillmentTransition(current: FulfillmentStatus, target: FulfillmentStatus): boolean {
  const allowedTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
    not_started: ['queued', 'processing', 'cancelled', 'manual_review'],
    queued: ['processing', 'failed', 'cancelled', 'manual_review'],
    processing: ['successful', 'failed', 'unknown', 'manual_review'],
    manual_review: ['queued', 'processing', 'successful', 'failed', 'cancelled'],
    unknown: ['successful', 'failed', 'manual_review'],
    successful: [], // terminal
    failed: ['queued', 'processing', 'manual_review', 'cancelled'], // retry allowed
    cancelled: []
  };
  return allowedTransitions[current]?.includes(target) ?? false;
}
