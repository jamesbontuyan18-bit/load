import React, { useEffect, useState } from 'react';
import { 
  HelpCircle, 
  Send, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle, 
  Loader2,
  ChevronRight
} from 'lucide-react';
import { SupportRequest, SupportCategory, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { createSupportTicket, getUserSupportTickets } from '../services/supportService';
import { getUserOrders } from '../services/orderService';

interface SupportViewProps {
  initialOrder?: Order | null;
  onOpenAuth: () => void;
}

export const SupportView: React.FC<SupportViewProps> = ({
  initialOrder,
  onOpenAuth
}) => {
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrder?.id || '');
  const [category, setCategory] = useState<SupportCategory>('load_delay');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const [myTickets, myOrders] = await Promise.all([
          getUserSupportTickets(currentUser.uid),
          getUserOrders(currentUser.uid)
        ]);
        setTickets(myTickets);
        setUserOrders(myOrders);
      } catch (err) {
        console.error('Error fetching support data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (!subject.trim() || !description.trim()) {
      alert('Please fill out the subject and description.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    const relatedOrder = userOrders.find(o => o.id === selectedOrderId);

    try {
      const ticket = await createSupportTicket({
        userId: currentUser.uid,
        customerEmail: currentUser.email || 'customer@jamesloadservices.ph',
        orderId: relatedOrder?.id,
        orderReference: relatedOrder?.orderReference,
        category,
        subject: subject.trim(),
        description: description.trim()
      });

      setTickets([ticket, ...tickets]);
      setSuccessMessage('Your support ticket has been submitted! Our support team will review it shortly.');
      setSubject('');
      setDescription('');
    } catch (err) {
      console.error('Error submitting support ticket:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">Resolved</span>;
      case 'in_progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">In Review</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">Open Ticket</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Customer Support Center</h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Need assistance with your load disbursement or payment? Submit a ticket below or view your ongoing requests.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Ticket Submission Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
          <h2 className="font-extrabold text-base text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            Submit an Inquiry / Issue
          </h2>

          {successMessage && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {!currentUser ? (
            <div className="text-center py-8">
              <p className="text-xs text-slate-500 mb-3">Please log in to submit and track support inquiries.</p>
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-amber-400 font-bold text-xs text-slate-950"
              >
                Log In / Register
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Category */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="load_delay">E-Load Delay / Not Received</option>
                  <option value="payment_issue">Payment Deducted but Status Pending</option>
                  <option value="wrong_number">Incorrect Recipient Mobile Number</option>
                  <option value="cancellation">Request Order Cancellation / Refund</option>
                  <option value="other">General Question / Feedback</option>
                </select>
              </div>

              {/* Order selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Order (Optional)</label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                >
                  <option value="">No specific order</option>
                  {userOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderReference} - {o.productNameSnapshot} (₱{o.sellingPrice})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Load not received after 10 mins"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Details & Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide any relevant details, GCash reference number, or transaction notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 font-black text-xs text-slate-950 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Ticket</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Existing Tickets List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
          <h2 className="font-extrabold text-base text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Your Support Inquiries
          </h2>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading tickets...</p>
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{ticket.subject}</span>
                    {getStatusBadge(ticket.status)}
                  </div>

                  <p className="text-slate-600 line-clamp-2">{ticket.description}</p>

                  {ticket.orderReference && (
                    <span className="inline-block font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Ref: {ticket.orderReference}
                    </span>
                  )}

                  {ticket.adminNotes && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 mt-2">
                      <span className="font-bold block text-[10px] text-amber-800 uppercase tracking-wider">
                        Response from Support:
                      </span>
                      <p className="text-[11px] mt-0.5">{ticket.adminNotes}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 pt-1">
                    Created on {new Date(ticket.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No support inquiries submitted yet.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
