import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SystemSettings } from '../types';

export const DEFAULT_SETTINGS: SystemSettings = {
  businessName: 'James Load Services',
  supportPhone: '+63 917 888 9999',
  supportEmail: 'support@jamesloadservices.ph',
  operatingHours: '6:00 AM - 11:00 PM Daily (Automated 24/7 Delivery)',
  manualPaymentGcashName: 'JAMES BONTUYAN',
  manualPaymentGcashNumber: '0917-888-9999',
  manualPaymentMayaName: 'JAMES BONTUYAN',
  manualPaymentMayaNumber: '0917-888-9999',
  announcement: '⚡ Instant automated load delivery is live for Globe, TM, Smart, TNT, and DITO! Direct payments via GCash, Maya & Cards.',
  sandboxMode: false,
  autoFulfillmentEnabled: true,
  updatedAt: new Date().toISOString()
};

export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const docRef = doc(db, 'settings', 'general');
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return DEFAULT_SETTINGS;
    }
    const data = snap.data();
    return { ...DEFAULT_SETTINGS, ...data, sandboxMode: false } as SystemSettings;
  } catch (error) {
    console.warn('Using default system settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'general');
    const now = new Date().toISOString();
    await setDoc(docRef, {
      ...settings,
      updatedAt: now
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/general');
  }
}
