import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  FinancialLedgerEntry, 
  LedgerEntryType, 
  AdminAuditLog, 
  toCentavos, 
  fromCentavos 
} from '../types';

export interface RecordLedgerParams {
  orderId?: string;
  orderReference?: string;
  entryType: LedgerEntryType;
  amountInPHP: number;
  currency?: string;
  sourceReference?: string;
  reversalOf?: string;
  description: string;
}

export async function recordLedgerEntry(params: RecordLedgerParams): Promise<FinancialLedgerEntry> {
  const entryId = `led-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const entry: FinancialLedgerEntry = {
    id: entryId,
    orderId: params.orderId,
    orderReference: params.orderReference,
    entryType: params.entryType,
    amountInCentavos: toCentavos(params.amountInPHP),
    currency: params.currency || 'PHP',
    sourceReference: params.sourceReference,
    reversalOf: params.reversalOf,
    description: params.description,
    createdAt: now
  };

  try {
    const docRef = doc(db, 'financialLedger', entryId);
    await setDoc(docRef, entry);
    return entry;
  } catch (error) {
    console.warn('Could not record ledger entry to Firestore (may be restricted to admin):', error);
    return entry;
  }
}

export async function fetchLedgerEntries(): Promise<FinancialLedgerEntry[]> {
  try {
    const colRef = collection(db, 'financialLedger');
    const snap = await getDocs(colRef);
    const list: FinancialLedgerEntry[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as FinancialLedgerEntry));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'financialLedger');
  }
}

export async function recordAdminAuditLog(log: Omit<AdminAuditLog, 'id' | 'createdAt'>): Promise<void> {
  const logId = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  try {
    const docRef = doc(db, 'adminAuditLogs', logId);
    await setDoc(docRef, {
      ...log,
      id: logId,
      createdAt: now
    });
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

export async function fetchAuditLogs(): Promise<AdminAuditLog[]> {
  try {
    const colRef = collection(db, 'adminAuditLogs');
    const snap = await getDocs(colRef);
    const list: AdminAuditLog[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as AdminAuditLog));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'adminAuditLogs');
  }
}
