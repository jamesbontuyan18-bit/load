export type TelcoNetwork = 'Globe' | 'TM' | 'Smart' | 'TNT' | 'DITO' | 'Other';

export type ProductCategory = 'regular' | 'data' | 'call_text' | 'combo' | 'special';

export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refund_pending'
  | 'refunded'
  | 'review_required';

export type FulfillmentStatus = 
  | 'not_started'
  | 'queued'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'unknown'
  | 'manual_review'
  | 'cancelled';

export type UserRole = 'customer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  accountStatus: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  network: TelcoNetwork;
  category: ProductCategory;
  description: string;
  faceValue: number;      // in PHP
  sellingPrice: number;   // customer price in PHP
  providerCost: number;   // reseller acquisition cost in PHP
  isActive: boolean;
  providerId: string;     // e.g. 'telco-direct', 'sandbox-gateway'
  providerProductId?: string;
  fulfillmentMode: 'auto' | 'manual';
  validity?: string;      // e.g. '3 Days', '7 Days', '30 Days'
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderReference: string; // e.g. JLS-202610-9821
  userId: string;
  customerEmail: string;
  customerName: string;
  productId: string;
  productNameSnapshot: string;
  networkSnapshot: TelcoNetwork;
  faceValueSnapshot: number;
  recipientNumber: string; // Philippine 09XXXXXXXXX
  sellingPrice: number;
  providerCost: number;
  gatewayFee: number;
  currency: string;       // 'PHP'
  paymentGateway: 'gcash' | 'maya' | 'card' | 'manual';
  paymentReference?: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  providerReference?: string; // Telco e-load transaction ID
  failureCode?: string;
  failureReason?: string;
  idempotencyKey?: string;
  manualPaymentProof?: string;
  manualPaymentRef?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  fulfilledAt?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderReference: string;
  userId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEntryType = 'GROSS_SALE' | 'PROVIDER_COST' | 'GATEWAY_FEE' | 'REFUND' | 'ADJUSTMENT';

export interface FinancialLedgerEntry {
  id: string;
  orderId?: string;
  orderReference?: string;
  entryType: LedgerEntryType;
  amountInCentavos: number; // precision safe (e.g. 5000 = PHP 50.00)
  currency: string;
  sourceReference?: string;
  reversalOf?: string;
  description: string;
  createdAt: string;
}

export type SupportCategory = 'load_delay' | 'wrong_number' | 'payment_issue' | 'cancellation' | 'other';
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportRequest {
  id: string;
  userId: string;
  orderId?: string;
  orderReference?: string;
  customerEmail: string;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  createdAt: string;
}

export interface PriceDropAlert {
  id: string;
  productId: string;
  productName: string;
  network: TelcoNetwork;
  initialPrice: number;
  targetPrice?: number;
  email: string;
  userId?: string;
  isActive: boolean;
  notified: boolean;
  createdAt: string;
}

export interface SystemSettings {
  businessName: string;
  supportPhone: string;
  supportEmail: string;
  operatingHours: string;
  manualPaymentGcashName: string;
  manualPaymentGcashNumber: string;
  manualPaymentMayaName: string;
  manualPaymentMayaNumber: string;
  announcement: string;
  sandboxMode: boolean;
  autoFulfillmentEnabled: boolean;
  updatedAt: string;
}

// Financial Helper Functions
export const toCentavos = (php: number): number => Math.round(php * 100);
export const fromCentavos = (centavos: number): number => centavos / 100;

export const formatPHP = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Normalize Philippine Phone Numbers: accepts +639XXXXXXXXX, 639XXXXXXXXX, 09XXXXXXXXX -> returns 09XXXXXXXXX
export const normalizePHPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('639') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return '0' + digits;
  }
  if (digits.startsWith('09') && digits.length === 11) {
    return digits;
  }
  return digits;
};

export const isValidPHPhone = (phone: string): boolean => {
  const normalized = normalizePHPhone(phone);
  return /^09\d{9}$/.test(normalized);
};

// Telco network auto-detection based on official Philippine carrier prefix allocation
export const detectCarrier = (phone: string): TelcoNetwork | null => {
  const norm = normalizePHPhone(phone);
  if (norm.length < 4) return null;
  const prefix = norm.substring(0, 4);

  // Globe / TM prefixes
  const globeTmPrefixes = [
    '0905', '0906', '0915', '0916', '0917', '0926', '0927', '0935', '0936', '0937',
    '0945', '0953', '0954', '0955', '0956', '0965', '0966', '0967', '0975', '0976',
    '0977', '0978', '0979', '0995', '0996', '0997'
  ];

  // Smart / TNT prefixes
  const smartTntPrefixes = [
    '0907', '0908', '0909', '0910', '0911', '0912', '0918', '0919', '0920', '0921',
    '0928', '0929', '0930', '0938', '0939', '0946', '0947', '0948', '0949', '0950',
    '0951', '0961', '0963', '0968', '0969', '0970', '0981', '0989', '0998', '0999'
  ];

  // DITO prefixes
  const ditoPrefixes = [
    '0991', '0992', '0993', '0994', '0895', '0896', '0897', '0898'
  ];

  if (globeTmPrefixes.includes(prefix)) return 'Globe';
  if (smartTntPrefixes.includes(prefix)) return 'Smart';
  if (ditoPrefixes.includes(prefix)) return 'DITO';

  return null;
};
