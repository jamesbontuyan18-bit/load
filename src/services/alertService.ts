import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PriceDropAlert, TelcoNetwork } from '../types';
import { recordAdminAuditLog } from './ledgerService';

const LOCAL_ALERTS_KEY = 'jls_price_alerts';

interface LocalAlertRecord {
  productId: string;
  alertId: string;
  email: string;
  subscribedAt: string;
}

export function getLocalPriceAlerts(): LocalAlertRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ALERTS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function isProductAlertActive(productId: string): boolean {
  const alerts = getLocalPriceAlerts();
  return alerts.some(a => a.productId === productId);
}

export function saveLocalAlert(record: LocalAlertRecord): void {
  if (typeof window === 'undefined') return;
  const current = getLocalPriceAlerts().filter(a => a.productId !== record.productId);
  current.push(record);
  localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(current));
}

export function removeLocalAlert(productId: string): void {
  if (typeof window === 'undefined') return;
  const current = getLocalPriceAlerts().filter(a => a.productId !== productId);
  localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(current));
}

export interface SubscribeParams {
  productId: string;
  productName: string;
  network: TelcoNetwork;
  initialPrice: number;
  targetPrice?: number;
  email: string;
  userId?: string;
}

export async function subscribeToPriceDrop(params: SubscribeParams): Promise<PriceDropAlert> {
  const alertId = `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const alertData: PriceDropAlert = {
    id: alertId,
    productId: params.productId,
    productName: params.productName,
    network: params.network,
    initialPrice: params.initialPrice,
    targetPrice: params.targetPrice,
    email: params.email.trim().toLowerCase(),
    userId: params.userId,
    isActive: true,
    notified: false,
    createdAt: now
  };

  try {
    const docRef = doc(db, 'priceDropAlerts', alertId);
    await setDoc(docRef, alertData);

    // Save in browser session
    saveLocalAlert({
      productId: params.productId,
      alertId,
      email: params.email,
      subscribedAt: now
    });

    return alertData;
  } catch (error) {
    console.warn('Could not save price drop alert to Firestore, storing locally:', error);
    saveLocalAlert({
      productId: params.productId,
      alertId,
      email: params.email,
      subscribedAt: now
    });
    return alertData;
  }
}

export async function unsubscribeFromPriceDrop(productId: string): Promise<void> {
  const localAlerts = getLocalPriceAlerts();
  const alert = localAlerts.find(a => a.productId === productId);
  
  if (alert) {
    try {
      const docRef = doc(db, 'priceDropAlerts', alert.alertId);
      await updateDoc(docRef, { isActive: false });
    } catch (e) {
      console.warn('Could not update price alert in Firestore:', e);
    }
  }

  removeLocalAlert(productId);
}

export async function fetchAllPriceDropAlerts(): Promise<PriceDropAlert[]> {
  try {
    const colRef = collection(db, 'priceDropAlerts');
    const snap = await getDocs(colRef);
    const list: PriceDropAlert[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as PriceDropAlert));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Error fetching price drop alerts:', error);
    return [];
  }
}

/**
 * Checks and notifies customers when a product price decreases
 */
export async function triggerPriceDropNotifications(
  productId: string, 
  productName: string, 
  oldPrice: number, 
  newPrice: number, 
  adminEmail: string
): Promise<number> {
  if (newPrice >= oldPrice) return 0;

  try {
    const colRef = collection(db, 'priceDropAlerts');
    const q = query(colRef, where('productId', '==', productId), where('isActive', '==', true));
    const snap = await getDocs(q);

    let notifiedCount = 0;
    const now = new Date().toISOString();

    for (const d of snap.docs) {
      const alert = d.data() as PriceDropAlert;
      // If targetPrice set, only trigger if newPrice <= targetPrice
      if (!alert.targetPrice || newPrice <= alert.targetPrice) {
        await updateDoc(doc(db, 'priceDropAlerts', d.id), {
          notified: true,
          notifiedAt: now
        });
        notifiedCount++;
      }
    }

    if (notifiedCount > 0) {
      await recordAdminAuditLog({
        adminUid: 'system',
        adminEmail: adminEmail || 'admin',
        action: 'PRICE_DROP_ALERTS_SENT',
        targetType: 'product',
        targetId: productId,
        details: `Dispatched price drop alerts to ${notifiedCount} customer(s) for ${productName}: ₱${oldPrice} -> ₱${newPrice}`
      });
    }

    return notifiedCount;
  } catch (e) {
    console.warn('Error triggering price drop notifications:', e);
    return 0;
  }
}
