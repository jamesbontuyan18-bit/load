import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingBag, 
  HelpCircle, 
  Settings as SettingsIcon, 
  FileText, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RotateCw, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Search, 
  Save, 
  Loader2, 
  Check, 
  X,
  CreditCard,
  PhoneCall,
  UserCheck,
  Zap,
  AlertCircle
} from 'lucide-react';
import { 
  Order, 
  Product, 
  FinancialLedgerEntry, 
  SupportRequest, 
  SystemSettings, 
  AdminAuditLog, 
  TelcoNetwork, 
  ProductCategory, 
  formatPHP, 
  fromCentavos 
} from '../types';
import { useAuth } from '../context/AuthContext';
import { getAllOrders } from '../services/orderService';
import { fetchProducts, saveProduct, deleteProduct, seedProductsIfEmpty } from '../services/catalogService';
import { fetchLedgerEntries, fetchAuditLogs } from '../services/ledgerService';
import { getAllSupportTickets, updateSupportTicketStatus } from '../services/supportService';
import { fetchSystemSettings, saveSystemSettings } from '../services/settingsService';
import { adminApproveManualPayment, adminRejectManualPayment, adminProcessRefund } from '../services/paymentService';
import { executeLoadFulfillment } from '../services/providerService';
import { triggerPriceDropNotifications, fetchAllPriceDropAlerts } from '../services/alertService';

