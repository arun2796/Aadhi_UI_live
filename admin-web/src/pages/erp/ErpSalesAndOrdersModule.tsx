import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  CreditCard,
  Search,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Printer,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Check,
  Clock,
  ArrowLeft,
  Filter,
  Plus,
  Truck,
  Eye,
  AlertCircle,
  Upload
} from 'lucide-react';
import { Order, Customer, Invoice, Payment, OrderStatus, OrderStatusHistory } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { orderApi } from '../../services/orderApi';
import { customerApi, CustomerDetail } from '../../services/customerApi';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { StatusBadge } from '../../components/common/CommonComponents';
import { ErpConfirmDialog } from './ErpConfirmDialog';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ImageViewerModal } from '../../components/common/ImageViewerModal';

type SalesSubTab = 'orders' | 'customers' | 'invoices' | 'payments';

interface ErpSalesAndOrdersModuleProps {
  initialSubTab?: SalesSubTab;
  initialSelectedOrderId?: string;
  initialSelectedCustomerId?: string;
}

/** Each sidebar item is its own screen — per-screen page title/subtitle shown instead of the old
    shared "Sales & Order Fulfillment" header + cross-screen pill tab bar. The header follows the
    currently shown section, so programmatic cross-navigation (e.g. an order opening customer detail) updates it too. */
const SCREEN_HEADERS: Record<SalesSubTab, { title: string; subtitle: string }> = {
  orders: { title: 'Orders', subtitle: 'Manage and fulfil customer orders.' },
  customers: { title: 'Customers', subtitle: 'Customer directory and purchase history.' },
  invoices: { title: 'Tax Invoices', subtitle: 'GST tax invoices issued for customer orders.' },
  payments: { title: 'Payments', subtitle: 'Payment records and verification.' }
};

const PAGE_SIZE = 10;

type OrderStatusTab = 'all' | 'pending_verification' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';
type PaymentTab = 'all' | 'Received' | 'Pending';

/** Valid next statuses per current status — mirrors Order.CanTransitionTo on the backend,
    allowing direct dispatch to Shipped from Confirmed. */
const NEXT_TRANSITIONS: Record<string, OrderStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipped', 'Processing', 'Packed', 'Cancelled'],
  Processing: ['Shipped', 'Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'OutForDelivery'],
  OutForDelivery: ['Delivered'],
  Delivered: [],
  Cancelled: []
};

/** Client-side list filters shared by the Filters popovers (design: every list page has one). */
interface ListFilterState {
  method: string; // 'all' | 'UPI' | 'COD'
  fromDate: string;
  toDate: string;
}

const EMPTY_LIST_FILTERS: ListFilterState = { method: 'all', fromDate: '', toDate: '' };

const matchesDateRange = (iso: string | undefined, f: ListFilterState): boolean => {
  if (!f.fromDate && !f.toDate) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (f.fromDate && t < new Date(f.fromDate).getTime()) return false;
  if (f.toDate) {
    const end = new Date(f.toDate);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
};

interface OrderProofThumbnailProps {
  url?: string;
  orderNumber: string;
  onClick: (e: React.MouseEvent) => void;
}

const OrderProofThumbnail: React.FC<OrderProofThumbnailProps> = ({ url, orderNumber, onClick }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!url) {
    return (
      <div className="w-9 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0">
        <CreditCard className="w-4 h-4 text-slate-300" />
      </div>
    );
  }

  if (hasError) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-9 h-9 rounded-lg border border-purple/30 bg-purple/10 hover:bg-purple/20 flex flex-col items-center justify-center flex-shrink-0 transition cursor-zoom-in group shadow-xs"
        title="Payment proof attached (Click to view or replace)"
      >
        <span className="text-[9px] font-black text-purple tracking-tight leading-none">UPI</span>
        <Eye className="w-2.5 h-2.5 text-purple/80 mt-0.5 opacity-70 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group flex-shrink-0 cursor-zoom-in"
      title="Click to view payment proof in high resolution"
    >
      <img
        src={normalizeImageUrl(url)}
        alt={`Proof ${orderNumber}`}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition"
      />
      <div className="absolute inset-0 bg-navy/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
        <Eye className="w-3.5 h-3.5" />
      </div>
    </button>
  );
};

interface OrderDetailsProofPreviewProps {
  url: string;
  orderNumber: string;
  customerName: string;
  onOpenViewer: () => void;
  onUploadClick: () => void;
}

