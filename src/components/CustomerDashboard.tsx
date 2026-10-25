import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  Search, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  TrendingUp, 
  ShoppingBag,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Order, formatPHP } from '../types';
import { useAuth } from '../context/AuthContext';
import { getUserOrders, getGuestOrders } from '../services/orderService';

interface CustomerDashboardProps {
  onSelectOrder: (order: Order) => void;
  onGoToBuy: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  onSelectOrder,
  onGoToBuy
}) => {
  const { currentUser, userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (currentUser) {
          const list = await getUserOrders(currentUser.uid);
          setOrders(list);
        } else {
          const guestList = await getGuestOrders();
          setOrders(guestList);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUser]);

  // Derived verified spending: only orders that are paid
  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const totalVerifiedSpent = paidOrders.reduce((sum, o) => sum + o.sellingPrice + o.gatewayFee, 0);
  const deliveredCount = orders.filter(o => o.fulfillmentStatus === 'successful').length;

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filterStatus === 'ALL' || o.paymentStatus === filterStatus;
    const matchesSearch = 
      o.orderReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productNameSnapshot.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.recipientNumber.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* Customer Header & Stats */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold mb-3 border border-amber-400/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {currentUser ? 'Verified Customer Account' : 'Guest Purchase History (Browser Session)'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              Welcome, {userProfile?.displayName || currentUser?.displayName || 'Guest Customer'}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {currentUser?.email || 'Track your load orders placed from this browser'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-[11px] font-medium text-slate-300 block">Total Verified Spent</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">{formatPHP(totalVerifiedSpent)}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-[11px] font-medium text-slate-300 block">Load Disbursed</span>
              <span className="text-xl sm:text-2xl font-black text-white">{deliveredCount} Promos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Status filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['ALL', 'paid', 'review_required', 'pending', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Orders' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ref or phone number..."
            className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading your purchase records...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                    {order.orderReference}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    order.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.paymentStatus === 'review_required'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>

                <h3 className="font-extrabold text-slate-900 text-base">{order.productNameSnapshot}</h3>
                <p className="text-xs text-slate-500">{order.networkSnapshot} • Recipient: {order.recipientNumber}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Amount Paid</span>
                  <span className="font-black text-lg text-slate-900">
                    {formatPHP(order.sellingPrice + order.gatewayFee)}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800">
                  <span>Track Receipt</span>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-extrabold text-slate-800 text-base">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            You have not placed any orders yet or no orders match the selected filter.
          </p>
          <button
            onClick={onGoToBuy}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 font-bold text-xs text-slate-950"
          >
            Buy Prepaid Load Now
          </button>
        </div>
      )}

    </div>
  );
};
