import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SystemSettings } from '../types';

export const DEFAULT_SETTINGS: SystemSettings = {
  businessName: 'James Load Services',
  supportPhone: '09355883709',
  supportEmail: 'support@jamesloadservices.ph',
  operatingHours: '6:00 AM - 11:00 PM Daily',
  manualPaymentGcashName: 'JAMES HOPE BONTUYAN',
  manualPaymentGcashNumber: '09355883709',
  manualPaymentMayaName: 'JAMES HOPE BONTUYAN',
  manualPaymentMayaNumber: '09355883709',
  announcement: '📢 Pay via GCash or Maya (Manual Verification). Transfer exact amount and enter reference number for fast admin review & loading.',
  sandboxMode: false,
  autoFulfillmentEnabled: false,
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
