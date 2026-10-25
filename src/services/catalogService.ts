import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, TelcoNetwork, ProductCategory } from '../types';

export const INITIAL_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Globe Promos
  {
    name: 'Go50',
    network: 'Globe',
    category: 'data',
    description: '5 GB data for all sites + 1 GB GoWiFi. Valid for 3 days.',
    faceValue: 50,
    sellingPrice: 53,
    providerCost: 48.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'GLB-GO50',
    fulfillmentMode: 'auto',
    validity: '3 Days'
  },
  {
    name: 'Go90',
    network: 'Globe',
    category: 'data',
    description: '8 GB data for all sites + Unli all-net texts. Valid for 7 days.',
    faceValue: 90,
    sellingPrice: 94,
    providerCost: 87.3,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'GLB-GO90',
    fulfillmentMode: 'auto',
    validity: '7 Days'
  },
  {
    name: 'GoEXTRA90',
    network: 'Globe',
    category: 'combo',
    description: '8 GB data + Unli calls to Globe/TM + Unli all-net texts. Valid for 7 days.',
    faceValue: 90,
    sellingPrice: 95,
    providerCost: 87.3,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'GLB-GOEXTRA90',
    fulfillmentMode: 'auto',
    validity: '7 Days'
  },
  {
    name: 'Globe Regular ₱100',
    network: 'Globe',
    category: 'regular',
    description: 'Standard ₱100 prepaid load credits for calls, texts, and promos.',
    faceValue: 100,
    sellingPrice: 104,
    providerCost: 97.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'GLB-REG-100',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  },
  {
    name: 'Globe Regular ₱300',
    network: 'Globe',
    category: 'regular',
    description: 'Standard ₱300 prepaid load credits for calls, texts, and promos.',
    faceValue: 300,
    sellingPrice: 308,
    providerCost: 291.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'GLB-REG-300',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  },

  // TM Promos
  {
    name: 'EasySURF 50',
    network: 'TM',
    category: 'data',
    description: '2 GB all-access data + 3 GB for FunALIW apps + Unli all-net texts. Valid for 3 days.',
    faceValue: 50,
    sellingPrice: 53,
    providerCost: 48.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'TM-EZ50',
    fulfillmentMode: 'auto',
    validity: '3 Days'
  },
  {
    name: 'TM Regular ₱50',
    network: 'TM',
    category: 'regular',
    description: 'Standard ₱50 TM prepaid load credits.',
    faceValue: 50,
    sellingPrice: 53,
    providerCost: 48.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'TM-REG-50',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  },
  {
    name: 'TM Unli Tawag at Text 150',
    network: 'TM',
    category: 'call_text',
    description: 'Unli calls & texts to Globe/TM + 100MB surf data for 15 days.',
    faceValue: 150,
    sellingPrice: 155,
    providerCost: 145.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'TM-UT150',
    fulfillmentMode: 'auto',
    validity: '15 Days'
  },

  // Smart Promos
  {
    name: 'GIGA Power 149',
    network: 'Smart',
    category: 'data',
    description: '2 GB/day for all sites & apps (14 GB total) + 6 GB open access data. Valid for 7 days.',
    faceValue: 149,
    sellingPrice: 154,
    providerCost: 144.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'SMART-GP149',
    fulfillmentMode: 'auto',
    validity: '7 Days'
  },
  {
    name: 'GIGA Video 99',
    network: 'Smart',
    category: 'data',
    description: '2 GB open access data + 1 GB/day for YouTube, Netflix, iWantTFC. Valid for 7 days.',
    faceValue: 99,
    sellingPrice: 104,
    providerCost: 96.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'SMART-GV99',
    fulfillmentMode: 'auto',
    validity: '7 Days'
  },
  {
    name: 'Magic Data 99',
    network: 'Smart',
    category: 'data',
    description: '2 GB high-speed open-access data with NO EXPIRY. Use anytime until consumed.',
    faceValue: 99,
    sellingPrice: 104,
    providerCost: 96.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'SMART-MD99',
    fulfillmentMode: 'auto',
    validity: 'No Expiration'
  },
  {
    name: 'Smart Regular ₱100',
    network: 'Smart',
    category: 'regular',
    description: 'Standard ₱100 Smart prepaid load balance.',
    faceValue: 100,
    sellingPrice: 104,
    providerCost: 97.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'SMART-REG-100',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  },

  // TNT Promos
  {
    name: 'SurfSaya 30',
    network: 'TNT',
    category: 'combo',
    description: '1.2 GB all sites data + 100MB/day FB & Messenger + Unli all-net calls & texts. Valid for 3 days.',
    faceValue: 30,
    sellingPrice: 33,
    providerCost: 29.1,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'TNT-SS30',
    fulfillmentMode: 'auto',
    validity: '3 Days'
  },
  {
    name: 'TNT Regular ₱50',
    network: 'TNT',
    category: 'regular',
    description: 'Standard ₱50 TNT prepaid load credit.',
    faceValue: 50,
    sellingPrice: 53,
    providerCost: 48.5,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'TNT-REG-50',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  },

  // DITO Promos
  {
    name: 'DITO Level-Up 99',
    network: 'DITO',
    category: 'combo',
    description: '7 GB all-access high-speed data + Unli DITO-to-DITO calls + 300 mins all-net calls + Unli all-net texts. Valid for 30 days.',
    faceValue: 99,
    sellingPrice: 104,
    providerCost: 95.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'DITO-LVLUP99',
    fulfillmentMode: 'auto',
    validity: '30 Days'
  },
  {
    name: 'DITO Level-Up 199',
    network: 'DITO',
    category: 'combo',
    description: '16 GB all-access high-speed data + Unli DITO-to-DITO calls + 300 mins all-net calls + Unli all-net texts. Valid for 30 days.',
    faceValue: 199,
    sellingPrice: 205,
    providerCost: 191.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'DITO-LVLUP199',
    fulfillmentMode: 'auto',
    validity: '30 Days'
  },
  {
    name: 'DITO Regular ₱100',
    network: 'DITO',
    category: 'regular',
    description: 'Standard ₱100 DITO Telecommunity prepaid credits.',
    faceValue: 100,
    sellingPrice: 104,
    providerCost: 96.0,
    isActive: true,
    providerId: 'telco-direct',
    providerProductId: 'DITO-REG-100',
    fulfillmentMode: 'auto',
    validity: '365 Days'
  }
];

