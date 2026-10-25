import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Smartphone, 
  ShieldCheck, 
  Clock, 
  Search, 
  CheckCircle2, 
  PhoneCall, 
  Mail, 
  ArrowRight, 
  Wifi, 
  CreditCard,
  Headphones,
  Lock,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { NetworkSelector } from './components/NetworkSelector';
import { ProductCard } from './components/ProductCard';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingView } from './components/OrderTrackingView';
import { CustomerDashboard } from './components/CustomerDashboard';
import { SupportView } from './components/SupportView';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { TrackOrderModal } from './components/TrackOrderModal';
import { PriceDropModal } from './components/PriceDropModal';
import { 
  Product, 
  Order, 
  TelcoNetwork, 
  ProductCategory, 
  SystemSettings, 
  detectCarrier, 
  isValidPHPhone 
} from './types';
import { fetchProducts, seedProductsIfEmpty } from './services/catalogService';
import { fetchSystemSettings } from './services/settingsService';

function MainApp() {
  const { currentUser, isAdmin } = useAuth();

  // Navigation states
  const [currentTab, setCurrentTab] = useState<'buy' | 'history' | 'tracking' | 'support' | 'admin'>('buy');
  
  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Filters
  const [selectedNetwork, setSelectedNetwork] = useState<TelcoNetwork | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick recipient number input on Hero
  const [heroPhone, setHeroPhone] = useState('');
  const [detectedHeroCarrier, setDetectedHeroCarrier] = useState<TelcoNetwork | null>(null);

  // Modals & Selected items
  const [activeCheckoutProduct, setActiveCheckoutProduct] = useState<Product | null>(null);
  const [activePriceDropProduct, setActivePriceDropProduct] = useState<Product | null>(null);
  const [priceAlertRefresh, setPriceAlertRefresh] = useState(0);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(null);
  const [supportInitialOrder, setSupportInitialOrder] = useState<Order | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  // Load products & settings on boot
  useEffect(() => {
    const initData = async () => {
      setIsLoadingProducts(true);
      try {
        const [loadedProducts, loadedSettings] = await Promise.all([
          seedProductsIfEmpty(),
          fetchSystemSettings()
        ]);
        setProducts(loadedProducts);
        setSettings(loadedSettings);
      } catch (err) {
        console.error('Error loading initial app data:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    initData();
  }, []);

  // Handle hero phone typing with auto-carrier switch
  const handleHeroPhoneChange = (val: string) => {
    setHeroPhone(val);
    const carrier = detectCarrier(val);
    setDetectedHeroCarrier(carrier);
    if (carrier) {
      setSelectedNetwork(carrier);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesNetwork = selectedNetwork === 'ALL' || p.network === selectedNetwork;
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.network.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNetwork && matchesCategory && matchesSearch;
  });

  const handleOrderCompleted = (order: Order) => {
    setActiveCheckoutProduct(null);
    setActiveTrackingOrder(order);
    setCurrentTab('tracking');
  };

  const handleOpenSupportForOrder = (order: Order) => {
    setSupportInitialOrder(order);
    setCurrentTab('support');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-amber-400 selection:text-slate-950 pb-20 md:pb-8">
      
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab as any)}
        settings={settings}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenTrackModal={() => setIsTrackModalOpen(true)}
      />

      {/* MAIN VIEW CONTENT */}
      <main className="grow">
        
        {/* VIEW 1: BUY LOAD (HOMEPAGE & CATALOG) */}
        {currentTab === 'buy' && (
          <div className="space-y-12">
            
            {/* HERO SECTION */}
            <section className="relative overflow-hidden bg-gradient-to-b from-amber-400/20 via-yellow-200/10 to-transparent pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-amber-200/40">
              <div className="max-w-5xl mx-auto text-center space-y-6">
                
                {/* Brand Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/30 text-amber-950 font-bold text-xs border border-amber-400/50 shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <span>Philippines' Trusted Prepaid Load & Promo Reseller</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-tight">
                  Instant Prepaid Load for <br className="hidden sm:inline" />
                  <span className="text-amber-500 drop-shadow-xs">Globe, TM, Smart, TNT & DITO</span>
                </h1>

                <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 font-medium">
                  Direct payment per order via GCash and Maya (Manual Verification). 
                  Pay directly to James Hope Bontuyan (Maya: 09355883709) and enter your reference number for quick admin review and load dispatch.
                </p>

                {/* Quick Number Input Card */}
                <div className="max-w-xl mx-auto bg-white rounded-3xl p-3 sm:p-4 shadow-xl border border-amber-200/80 flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Smartphone className="w-5 h-5 text-amber-500 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      value={heroPhone}
                      onChange={(e) => handleHeroPhoneChange(e.target.value)}
                      placeholder="Enter 11-digit mobile (e.g. 09171234567)"
                      maxLength={13}
                      className="w-full pl-11 pr-24 py-3 rounded-2xl text-sm font-semibold tracking-wide text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50/50"
                    />
                    {detectedHeroCarrier && (
                      <span className="absolute right-3 top-3 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                        {detectedHeroCarrier}
                      </span>
                    )}
                  </div>

                  <a
                    href="#catalog"
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm whitespace-nowrap shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Browse Promos</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Quick Perks */}
                <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-bold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>24/7 Automated Delivery</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Official Telco Packages</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Direct Payment Per Order</span>
                  </div>
                </div>

              </div>
            </section>

            {/* PRODUCT CATALOG SECTION */}
            <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-amber-600">
                    Prepaid Promos & Regular Load
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    Select Your Network & Package
                  </h2>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search promo or keyword..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Telco Network Filter Tabs */}
              <NetworkSelector
                selectedNetwork={selectedNetwork}
                onSelectNetwork={(net) => setSelectedNetwork(net)}
              />

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'ALL', label: 'All Packages' },
                  { id: 'data', label: 'Data Promos' },
                  { id: 'regular', label: 'Regular Load' },
                  { id: 'combo', label: 'Combo / All-In' },
                  { id: 'call_text', label: 'Call & Text' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-amber-100 text-amber-900 font-black border border-amber-300'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Products Grid */}
              {isLoadingProducts ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-medium">Loading Philippine telco packages...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {filteredProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={(p) => setActiveCheckoutProduct(p)}
                      onOpenPriceAlert={(p) => setActivePriceDropProduct(p)}
                      refreshTrigger={priceAlertRefresh}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
                  <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-extrabold text-slate-800 text-base">No Products Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    No promo matches your network or category filter. Try selecting "All Networks".
                  </p>
                  <button
                    onClick={() => { setSelectedNetwork('ALL'); setSelectedCategory('ALL'); setSearchQuery(''); }}
                    className="px-4 py-2 rounded-xl bg-amber-400 font-bold text-xs text-slate-950"
                  >
                    Reset Filters
                  </button>
                </div>
              )}

            </section>

            {/* HOW IT WORKS SECTION */}
            <section className="bg-white py-16 border-y border-slate-200">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="text-center max-w-xl mx-auto mb-12">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-amber-600">
                    Seamless Experience
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                    How Buying Load Works
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2">
                    Three simple steps to load any Philippine mobile number instantly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Step 1 */}
                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-xs">
                      1
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Pick Network & Number</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Choose from Globe, TM, Smart, TNT, or DITO. Enter your 11-digit mobile number with carrier auto-detection.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-xs">
                      2
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Direct Payment Per Order</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pay directly via GCash, Maya, Debit/Credit Card, or Manual Transfer. No need to maintain a prepaid deposit wallet.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-xs">
                      3
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Automated E-Load SMS</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The carrier instantly disburses your load or data package. Track transaction status and view your receipt in real-time.
                    </p>
                  </div>
                </div>

              </div>
            </section>

          </div>
        )}

        {/* VIEW 2: ORDER TRACKING RECEIPT */}
        {currentTab === 'tracking' && (
          <OrderTrackingView
            order={activeTrackingOrder}
            onBack={() => setCurrentTab('buy')}
            onOpenSupportForOrder={handleOpenSupportForOrder}
            onSelectOrder={(ord) => setActiveTrackingOrder(ord)}
          />
        )}

        {/* VIEW 3: CUSTOMER ORDERS HISTORY DASHBOARD */}
        {currentTab === 'history' && (
          <CustomerDashboard
            onSelectOrder={(ord) => {
              setActiveTrackingOrder(ord);
              setCurrentTab('tracking');
            }}
            onGoToBuy={() => setCurrentTab('buy')}
          />
        )}

        {/* VIEW 4: CUSTOMER SUPPORT CENTER */}
        {currentTab === 'support' && (
          <SupportView
            initialOrder={supportInitialOrder}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* VIEW 5: ADMINISTRATOR CONSOLE */}
        {currentTab === 'admin' && (
          <AdminDashboard />
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-10 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center">
                <Zap className="w-4 h-4 fill-slate-950" />
              </div>
              <span className="font-extrabold text-base text-white">
                James <span className="text-amber-400">Load</span> Services
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm">
              Independent authorized prepaid load reseller platform serving customers nationwide across the Philippines. 
              Direct payments per purchase, automated fulfillment, and transparent pricing.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Customer Support</h4>
            <ul className="space-y-1.5 text-slate-400 text-xs">
              <li className="flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>{settings?.supportPhone || '+63 917 888 9999'}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>{settings?.supportEmail || 'support@jamesloadservices.ph'}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{settings?.operatingHours || '6:00 AM - 11:00 PM Daily'}</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Manual Payments</h4>
            <div className="space-y-1.5 text-slate-400 text-xs">
              <p>• GCash (Manual Transfer / QR)</p>
              <p>• Maya (09355883709 - James Hope Bontuyan)</p>
              <p>• Admin Review & Quick E-Load Dispatch</p>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} James Load Services. All rights reserved.</p>
          <p>Philippine Telecom & E-Load Reseller Services.</p>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab as any)}
        onOpenTrackModal={() => setIsTrackModalOpen(true)}
      />

      {/* MODAL 1: CHECKOUT */}
      {activeCheckoutProduct && (
        <CheckoutModal
          product={activeCheckoutProduct}
          initialPhone={heroPhone}
          settings={settings}
          onClose={() => setActiveCheckoutProduct(null)}
          onOrderCompleted={handleOrderCompleted}
          onOpenAuth={() => setIsAuthOpen(true)}
        />
      )}

      {/* MODAL 2: AUTH */}
      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
        />
      )}

      {/* MODAL 3: TRACK ORDER QUICK LOOKUP */}
      {isTrackModalOpen && (
        <TrackOrderModal
          onClose={() => setIsTrackModalOpen(false)}
          onOrderFound={(ord) => {
            setActiveTrackingOrder(ord);
            setCurrentTab('tracking');
          }}
        />
      )}

      {/* MODAL 4: PRICE DROP NOTIFICATION */}
      {activePriceDropProduct && (
        <PriceDropModal
          product={activePriceDropProduct}
          onClose={() => setActivePriceDropProduct(null)}
          onAlertStatusChanged={() => setPriceAlertRefresh(prev => prev + 1)}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
