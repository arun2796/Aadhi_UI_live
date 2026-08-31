import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Users,
  FileText,
  Receipt,
  CreditCard,
  RotateCcw,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Truck,
  Box,
  Clock,
  Printer,
  Download,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Check,
  Send
} from 'lucide-react';
import { Order, Customer, Quote, Invoice, Payment, ReturnRequest, OrderStatus } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpSalesAndOrdersModuleProps {
  initialSubTab?: 'orders' | 'customers' | 'quotes' | 'invoices' | 'payments' | 'returns';
  initialSelectedOrderId?: string;
}

export const ErpSalesAndOrdersModule: React.FC<ErpSalesAndOrdersModuleProps> = ({
  initialSubTab = 'orders',
  initialSelectedOrderId
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'orders' | 'customers' | 'quotes' | 'invoices' | 'payments' | 'returns'>(initialSubTab);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Order for Detail / Verification Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');

  // Selected Invoice for Printable View Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ords, custs, qts, invs, pays, rets] = await Promise.all([
        api.getOrders(),
        api.getCustomers(),
        api.getQuotes(),
        api.getInvoices(),
        api.getPayments(),
        api.getReturns()
      ]);
      setOrders(ords);
      setCustomers(custs);
      setQuotes(qts);
      setInvoices(invs);
      setPayments(pays);
      setReturns(rets);
    } catch {
      showToast('Failed to load sales data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Order Status Transition
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus, `Updated via Admin ERP to ${newStatus}`);
      showToast(`Order status updated to ${newStatus}`, 'success');
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch {
      showToast('Status transition failed', 'error');
    }
  };

  // Handle Verify Payment & Move to Packing
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await api.verifyPayment(selectedOrder.id, {
        verifiedUtrNumber: utrInput || selectedOrder.utrNumber || 'MANUAL-CONFIRM',
        verificationNotes: verificationNotes || 'UPI payment confirmed by Admin',
        autoMoveToPacking: true
      });
      showToast('Payment verified & Order moved to Packing screen!', 'success');
      setIsVerifyingPayment(false);
      setSelectedOrder(updated);
      loadData();
    } catch {
      showToast('Payment verification failed', 'error');
    }
  };

  // Convert Quote to Order
  const handleConvertQuote = async (quoteId: string) => {
    try {
      const order = await api.convertQuoteToOrder(quoteId);
      showToast('Quote successfully converted to live Order!', 'success');
      loadData();
      setSubTab('orders');
    } catch {
      showToast('Quote conversion failed', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Sales & Order Fulfillment</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Process orders through packing and shipping, verify UPI payments, manage customer CRM, and issue invoices.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
          { id: 'customers', label: `Customers CRM (${customers.length})`, icon: Users },
          { id: 'quotes', label: `Wholesale Quotes (${quotes.length})`, icon: FileText },
          { id: 'invoices', label: `Tax Invoices (${invoices.length})`, icon: Receipt },
          { id: 'payments', label: `Payments (${payments.length})`, icon: CreditCard },
          { id: 'returns', label: `Returns (${returns.length})`, icon: RotateCcw }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. ORDERS MANAGEMENT TAB */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Order #, Customer, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-navy outline-none"
              >
                <option value="all">All Statuses ({orders.length})</option>
                <option value="Pending">Pending Payment / Approval</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Processing">Processing (Packing Screen)</option>
                <option value="Packed">Packed</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order ID & Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Payment Status</th>
                    <th className="py-3 px-3">Fulfillment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-purple text-xs">{o.orderNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(o.placedAtUtc).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy text-xs">{o.customerName}</div>
                        <div className="text-[10px] text-slate-400">{o.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-700">{o.items?.length || 1} Products</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-navy text-xs">₹{o.grandTotal.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{o.paymentMethod}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : o.paymentStatus === 'Refunded'
                              ? 'bg-purple/10 text-purple'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            o.orderStatus === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-700'
                              : o.orderStatus === 'Shipped'
                              ? 'bg-blue-100 text-blue-700'
                              : o.orderStatus === 'Processing'
                              ? 'bg-orange/10 text-orange'
                              : o.orderStatus === 'Cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {o.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedOrder(o);
                              setUtrInput(o.utrNumber || '');
                              setIsVerifyingPayment(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-navy text-white hover:bg-navy-dark text-xs font-bold shadow-2xs"
                          >
                            View Order
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. CUSTOMERS CRM TAB */}
      {subTab === 'customers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-3">Phone & Email</th>
                  <th className="py-3 px-3">City</th>
                  <th className="py-3 px-3">Total Orders</th>
                  <th className="py-3 px-3">Lifetime Value (LTV)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">CRM Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy text-xs">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {c.id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-700">{c.phone}</div>
                      <div className="text-[10px] text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-3 px-3">{c.city || 'Chennai'}</td>
                    <td className="py-3 px-3 font-bold text-purple">{c.totalOrders} Orders</td>
                    <td className="py-3 px-3 font-black text-navy">₹{c.lifetimeValue.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSearchQuery(c.phone);
                          setSubTab('orders');
                        }}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-purple hover:bg-purple/5 text-xs font-bold"
                      >
                        View Orders &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. WHOLESALE QUOTES (B2B) TAB */}
      {subTab === 'quotes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotes.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-black text-purple text-sm">{q.quoteNumber}</span>
                    <h3 className="font-bold text-xs text-navy mt-0.5">{q.customerName}</h3>
                    <p className="text-[10px] text-slate-400">{q.customerPhone}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {q.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Quote Line Items</div>
                  {q.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700">
                      <span>{it.productName} (x{it.quantity})</span>
                      <span className="font-bold">₹{it.lineTotal.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-navy text-xs">
                    <span>Grand Total:</span>
                    <span>₹{q.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {q.notes && <p className="text-[11px] text-slate-500 italic">"{q.notes}"</p>}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    Expires: {new Date(q.expiryDateUtc).toLocaleDateString('en-IN')}
                  </div>
                  <button
                    onClick={() => handleConvertQuote(q.id)}
                    className="px-4 py-1.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Convert to Order</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TAX INVOICES TAB */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Subtotal</th>
                  <th className="py-3 px-3">GST Tax (18%)</th>
                  <th className="py-3 px-3">Grand Total</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 font-mono text-purple">{inv.orderNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-3">₹{inv.subtotal.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">₹{inv.tax.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 font-black text-navy">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="Print / View Invoice"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PAYMENTS TAB */}
      {subTab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">UTR / Reference</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{pay.paymentNumber}</td>
                    <td className="py-3 px-3 font-mono text-purple">{pay.orderNumber || '—'}</td>
                    <td className="py-3 px-3 font-bold">{pay.customerName}</td>
                    <td className="py-3 px-3 font-bold text-slate-600">{pay.paymentMethod}</td>
                    <td className="py-3 px-3 font-black text-navy">₹{pay.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{pay.transactionReference || 'UPI-APP-TXN'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        {pay.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. RETURNS TAB */}
      {subTab === 'returns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-red-600 text-xs">{ret.returnNumber}</span>
                    <h3 className="font-bold text-xs text-navy mt-0.5">Order Ref: {ret.orderNumber}</h3>
                    <p className="text-[10px] text-slate-400">{ret.customerName} • {ret.customerPhone}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {ret.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  {ret.items.map((it, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex justify-between">
                      <div>
                        <div className="font-bold text-navy">{it.productName} (x{it.quantity})</div>
                        <div className="text-[10px] text-slate-400">Reason: {it.reason}</div>
                      </div>
                      <div className="font-black text-navy">₹{it.refundAmount.toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">Refund: ₹{ret.totalRefundAmount}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        await api.updateReturnStatus(ret.id, 'Approved');
                        showToast('Return Approved & Refund queued', 'success');
                        loadData();
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold"
                    >
                      Approve & Restock
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ORDER DETAIL & PAYMENT VERIFICATION MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                    {selectedOrder.orderNumber}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                      selectedOrder.orderStatus === 'Delivered'
                        ? 'bg-emerald-100 text-emerald-700'
                        : selectedOrder.orderStatus === 'Processing'
                        ? 'bg-orange/10 text-orange'
                        : 'bg-purple/10 text-purple'
                    }`}
                  >
                    {selectedOrder.orderStatus}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Placed on {new Date(selectedOrder.placedAtUtc).toLocaleString('en-IN')}
                </div>
              </div>

              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5 text-xs">
              {/* Customer & Delivery Address Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Customer Details</div>
                  <div className="font-bold text-navy text-xs">{selectedOrder.customerName}</div>
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <Phone className="w-3 h-3 text-orange" />
                    <span>{selectedOrder.customerPhone}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <Mail className="w-3 h-3 text-purple" />
                    <span>{selectedOrder.customerEmail}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Delivery Address</div>
                  <div className="flex items-start space-x-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div>{selectedOrder.shippingAddress?.addressLine1}</div>
                      {selectedOrder.shippingAddress?.addressLine2 && <div>{selectedOrder.shippingAddress.addressLine2}</div>}
                      <div>
                        {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} - {selectedOrder.shippingAddress?.postalCode}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* UPI Payment Screenshot & UTR Verification Section */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-xs text-amber-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    <span>UPI Payment Verification</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedOrder.paymentStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Payment: {selectedOrder.paymentStatus}
                  </span>
                </div>

                {selectedOrder.paymentScreenshotUrl && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-amber-800">Submitted Payment Screenshot:</div>
                    <a
                      href={selectedOrder.paymentScreenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block relative rounded-xl overflow-hidden border border-amber-200 max-h-48 group cursor-zoom-in"
                    >
                      <img
                        src={selectedOrder.paymentScreenshotUrl}
                        alt="Payment Screenshot"
                        className="w-full h-44 object-contain bg-slate-900 group-hover:opacity-90"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-navy/40 opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs space-x-1">
                        <ExternalLink className="w-4 h-4" />
                        <span>Click to Expand Full Screenshot</span>
                      </div>
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-amber-900">UTR / Reference Number</label>
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 423588991204"
                      className="w-full mt-1 p-2 rounded-xl bg-white border border-amber-300 font-mono text-navy outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900">Verification Notes</label>
                    <input
                      type="text"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="e.g. Verified in GPay business statement"
                      className="w-full mt-1 p-2 rounded-xl bg-white border border-amber-300 text-navy outline-none"
                    />
                  </div>
                </div>

                {selectedOrder.paymentStatus !== 'Paid' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleConfirmPayment}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm Payment & Move to Packing</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              <div className="space-y-2">
                <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Ordered Products</div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {selectedOrder.items?.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div>
                        <div className="font-bold text-navy text-xs">{it.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku} • ₹{it.unitPrice} each</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-navy">₹{it.lineTotal.toLocaleString('en-IN')}</div>
                        <span className="text-[10px] text-purple font-bold">Qty: {it.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-slate-600 text-xs">
                  <div className="flex justify-between">
                    <span>Items Subtotal:</span>
                    <span className="font-bold">₹{selectedOrder.itemsSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount:</span>
                      <span>-₹{selectedOrder.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping Fee:</span>
                    <span className="font-bold">₹{selectedOrder.shippingCharge}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-navy text-sm">
                    <span>Grand Total:</span>
                    <span className="text-orange">₹{selectedOrder.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Order State Machine Quick Actions */}
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-navy uppercase tracking-wider">
                  Order Lifecycle Progression
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Processing')}
                    className="px-3 py-1.5 rounded-xl bg-orange text-white font-bold text-xs hover:bg-orange-hover"
                  >
                    1. Move to Packing Screen
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Packed')}
                    className="px-3 py-1.5 rounded-xl bg-purple text-white font-bold text-xs hover:bg-purple-dark"
                  >
                    2. Mark as Packed
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Shipped')}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
                  >
                    3. Dispatch / Ship
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Delivered')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
                  >
                    4. Mark Delivered
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Cancelled')}
                    className="px-3 py-1.5 rounded-xl bg-red-100 text-red-700 font-bold text-xs hover:bg-red-200"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedInvoice({
                    id: `inv-${selectedOrder.id}`,
                    invoiceNumber: `INV-${selectedOrder.orderNumber.replace('ORD-', '')}`,
                    orderId: selectedOrder.id,
                    orderNumber: selectedOrder.orderNumber,
                    customerId: selectedOrder.customerId,
                    customerName: selectedOrder.customerName,
                    subtotal: selectedOrder.itemsSubtotal,
                    discount: selectedOrder.discount,
                    tax: selectedOrder.tax,
                    shipping: selectedOrder.shippingCharge,
                    grandTotal: selectedOrder.grandTotal,
                    paidAmount: selectedOrder.grandTotal,
                    balanceAmount: 0,
                    status: 'Paid',
                    issuedAtUtc: new Date().toISOString(),
                    dueDateUtc: new Date().toISOString()
                  });
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-navy font-bold text-xs flex items-center space-x-1.5 hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5 text-purple" />
                <span>Print Tax Invoice</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl bg-navy text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE TAX INVOICE MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="font-black text-base text-navy">AADHI CRACKERS</div>
                <span className="text-[10px] font-mono bg-purple/10 text-purple px-2 py-0.2 rounded font-bold">
                  ORIGINAL TAX INVOICE
                </span>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Invoice To:</div>
                <div className="font-bold text-navy">{selectedInvoice.customerName}</div>
                <div className="text-slate-500">Order: {selectedInvoice.orderNumber}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Invoice Number:</div>
                <div className="font-mono font-bold text-navy">{selectedInvoice.invoiceNumber}</div>
                <div className="text-slate-500">{new Date(selectedInvoice.issuedAtUtc).toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-bold">₹{selectedInvoice.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9%) + SGST (9%):</span>
                <span className="font-bold">₹{selectedInvoice.tax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery & Handling:</span>
                <span className="font-bold">₹{selectedInvoice.shipping.toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-navy">
                <span>Total Amount Paid:</span>
                <span className="text-orange">₹{selectedInvoice.grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">GSTIN: 33ABCDE1234F1Z5 • Sivakasi, Tamil Nadu</span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