export async function fetchProducts(): Promise<Product[]> {
  try {
    const productsCol = collection(db, 'products');
    const snapshot = await getDocs(productsCol);
    if (snapshot.empty) {
      return [];
    }
    const products: Product[] = [];
    snapshot.forEach(docSnap => {
      products.push({ id: docSnap.id, ...docSnap.data() } as Product);
    });
    return products;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'products');
  }
}

export async function fetchProductById(productId: string): Promise<Product | null> {
  // Check in-memory local ID first if applicable
  if (productId.startsWith('local-')) {
    const idx = parseInt(productId.replace('local-', ''), 10);
    if (!isNaN(idx) && INITIAL_PRODUCTS[idx]) {
      return {
        id: productId,
        ...INITIAL_PRODUCTS[idx],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  try {
    const docRef = doc(db, 'products', productId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Product;
    }
  } catch (error) {
    console.warn('Could not query Firestore for product, using fallback:', error);
  }

  // Fallback to match by slug or name in INITIAL_PRODUCTS
  const match = INITIAL_PRODUCTS.find(p => {
    const slug = `${p.network.toLowerCase()}-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    return slug === productId || p.name.toLowerCase() === productId.toLowerCase();
  });

  if (match) {
    return {
      id: productId,
      ...match,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return null;
}

export async function seedProductsIfEmpty(): Promise<Product[]> {
  try {
    const existing = await fetchProducts();
    if (existing.length > 0) return existing;

    const seeded: Product[] = [];
    const now = new Date().toISOString();

    for (const item of INITIAL_PRODUCTS) {
      const prodId = `${item.network.toLowerCase()}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const prodDoc: Product = {
        id: prodId,
        ...item,
        createdAt: now,
        updatedAt: now
      };
      await setDoc(doc(db, 'products', prodId), prodDoc);
      seeded.push(prodDoc);
    }

    return seeded;
  } catch (error) {
    console.error('Error seeding initial products:', error);
    // If permission denied because unauthenticated or rules lock, return in-memory initial catalog
    return INITIAL_PRODUCTS.map((p, idx) => ({
      id: `local-${idx}`,
      ...p,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }
}

export async function saveProduct(product: Partial<Product> & { id?: string }): Promise<void> {
  try {
    const now = new Date().toISOString();
    if (product.id) {
      const docRef = doc(db, 'products', product.id);
      await updateDoc(docRef, {
        ...product,
        updatedAt: now
      });
    } else {
      const newId = `${(product.network || 'other').toLowerCase()}-${Date.now()}`;
      const docRef = doc(db, 'products', newId);
      await setDoc(docRef, {
        ...product,
        id: newId,
        isActive: product.isActive ?? true,
        createdAt: now,
        updatedAt: now
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products');
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}
