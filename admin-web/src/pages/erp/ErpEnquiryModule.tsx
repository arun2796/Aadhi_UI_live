import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MessageSquare,
  FilePlus2,
  Users,
  Search,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Tag,
  StickyNote,
  Trash2,
  FileDown,
  Plus,
  X,
  Check
} from 'lucide-react';
import { Product } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import {
  enquiryApi,
  Enquiry,
  EnquiryCustomer,
  EnquiryPayload,
  EnquirySource,
  EnquiryStatus,
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES
} from '../../services/enquiryApi';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';

interface ErpEnquiryModuleProps {
  initialSubTab?: string; // 'enquiries' | 'direct' | 'customers'
}

type SubTab = 'enquiries' | 'direct' | 'customers';
type StatusTab = 'all' | EnquiryStatus;

const PAGE_SIZE = 10;

const formatINR = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : '—';

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]
  );

const itemsCount = (e: Enquiry) => e.items?.length ?? e.itemCount ?? 0;

/** Status pill per design: New amber, Contacted blue, Quoted indigo, Converted green, Closed red. */
const EnquiryStatusPill: React.FC<{ status: EnquiryStatus | string }> = ({ status }) => {
  const styles: Record<string, string> = {
    New: 'bg-amber-50 text-amber-700 border border-amber-200',
    Contacted: 'bg-blue-50 text-blue-700 border border-blue-200',
    Quoted: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    Converted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Closed: 'bg-red-50 text-red-700 border border-red-200'
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-slate-50 text-slate-600 border border-slate-200'
      }`}
    >
      {status}
    </span>
  );
};

/** Clean printable quotation for an enquiry — opened in a new window, then window.print()
    (mirrors the invoice-print pattern in ErpSalesAndOrdersModule). */
const buildQuotationHtml = (e: Enquiry): string => {
  const items = e.items || [];
  const total = items.reduce(
    (sum, it) => sum + (it.quotedPrice ?? it.expectedPrice ?? 0) * (it.quantity || 0),
    0
  );

  const rows = items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.productName)}${it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : ''}</td>
        <td class="num">${it.quantity ?? 0}</td>
        <td class="num">${it.expectedPrice != null ? formatINR(it.expectedPrice) : '&mdash;'}</td>
        <td class="num">${it.quotedPrice != null ? formatINR(it.quotedPrice) : '&mdash;'}</td>
        <td class="num">${formatINR((it.quotedPrice ?? it.expectedPrice ?? 0) * (it.quantity || 0))}</td>
      </tr>`
    )
    .join('');

  const contactLines = [
    e.phone ? `Ph. ${escapeHtml(e.phone)}` : '',
    e.email ? escapeHtml(e.email) : '',
    e.address ? escapeHtml(e.address) : ''
  ]
    .filter(Boolean)
    .join('<br />');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quotation ${escapeHtml(e.enquiryNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 36px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4F2ACB; padding-bottom: 16px; }
  .brand { font-size: 24px; font-weight: 800; color: #111238; letter-spacing: 1px; }
  .brand small { display: block; font-size: 10px; color: #64748b; font-weight: 600; letter-spacing: 2px; margin-top: 4px; }
  .q-label { text-align: right; }
  .q-label h2 { margin: 0; color: #4F2ACB; font-size: 20px; letter-spacing: 3px; }
  .q-label div { margin-top: 6px; color: #64748b; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; gap: 24px; }
  .meta div { line-height: 1.8; }
  .label { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #111238; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 12px; }
  th.num { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .note { font-size: 11px; color: #64748b; margin-top: 2px; }
  .totals { margin-top: 16px; margin-left: auto; width: 300px; }
  .totals .grand { display: flex; justify-content: space-between; border-top: 2px solid #111238; padding-top: 8px; font-weight: 800; font-size: 15px; color: #111238; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 14px; line-height: 1.7; }
  .footer strong { color: #64748b; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">AADHI CRACKERS<small>PREMIUM SIVAKASI FIREWORKS &middot; QUOTATION</small></div>
    <div class="q-label">
      <h2>QUOTATION</h2>
      <div>${escapeHtml(e.enquiryNumber || '—')}</div>
    </div>
  </div>
  <div class="meta">
    <div>
      <div class="label">Prepared For</div>
      <div><strong>${escapeHtml(e.customerName)}</strong></div>
      <div>${contactLines || '&mdash;'}</div>
    </div>
    <div>
      <div><span class="label">Enquiry No:</span> <strong>${escapeHtml(e.enquiryNumber || '—')}</strong></div>
      <div><span class="label">Enquiry Date:</span> ${escapeHtml(formatDate(e.createdAt))}</div>
      <div><span class="label">Source:</span> ${escapeHtml(e.source || '—')}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th>Product</th>
        <th class="num">Qty</th>
        <th class="num">Expected Price</th>
        <th class="num">Quoted Price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No items on this enquiry</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="grand"><span>Quotation Total</span><span>${formatINR(total)}</span></div>
  </div>
  <div class="footer">
    <strong>This is a quotation, not an invoice.</strong> Prices are indicative and valid for 15 days.<br />
    AADHI CRACKERS &middot; Sivakasi, Tamil Nadu
  </div>
</body>
</html>`;
};

/** Draft row for the Direct Enquiry items list. */
interface DraftItemRow {
  key: number;
  productId: string; // '' = free-text / custom item
  productName: string;
  quantity: string;
  expectedPrice: string;
}

let draftRowKey = 0;

const newDraftRow = (): DraftItemRow => ({
  key: ++draftRowKey,
  productId: '',
  productName: '',
  quantity: '1',
  expectedPrice: ''
});

const EMPTY_FORM = {
  customerName: '',
  phone: '',
  email: '',
  address: '',
  source: 'Direct' as EnquirySource,
  notes: ''
};

export const ErpEnquiryModule: React.FC<ErpEnquiryModuleProps> = ({ initialSubTab = 'enquiries' }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();
  const routeId =
    routeParams.id && routeParams.id !== 'direct' && routeParams.id !== 'customers' ? routeParams.id : undefined;

  const normalizeTab = (t?: string): SubTab =>
    t === 'direct' || t === 'customers' ? t : 'enquiries';

  const [subTab, setSubTab] = useState<SubTab>(normalizeTab(initialSubTab));

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [enquiryCustomers, setEnquiryCustomers] = useState<EnquiryCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ENQUIRY LIST — filters + detail
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  // DETAIL — inline quoted-price drafts + confirms
  const [quoteDrafts, setQuoteDrafts] = useState<string[]>([]);
  const [isSavingQuotes, setIsSavingQuotes] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EnquiryStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);

  // DIRECT ENQUIRY — form state + product picker
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formItems, setFormItems] = useState<DraftItemRow[]>([newDraftRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // ENQUIRY CUSTOMERS
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);

  // ===================== Data loading =====================

  const loadData = async () => {
    setIsLoading(true);
    const [enqRes, custRes] = await Promise.allSettled([
      enquiryApi.getEnquiries({ pageSize: 500 }),
      enquiryApi.getEnquiryCustomers()
    ]);
    if (enqRes.status === 'fulfilled') setEnquiries(enqRes.value.items);
    if (custRes.status === 'fulfilled') setEnquiryCustomers(custRes.value);
    if (enqRes.status === 'rejected' || custRes.status === 'rejected') {
      const reason = enqRes.status === 'rejected' ? enqRes.reason : (custRes as PromiseRejectedResult).reason;
      const { message } = getApiErrorDetails(reason);
      showToast(message || 'Failed to load enquiries', 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the sub-tab in sync when navigation swaps the route (/direct, /customers, list)
  useEffect(() => {
    setSubTab(normalizeTab(initialSubTab));
  }, [initialSubTab]);

  // /admin/enquiries/:id deep link — open the enquiry detail directly
  useEffect(() => {
    if (routeId) {
      openEnquiryById(routeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Lazy-load products the first time the Direct Enquiry tab is opened (for the item picker)
  useEffect(() => {
    if (subTab !== 'direct' || productsLoaded) return;
    api
      .getProducts({ pageSize: 500 })
      .then((res) => {
        setProducts([...res]);
        setProductsLoaded(true);
      })
      .catch(() => {
        // Picker degrades to free-text item names — no need to block the form.
        setProductsLoaded(true);
      });
  }, [subTab, productsLoaded]);

  // Reset pagination when list filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusTab]);
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);

  // Re-seed the quoted-price drafts whenever a different enquiry (or fresher items) is shown
  useEffect(() => {
    setQuoteDrafts((selectedEnquiry?.items || []).map((it) => (it.quotedPrice != null ? String(it.quotedPrice) : '')));
    setPendingStatus(null);
  }, [selectedEnquiry?.id, selectedEnquiry?.items]);

  // ===================== Derived data =====================

  const filteredEnquiries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return enquiries.filter((e) => {
      const matchesSearch =
        !q ||
        (e.enquiryNumber || '').toLowerCase().includes(q) ||
        (e.customerName || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(searchQuery.trim());
      const matchesTab = statusTab === 'all' || e.status === statusTab;
      return matchesSearch && matchesTab;
    });
  }, [enquiries, searchQuery, statusTab]);

  const pagedEnquiries = filteredEnquiries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusTabs: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: enquiries.length },
    ...ENQUIRY_STATUSES.map((s) => ({
      id: s as StatusTab,
      label: s,
      count: enquiries.filter((e) => e.status === s).length
    }))
  ];

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    return enquiryCustomers.filter(
      (c) =>
        !q ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(customerSearch.trim()) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [enquiryCustomers, customerSearch]);

  const pagedCustomers = filteredCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);

  const quotesDirty = useMemo(() => {
    const items = selectedEnquiry?.items || [];
    return quoteDrafts.some((d, i) => {
      const orig = items[i]?.quotedPrice;
      return d !== (orig != null ? String(orig) : '');
    });
  }, [quoteDrafts, selectedEnquiry?.items]);

  // ===================== Handlers =====================

  const openEnquiry = (e: Enquiry) => {
    setSelectedEnquiry(e);
    // Hydrate with the full detail (items) in the background
    enquiryApi
      .getEnquiryById(e.id)
      .then((full) => {
        if (full && full.id) {
          setSelectedEnquiry((prev) => (prev && prev.id === e.id ? full : prev));
        }
      })
      .catch(() => {});
  };

  const openEnquiryById = async (id: string) => {
    try {
      const full = await enquiryApi.getEnquiryById(id);
      if (full && full.id) {
        setSubTab('enquiries');
        setSelectedEnquiry(full);
      } else {
        showToast('Enquiry not found', 'warning');
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load enquiry details', 'error');
    }
  };

  const closeDetail = () => {
    setSelectedEnquiry(null);
    if (routeId) {
      navigate('/admin/enquiries');
    }
  };

  const handleSubTabClick = (id: SubTab) => {
    setSubTab(id);
    if (id === 'enquiries' && selectedEnquiry) {
      closeDetail();
    }
  };

  /** Builds the full PUT payload for the selected enquiry (contract: PUT replaces the enquiry). */
  const buildUpdatePayload = (e: Enquiry, items: EnquiryPayload['items']): EnquiryPayload => ({
    customerName: e.customerName,
    phone: e.phone,
    email: e.email || undefined,
    address: e.address || undefined,
    source: e.source,
    notes: e.notes || undefined,
    items
  });

  /** Saves the inline-edited quoted prices via PUT /enquiries/{id}. */
  const handleSaveQuotedPrices = async () => {
    if (!selectedEnquiry) return;
    const items: EnquiryPayload['items'] = (selectedEnquiry.items || []).map((it, i) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      expectedPrice: it.expectedPrice,
      quotedPrice:
        quoteDrafts[i] !== undefined && quoteDrafts[i] !== '' && !Number.isNaN(Number(quoteDrafts[i]))
          ? Number(quoteDrafts[i])
          : undefined,
      note: it.note
    }));
    setIsSavingQuotes(true);
    try {
      const updated = await enquiryApi.updateEnquiry(selectedEnquiry.id, buildUpdatePayload(selectedEnquiry, items));
      const next: Enquiry =
        updated && updated.id
          ? { ...selectedEnquiry, ...updated }
          : { ...selectedEnquiry, items: items.map((it) => ({ ...it })) };
      setSelectedEnquiry(next);
      setEnquiries((prev) => prev.map((e) => (e.id === next.id ? { ...e, ...next } : e)));
      showToast('Quoted prices saved', 'success');
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to save quoted prices', 'error');
    } finally {
      setIsSavingQuotes(false);
    }
  };

  /** Confirms the status change picked in the dropdown — PUT /enquiries/{id}/status. */
  const handleConfirmStatusChange = async () => {
    if (!selectedEnquiry || !pendingStatus) return;
    const target = pendingStatus;
    try {
      const updated = await enquiryApi.updateEnquiryStatus(
        selectedEnquiry.id,
        target,
        `Status changed to ${target} via Admin ERP`
      );
      const next: Enquiry =
        updated && updated.id ? { ...selectedEnquiry, ...updated } : { ...selectedEnquiry, status: target };
      setSelectedEnquiry(next);
      setEnquiries((prev) => prev.map((e) => (e.id === next.id ? { ...e, status: next.status } : e)));
      showToast(`Enquiry marked as ${target}`, 'success');
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to update enquiry status', 'error');
    } finally {
      setPendingStatus(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await enquiryApi.deleteEnquiry(target.id);
      setEnquiries((prev) => prev.filter((e) => e.id !== target.id));
      showToast(`Enquiry ${target.enquiryNumber} deleted`, 'success');
      setDeleteTarget(null);
      if (selectedEnquiry?.id === target.id) {
        closeDetail();
      }
      // Enquiry counts per customer changed — refresh the aggregate quietly.
      enquiryApi
        .getEnquiryCustomers()
        .then(setEnquiryCustomers)
        .catch(() => {});
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to delete enquiry', 'error');
      setDeleteTarget(null);
    }
  };

  /** Download PDF — opens a printable quotation window and triggers window.print(). */
  const handleDownloadPdf = (e: Enquiry) => {
    const w = window.open('', '_blank', 'width=820,height=940');
    if (!w) {
      showToast('Please allow pop-ups to download the quotation.', 'warning');
      return;
    }
    w.document.write(buildQuotationHtml(e));
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

  // ---------- Direct Enquiry form ----------

  const handleRowProductSelect = (key: number, productId: string) => {
    setFormItems((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r;
        if (!productId) return { ...r, productId: '', productName: '' };
        const p = products.find((x) => x.id === productId);
        return {
          ...r,
          productId,
          productName: p?.name || r.productName,
          expectedPrice: r.expectedPrice === '' && p ? String(p.price) : r.expectedPrice
        };
      })
    );
  };

  const updateRow = (key: number, patch: Partial<DraftItemRow>) => {
    setFormItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: number) => {
    setFormItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setFormItems([newDraftRow()]);
  };

  const handleSaveEnquiry = async () => {
    const name = form.customerName.trim();
    const phone = form.phone.trim();
    if (!name) {
      showToast('Customer name is required', 'warning');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      showToast('Enter a valid 10-digit phone number', 'warning');
      return;
    }
    const items: EnquiryPayload['items'] = formItems
      .filter((r) => r.productName.trim() && Number(r.quantity) > 0)
      .map((r) => ({
        productId: r.productId || undefined,
        productName: r.productName.trim(),
        quantity: Math.floor(Number(r.quantity)),
        expectedPrice:
          r.expectedPrice !== '' && !Number.isNaN(Number(r.expectedPrice)) ? Number(r.expectedPrice) : undefined
      }));
    if (items.length === 0) {
      showToast('Add at least one item with a product name and quantity', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const created = await enquiryApi.createEnquiry({
        customerName: name,
        phone,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        source: form.source,
        notes: form.notes.trim() || undefined,
        items
      });
      showToast(`Enquiry ${created?.enquiryNumber || ''} saved`.replace('  ', ' ').trim(), 'success');
      resetForm();
      loadData();
      setSubTab('enquiries');
      if (created?.id) {
        setSelectedEnquiry(created);
        navigate(`/admin/enquiries/${created.id}`);
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to save enquiry', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Enquiry Customers ----------

  const filterListByCustomer = (c: EnquiryCustomer) => {
    setSelectedEnquiry(null);
    setStatusTab('all');
    setSearchQuery(c.phone);
    setSubTab('enquiries');
    if (routeId) {
      navigate('/admin/enquiries');
    }
  };

  // ===================== Render =====================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight">Enquiries</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track walk-in, phone and website product enquiries, prepare quotations, and convert leads into orders.
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
          { id: 'enquiries' as SubTab, label: `Enquiry (${enquiries.length})`, icon: MessageSquare },
          { id: 'direct' as SubTab, label: 'Direct Enquiry', icon: FilePlus2 },
          { id: 'customers' as SubTab, label: `Enquiry Customers (${enquiryCustomers.length})`, icon: Users }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSubTabClick(tab.id)}
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

      {/* ============ 1. ENQUIRY LIST ============ */}
      {subTab === 'enquiries' && !selectedEnquiry && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-navy">Enquiries</h2>

          {/* Status Tab Bar */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {statusTabs.map((t) => {
              const isActive = statusTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setStatusTab(t.id)}
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

          {/* Search bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center space-x-2 w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search enquiry no, name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-navy" title="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Enquiries table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Enquiry No</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedEnquiries.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => openEnquiry(e)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-navy text-xs">{e.enquiryNumber}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy text-xs">{e.customerName}</div>
                        {e.email && <div className="text-[10px] text-slate-400">{e.email}</div>}
                      </td>
                      <td className="py-3 px-3">{e.phone}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {e.source}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-purple">{itemsCount(e)}</td>
                      <td className="py-3 px-3">
                        <EnquiryStatusPill status={e.status} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(e.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                      </td>
                    </tr>
                  ))}
                  {pagedEnquiries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 text-xs font-bold">
                        {isLoading ? 'Loading enquiries...' : 'No enquiries match this view.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={filteredEnquiries.length} onPageChange={setPage} />
            </div>
          </div>
        </div>
      )}

      {/* ============ 2. ENQUIRY DETAIL ============ */}
      {subTab === 'enquiries' && selectedEnquiry && (
        <div className="space-y-4">
          <button
            onClick={closeDetail}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-purple text-xs font-bold hover:bg-purple/5 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Enquiries</span>
          </button>

          {/* Header: number + status pill + status dropdown + delete */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-3">
              <h2 className="text-lg font-black text-navy">Enquiry {selectedEnquiry.enquiryNumber}</h2>
              <EnquiryStatusPill status={selectedEnquiry.status} />
              <span className="text-[10px] text-slate-400">Created {formatDateTime(selectedEnquiry.createdAt)}</span>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && setPendingStatus(e.target.value as EnquiryStatus)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-navy text-xs font-bold outline-none focus:border-purple shadow-2xs"
                title="Change enquiry status"
              >
                <option value="">Change Status...</option>
                {ENQUIRY_STATUSES.filter((s) => s !== selectedEnquiry.status).map((s) => (
                  <option key={s} value={s}>
                    Mark as {s}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDownloadPdf(selectedEnquiry)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setDeleteTarget(selectedEnquiry)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Contact card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
            <div className="font-black text-xs text-navy mb-3">Customer Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-slate-600">
              <div className="font-bold text-navy">{selectedEnquiry.customerName}</div>
              <div className="flex items-center space-x-1.5">
                <Tag className="w-3 h-3 text-purple flex-shrink-0" />
                <span>
                  Source: <span className="font-bold text-navy">{selectedEnquiry.source}</span>
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Phone className="w-3 h-3 text-orange flex-shrink-0" />
                <span>{selectedEnquiry.phone || '—'}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3 h-3 text-purple flex-shrink-0" />
                <span>{selectedEnquiry.email || '—'}</span>
              </div>
              <div className="flex items-start space-x-1.5 sm:col-span-2">
                <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <span>{selectedEnquiry.address || 'No address provided'}</span>
              </div>
              {selectedEnquiry.notes && (
                <div className="flex items-start space-x-1.5 sm:col-span-2 pt-1 border-t border-slate-100">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="italic">{selectedEnquiry.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items table with inline-editable quoted prices */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="font-black text-xs text-navy">Enquiry Items</div>
              {quotesDirty && (
                <button
                  onClick={handleSaveQuotedPrices}
                  disabled={isSavingQuotes}
                  className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs ${
                    isSavingQuotes ? 'bg-purple/40 text-white cursor-not-allowed' : 'bg-purple hover:bg-purple-dark text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingQuotes ? 'Saving...' : 'Save Quoted Prices'}</span>
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-5">Product</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3">Expected ₹</th>
                    <th className="py-2 px-5">Quoted ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(selectedEnquiry.items || []).map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-3 px-5">
                        <div className="font-bold text-navy">{it.productName}</div>
                        {it.note && <div className="text-[10px] text-slate-400">{it.note}</div>}
                      </td>
                      <td className="py-3 px-3">{it.quantity}</td>
                      <td className="py-3 px-3">{it.expectedPrice != null ? formatINR(it.expectedPrice) : '—'}</td>
                      <td className="py-3 px-5">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={quoteDrafts[idx] ?? ''}
                          onChange={(ev) =>
                            setQuoteDrafts((prev) => {
                              const next = [...prev];
                              next[idx] = ev.target.value;
                              return next;
                            })
                          }
                          placeholder="Enter quote"
                          className="w-28 p-2 rounded-xl bg-slate-50 border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                        />
                      </td>
                    </tr>
                  ))}
                  {(!selectedEnquiry.items || selectedEnquiry.items.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">
                        No items on this enquiry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {(selectedEnquiry.items || []).length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end text-xs">
                <span className="text-slate-500 mr-3">Quotation Total</span>
                <span className="font-black text-navy">
                  {formatINR(
                    (selectedEnquiry.items || []).reduce((sum, it, i) => {
                      const draft = quoteDrafts[i];
                      const quoted =
                        draft !== undefined && draft !== '' && !Number.isNaN(Number(draft))
                          ? Number(draft)
                          : it.quotedPrice;
                      return sum + (quoted ?? it.expectedPrice ?? 0) * (it.quantity || 0);
                    }, 0)
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ 3. DIRECT ENQUIRY (manual entry form) ============ */}
      {subTab === 'direct' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-navy">Direct Enquiry</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record a walk-in, phone or WhatsApp lead manually and capture the products they asked about.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-500">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10) }))}
                  placeholder="10-digit mobile number"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy font-mono font-bold outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as EnquirySource }))}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                >
                  {ENQUIRY_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-500">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, city, pincode"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-500">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Wants delivery before Diwali, asked for wholesale rates..."
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-navy outline-none focus:border-purple resize-none"
                />
              </div>
            </div>

            {/* Items */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-black text-xs text-navy">Enquired Items</div>
                <button
                  onClick={() => setFormItems((rows) => [...rows, newDraftRow()])}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-purple/30 bg-purple/5 text-purple text-xs font-bold hover:bg-purple/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {formItems.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_90px_130px_36px] gap-2 items-center bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 text-xs"
                  >
                    <select
                      value={row.productId}
                      onChange={(e) => handleRowProductSelect(row.key, e.target.value)}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                      title="Pick a catalog product or leave as custom item"
                    >
                      <option value="">Custom item (type name)</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={row.productName}
                      readOnly={!!row.productId}
                      onChange={(e) => updateRow(row.key, { productName: e.target.value })}
                      placeholder="Product name"
                      className={`p-2 rounded-xl border border-slate-200 text-navy font-bold outline-none focus:border-purple ${
                        row.productId ? 'bg-slate-100 text-slate-500' : 'bg-white'
                      }`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      placeholder="Qty"
                      className="p-2 rounded-xl bg-white border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.expectedPrice}
                      onChange={(e) => updateRow(row.key, { expectedPrice: e.target.value })}
                      placeholder="Expected ₹"
                      className="p-2 rounded-xl bg-white border border-slate-200 text-navy font-bold outline-none focus:border-purple"
                    />
                    <button
                      onClick={() => removeRow(row.key)}
                      disabled={formItems.length === 1}
                      className={`p-2 rounded-xl border flex items-center justify-center ${
                        formItems.length === 1
                          ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100'
                      }`}
                      title="Remove item"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                onClick={handleSaveEnquiry}
                disabled={isSaving}
                className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-xs ${
                  isSaving ? 'bg-purple/40 text-white cursor-not-allowed' : 'bg-purple hover:bg-purple-dark text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Enquiry'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 4. ENQUIRY CUSTOMERS ============ */}
      {subTab === 'customers' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-navy">Enquiry Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Everyone who has enquired at least once — click a row to see their enquiries.
            </p>
          </div>

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
                    <th className="py-3 px-3">Enquiries</th>
                    <th className="py-3 px-3">Last Enquiry</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedCustomers.map((c, i) => (
                    <tr
                      key={`${c.phone}-${i}`}
                      onClick={() => filterListByCustomer(c)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      title="Show this customer's enquiries"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple/10 text-purple flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {(c.customerName || 'C')
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="font-bold text-navy text-xs">{c.customerName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">{c.phone}</td>
                      <td className="py-3 px-3 text-slate-500">{c.email || '—'}</td>
                      <td className="py-3 px-3 font-bold text-purple">{c.enquiryCount}</td>
                      <td className="py-3 px-3 text-slate-500">{formatDate(c.lastEnquiryAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                      </td>
                    </tr>
                  ))}
                  {pagedCustomers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-xs font-bold">
                        {isLoading ? 'Loading customers...' : 'No enquiry customers found.'}
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

      {/* ============ Confirm dialogs ============ */}
      <ErpConfirmDialog
        open={!!pendingStatus && !!selectedEnquiry}
        title="Change Enquiry Status"
        message={
          <>
            Move <span className="font-bold text-navy">{selectedEnquiry?.enquiryNumber}</span> from{' '}
            <span className="font-bold">{selectedEnquiry?.status}</span> to{' '}
            <span className="font-bold text-purple">{pendingStatus}</span>?
          </>
        }
        confirmLabel="Update Status"
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setPendingStatus(null)}
      />

      <ErpConfirmDialog
        open={!!deleteTarget}
        title="Delete Enquiry"
        message={
          <>
            Permanently delete enquiry{' '}
            <span className="font-bold text-navy">{deleteTarget?.enquiryNumber}</span> from{' '}
            <span className="font-bold">{deleteTarget?.customerName}</span>? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ErpEnquiryModule;