export const AdminDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'metrics' | 'orders' | 'products' | 'ledger' | 'support' | 'settings'>('metrics');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<FinancialLedgerEntry[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderNetworkFilter, setOrderNetworkFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Selected Order for detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Product edit modal state
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Support ticket response state
  const [selectedTicket, setSelectedTicket] = useState<SupportRequest | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [o, p, l, s, setts, logs] = await Promise.all([
        getAllOrders(),
        fetchProducts(),
        fetchLedgerEntries(),
        getAllSupportTickets(),
        fetchSystemSettings(),
        fetchAuditLogs()
      ]);
      setOrders(o);
      setProducts(p);
      setLedgerEntries(l);
      setSupportTickets(s);
      setSettings(setts);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter orders by date
  const filteredOrdersByDate = orders.filter(o => {
    if (dateFilter === 'all') return true;
    const orderDate = new Date(o.createdAt).getTime();
    const now = Date.now();
    if (dateFilter === 'today') return now - orderDate <= 24 * 3600 * 1000;
    if (dateFilter === '7days') return now - orderDate <= 7 * 24 * 3600 * 1000;
    if (dateFilter === '30days') return now - orderDate <= 30 * 24 * 3600 * 1000;
    return true;
  });

  // Financial Metrics calculations (precision safe)
  const paidOrders = filteredOrdersByDate.filter(o => o.paymentStatus === 'paid');
  const grossSales = paidOrders.reduce((sum, o) => sum + o.sellingPrice, 0);
  const gatewayFees = paidOrders.reduce((sum, o) => sum + (o.gatewayFee || 0), 0);
  
  // Realized provider cost for successfully fulfilled orders
  const fulfilledOrders = paidOrders.filter(o => o.fulfillmentStatus === 'successful');
  const realizedProviderCosts = fulfilledOrders.reduce((sum, o) => sum + o.providerCost, 0);

  // Refunded orders
  const refundedOrders = filteredOrdersByDate.filter(o => o.paymentStatus === 'refunded');
  const refundTotals = refundedOrders.reduce((sum, o) => sum + o.sellingPrice, 0);

  // Expected margin vs Realized net profit
  const expectedGrossMargin = grossSales - paidOrders.reduce((sum, o) => sum + o.providerCost, 0) - gatewayFees;
  const realizedNetProfit = grossSales - realizedProviderCosts - gatewayFees - refundTotals;

  // Counts
  const totalOrdersCount = filteredOrdersByDate.length;
  const successfulCount = fulfilledOrders.length;
  const pendingPaymentsCount = filteredOrdersByDate.filter(o => o.paymentStatus === 'pending').length;
  const awaitingFulfillmentCount = filteredOrdersByDate.filter(o => o.paymentStatus === 'paid' && o.fulfillmentStatus !== 'successful').length;
  const reviewRequiredCount = filteredOrdersByDate.filter(o => o.paymentStatus === 'review_required').length;
  const failedOrdersCount = filteredOrdersByDate.filter(o => o.paymentStatus === 'failed' || o.fulfillmentStatus === 'failed').length;

  // Export orders to CSV
  const exportToCSV = () => {
    const headers = ['Order Reference', 'Date', 'Customer', 'Network', 'Promo', 'Recipient', 'Selling Price', 'Cost', 'Gateway', 'Payment Status', 'Fulfillment Status', 'Provider Ref'];
    const rows = filteredOrdersByDate.map(o => [
      o.orderReference,
      new Date(o.createdAt).toLocaleString(),
      o.customerName,
      o.networkSnapshot,
      `"${o.productNameSnapshot}"`,
      o.recipientNumber,
      o.sellingPrice,
      o.providerCost,
      o.paymentGateway,
      o.paymentStatus,
      o.fulfillmentStatus,
      o.providerReference || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `james_load_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Order Actions
  const handleApprovePayment = async (order: Order) => {
    if (!currentUser) return;
    setActionInProgress(true);
    try {
      await adminApproveManualPayment(order.id, currentUser.uid, currentUser.email || 'admin');
      await loadAllData();
      setSelectedOrder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving payment');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectPayment = async (order: Order) => {
    if (!currentUser) return;
    const reason = prompt('Please enter reason for rejection:', 'Unverified transaction reference');
    if (!reason) return;

    setActionInProgress(true);
    try {
      await adminRejectManualPayment(order.id, currentUser.uid, currentUser.email || 'admin', reason);
      await loadAllData();
      setSelectedOrder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting payment');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRetryFulfillment = async (order: Order) => {
    if (!currentUser) return;
    setActionInProgress(true);
    try {
      const res = await executeLoadFulfillment(order.id, true, currentUser.uid);
      if (res.success) {
        alert(`Load fulfilled! Carrier Ref: ${res.providerReference}`);
      } else {
        alert(`Fulfillment failed: ${res.errorMessage}`);
      }
      await loadAllData();
      setSelectedOrder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error during retry');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRefund = async (order: Order) => {
    if (!currentUser) return;
    const reason = prompt('Please enter refund reason:', 'Customer requested cancellation or provider error');
    if (!reason) return;

    setActionInProgress(true);
    try {
      await adminProcessRefund(order.id, currentUser.uid, currentUser.email || 'admin', reason);
      await loadAllData();
      setSelectedOrder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error processing refund');
    } finally {
      setActionInProgress(false);
    }
  };

  // Save product changes
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setActionInProgress(true);
    try {
      const existingProduct = products.find(p => p.id === editingProduct.id);
      const isPriceDrop = existingProduct && 
        editingProduct.sellingPrice !== undefined && 
        Number(editingProduct.sellingPrice) < existingProduct.sellingPrice;

      await saveProduct(editingProduct);

      let alertMessage = 'Product saved successfully!';
      if (isPriceDrop && existingProduct) {
        const notifiedCount = await triggerPriceDropNotifications(
          existingProduct.id,
          existingProduct.name,
          existingProduct.sellingPrice,
          Number(editingProduct.sellingPrice),
          currentUser?.email || 'admin'
        );
        if (notifiedCount > 0) {
          alertMessage += ` Email alerts dispatched to ${notifiedCount} subscriber(s)!`;
        }
      }

      setEditingProduct(null);
      await loadAllData();
      alert(alertMessage);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving product');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      // Safe check for sandboxed iframe
      const shouldDelete = typeof window !== 'undefined' && window.confirm ? window.confirm('Are you sure you want to delete this product?') : true;
      if (!shouldDelete) return;
    } catch (e) {
      // If confirm throws in iframe, proceed
    }
    setActionInProgress(true);
    try {
      await deleteProduct(id);
      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting product');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleResetCatalog = async () => {
    if (!confirm('Seed standard Philippine promo packages? This will add any missing default promos.')) return;
    setActionInProgress(true);
    try {
      await seedProductsIfEmpty();
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReplyTicket = async (status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    if (!selectedTicket) return;
    setActionInProgress(true);
    try {
      await updateSupportTicketStatus(selectedTicket.id, status, ticketReply);
      setSelectedTicket(null);
      setTicketReply('');
      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating ticket');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setActionInProgress(true);
    try {
      await saveSystemSettings(settings);
      alert('Settings updated successfully!');
      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating settings');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      
      {/* Top Admin Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs mb-2">
            <ShieldCheck className="w-4 h-4" />
            ADMINISTRATOR CONSOLE
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">James Load Services Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Logged in as <span className="font-mono text-amber-400">{currentUser?.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={exportToCSV}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        {[
          { id: 'metrics', label: 'Financial Metrics', icon: TrendingUp },
          { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag, badge: reviewRequiredCount > 0 ? reviewRequiredCount : null },
          { id: 'products', label: `Products (${products.length})`, icon: Package },
          { id: 'ledger', label: `Financial Ledger (${ledgerEntries.length})`, icon: FileText },
          { id: 'support', label: `Support Tickets (${supportTickets.length})`, icon: HelpCircle },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL METRICS & DASHBOARD */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Date Filter */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Accounting & Operational Overview
            </h2>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              {(['all', 'today', '7days', '30days'] as const).map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                    dateFilter === df ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {df === 'all' ? 'All Time' : df === '7days' ? 'Last 7 Days' : df === '30days' ? 'Last 30 Days' : 'Today'}
                </button>
              ))}
            </div>
          </div>

          {/* Key Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Realized Net Profit */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
              <span className="text-[11px] font-semibold text-emerald-100 block">Realized Net Profit</span>
              <div className="text-2xl sm:text-3xl font-black mt-1">
                {formatPHP(realizedNetProfit)}
              </div>
              <p className="text-[11px] text-emerald-100 mt-2">
                Authoritative gross sales minus wholesale costs & fees
              </p>
            </div>

            {/* Gross Verified Sales */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gross Sales</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {formatPHP(grossSales)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                From {paidOrders.length} verified paid transactions
              </p>
            </div>

            {/* Provider Costs */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Wholesale Provider Costs</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {formatPHP(realizedProviderCosts)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Paid to carrier e-load aggregators
              </p>
            </div>

            {/* Expected Margin */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Expected Gross Margin</span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {formatPHP(expectedGrossMargin)}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Expected margin on all verified payments
              </p>
            </div>

          </div>

          {/* Operational Status Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 block font-bold">Total Orders</span>
              <span className="text-xl font-black text-slate-900">{totalOrdersCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[11px] text-emerald-800 block font-bold">Delivered (Success)</span>
              <span className="text-xl font-black text-emerald-900">{successfulCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[11px] text-amber-800 block font-bold">Manual Review</span>
              <span className="text-xl font-black text-amber-900">{reviewRequiredCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center">
              <span className="text-[11px] text-blue-800 block font-bold">Awaiting Delivery</span>
              <span className="text-xl font-black text-blue-900">{awaitingFulfillmentCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 block font-bold">Pending Payment</span>
              <span className="text-xl font-black text-slate-700">{pendingPaymentsCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[11px] text-rose-800 block font-bold">Failed / Cancelled</span>
              <span className="text-xl font-black text-rose-900">{failedOrdersCount}</span>
            </div>
          </div>

          {/* Network Carrier Sales Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
              Network Distribution & Sales
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {(['Globe', 'TM', 'Smart', 'TNT', 'DITO'] as TelcoNetwork[]).map(net => {
                const netOrders = paidOrders.filter(o => o.networkSnapshot === net);
                const netSales = netOrders.reduce((sum, o) => sum + o.sellingPrice, 0);
                return (
                  <div key={net} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="font-extrabold text-xs text-slate-800 block">{net}</span>
                    <span className="font-black text-lg text-slate-900 block mt-1">{formatPHP(netSales)}</span>
                    <span className="text-[10px] text-slate-500">{netOrders.length} orders</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDER MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Actionable Banner for Orders Needing Admin Review */}
          {reviewRequiredCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-400 text-slate-950 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-amber-500">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-slate-950 shrink-0" />
                <div>
                  <span className="font-black text-sm block">
                    {reviewRequiredCount} Order(s) Awaiting Admin Verification & Dispatch!
                  </span>
                  <span className="text-xs text-slate-900 font-medium">
                    Customer submitted payment proof. Verify reference and click "Approve & Dispatch" to release load.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderStatusFilter('review_required')}
                className="px-3.5 py-2 rounded-xl bg-slate-950 text-amber-300 hover:bg-slate-900 text-xs font-black shadow-xs whitespace-nowrap cursor-pointer transition-colors"
              >
                Filter Review Queue ({reviewRequiredCount})
              </button>
            </div>
          )}

          {/* Order Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order ref or phone..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <select
                value={orderNetworkFilter}
                onChange={(e) => setOrderNetworkFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
              >
                <option value="ALL">All Networks</option>
                <option value="Globe">Globe</option>
                <option value="TM">TM</option>
                <option value="Smart">Smart</option>
                <option value="TNT">TNT</option>
                <option value="DITO">DITO</option>
              </select>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="review_required">Manual Review</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Showing {filteredOrdersByDate.length} orders
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Order Ref</th>
                    <th className="py-3.5 px-4">Recipient</th>
                    <th className="py-3.5 px-4">Network & Promo</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Gateway</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4">Delivery</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrdersByDate
                    .filter(o => {
                      const matchNet = orderNetworkFilter === 'ALL' || o.networkSnapshot === orderNetworkFilter;
                      const matchSt = orderStatusFilter === 'ALL' || o.paymentStatus === orderStatusFilter;
                      const matchSearch = 
                        o.orderReference.toLowerCase().includes(orderSearch.toLowerCase()) ||
                        o.recipientNumber.includes(orderSearch) ||
                        o.productNameSnapshot.toLowerCase().includes(orderSearch.toLowerCase());
                      return matchNet && matchSt && matchSearch;
                    })
                    .map(order => (
                      <tr 
                        key={order.id} 
                        className={`transition-colors ${
                          order.paymentStatus === 'review_required' 
                            ? 'bg-amber-50/70 hover:bg-amber-100/60' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                          {order.orderReference}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {order.recipientNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">{order.productNameSnapshot}</span>
                          <span className="text-[10px] text-slate-400">{order.networkSnapshot}</span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatPHP(order.sellingPrice + order.gatewayFee)}
                        </td>
                        <td className="py-3.5 px-4 uppercase font-bold text-slate-600">
                          {order.paymentGateway}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.paymentStatus === 'review_required'
                              ? 'bg-amber-200 text-amber-900 font-black animate-pulse'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {order.paymentStatus === 'review_required' ? 'Review Required' : order.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            order.fulfillmentStatus === 'successful'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.fulfillmentStatus === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {order.fulfillmentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                              order.paymentStatus === 'review_required'
                                ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs'
                                : 'bg-slate-100 hover:bg-amber-400 hover:text-slate-950 text-slate-700'
                            }`}
                          >
                            {order.paymentStatus === 'review_required' ? 'Review & Dispatch' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT CATALOG MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Prepaid Load & Promo Packages
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetCatalog}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Seed Default Telco Promos
              </button>
              <button
                onClick={() => setEditingProduct({
                  name: '',
                  network: 'Globe',
                  category: 'data',
                  description: '',
                  faceValue: 50,
                  sellingPrice: 53,
                  providerCost: 48.5,
                  isActive: true,
                  providerId: 'telco-direct',
                  fulfillmentMode: 'auto',
                  validity: '3 Days'
                })}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(prod => {
              const margin = prod.sellingPrice - prod.providerCost;
              const marginPercent = ((margin / prod.sellingPrice) * 100).toFixed(1);

              return (
                <div key={prod.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-100 text-slate-800">
                        {prod.network}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prod.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {prod.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-base">{prod.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{prod.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Selling</span>
                        <span className="font-bold text-slate-900">{formatPHP(prod.sellingPrice)}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Cost</span>
                        <span className="font-bold text-slate-600">{formatPHP(prod.providerCost)}</span>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-800">
                        <span className="text-[10px] text-emerald-600 block">Margin</span>
                        <span className="font-black">+{formatPHP(margin)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingProduct(prod)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                        title="Edit Product"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Immutable Financial Event Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Auditable event-sourced records for sales, provider costs, gateway fees, and refunds.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Entry Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Source Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledgerEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          entry.entryType === 'GROSS_SALE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : entry.entryType === 'PROVIDER_COST'
                            ? 'bg-amber-100 text-amber-800'
                            : entry.entryType === 'REFUND'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black">
                        {entry.entryType === 'GROSS_SALE' ? '+' : '-'}
                        {formatPHP(fromCentavos(entry.amountInCentavos))}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-bold">
                        {entry.orderReference || '-'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {entry.sourceReference || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Customer Inquiries & Support Tickets
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportTickets.map(ticket => (
              <div key={ticket.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{ticket.subject}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {ticket.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ticket.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Customer: {ticket.customerEmail}</span>
                  {ticket.orderReference && <span className="font-mono">Ref: {ticket.orderReference}</span>}
                </div>

                {ticket.adminNotes && (
                  <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="font-bold block text-[10px] uppercase">Admin Reply:</span>
                    {ticket.adminNotes}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => { setSelectedTicket(ticket); setTicketReply(ticket.adminNotes || ''); }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 font-bold text-xs text-slate-950"
                  >
                    Respond & Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SYSTEM SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-2xl">
          <h2 className="text-base font-extrabold text-slate-900 mb-4">
            Reseller Configuration & Payment Details
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Support Phone</label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-4">
              <span className="font-extrabold text-amber-950 block">Manual Payment Receiver Accounts</span>
              
              {/* GCash Details */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider block">GCash Account Details</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">GCash Account Name</label>
                    <input
                      type="text"
                      value={settings.manualPaymentGcashName || 'JAMES HOPE BONTUYAN'}
                      onChange={(e) => setSettings({ ...settings, manualPaymentGcashName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">GCash Number</label>
                    <input
                      type="text"
                      value={settings.manualPaymentGcashNumber || '09355883709'}
                      onChange={(e) => setSettings({ ...settings, manualPaymentGcashNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Maya Details */}
              <div className="space-y-1.5 pt-2 border-t border-amber-200/80">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">Maya Account Details</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Maya Account Name</label>
                    <input
                      type="text"
                      value={settings.manualPaymentMayaName || 'JAMES HOPE BONTUYAN'}
                      onChange={(e) => setSettings({ ...settings, manualPaymentMayaName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Maya Number</label>
                    <input
                      type="text"
                      value={settings.manualPaymentMayaNumber || '09355883709'}
                      onChange={(e) => setSettings({ ...settings, manualPaymentMayaNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer Announcement Banner</label>
              <textarea
                rows={2}
                value={settings.announcement}
                onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-900">
                  Production Mode: LIVE (Automated Telco Fulfillment & Real Instant Settlement)
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2.5 py-0.5 rounded-full">
                ONLINE
              </span>
            </div>

            <button
              type="submit"
              disabled={actionInProgress}
              className="py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-xs"
            >
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* ORDER ACTION MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Order Management</span>
                <h3 className="font-black text-lg font-mono">{selectedOrder.orderReference}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{selectedOrder.customerName} ({selectedOrder.customerEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient Phone:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedOrder.recipientNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Promo Package:</span>
                  <span className="font-bold text-slate-900">{selectedOrder.productNameSnapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selling Price:</span>
                  <span className="font-bold text-slate-900">{formatPHP(selectedOrder.sellingPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Wholesale Cost:</span>
                  <span className="font-bold text-slate-600">{formatPHP(selectedOrder.providerCost)}</span>
                </div>
              </div>

              {(selectedOrder.paymentReference || selectedOrder.manualPaymentRef) && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-800">
                      Payment Verification ({selectedOrder.paymentGateway.toUpperCase()})
                    </span>
                    <span className="text-[10px] font-black uppercase bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-900">
                      Pending Admin Review
                    </span>
                  </div>
                  <p className="font-mono font-black text-sm text-slate-900 mt-0.5">
                    Ref: {selectedOrder.paymentReference || selectedOrder.manualPaymentRef}
                  </p>
                  {selectedOrder.notes && (
                    <p className="text-[11px] mt-1 text-slate-700 bg-white/70 p-2 rounded-lg border border-amber-200/50">
                      {selectedOrder.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedOrder.paymentStatus === 'review_required' && (
                  <div className="space-y-2">
                    <button
                      disabled={actionInProgress}
                      onClick={() => handleApprovePayment(selectedOrder)}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-[0.99]"
                    >
                      {actionInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Approving & Dispatching Load...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>Approve Payment & Dispatch Load Now ⚡</span>
                        </>
                      )}
                    </button>
                    <button
                      disabled={actionInProgress}
                      onClick={() => handleRejectPayment(selectedOrder)}
                      className="w-full py-2.5 px-3 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Payment (Invalid / Unverified)</span>
                    </button>
                  </div>
                )}

                {selectedOrder.paymentStatus === 'paid' && selectedOrder.fulfillmentStatus !== 'successful' && (
                  <button
                    disabled={actionInProgress}
                    onClick={() => handleRetryFulfillment(selectedOrder)}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCw className="w-4 h-4" />
                    Retry Load Fulfillment
                  </button>
                )}

                {selectedOrder.paymentStatus === 'paid' && (
                  <button
                    disabled={actionInProgress}
                    onClick={() => handleRefund(selectedOrder)}
                    className="w-full py-2 px-3 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs"
                  >
                    Process Refund & Reverse Ledger
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-gradient-to-r from-amber-400 to-yellow-400 p-5 text-slate-950 flex items-center justify-between">
              <h3 className="font-black text-base">
                {editingProduct.id ? 'Edit Product Package' : 'Create New Load Product'}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 rounded hover:bg-black/10">
                <X className="w-5 h-5 text-slate-950" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Network</label>
                  <select
                    value={editingProduct.network}
                    onChange={(e) => setEditingProduct({ ...editingProduct, network: e.target.value as TelcoNetwork })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Globe">Globe</option>
                    <option value="TM">TM</option>
                    <option value="Smart">Smart</option>
                    <option value="TNT">TNT</option>
                    <option value="DITO">DITO</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="regular">Regular Load</option>
                    <option value="data">Data Package</option>
                    <option value="combo">Combo Promo</option>
                    <option value="call_text">Call & Text</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product / Promo Name</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="e.g. Go50 or GIGA Power 149"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Face Value (₱)</label>
                  <input
                    type="number"
                    value={editingProduct.faceValue}
                    onChange={(e) => setEditingProduct({ ...editingProduct, faceValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Selling Price (₱)</label>
                  <input
                    type="number"
                    value={editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wholesale Cost (₱)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.providerCost}
                    onChange={(e) => setEditingProduct({ ...editingProduct, providerCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Validity (e.g. 3 Days, 7 Days)</label>
                <input
                  type="text"
                  value={editingProduct.validity || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, validity: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={editingProduct.isActive ?? true}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <label htmlFor="isActiveCheck" className="font-bold text-slate-800">
                  Active & Available for Sale
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET RESPONSE MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <h3 className="font-black text-base">Respond to Ticket</h3>
              <button onClick={() => setSelectedTicket(null)} className="p-1 rounded hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block">{selectedTicket.subject}</span>
                <p className="text-slate-600 mt-1">{selectedTicket.description}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Response Note</label>
                <textarea
                  rows={3}
                  value={ticketReply}
                  onChange={(e) => setTicketReply(e.target.value)}
                  placeholder="Explain resolution or carrier status to customer..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleReplyTicket('resolved')}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black"
                >
                  Resolve Ticket
                </button>
                <button
                  onClick={() => handleReplyTicket('in_progress')}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black"
                >
                  Mark In Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