const OrderDetailsProofPreview: React.FC<OrderDetailsProofPreviewProps> = ({
  url,
  orderNumber,
  customerName,
  onOpenViewer,
  onUploadClick
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center space-y-2.5">
        <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Image Not Found on Server (404)</span>
        </div>
        <p className="text-[11px] text-amber-800/80 leading-relaxed max-w-sm mx-auto">
          Previous ephemeral file storage was cleared during a cloud restart. You can attach or re-upload the screenshot now to permanently save it in the database.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={onUploadClick}
            className="px-3 py-1.5 rounded-lg bg-purple hover:bg-purple-dark text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Re-upload Proof</span>
          </button>
          <button
            type="button"
            onClick={onOpenViewer}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-navy text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Details</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
      <img
        src={normalizeImageUrl(url)}
        alt="Payment Screenshot"
        onError={() => setHasError(true)}
        className="w-full h-36 object-contain cursor-pointer transition-transform group-hover:scale-105"
        onClick={onOpenViewer}
      />
      <div
        onClick={onOpenViewer}
        className="absolute inset-0 bg-navy/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
      >
        <Eye className="w-6 h-6 mb-1 text-orange" />
        <span className="text-xs font-bold">Click to Zoom Proof</span>
      </div>
      <a
        href={normalizeImageUrl(url)}
        target="_blank"
        rel="noreferrer"
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
        title="Open in new tab"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};

/** Outline "Filters" button + simple popover (payment method + date range, client-side). */
const FiltersButton: React.FC<{
  filters: ListFilterState;
  onChange: (f: ListFilterState) => void;
  showMethod?: boolean;
}> = ({ filters, onChange, showMethod = true }) => {
  const [open, setOpen] = useState(false);
  const isActive = (showMethod && filters.method !== 'all') || !!filters.fromDate || !!filters.toDate;
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-2xs transition-colors ${
          isActive
            ? 'border-purple bg-purple/5 text-purple'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Filter className="w-3.5 h-3.5" />
        <span>Filters</span>
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-purple" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 space-y-3 text-xs">
            {showMethod && (
              <div>
                <label className="font-bold text-slate-500">Payment Method</label>
                <select
                  value={filters.method}
                  onChange={(e) => onChange({ ...filters, method: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy font-bold outline-none"
                >
                  <option value="all">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="COD">COD</option>
                </select>
              </div>
            )}
            <div>
              <label className="font-bold text-slate-500">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
                className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-500">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
                className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none"
              />
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button
                onClick={() => onChange(EMPTY_LIST_FILTERS)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const formatINR = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : '—';

/** Payment column label per design 02: Paid | COD | Refunded (falls back to raw payment status). */
const paymentLabel = (o: Order) =>
  o.paymentStatus === 'Refunded' || o.paymentStatus === 'RefundPending'
    ? 'Refunded'
    : o.paymentStatus === 'Paid'
    ? 'Paid'
    : o.paymentMethod === 'COD'
    ? 'COD'
    : o.paymentStatus;

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]
  );

/** Clean printable HTML invoice for an order — opened in a new window, then window.print()
    (mirrors the customer-web invoice pattern). */
/** Clean printable HTML invoice for an order matching Sivakasi fireworks bill reference */
const buildOrderInvoiceHtml = (o: Order): string => {
  const formatNum = (n?: number): string =>
    (Number(n) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatInvoiceDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const items = o.items || [];
  const subTotal =
    Number(o.itemsSubtotal) > 0
      ? Number(o.itemsSubtotal)
      : items.reduce(
          (sum, it) =>
            sum + (Number(it.lineTotal) || (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1)),
          0
        );

  const packingCharge =
    Number(o.shippingCharge) > 0
      ? Number(o.shippingCharge)
      : Math.round(subTotal * 0.015);

  const overallTotal =
    Number(o.grandTotal) > subTotal
      ? Number(o.grandTotal)
      : subTotal + packingCharge;

  const rows = items
    .map((it, i) => {
      const qty = Number(it.quantity) || 1;
      const lineTotal = Number(it.lineTotal) || (Number(it.unitPrice) || 0) * qty;
      const finalRate = qty > 0 ? Number(it.unitPrice) || lineTotal / qty : 0;

      // Sivakasi Cracker 80% discount model
      let rateQty = finalRate * 5;
      let discount = rateQty * 0.8;
      if (Number(it.discount) > 0) {
        const unitDisc = Number(it.discount) / qty;
        rateQty = finalRate + unitDisc;
        discount = unitDisc;
      }

      const code = it.sku || `AC-${String(i + 1).padStart(2, '0')}`;

      return `
      <tr>
        <td class="col-sno">${i + 1}</td>
        <td class="col-code">${escapeHtml(code)}</td>
        <td class="col-name">${escapeHtml(it.productName)}</td>
        <td class="col-qty">${qty}</td>
        <td class="col-rate">${formatNum(rateQty)}</td>
        <td class="col-disc">${formatNum(discount)}</td>
        <td class="col-final">${formatNum(finalRate)}</td>
        <td class="col-amount">${formatNum(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const addr = o.shippingAddress;
  const addressLines = addr
    ? [
        addr.addressLine1,
        addr.addressLine2,
        [addr.city, addr.state].filter(Boolean).join(', '),
        addr.postalCode ? `${addr.state ? '' : 'Pincode: '}${addr.postalCode}` : null
      ]
        .filter(Boolean)
        .map((l) => escapeHtml(l))
        .join('<br />')
    : 'Sivakasi, Tamil Nadu';

  const orderNum = o.orderNumber || '—';
  const orderDate = formatInvoiceDate(o.placedAtUtc) || new Date().toLocaleDateString('en-IN');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Estimate_${escapeHtml(orderNum)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 12px; font-size: 11px; background: #fff; }
  .invoice-box { width: 100%; max-width: 820px; margin: 0 auto; border: 1.5px solid #000; background: #fff; }
  .top-bar { display: flex; border-bottom: 1.5px solid #000; font-size: 12px; }
  .top-bar-cell { padding: 6px 10px; display: flex; align-items: center; }
  .top-bar-left { width: 33.33%; border-right: 1.5px solid #000; font-weight: bold; }
  .top-bar-center { width: 33.34%; justify-content: center; font-size: 13.5px; font-weight: 800; letter-spacing: 1px; border-right: 1.5px solid #000; }
  .top-bar-right { width: 33.33%; justify-content: flex-end; font-weight: bold; }
  .company-header { padding: 6px 12px 8px; border-bottom: 1.5px solid #000; text-align: center; }
  .company-contacts { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 2px; }
  .company-name { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin: 2px 0 3px; }
  .company-address { font-size: 11px; color: #111; }
  .info-grid { display: flex; border-bottom: 1.5px solid #000; }
  .customer-col { width: 58%; border-right: 1.5px solid #000; padding: 6px 10px; line-height: 1.45; font-size: 11px; }
  .customer-col .title { font-weight: bold; margin-bottom: 2px; font-size: 11.5px; }
  .bank-col { width: 42%; padding: 6px 10px; line-height: 1.4; }
  .bank-table { width: 100%; border-collapse: collapse; }
  .bank-table td { padding: 1px 0; font-size: 10.5px; vertical-align: top; }
  .bank-table td.lbl { font-weight: bold; width: 82px; white-space: nowrap; }
  .bank-table td.colon { width: 14px; font-weight: bold; text-align: center; }
  .bank-table td.val { font-weight: bold; letter-spacing: 0.2px; }
  .ledger-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .ledger-table th { border-bottom: 1.5px solid #000; border-right: 1px solid #000; padding: 5px 3px; text-align: center; font-weight: bold; background: #fff; }
  .ledger-table th:last-child { border-right: none; }
  .cat-band td { background: #e2e8f0; font-weight: bold; padding: 3px 8px; font-size: 10.5px; border-bottom: 1px solid #000; text-align: left; }
  .ledger-table td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3.5px 5px; vertical-align: middle; }
  .ledger-table td:last-child { border-right: none; }
  .col-sno { width: 34px; text-align: center; }
  .col-code { width: 52px; text-align: center; font-weight: 500; }
  .col-name { text-align: left; padding-left: 8px !important; }
  .col-qty { width: 38px; text-align: center; font-weight: bold; }
  .col-rate { width: 72px; text-align: right; }
  .col-disc { width: 70px; text-align: right; }
  .col-final { width: 70px; text-align: right; font-weight: 600; }
  .col-amount { width: 80px; text-align: right; font-weight: bold; }
  .subtotal-row td { font-weight: bold; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  .subtotal-label { text-align: right; font-weight: bold; padding-right: 8px !important; }
  .spacer-row td { height: 42px; border-bottom: 1px solid #000; }
  .packing-row td { font-weight: bold; border-bottom: 1.5px solid #000; padding: 4px 6px; }
  .overall-row td { font-weight: bold; padding: 4px 6px; background: #e2e8f0; font-size: 11px; }
  .total-items-cell { font-weight: bold; text-align: left; padding-left: 8px !important; }
  .overall-label { text-align: right; font-weight: bold; padding-right: 8px !important; }
  .invoice-footer { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 9.5px; border-top: 1.5px solid #000; line-height: 1.45; }
  .terms-box { width: 65%; }
  .terms-box .terms-title { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
  .sign-box { width: 32%; text-align: right; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; }
  .sign-title { font-weight: bold; }
  .sign-space { height: 28px; }
  @media print {
    body { padding: 0; }
    .invoice-box { border: 1.5px solid #000; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="invoice-box">
    <!-- 1. Top Header Bar -->
    <div class="top-bar">
      <div class="top-bar-cell top-bar-left">Order No : ${escapeHtml(orderNum)}</div>
      <div class="top-bar-cell top-bar-center">ESTIMATE</div>
      <div class="top-bar-cell top-bar-right">Date : ${escapeHtml(orderDate)}</div>
    </div>

    <!-- 2. Company Header -->
    <div class="company-header">
      <div class="company-contacts">
        <span>Mobile : +91 94428 26566</span>
        <span>E-mail : support@aadhicrackers.com</span>
      </div>
      <div class="company-name">Aadhi Crackers</div>
      <div class="company-address">3/1233/A8, Naranapuram Main Road, Sivakasi - 626 189.</div>
    </div>

    <!-- 3. Customer & Bank Details -->
    <div class="info-grid">
      <div class="customer-col">
        <div class="title">Customer Details</div>
        <div><strong>${escapeHtml(o.customerName || 'Valued Customer')}</strong></div>
        ${o.customerPhone ? `<div>${escapeHtml(o.customerPhone)}</div>` : ''}
        ${addressLines ? `<div>${addressLines}</div>` : ''}
      </div>
      <div class="bank-col">
        <table class="bank-table">
          <tr><td class="lbl">A/C Name</td><td class="colon">:</td><td class="val">AADHI CRACKERS</td></tr>
          <tr><td class="lbl">A/C Number</td><td class="colon">:</td><td class="val">926020003006172</td></tr>
          <tr><td class="lbl">A/C Type</td><td class="colon">:</td><td class="val">Current</td></tr>
          <tr><td class="lbl">Bank Name</td><td class="colon">:</td><td class="val">AXIS BANK LTD</td></tr>
          <tr><td class="lbl">IFSC Code</td><td class="colon">:</td><td class="val">UTIB0000089</td></tr>
        </table>
      </div>
    </div>

    <!-- 4. Ledger Table -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th class="col-sno">S.No</th>
          <th class="col-code">Code</th>
          <th class="col-name">Product Name</th>
          <th class="col-qty">Qty</th>
          <th class="col-rate">Rate / Qty</th>
          <th class="col-disc">Discount</th>
          <th class="col-final">Final Rate</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr class="cat-band">
          <td colspan="8">80% Products</td>
        </tr>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:12px;color:#666;">No items found</td></tr>'}
        <!-- Sub Total Row -->
        <tr class="subtotal-row">
          <td colspan="7" class="subtotal-label">Sub Total</td>
          <td class="col-amount">${formatNum(subTotal)}</td>
        </tr>
        <!-- Spacer Row with vertical borders -->
        <tr class="spacer-row">
          <td class="col-sno">&nbsp;</td>
          <td class="col-code">&nbsp;</td>
          <td class="col-name">&nbsp;</td>
          <td class="col-qty">&nbsp;</td>
          <td class="col-rate">&nbsp;</td>
          <td class="col-disc">&nbsp;</td>
          <td class="col-final">&nbsp;</td>
          <td class="col-amount">&nbsp;</td>
        </tr>
        <!-- Packing Charges Row -->
        <tr class="packing-row">
          <td colspan="7" class="subtotal-label">Packing Charges ( 1.5% )</td>
          <td class="col-amount">${formatNum(packingCharge)}</td>
        </tr>
        <!-- Overall Total Row -->
        <tr class="overall-row">
          <td colspan="4" class="total-items-cell">Total Items : ${items.length}</td>
          <td colspan="3" class="overall-label">Overall Total</td>
          <td class="col-amount">${formatNum(overallTotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 5. Footer & Terms -->
    <div class="invoice-footer">
      <div class="terms-box">
        <div class="terms-title">Terms &amp; Conditions:</div>
        <div>1. Goods once sold cannot be taken back or exchanged.</div>
        <div>2. Store fireworks in a cool, dry place away from heat and open flames.</div>
        <div>3. Subject to Sivakasi Jurisdiction.</div>
      </div>
      <div class="sign-box">
        <div class="sign-title">For AADHI CRACKERS</div>
        <div class="sign-space"></div>
        <div>Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/** Payments status pill per design 15: Paid green, Pending amber, Refunded orange. */
const PaymentStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'Paid'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'Pending' || status === 'Authorized'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : status === 'Refunded' || status === 'RefundPending' || status === 'Completed'
      ? 'bg-orange-50 text-orange-600 border border-orange-200'
      : status === 'Failed' || status === 'Cancelled'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-slate-50 text-slate-600 border border-slate-200';
  const label = status === 'RefundPending' ? 'Refunded' : status === 'Completed' ? 'Refunded' : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>
  );
};

/** Maps granular fulfillment statuses onto the design's timeline/tab buckets. */
const STATUS_RANK: Record<string, number> = {
  Pending: 0,
  Confirmed: 1,
  Processing: 2,
  Packed: 2,
  Shipped: 3,
  OutForDelivery: 3,
  Delivered: 4
};

interface TimelineStep {
  label: string;
  timestamp?: string;
  done: boolean;
}

const buildTimeline = (order: Order): { steps: TimelineStep[]; cancelled?: OrderStatusHistory } => {
  const histories = order.statusHistories || [];
  const findTime = (statuses: OrderStatus[]) =>
    histories.find((h) => statuses.includes(h.toStatus))?.changedAtUtc;

  let currentRank = STATUS_RANK[order.orderStatus];
  if (currentRank === undefined) {
    // Cancelled / Returned — show progress reached before the terminal state
    currentRank = histories.reduce((max, h) => Math.max(max, STATUS_RANK[h.toStatus] ?? 0), 0);
  }

  const steps: TimelineStep[] = [
    { label: 'Order Placed', timestamp: order.placedAtUtc, done: true },
    { label: 'Confirmed', timestamp: findTime(['Confirmed']), done: currentRank >= 1 },
    { label: 'Processing', timestamp: findTime(['Processing', 'Packed']), done: currentRank >= 2 },
    { label: 'Shipped', timestamp: findTime(['Shipped', 'OutForDelivery']), done: currentRank >= 3 },
    { label: 'Delivered', timestamp: findTime(['Delivered']), done: currentRank >= 4 }
  ];

  const cancelled =
    order.orderStatus === 'Cancelled'
      ? histories.find((h) => h.toStatus === 'Cancelled') || {
          fromStatus: 'Pending' as OrderStatus,
          toStatus: 'Cancelled' as OrderStatus,
          changedAtUtc: ''
        }
      : undefined;

  return { steps, cancelled };
};

export const ErpSalesAndOrdersModule: React.FC<ErpSalesAndOrdersModuleProps> = ({
  initialSubTab = 'orders',
  initialSelectedOrderId,
  initialSelectedCustomerId
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [subTab, setSubTab] = useState<SalesSubTab>(initialSubTab);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusTab, setOrderStatusTab] = useState<OrderStatusTab>('all');
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [dispatchTargetOrder, setDispatchTargetOrder] = useState<Order | null>(null);
  const [dispatchLrInput, setDispatchLrInput] = useState('');
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<Order | null>(null);
  const [viewerImage, setViewerImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    orderId?: string;
    orderNumber?: string;
    utrNumber?: string;
  } | null>(null);
  const [orderFilters, setOrderFilters] = useState<ListFilterState>(EMPTY_LIST_FILTERS);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | ''>('');
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);

  // CUSTOMERS — list + detail
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // PAYMENTS — tabs, search, filters (design 15)
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('all');
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentFilters, setPaymentFilters] = useState<ListFilterState>(EMPTY_LIST_FILTERS);

  // Selected Invoice for Printable View Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ords, custs, invs, pays] = await Promise.all([
        api.getOrders(),
        customerApi.getCustomers(),
        api.getInvoices(),
        api.getPayments()
      ]);
      setOrders(ords);
      setCustomers(custs);
      setInvoices(invs);
      setPayments(pays);
    } catch {
      showToast('Could not load ERP data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync subTab with the initialSubTab prop whenever the sidebar switches screens
  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
      setSelectedOrder(null);
      setSelectedCustomer(null);
    }
  }, [initialSubTab]);

  // ?tab=confirm deep link (sidebar "Order Confirm") — maps to pending_verification
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'confirm' || tabParam === 'pending') {
      setSubTab('orders');
      setOrderStatusTab('pending_verification');
      setSelectedOrder(null);
    } else if (subTab === 'orders' && !tabParam) {
      setOrderStatusTab('all');
    }
  }, [searchParams, subTab]);

  // /admin/orders/:id deep link — open the order detail directly
  useEffect(() => {
    if (initialSelectedOrderId) {
      openOrderById(initialSelectedOrderId);
    }
  }, [initialSelectedOrderId]);

  // /admin/customers/:id deep link — open the customer detail directly
  const routeCustomerId = initialSelectedCustomerId ?? (initialSubTab === 'customers' ? routeParams.id : undefined);
  useEffect(() => {
    if (routeCustomerId) {
      openCustomer(routeCustomerId);
    }
  }, [routeCustomerId]);

  // Reset pagination when filters change
  useEffect(() => {
    setOrderPage(1);
  }, [searchQuery, orderStatusTab, orderFilters]);
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);
  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearch, paymentTab, paymentFilters]);

  // Reset the status-dropdown draft whenever a different order (or a new status) is shown
  useEffect(() => {
    setStatusDraft('');
  }, [selectedOrder?.id, selectedOrder?.orderStatus]);

  // ===================== ORDERS: derived data =====================

  const matchesOrderSearch = (o: Order) =>
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.customerPhone || '').includes(searchQuery) ||
    (o.utrNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

  const matchesStatusTab = (o: Order, tab: OrderStatusTab) => {
    switch (tab) {
      case 'all':
        return true;
      case 'pending_verification':
        return o.orderStatus === 'Pending' || (o.paymentStatus !== 'Paid' && o.orderStatus !== 'Cancelled');
      case 'Confirmed':
        return o.orderStatus === 'Confirmed' || o.orderStatus === 'Processing' || o.orderStatus === 'Packed';
      case 'Shipped':
        return o.orderStatus === 'Shipped' || o.orderStatus === 'OutForDelivery';
      case 'Delivered':
        return o.orderStatus === 'Delivered';
      case 'Cancelled':
        return o.orderStatus === 'Cancelled';
      default:
        return true;
    }
  };

  const matchesOrderFilters = (o: Order) =>
    (orderFilters.method === 'all' || o.paymentMethod === orderFilters.method) &&
    matchesDateRange(o.placedAtUtc, orderFilters);

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesOrderSearch(o) && matchesStatusTab(o, orderStatusTab) && matchesOrderFilters(o)),
    [orders, searchQuery, orderStatusTab, orderFilters]
  );

  const pagedOrders = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

  /** Orders needing payment verification or confirmation */
  const pendingVerificationCount = useMemo(
    () => orders.filter((o) => o.orderStatus === 'Pending' || (o.paymentStatus !== 'Paid' && o.orderStatus !== 'Cancelled')).length,
    [orders]
  );

  const orderTabs: { id: OrderStatusTab; label: string; count: number; alert?: boolean }[] = [
    { id: 'all', label: 'All Orders', count: orders.length },
    {
      id: 'pending_verification',
      label: 'Pending Verification',
      count: pendingVerificationCount,
      alert: pendingVerificationCount > 0
    },
    {
      id: 'Confirmed',
      label: 'Confirmed',
      count: orders.filter((o) => o.orderStatus === 'Confirmed' || o.orderStatus === 'Processing' || o.orderStatus === 'Packed').length
    },
    {
      id: 'Shipped',
      label: 'Shipped',
      count: orders.filter((o) => o.orderStatus === 'Shipped' || o.orderStatus === 'OutForDelivery').length
    },
    {
      id: 'Delivered',
      label: 'Delivered',
      count: orders.filter((o) => o.orderStatus === 'Delivered').length
    },
    {
      id: 'Cancelled',
      label: 'Cancelled',
      count: orders.filter((o) => o.orderStatus === 'Cancelled').length
    }
  ];

  // ===================== CUSTOMERS: derived data =====================

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) => {
        const q = customerSearch.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(customerSearch)
        );
      }),
    [customers, customerSearch]
  );

  const pagedCustomers = filteredCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);

  // ===================== PAYMENTS: derived data (design 15) =====================

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        const q = paymentSearch.toLowerCase();
        const matchesSearch =
          (p.paymentNumber || '').toLowerCase().includes(q) ||
          (p.orderNumber || '').toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q);
        const matchesTab =
          paymentTab === 'all' ||
          (paymentTab === 'Received' && p.paymentStatus === 'Paid') ||
          (paymentTab === 'Pending' && (p.paymentStatus === 'Pending' || p.paymentStatus === 'Authorized'));
        const matchesFilters =
          (paymentFilters.method === 'all' || p.paymentMethod === paymentFilters.method) &&
          matchesDateRange(p.paidAtUtc, paymentFilters);
        return matchesSearch && matchesTab && matchesFilters;
      }),
    [payments, paymentSearch, paymentTab, paymentFilters]
  );

  const pagedPayments = filteredPayments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE);

  const paymentTabs: { id: PaymentTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: payments.length },
    { id: 'Received', label: 'Received', count: payments.filter((p) => p.paymentStatus === 'Paid').length },
    {
      id: 'Pending',
      label: 'Pending',
      count: payments.filter((p) => p.paymentStatus === 'Pending' || p.paymentStatus === 'Authorized').length
    }
  ];

  // ===================== Handlers =====================

  /** Print Invoice (design 03) — opens a clean invoice window and triggers window.print(). */
  const handlePrintInvoice = async (order: Order) => {
    let orderToPrint = order;
    if (!orderToPrint.items || orderToPrint.items.length === 0) {
      try {
        const full = await api.getOrderById(order.id);
        if (full && full.items && full.items.length > 0) {
          orderToPrint = full;
        }
      } catch {
        /* fallback to current order */
      }
    }
    const w = window.open('', '_blank', 'width=880,height=960');
    if (!w) {
      showToast('Please allow pop-ups to print the invoice.', 'warning');
      return;
    }
    w.document.write(buildOrderInvoiceHtml(orderToPrint));
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* the opened window can be printed manually */
      }
    }, 400);
  };

  /** Add Customer (design 08) — POST /customers with { firstName, lastName, phone, email }. */
  const handleCreateCustomer = async () => {
    const name = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();
    if (!name || !phone) {
      showToast('Customer name and phone are required', 'warning');
      return;
    }
    const [firstName, ...rest] = name.split(/\s+/);
    setIsSavingCustomer(true);
    try {
      await customerApi.createCustomer({
        firstName,
        lastName: rest.join(' '),
        phone,
        email: newCustomer.email.trim()
      });
      showToast(`Customer "${name}" created`, 'success');
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      loadData();
    } catch {
      showToast('Could not create customer', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const openOrder = (o: Order) => {
    setSelectedOrder(o);
    setUtrInput(o.utrNumber || '');
    setVerificationNotes('');
    setTrackingInput(o.trackingNumber || '');
    // Hydrate with the full detail (items, status history) in the background
    api
      .getOrderById(o.id)
      .then((full) => {
        if (full) {
          setSelectedOrder((prev) => (prev && prev.id === o.id ? full : prev));
          setUtrInput(full.utrNumber || '');
          setTrackingInput(full.trackingNumber || '');
        }
      })
      .catch(() => {});
  };

  const openOrderById = async (id: string) => {
    try {
      const full = await api.getOrderById(id);
      if (full) {
        setSubTab('orders');
        setSelectedOrder(full);
        setUtrInput(full.utrNumber || '');
        setVerificationNotes('');
        setTrackingInput(full.trackingNumber || '');
      } else {
        showToast('Order not found', 'warning');
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load order details', 'error');
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrder(null);
    if (initialSelectedOrderId) {
      navigate('/admin/orders');
    }
  };

  const openCustomer = async (id: string) => {
    setSubTab('customers');
    setIsCustomerLoading(true);
    try {
      const [profileRes, ordersRes] = await Promise.allSettled([
        customerApi.getCustomerById(id),
        customerApi.getCustomerOrders(id)
      ]);
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setSelectedCustomer(profileRes.value);
      } else {
        throw profileRes.status === 'rejected' ? profileRes.reason : new Error('Customer not found');
      }
      setCustomerOrders(ordersRes.status === 'fulfilled' ? ordersRes.value : []);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load customer profile', 'error');
    } finally {
      setIsCustomerLoading(false);
    }
  };

  const closeCustomerDetail = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
    if (routeCustomerId) {
      navigate('/admin/customers');
    }
  };

  // Handle Order Status Transition
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus, `Updated via Admin ERP to ${newStatus}`);
      showToast(`Order status updated to ${newStatus}`, 'success');
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updated);
        }
      } else {
        loadData();
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Status transition failed', 'error');
    }
  };

  // 1-Click Approve & Confirm Order (order detail view)
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    try {
      if (selectedOrder.paymentMethod === 'COD') {
        const updated = await api.updateOrderStatus(selectedOrder.id, 'Confirmed', 'COD order confirmed by Admin');
        showToast(`Order ${selectedOrder.orderNumber} Confirmed!`, 'success');
        if (updated) {
          setSelectedOrder(updated);
          setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
        }
      } else {
        const updated = await api.verifyPayment(selectedOrder.id, {
          verifiedUtrNumber: utrInput.trim() || selectedOrder.utrNumber || 'MANUAL-CONFIRM',
          verificationNotes: verificationNotes.trim() || 'UPI payment confirmed by Admin',
          autoMoveToPacking: false
        });
        showToast(`Payment verified & Order ${selectedOrder.orderNumber} Confirmed!`, 'success');
        if (updated) {
          setSelectedOrder(updated);
          setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
        }
      }
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Payment verification failed', 'error');
    }
  };

  // Dispatch Order to Transport (Confirmed -> Shipped)
  const handleDispatchOrder = async () => {
    if (!selectedOrder) return;
    try {
      const trackingNo = trackingInput.trim();
      const reason = trackingNo ? `Dispatched via transport: ${trackingNo}` : 'Dispatched to transport office';
      const updated = await api.updateOrderStatus(selectedOrder.id, 'Shipped', reason, trackingNo || undefined);
      showToast(`Order ${selectedOrder.orderNumber} marked as Dispatched / Shipped!`, 'success');
      if (updated) {
        setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
      }
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to dispatch order', 'error');
    }
  };

  // Quick Dispatch from Table Row modal
  const handleQuickDispatch = async () => {
    if (!dispatchTargetOrder) return;
    try {
      const trackingNo = dispatchLrInput.trim();
      const reason = trackingNo ? `Dispatched via transport: ${trackingNo}` : 'Dispatched to transport office';
      const updated = await api.updateOrderStatus(dispatchTargetOrder.id, 'Shipped', reason, trackingNo || undefined);
      showToast(`Order ${dispatchTargetOrder.orderNumber} marked as Dispatched!`, 'success');
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.id === dispatchTargetOrder.id ? updated : o)));
        if (selectedOrder?.id === dispatchTargetOrder.id) {
          setSelectedOrder(updated);
        }
      }
      setDispatchTargetOrder(null);
      setDispatchLrInput('');
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to dispatch order', 'error');
    }
  };

  // Mark as Delivered
  const handleMarkDelivered = async (orderId?: string) => {
    const targetId = orderId || selectedOrder?.id;
    if (!targetId) return;
    try {
      const updated = await api.updateOrderStatus(targetId, 'Delivered', 'Parcel collected by customer at transport office');
      showToast('Order marked as Delivered!', 'success');
      if (updated) {
        if (selectedOrder?.id === targetId) setSelectedOrder(updated);
        setOrders((prev) => prev.map((o) => (o.id === targetId ? updated : o)));
      }
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to mark as delivered', 'error');
    }
  };

  // Direct confirm from list row
  const handleDirectConfirm = async (order: Order) => {
    try {
      if (order.paymentMethod === 'COD') {
        const updated = await api.updateOrderStatus(order.id, 'Confirmed', 'COD order confirmed by Admin');
        if (updated) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        }
        showToast(`Order ${order.orderNumber} confirmed!`, 'success');
      } else {
        const updated = await api.verifyPayment(order.id, {
          verifiedUtrNumber: order.utrNumber || 'MANUAL-CONFIRM',
          verificationNotes: 'UPI payment verified & confirmed by Admin',
          autoMoveToPacking: false
        });
        if (updated) {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        }
        showToast(`Payment verified — Order ${order.orderNumber} Confirmed!`, 'success');
      }
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Order confirmation failed', 'error');
    }
  };

  // Reject Payment (order detail + confirm queue) — cancels the order
  const handleRejectPayment = async (order: Order) => {
    try {
      const updated = await api.rejectPayment(order.id, verificationNotes || 'Payment proof could not be verified');
      showToast(`Payment rejected — order ${order.orderNumber} cancelled`, 'info');
      setRejectPaymentTarget(null);
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder(updated);
        }
      } else {
        loadData();
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Payment rejection failed', 'error');
      setRejectPaymentTarget(null);
    }
  };

  // ===================== Render =====================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Per-screen header — each sidebar item is its own standalone screen (no cross-screen
          tab bar); the title follows the currently shown section during cross-navigation. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>
              {subTab === 'orders' && (orderStatusTab === 'pending_verification' || searchParams.get('tab') === 'confirm')
                ? 'Order Confirm'
                : SCREEN_HEADERS[subTab].title}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {subTab === 'orders' && (orderStatusTab === 'pending_verification' || searchParams.get('tab') === 'confirm')
              ? 'Review pending customer payments and 1-click confirm orders for fulfillment.'
              : SCREEN_HEADERS[subTab].subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {subTab === 'customers' && !selectedCustomer && (
            <button
              onClick={() => setShowAddCustomer(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          )}
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ============ 1. ORDERS TAB ============ */}
      {subTab === 'orders' && !selectedOrder && (
        <div className="space-y-4">
          {/* Status Tab Bar */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {orderTabs.map((t) => {
              const isActive = orderStatusTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setOrderStatusTab(t.id)}
                  className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center space-x-1.5 ${
                    isActive
                      ? 'border-purple text-purple'
                      : 'border-transparent text-slate-500 hover:text-navy'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        t.alert
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isActive
                          ? 'bg-purple/10 text-purple'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search bar + Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
            <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search order ID, customer, phone, or UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <FiltersButton filters={orderFilters} onChange={setOrderFilters} />
          </div>

          {/* UNIFIED ORDERS LIST */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Proof & UTR</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedOrders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => openOrder(o)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-navy text-xs hover:text-purple">{o.orderNumber}</span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {o.items?.length || 1} item{o.items?.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy text-xs">{o.customerName}</div>
                        <div className="text-[10px] text-slate-400">{o.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3 font-black text-navy">{formatINR(Math.max(0, o.itemsSubtotal - o.discount + (o.tax || 0)))}</td>
                      <td className="py-3 px-3">
                        {o.paymentMethod !== 'COD' ? (
                          <div className="flex items-center gap-2">
                            <OrderProofThumbnail
                              url={o.paymentScreenshotUrl}
                              orderNumber={o.orderNumber}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewerImage({
                                  url: o.paymentScreenshotUrl || '',
                                  title: `Payment Proof - ${o.orderNumber}`,
                                  subtitle: `UTR: ${o.utrNumber || 'N/A'} • ${formatINR(Math.max(0, o.itemsSubtotal - o.discount + (o.tax || 0)))} • ${o.customerName}`,
                                  orderId: o.id,
                                  orderNumber: o.orderNumber,
                                  utrNumber: o.utrNumber
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-navy text-[11px] truncate max-w-[120px]">
                                {o.utrNumber || 'No UTR'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {o.paymentScreenshotUrl ? 'Proof attached' : 'Awaiting proof'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">Cash on Delivery</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={o.orderStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            paymentLabel(o) === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {paymentLabel(o)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(o.placedAtUtc)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          {o.orderStatus === 'Pending' && (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDirectConfirm(o)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1 shadow-xs transition-transform active:scale-95"
                                title="1-Click Approve & Confirm Order"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirm</span>
                              </button>
                              <button
                                onClick={() => setRejectPaymentTarget(o)}
                                className="p-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
                                title="Reject Payment"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {(o.orderStatus === 'Confirmed' || o.orderStatus === 'Processing' || o.orderStatus === 'Packed') && (
                            <button
                              onClick={() => {
                                setDispatchTargetOrder(o);
                                setDispatchLrInput(o.trackingNumber || '');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center space-x-1 shadow-xs transition-transform active:scale-95"
                              title="Enter LR and dispatch order"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </button>
                          )}
                          {o.orderStatus === 'Shipped' && (
                            <button
                              onClick={() => handleMarkDelivered(o.id)}
                              className="px-3 py-1.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-black text-xs flex items-center space-x-1 shadow-xs transition-transform active:scale-95"
                              title="Mark order as delivered"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Delivered</span>
                            </button>
                          )}
                          <button
                            onClick={() => openOrder(o)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-purple hover:bg-purple/5"
                            title="View order details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pagedOrders.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-bold">
                        <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <div>No orders found in this view.</div>
                        {orderStatusTab === 'pending_verification' && (
                          <p className="text-[11px] text-slate-400 font-normal mt-1">All orders have been verified and confirmed!</p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={orderPage}
                pageSize={PAGE_SIZE}
                total={filteredOrders.length}
                onPageChange={setOrderPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============ ORDER DETAIL VIEW (design 03) ============ */}
      {subTab === 'orders' && selectedOrder && (
        <div className="space-y-4">
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-lg font-black text-navy">Order ID: {selectedOrder.orderNumber}</h2>
            <StatusBadge status={selectedOrder.orderStatus} />
            <span className="text-[10px] text-slate-400">
              Placed on {new Date(selectedOrder.placedAtUtc).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Smart Workflow Action Banner */}
          {selectedOrder.orderStatus !== 'Cancelled' && (
            <div className="rounded-2xl border p-4 shadow-2xs transition-all bg-white">
              {selectedOrder.orderStatus === 'Pending' || selectedOrder.paymentStatus !== 'Paid' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60 bg-amber-50/50 -m-4 mb-0 p-4 rounded-t-2xl">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-navy flex items-center gap-2">
                          <span>Action Required: Verify Payment & Confirm</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            {selectedOrder.paymentStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Check customer's UPI screenshot and UTR below. Click "Approve & Confirm Order" to confirm immediately.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setRejectPaymentTarget(selectedOrder)}
                        className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={handleConfirmPayment}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-transform active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Confirm Order</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                    {/* Proof preview with click to zoom lightbox */}
                    <div className="md:col-span-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Payment Proof Screenshot
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setViewerImage({
                              url: selectedOrder.paymentScreenshotUrl || '',
                              title: `Payment Proof - Order #${selectedOrder.orderNumber}`,
                              subtitle: `Customer: ${selectedOrder.customerName}`,
                              orderId: selectedOrder.id,
                              orderNumber: selectedOrder.orderNumber,
                              utrNumber: selectedOrder.utrNumber
                            })
                          }
                          className="text-[11px] font-bold text-purple hover:text-purple-dark flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{selectedOrder.paymentScreenshotUrl ? 'Replace' : 'Upload'}</span>
                        </button>
                      </div>
                      {selectedOrder.paymentScreenshotUrl ? (
                        <OrderDetailsProofPreview
                          url={selectedOrder.paymentScreenshotUrl}
                          orderNumber={selectedOrder.orderNumber}
                          customerName={selectedOrder.customerName}
                          onOpenViewer={() =>
                            setViewerImage({
                              url: normalizeImageUrl(selectedOrder.paymentScreenshotUrl),
                              title: `Payment Proof - Order #${selectedOrder.orderNumber}`,
                              subtitle: `Customer: ${selectedOrder.customerName} • Total: ${formatINR(Math.max(0, selectedOrder.itemsSubtotal - selectedOrder.discount + (selectedOrder.tax || 0)))}`,
                              orderId: selectedOrder.id,
                              orderNumber: selectedOrder.orderNumber,
                              utrNumber: selectedOrder.utrNumber
                            })
                          }
                          onUploadClick={() =>
                            setViewerImage({
                              url: selectedOrder.paymentScreenshotUrl || '',
                              title: `Payment Proof - Order #${selectedOrder.orderNumber}`,
                              subtitle: `Customer: ${selectedOrder.customerName}`,
                              orderId: selectedOrder.id,
                              orderNumber: selectedOrder.orderNumber,
                              utrNumber: selectedOrder.utrNumber
                            })
                          }
                        />
                      ) : (
                        <div
                          onClick={() =>
                            setViewerImage({
                              url: '',
                              title: `Payment Proof - Order #${selectedOrder.orderNumber}`,
                              subtitle: `Customer: ${selectedOrder.customerName}`,
                              orderId: selectedOrder.id,
                              orderNumber: selectedOrder.orderNumber,
                              utrNumber: selectedOrder.utrNumber
                            })
                          }
                          className="h-36 rounded-xl border border-dashed border-purple/30 bg-purple/5 hover:bg-purple/10 flex flex-col items-center justify-center text-purple p-3 text-center cursor-pointer transition"
                        >
                          <Upload className="w-6 h-6 mb-1 text-purple" />
                          <span className="text-xs font-bold">Upload Payment Screenshot</span>
                          <span className="text-[10px] text-slate-500">Click to upload customer proof</span>
                        </div>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="md:col-span-8 flex flex-col justify-between space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-navy mb-1">UTR / Transaction Ref ID</label>
                          <input
                            type="text"
                            value={utrInput}
                            onChange={(e) => setUtrInput(e.target.value)}
                            placeholder="e.g. 423588991204"
                            className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-navy text-xs outline-none focus:border-purple focus:bg-white transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-navy mb-1">Verification Notes</label>
                          <input
                            type="text"
                            value={verificationNotes}
                            onChange={(e) => setVerificationNotes(e.target.value)}
                            placeholder="e.g. Verified in GPay business statement"
                            className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy text-xs outline-none focus:border-purple focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Order Payable Total:</span>
                        <span className="font-black text-sm text-navy">{formatINR(Math.max(0, selectedOrder.itemsSubtotal - selectedOrder.discount + (selectedOrder.tax || 0)))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedOrder.orderStatus === 'Confirmed' || selectedOrder.orderStatus === 'Processing' || selectedOrder.orderStatus === 'Packed' ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-navy">Order Confirmed & Ready for Transport Dispatch</div>
                      <div className="text-xs text-slate-500">
                        Pack the cracker cartons and enter the transport LR or tracking number.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="LR / Tracking # (e.g. VRL-90821)"
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-navy outline-none focus:border-purple focus:bg-white w-52"
                    />
                    <button
                      onClick={handleDispatchOrder}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-blue-600/20 whitespace-nowrap transition-transform active:scale-95"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Mark Dispatched</span>
                    </button>
                  </div>
                </div>
              ) : selectedOrder.orderStatus === 'Shipped' || selectedOrder.orderStatus === 'OutForDelivery' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-navy flex items-center gap-2">
                        <span>Parcel Dispatched / In Transit</span>
                        {selectedOrder.trackingNumber && (
                          <span className="text-[10px] font-mono bg-purple/10 text-purple font-bold px-2 py-0.5 rounded-md">
                            LR #{selectedOrder.trackingNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Customer will collect the parcel at the transport office.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarkDelivered()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 whitespace-nowrap transition-transform active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Delivered</span>
                  </button>
                </div>
              ) : selectedOrder.orderStatus === 'Delivered' ? (
                <div className="flex items-center space-x-3 p-1">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-emerald-800">Order Completed & Delivered</div>
                    <div className="text-xs text-slate-500">Parcel was successfully collected by customer.</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Left: Customer Information + Delivery Address cards | Right: Order Summary (design 03) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-1.5">
                <div className="font-black text-xs text-navy">Customer Information</div>
                <div className="font-bold text-navy text-xs">{selectedOrder.customerName}</div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Phone className="w-3 h-3 text-orange" />
                  <span>{selectedOrder.customerPhone}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Mail className="w-3 h-3 text-purple" />
                  <span>{selectedOrder.customerEmail}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-1.5">
                <div className="font-black text-xs text-navy">Delivery Address</div>
                <div className="flex items-start space-x-1.5 text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-navy">{selectedOrder.customerName}</div>
                    <div>{selectedOrder.shippingAddress?.addressLine1}</div>
                    {selectedOrder.shippingAddress?.addressLine2 && <div>{selectedOrder.shippingAddress.addressLine2}</div>}
                    <div>
                      {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} -{' '}
                      {selectedOrder.shippingAddress?.postalCode}
                    </div>
                    <div>Ph. {selectedOrder.customerPhone}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 h-fit">
              <div className="font-black text-xs text-navy mb-3">Order Summary</div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Order Date</span>
                  <span className="font-bold text-navy">{formatDate(selectedOrder.placedAtUtc)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-bold text-navy">
                    {selectedOrder.paymentMethod === 'UPI' ? 'UPI / Google Pay' : selectedOrder.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Status</span>
                  <StatusBadge status={selectedOrder.paymentStatus} type="payment" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Delivery Method</span>
                  <span className="font-bold text-navy">Standard Transport Delivery</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Order Status</span>
                  {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).length > 0 ? (
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as OrderStatus | '')}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy text-xs font-bold outline-none focus:border-purple"
                    >
                      <option value="">{selectedOrder.orderStatus} (current)</option>
                      {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={selectedOrder.orderStatus} />
                  )}
                </div>
                {selectedOrder.trackingNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tracking #</span>
                    <span className="font-mono font-bold text-navy">{selectedOrder.trackingNumber}</span>
                  </div>
                )}
                {selectedOrder.utrNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">UTR / Reference</span>
                    <span className="font-mono font-bold text-navy">{selectedOrder.utrNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items + Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 pt-4 pb-2 font-black text-xs text-navy">Items</div>
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-5">Product</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-5">
                        <div className="flex items-center space-x-2.5">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt={it.productName} className="w-8 h-8 rounded-lg object-cover border border-slate-100" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag className="w-3.5 h-3.5 text-orange" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-navy">{it.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">{formatINR(it.unitPrice)}</td>
                      <td className="py-3 px-3">{it.quantity}</td>
                      <td className="py-3 px-5 text-right font-black text-navy">{formatINR(it.lineTotal)}</td>
                    </tr>
                  ))}
                  {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">
                        Line items unavailable for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 h-fit">
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-navy">{formatINR(selectedOrder.itemsSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className={`font-bold ${selectedOrder.discount > 0 ? 'text-emerald-600' : 'text-navy'}`}>
                    {selectedOrder.discount > 0 ? `-${formatINR(selectedOrder.discount)}` : formatINR(0)}
                  </span>
                </div>
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (GST)</span>
                    <span className="font-bold text-navy">{formatINR(selectedOrder.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Delivery Charges</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-bold border border-emerald-200">
                    ₹0 (Transport To-Pay)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-slate-200 flex justify-between font-black text-sm text-navy">
                  <span>Total Amount</span>
                  <span className="text-orange">
                    {formatINR(Math.max(0, selectedOrder.itemsSubtotal - selectedOrder.discount + (selectedOrder.tax || 0)))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Timeline (design 03) */}
          {(() => {
            const { steps, cancelled } = buildTimeline(selectedOrder);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                <div className="font-black text-xs text-navy mb-5">Order Timeline</div>
                {cancelled && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center space-x-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Order Cancelled
                      {cancelled.changedAtUtc ? ` on ${formatDateTime(cancelled.changedAtUtc)}` : ''}
                      {cancelled.reason ? ` — ${cancelled.reason}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex overflow-x-auto">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex-1 min-w-24 relative flex flex-col items-center text-center">
                      {i > 0 && (
                        <div
                          className={`absolute top-[11px] right-1/2 w-full h-0.5 ${
                            s.done && !cancelled ? 'bg-emerald-300' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <div
                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          s.done && !cancelled
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : s.done
                            ? 'bg-slate-400 border-slate-400 text-white'
                            : 'bg-white border-slate-300 text-slate-300'
                        }`}
                      >
                        {s.done ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                      </div>
                      <div className={`mt-2 text-xs font-bold ${s.done ? 'text-navy' : 'text-slate-400'}`}>{s.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {s.timestamp ? formatDateTime(s.timestamp) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Footer buttons (design 03): Back | Print Invoice | Cancel Order | Update Status */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              onClick={closeOrderDetail}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              onClick={() => handlePrintInvoice(selectedOrder)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-navy text-xs font-bold hover:bg-slate-50 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-purple" />
              <span>Print Invoice</span>
            </button>
            {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).includes('Cancelled') && (
              <button
                onClick={() => setCancelOrderTarget(selectedOrder)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Order</span>
              </button>
            )}
            {(NEXT_TRANSITIONS[selectedOrder.orderStatus] ?? []).length > 0 && (
              <button
                onClick={() => statusDraft && handleUpdateStatus(selectedOrder.id, statusDraft)}
                disabled={!statusDraft}
                className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-xs ${
                  statusDraft
                    ? 'bg-purple hover:bg-purple-dark text-white'
                    : 'bg-purple/40 text-white cursor-not-allowed'
                }`}
                title={statusDraft ? `Set status to ${statusDraft}` : 'Select a new status in Order Summary first'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Update Status</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============ 2. CUSTOMERS CRM TAB (design 11) ============ */}
      {subTab === 'customers' && !selectedCustomer && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center space-x-2 w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer name, phone or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Orders</th>
                    <th className="py-3 px-3">Total Spent</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple/10 text-purple flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {(c.name || 'C')
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="font-bold text-navy text-xs">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">{c.phone}</td>
                      <td className="py-3 px-3 text-slate-500">{c.email}</td>
                      <td className="py-3 px-3 font-bold text-purple">{c.totalOrders}</td>
                      <td className="py-3 px-3 font-black text-navy">{formatINR(c.lifetimeValue)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                      </td>
                    </tr>
                  ))}
                  {pagedCustomers.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold">
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={customerPage}
                pageSize={PAGE_SIZE}
                total={filteredCustomers.length}
                onPageChange={setCustomerPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============ CUSTOMER DETAIL VIEW ============ */}
      {subTab === 'customers' && selectedCustomer && (
        <div className="space-y-4">
          <button
            onClick={closeCustomerDetail}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-purple text-xs font-bold hover:bg-purple/5 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customers</span>
          </button>

          {isCustomerLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center text-xs font-bold text-slate-400">
              Loading customer profile...
            </div>
          ) : (
            <>
              {/* Profile header */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple/10 text-purple flex items-center justify-center font-black text-lg flex-shrink-0">
                  {(selectedCustomer.name || 'C')
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h2 className="text-base font-black text-navy">{selectedCustomer.name}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedCustomer.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {selectedCustomer.status}
                    </span>
                    {selectedCustomer.customerCode && (
                      <span className="text-[10px] font-mono text-slate-400">{selectedCustomer.customerCode}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center space-x-1.5">
                      <Phone className="w-3 h-3 text-orange" />
                      <span>{selectedCustomer.phone || '—'}</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <Mail className="w-3 h-3 text-purple" />
                      <span>{selectedCustomer.email || '—'}</span>
                    </span>
                    <span className="text-slate-400">Member since {formatDate(selectedCustomer.createdAtUtc)}</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Orders</div>
                  <div className="text-2xl font-black text-purple mt-1">
                    {selectedCustomer.totalOrders || customerOrders.length}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Spent</div>
                  <div className="text-2xl font-black text-navy mt-1">{formatINR(selectedCustomer.lifetimeValue)}</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reward Points</div>
                  <div className="text-2xl font-black text-orange mt-1">{selectedCustomer.rewardPoints ?? 0}</div>
                </div>
              </div>

              {/* Addresses + Order history */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                  <div className="font-black text-xs text-navy mb-3">Saved Addresses</div>
                  {(selectedCustomer.addresses || []).length === 0 ? (
                    <p className="text-xs text-slate-400 font-bold">No saved addresses.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(selectedCustomer.addresses || []).map((addr, idx) => (
                        <div key={addr.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-navy">{addr.label || addr.fullName || `Address ${idx + 1}`}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple/10 text-purple">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-slate-600 leading-relaxed">
                            <div>{addr.addressLine1}</div>
                            {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                            <div>
                              {addr.city}
                              {addr.state ? `, ${addr.state}` : ''} - {addr.postalCode || addr.pincode || ''}
                            </div>
                            {addr.phone && <div className="text-slate-400">Ph. {addr.phone}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 pt-4 pb-2 font-black text-xs text-navy">Order History</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-5">Order ID</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-5">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {customerOrders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => openOrderById(o.id)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-5 font-mono font-bold text-purple">{o.orderNumber}</td>
                            <td className="py-3 px-3 text-slate-500">{formatDate(o.placedAtUtc)}</td>
                            <td className="py-3 px-3 font-black text-navy">{formatINR(o.grandTotal)}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={o.orderStatus} />
                            </td>
                            <td className="py-3 px-5 font-bold text-slate-600">{paymentLabel(o)}</td>
                          </tr>
                        ))}
                        {customerOrders.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                              No orders placed yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ 3. TAX INVOICES TAB ============ */}
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
                    <td className="py-3 px-3">{formatINR(inv.subtotal)}</td>
                    <td className="py-3 px-3">{formatINR(inv.tax)}</td>
                    <td className="py-3 px-3 font-black text-navy">{formatINR(inv.grandTotal)}</td>
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

      {/* ============ 5. PAYMENTS TAB (design 15) ============ */}
      {subTab === 'payments' && (
        <div className="space-y-4">
          {/* Status tab bar: All | Received | Pending — internal to the Payments screen */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {paymentTabs.map((t) => {
              const isActive = paymentTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPaymentTab(t.id)}
                  className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive ? 'border-purple text-purple' : 'border-transparent text-slate-500 hover:text-navy'
                  }`}
                >
                  {t.label}{' '}
                  {t.count > 0 && <span className={isActive ? 'text-purple' : 'text-slate-400'}>({t.count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search + Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2">
            <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search payment ID or order ID..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <FiltersButton filters={paymentFilters} onChange={setPaymentFilters} />
          </div>

          {/* Payments table: Payment ID / Order ID / Customer / Amount / Method / Status / Date */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy">{pay.paymentNumber}</td>
                      <td className="py-3 px-3 font-mono text-purple">{pay.orderNumber || '—'}</td>
                      <td className="py-3 px-3 font-bold">{pay.customerName}</td>
                      <td className="py-3 px-3 font-black text-navy">{formatINR(pay.amount)}</td>
                      <td className="py-3 px-3 font-bold text-slate-600">{pay.paymentMethod}</td>
                      <td className="py-3 px-3">
                        <PaymentStatusPill status={pay.paymentStatus} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(pay.paidAtUtc)}</td>
                    </tr>
                  ))}
                  {pagedPayments.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-xs font-bold">
                        No payments match this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={paymentPage}
                pageSize={PAGE_SIZE}
                total={filteredPayments.length}
                onPageChange={setPaymentPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT CONFIRM DIALOG */}
      <ErpConfirmDialog
        open={!!rejectPaymentTarget}
        title="Reject Payment?"
        message={
          rejectPaymentTarget ? (
            <>
              This will reject the submitted payment proof for order{' '}
              <span className="font-mono font-bold text-navy">{rejectPaymentTarget.orderNumber}</span> and cancel the
              order. The customer will need to place a fresh order.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Reject Payment"
        onConfirm={() => rejectPaymentTarget && handleRejectPayment(rejectPaymentTarget)}
        onCancel={() => setRejectPaymentTarget(null)}
      />

      {/* CANCEL ORDER CONFIRM DIALOG (design 03 footer) */}
      <ErpConfirmDialog
        open={!!cancelOrderTarget}
        title="Cancel Order?"
        message={
          cancelOrderTarget ? (
            <>
              Order <span className="font-mono font-bold text-navy">{cancelOrderTarget.orderNumber}</span> will be
              cancelled and any reserved stock released. This action cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        onConfirm={() => {
          if (cancelOrderTarget) {
            handleUpdateStatus(cancelOrderTarget.id, 'Cancelled');
            setCancelOrderTarget(null);
          }
        }}
        onCancel={() => setCancelOrderTarget(null)}
      />

      {/* ADD CUSTOMER MODAL (design 08) */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-sm text-navy">Add Customer</h3>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="text-slate-400 hover:text-slate-600"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500">Full Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Arun Kumar"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Phone *</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                  placeholder="e.g. arun@example.com"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowAddCustomer(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={isSavingCustomer}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs ${
                  isSavingCustomer ? 'bg-purple/50 cursor-not-allowed' : 'bg-purple hover:bg-purple-dark'
                }`}
              >
                {isSavingCustomer ? 'Saving...' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE TAX INVOICE MODAL */}
      {selectedInvoice && (() => {
        const invOrder = orders.find(
          (o) => o.orderNumber === selectedInvoice.orderNumber || o.id === selectedInvoice.orderId
        );
        const printableOrder: Order = invOrder || {
          id: selectedInvoice.orderId || selectedInvoice.id,
          orderNumber: selectedInvoice.orderNumber || selectedInvoice.invoiceNumber,
          customerId: selectedInvoice.customerId,
          customerName: selectedInvoice.customerName,
          customerEmail: '',
          customerPhone: '',
          orderStatus: 'Delivered',
          paymentStatus: 'Paid',
          paymentMethod: 'UPI',
          fulfillmentStatus: 'Delivered',
          itemsSubtotal: selectedInvoice.subtotal,
          discount: selectedInvoice.discount || 0,
          tax: selectedInvoice.tax || 0,
          shippingCharge: selectedInvoice.shipping || 0,
          grandTotal: selectedInvoice.grandTotal,
          placedAtUtc: selectedInvoice.issuedAtUtc,
          shippingAddress: {
            fullName: selectedInvoice.customerName,
            phone: '',
            addressLine1: 'Sivakasi Delivery',
            city: 'Sivakasi',
            state: 'Tamil Nadu',
            postalCode: '626123',
            country: 'India'
          },
          items: invOrder?.items || [],
          statusHistories: []
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="font-black text-base text-navy">AADHI CRACKERS</div>
                  <span className="text-[10px] font-mono bg-purple/10 text-purple px-2.5 py-0.5 rounded-full font-bold">
                    ESTIMATE / INVOICE #{selectedInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintInvoice(printableOrder)}
                    className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Close"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Formatted Reference Invoice Live Preview */}
              <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 min-h-[440px]">
                <iframe
                  title={`Invoice ${selectedInvoice.invoiceNumber}`}
                  srcDoc={buildOrderInvoiceHtml(printableOrder)}
                  className="w-full h-full border-none bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                <span>GSTIN: 33ABCDE1234F1Z5 • Sivakasi, Tamil Nadu</span>
                <span className="font-bold text-navy">Total: {formatINR(selectedInvoice.grandTotal)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUICK DISPATCH MODAL */}
      {dispatchTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-navy">Dispatch Order #{dispatchTargetOrder.orderNumber}</h3>
                  <p className="text-[11px] text-slate-500">Enter lorry transport LR / tracking details</p>
                </div>
              </div>
              <button
                onClick={() => setDispatchTargetOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy mb-1">Customer</label>
                <div className="p-2.5 bg-slate-50 rounded-xl text-slate-700">
                  <span className="font-bold text-navy">{dispatchTargetOrder.customerName}</span> • {dispatchTargetOrder.customerPhone}
                </div>
              </div>

              <div>
                <label className="block font-bold text-navy mb-1">Transport Lorry / LR Number (Optional)</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. VRL-90821 or Rathimeena LR-442"
                  value={dispatchLrInput}
                  onChange={(e) => setDispatchLrInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-navy outline-none focus:border-purple"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Customer will see this LR number on their order tracking page.
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDispatchTargetOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickDispatch}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-blue-600/20"
              >
                <Truck className="w-4 h-4" />
                <span>Confirm Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX IMAGE VIEWER MODAL */}
      <ImageViewerModal
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
        imageUrl={viewerImage?.url}
        title={viewerImage?.title}
        subtitle={viewerImage?.subtitle}
        orderId={viewerImage?.orderId}
        orderNumber={viewerImage?.orderNumber}
        utrNumber={viewerImage?.utrNumber}
        onScreenshotUpdated={(newUrl) => {
          if (selectedOrder && viewerImage?.orderId === selectedOrder.id) {
            setSelectedOrder({ ...selectedOrder, paymentScreenshotUrl: newUrl });
          }
          setOrders((prev) =>
            prev.map((o) => (o.id === viewerImage?.orderId ? { ...o, paymentScreenshotUrl: newUrl } : o))
          );
          showToast('Payment proof screenshot saved and updated successfully!', 'success');
        }}
      />
    </div>
  );
};
