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
import { SupportRequest, SupportCategory, SupportStatus } from '../types';

export interface CreateSupportParams {
  userId: string;
  orderId?: string;
  orderReference?: string;
  customerEmail: string;
  category: SupportCategory;
  subject: string;
  description: string;
}

export async function createSupportTicket(params: CreateSupportParams): Promise<SupportRequest> {
  const reqId = `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const ticket: SupportRequest = {
    id: reqId,
    userId: params.userId,
    orderId: params.orderId,
    orderReference: params.orderReference,
    customerEmail: params.customerEmail,
    category: params.category,
    subject: params.subject,
    description: params.description,
    status: 'open',
    createdAt: now,
    updatedAt: now
  };

  try {
    const docRef = doc(db, 'supportRequests', reqId);
    await setDoc(docRef, ticket);
    return ticket;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `supportRequests/${reqId}`);
  }
}

export async function getUserSupportTickets(userId: string): Promise<SupportRequest[]> {
  try {
    const colRef = collection(db, 'supportRequests');
    const q = query(colRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: SupportRequest[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as SupportRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'supportRequests');
  }
}

export async function getAllSupportTickets(): Promise<SupportRequest[]> {
  try {
    const colRef = collection(db, 'supportRequests');
    const snap = await getDocs(colRef);
    const list: SupportRequest[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as SupportRequest));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'supportRequests');
  }
}

export async function updateSupportTicketStatus(
  requestId: string, 
  status: SupportStatus, 
  adminNotes?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'supportRequests', requestId);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      status,
      adminNotes: adminNotes ?? '',
      updatedAt: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `supportRequests/${requestId}`);
  }
}
