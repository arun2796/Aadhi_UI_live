import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Package,
  Truck,
  Download,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  ShieldCheck,
  QrCode,
  Copy,
  ExternalLink,
  XCircle,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { api } from '../../services/api';
import { StatusBadge, Drawer } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

interface ErpOrdersPageProps {
  initialOrderId?: string;
}

export const ErpOrdersPage: React.FC<ErpOrdersPageProps> = ({ initialOrderId }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatusTab, setActiveStatusTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('Processing');
  const [statusReason, setStatusReason] = useState<string>('');

  // Proof Zoom Modal State
  const [zoomedScreenshot, setZoomedScreenshot] = useState<string | null>(null);

  // Reject Modal State
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadOrders = () => {
    api.getOrders().then(all => {
      setOrders(all);
      if (initialOrderId) {
        const found = all.find(o => o.id === initialOrderId);
        if (found) setSelectedOrder(found);
      }
    });
  };

  useEffect(() => {
    loadOrders();
  }, [initialOrderId]);

  const pendingVerificationCount = orders.filter(
    o => o.paymentMethod === 'UPI' && (o.paymentStatus === 'Pending' || o.orderStatus === 'Pending') && (o.paymentScreenshotUrl || o.utrNumber)
  ).length;

  const filteredOrders = orders.filter(o => {
    if (activeStatusTab === 'verification_pending') {
      return o.paymentMethod === 'UPI' && o.paymentStatus === 'Pending' && (o.paymentScreenshotUrl || o.utrNumber);
    }
    if (activeStatusTab !== 'all' && o.orderStatus.toLowerCase() !== activeStatusTab.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        (o.utrNumber && o.utrNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.updateOrderStatus(selectedOrder.id, newStatus, statusReason);
      if (updated) {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setSelectedOrder(updated);
        showToast(`Order ${updated.orderNumber} transitioned to "${newStatus}"!`, 'success');
        setStatusReason('');
      }
    } catch {
      showToast('Failed to update status', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleVerifyPayment = async (autoMoveToPacking: boolean = false) => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.verifyPayment(selectedOrder.id, {
        verifiedUtrNumber: selectedOrder.utrNumber,
        verificationNotes: 'UPI Payment screenshot and bank UTR verified by Admin',
        autoMoveToPacking
      });
      if (updated) {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setSelectedOrder(updated);
        showToast(
          autoMoveToPacking
            ? `Payment verified & Order ${updated.orderNumber} moved directly to packing!`
            : `Payment verified & Order ${updated.orderNumber} Confirmed!`,
          'success'
        );
      }
    } catch {
      showToast('Failed to verify payment', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMoveToPacking = async () => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.moveToPacking(selectedOrder.id);
      if (updated) {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setSelectedOrder(updated);
        showToast(`Order ${updated.orderNumber} moved to packing station!`, 'success');
      }
    } catch {
      showToast('Failed to move order to packing', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedOrder || !rejectReason.trim()) {
      showToast('Please specify a rejection reason', 'error');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const updated = await api.rejectPayment(selectedOrder.id, rejectReason.trim());
      if (updated) {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setSelectedOrder(updated);
        setIsRejectOpen(false);
        setRejectReason('');
        showToast(`Payment proof rejected and Order ${updated.orderNumber} cancelled.`, 'warning');
      }
    } catch {
      showToast('Failed to reject payment', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusList: OrderStatus[] = [
    'Pending',
    'Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'OutForDelivery',
    'Delivered',
    'Cancelled'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Customer Orders & Payment Verification</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify UPI payment screenshots, confirm orders, and move fulfilled items to the packing station.
          </p>
        </div>

        {pendingVerificationCount > 0 && (
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>{pendingVerificationCount} UPI Proof(s) Awaiting Verification</span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full pb-1">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'verification_pending', label: `Pending Verification (${pendingVerificationCount})`, highlight: pendingVerificationCount > 0 },
              { id: 'Confirmed', label: 'Confirmed' },
              { id: 'Processing', label: 'Packing / Processing' },
              { id: 'Packed', label: 'Packed' },
              { id: 'Shipped', label: 'Shipped' },
              { id: 'Delivered', label: 'Delivered' },
              { id: 'Cancelled', label: 'Cancelled' }
            ].map((tab) => {
              const isSelected = activeStatusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatusTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-navy text-white shadow-xs'
                      : tab.highlight
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, UTR, Name..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Grand Total</th>
                <th className="py-3 px-4">Payment Proof</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No orders found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const hasUpiProof = !!(order.paymentScreenshotUrl || order.utrNumber);
                  const isPendingProof = hasUpiProof && order.paymentStatus === 'Pending';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-navy">{order.orderNumber}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{order.customerName}</div>
                        <div className="text-[10px] text-slate-400">{order.customerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(order.placedAtUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-black text-navy">
                        ₹{order.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        {hasUpiProof ? (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPendingProof
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              <ShieldCheck className="w-3 h-3" />
                              <span>{isPendingProof ? 'Proof Attached' : 'Payment Verified'}</span>
                            </span>
                            {order.utrNumber && (
                              <div className="text-[10px] font-mono text-slate-500">
                                UTR: {order.utrNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <StatusBadge status={order.paymentStatus} type="payment" />
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.orderStatus} type="order" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setNewStatus(order.orderStatus);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                            isPendingProof
                              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-navy hover:text-white text-navy'
                          }`}
                        >
                          {isPendingProof ? 'Verify Proof' : 'View & Manage'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail & Payment Verification Drawer */}
      <Drawer
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Manage Order ${selectedOrder.orderNumber}` : ''}
        width="max-w-xl"
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs font-sans">
            {/* 1. UPI Payment Proof Verification Card (if proof attached) */}
            {(selectedOrder.paymentScreenshotUrl || selectedOrder.utrNumber) && (
              <div className={`p-4 rounded-2xl border space-y-3 ${
                selectedOrder.paymentStatus === 'Paid'
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/70 border-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className={`w-5 h-5 ${selectedOrder.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span className="font-bold text-sm text-navy">
                      UPI Payment Proof & UTR Verification
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedOrder.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800 animate-pulse'
                  }`}>
                    {selectedOrder.paymentStatus === 'Paid' ? 'Verified' : 'Action Required'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-white p-3 rounded-xl border border-slate-200">
                  {/* Screenshot Thumbnail with zoom */}
                  {selectedOrder.paymentScreenshotUrl ? (
                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center h-28 cursor-pointer"
                         onClick={() => setZoomedScreenshot(selectedOrder.paymentScreenshotUrl!)}>
                      <img
                        src={selectedOrder.paymentScreenshotUrl}
                        alt="Customer Payment Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-navy/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold space-x-1">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Click to Enlarge</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <QrCode className="w-6 h-6 mb-1 text-slate-300" />
                      <span className="text-[10px]">No image file</span>
                    </div>
                  )}

                  {/* Transaction Metadata */}
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">12-Digit UTR Number</span>
                      <span className="font-mono font-black text-navy text-sm">
                        {selectedOrder.utrNumber || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Claimed Amount</span>
                      <span className="font-bold text-orange text-xs">
                        ₹{selectedOrder.grandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {selectedOrder.paymentVerifiedBy && (
                      <div className="text-[10px] text-emerald-700">
                        Verified by: <strong>{selectedOrder.paymentVerifiedBy}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Actions */}
                {selectedOrder.paymentStatus !== 'Paid' && selectedOrder.orderStatus !== 'Cancelled' && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={() => handleVerifyPayment(false)}
                      disabled={isUpdatingStatus}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Confirm Payment</span>
                    </button>

                    <button
                      onClick={() => handleVerifyPayment(true)}
                      disabled={isUpdatingStatus}
                      className="flex-1 py-2.5 rounded-xl bg-purple hover:bg-purple-light text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Package className="w-4 h-4" />
                      <span>Verify & Move to Packing</span>
                    </button>

                    <button
                      onClick={() => setIsRejectOpen(true)}
                      disabled={isUpdatingStatus}
                      className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors"
                    >
                      Reject Proof
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. Direct Move to Packing CTA (if order is Confirmed) */}
            {selectedOrder.orderStatus === 'Confirmed' && (
              <div className="p-4 rounded-2xl bg-purple/10 border border-purple/20 flex items-center justify-between">
                <div>
                  <div className="font-bold text-navy text-xs">Ready for Warehouse Fulfillment</div>
                  <div className="text-[10px] text-slate-500">Order is paid and confirmed. Dispatch to packing station.</div>
                </div>
                <button
                  onClick={handleMoveToPacking}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-light text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Move to Packing Station</span>
                </button>
              </div>
            )}

            {/* 3. Manual Status Transition */}
            <div className="p-4 rounded-2xl bg-orange/5 border border-orange/20 space-y-3">
              <div className="font-bold text-navy text-sm">Update Order Fulfillment Status</div>
              <div className="flex items-center space-x-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-navy focus:outline-none focus:ring-1 focus:ring-orange"
                >
                  {statusList.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>

                <button
                  onClick={handleUpdateStatus}
                  disabled={isUpdatingStatus || newStatus === selectedOrder.orderStatus}
                  className="px-4 py-2 bg-orange hover:bg-orange-hover disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-xs"
                >
                  {isUpdatingStatus ? 'Saving...' : 'Update Status'}
                </button>
              </div>

              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason or courier AWB number (e.g. Handed to Express Logistics)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-none"
              />
            </div>

            {/* 4. Customer & Shipping Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-navy flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-orange" />
                <span>Shipping Address & Customer</span>
              </div>
              <div className="font-semibold text-slate-800">{selectedOrder.shippingAddress.fullName} ({selectedOrder.shippingAddress.phone})</div>
              <div className="text-slate-500">
                {selectedOrder.shippingAddress.addressLine1}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.postalCode}
              </div>
            </div>

            {/* 5. Items Breakdown */}
            <div className="space-y-2">
              <div className="font-bold text-navy">Ordered Items ({selectedOrder.items.length})</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-white">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">SKU: {item.sku} • Qty: {item.quantity}</div>
                    </div>
                    <div className="font-black text-navy">₹{item.lineTotal.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Totals */}
            <div className="space-y-1 pt-2 border-t border-slate-200 font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{selectedOrder.itemsSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="text-emerald-600">-₹{selectedOrder.discount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (GST 18%):</span>
                <span>₹{selectedOrder.tax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-navy pt-1 border-t">
                <span>Grand Total:</span>
                <span className="text-orange">₹{selectedOrder.grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Invoice Download Action */}
            <button
              onClick={() => showToast(`Official GST Tax Invoice for ${selectedOrder.orderNumber} downloaded!`, 'success')}
              className="w-full py-3 rounded-xl border border-navy text-navy hover:bg-navy hover:text-white font-bold transition-colors flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Official Tax Invoice PDF</span>
            </button>
          </div>
        )}
      </Drawer>

      {/* Proof Zoom Modal */}
      {zoomedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedScreenshot(null)}
        >
          <div className="max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <img
              src={zoomedScreenshot}
              alt="Full Payment Proof"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
            <div className="p-3 flex justify-between items-center bg-slate-50 mt-2 rounded-xl text-xs font-bold text-navy">
              <span>Customer Uploaded Payment Proof</span>
              <button
                onClick={() => setZoomedScreenshot(null)}
                className="px-3 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-navy flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              <span>Reject Payment Proof</span>
            </h3>

            <p className="text-xs text-slate-500">
              Provide a reason for rejecting this payment proof. The order will be marked as cancelled.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR number does not match any incoming credit in bank account"
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-rose-500 outline-none h-24"
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
