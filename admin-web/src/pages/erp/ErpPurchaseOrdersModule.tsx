import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Truck,
  Store,
  Plus,
  Search,
  Filter,
  RefreshCw,
  XCircle,
  FileCheck,
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  Send,
  CheckCircle2,
  Ban,
  Package,
  History
} from 'lucide-react';
import { Supplier, PurchaseOrder, GoodsReceivedNote, SupplierBill, Product, Warehouse } from '../../types';
import { api, purchaseApi, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';

interface ErpPurchaseOrdersModuleProps {
  initialSubTab?: 'purchases' | 'suppliers' | 'grn' | 'bills';
}

type PurchaseSubTab = 'purchases' | 'purchase-items' | 'purchase-history' | 'suppliers' | 'grn' | 'bills';

/** Screens that are their own route destination — own header, no Purchase tab bar.
 *  ('suppliers' is also an internal tab of the client Purchase screen; this map only
 *  applies when the module is ROUTED with that initialSubTab, e.g. /admin/suppliers.) */
const STANDALONE_HEADERS: Partial<Record<PurchaseSubTab, { title: string; subtitle: string }>> = {
  suppliers: { title: 'Suppliers', subtitle: 'Vendor directory, contacts and account balances.' },
  grn: { title: 'Goods Received Notes', subtitle: 'GRN receipt inspections recorded against purchase orders.' },
  bills: { title: 'Supplier Bills', subtitle: 'Vendor invoices, payments and outstanding balances.' }
};

const PO_PAGE_SIZE = 10;
const SUPPLIER_PAGE_SIZE = 8;
const ITEMS_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 10;
/** How many POs (newest first) get lazy detail fetches when the list DTO omits line items. */
const MAX_PO_DETAIL_FETCHES = 40;

/** One flattened PO line item for the "Purchase Items" tab. */
interface FlatPurchaseItem {
  key: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  orderDateUtc: string;
  productName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  lineTotal: number;
}

/** Design tab ids (spec 7): All | Draft | Sent | Partial | Received | Cancelled. */
type PoStatusTab = 'all' | 'Draft' | 'Sent' | 'Partial' | 'Received' | 'Cancelled';

const PO_TABS: { id: PoStatusTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Partial', label: 'Partial' },
  { id: 'Received', label: 'Received' },
  { id: 'Cancelled', label: 'Cancelled' }
];

/** Single-status tabs map 1:1 onto backend PurchaseOrderStatus values (Sent = Submitted + Approved). */
const PO_TAB_BACKEND_STATUS: Partial<Record<PoStatusTab, string>> = {
  Draft: 'Draft',
  Partial: 'PartiallyReceived',
  Received: 'Received',
  Cancelled: 'Cancelled'
};

const PO_STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-indigo-100 text-indigo-700',
  Approved: 'bg-purple/10 text-purple',
  PartiallyReceived: 'bg-amber-100 text-amber-700',
  Received: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-100 text-red-700',
  Rejected: 'bg-red-100 text-red-700'
};

/** Design labels (spec 7): Submitted shows as "Sent" (indigo), PartiallyReceived as "Partial" (amber). */
const PO_STATUS_LABELS: Record<string, string> = {
  Submitted: 'Sent',
  PartiallyReceived: 'Partial'
};

const PoStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
      PO_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
    }`}
  >
    {PO_STATUS_LABELS[status] || status}
  </span>
);

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const ErpPurchaseOrdersModule: React.FC<ErpPurchaseOrdersModuleProps> = ({
  initialSubTab = 'purchases'
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routeParams = useParams<{ id?: string }>();
  // Routed as /admin/suppliers, /admin/goods-received or /admin/supplier-bills → standalone
  // screen; /admin/purchases is the client Purchase screen with its four internal tabs.
  const standaloneHeader = STANDALONE_HEADERS[initialSubTab];
  const [subTab, setSubTab] = useState<PurchaseSubTab>(initialSubTab);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [poTotal, setPoTotal] = useState(0);
  const [poPage, setPoPage] = useState(1);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [poSearch, setPoSearch] = useState('');
  const [poStatusTab, setPoStatusTab] = useState<PoStatusTab>('all');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPage, setSupplierPage] = useState(1);

  // Purchase Items / Purchase History tabs — lazily loaded wide PO snapshot (with line items)
  const [allPos, setAllPos] = useState<PurchaseOrder[]>([]);
  const [allPosLoaded, setAllPosLoaded] = useState(false);
  const [isAllPosLoading, setIsAllPosLoading] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsSearch, setItemsSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // PO detail + workflow state
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [isPoDetailLoading, setIsPoDetailLoading] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<{ type: 'reject' | 'cancel'; reason: string } | null>(null);

  // Supplier detail state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSupplierEditOpen, setIsSupplierEditOpen] = useState(false);
  const [supplierEditForm, setSupplierEditForm] = useState<Partial<Supplier>>({});
  const [supplierDeleteTarget, setSupplierDeleteTarget] = useState<Supplier | null>(null);

  // PO Creation Modal state
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poWarehouseId, setPoWarehouseId] = useState('');
  const [poProductId, setPoProductId] = useState('');
  const [poQuantity, setPoQuantity] = useState(100);
  const [poUnitPrice, setPoUnitPrice] = useState(600);
  const [poNotes, setPoNotes] = useState('Festive season pre-stocking order');

  // Supplier Creation Modal state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstNumber: '33AAAAA0000A1Z5',
    address: 'Sivakasi, Tamil Nadu',
    paymentTerms: 'Net 30 Days',
    creditLimit: 1000000,
    isActive: true
  });

  /** Fetch the PO list for a design tab. Single-status tabs use the backend status filter;
   *  "Sent" merges Submitted + Approved and paginates client-side. */
  const fetchPurchases = async (page = poPage, tab = poStatusTab) => {
    setIsLoading(true);
    try {
      if (tab === 'Sent') {
        const [submitted, approved] = await Promise.all([
          purchaseApi.getPurchaseOrders(1, 100, 'Submitted'),
          purchaseApi.getPurchaseOrders(1, 100, 'Approved')
        ]);
        const merged = [...submitted, ...approved].sort(
          (a, b) => new Date(b.orderDateUtc).getTime() - new Date(a.orderDateUtc).getTime()
        );
        setPurchases(merged);
        setPoTotal(submitted.totalCount + approved.totalCount);
      } else {
        const pos = await purchaseApi.getPurchaseOrders(page, PO_PAGE_SIZE, PO_TAB_BACKEND_STATUS[tab]);
        setPurchases([...pos]);
        setPoTotal(pos.totalCount);
      }
    } catch {
      showToast('Failed to load purchase orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSupportingData = async () => {
    try {
      const [sups, gnotes, blls, prods, whs] = await Promise.all([
        api.getSuppliers(),
        api.getGoodsReceivedNotes(),
        api.getSupplierBills(),
        api.getProducts(),
        api.getWarehouses()
      ]);
      setSuppliers(sups);
      setGrns(gnotes);
      setBills(blls);
      setProducts(prods);
      setWarehouses(whs);

      if (sups.length > 0) setPoSupplierId((prev) => prev || sups[0].id);
      if (whs.length > 0) setPoWarehouseId((prev) => prev || whs[0].id);
      if (prods.length > 0) {
        setPoProductId((prev) => prev || prods[0].id);
        setPoUnitPrice((prev) => prev || prods[0].costPrice || 600);
      }
    } catch {
      showToast('Failed to load purchase & supplier data', 'error');
    }
  };

  const loadData = async (page = poPage) => {
    setAllPosLoaded(false); // stale the items/history snapshot so it refetches on next visit
    await Promise.all([fetchPurchases(page, poStatusTab), loadSupportingData()]);
  };

  /** Wide PO snapshot for the Purchase Items / Purchase History tabs. The list endpoint may
   *  omit line items, so details are fetched lazily (newest first, bounded) for empty rows. */
  const loadAllPos = async () => {
    setIsAllPosLoading(true);
    try {
      const pos = await purchaseApi.getPurchaseOrders(1, 100);
      const sorted = [...pos].sort(
        (a, b) => new Date(b.orderDateUtc).getTime() - new Date(a.orderDateUtc).getTime()
      );

      const missingItems = sorted
        .filter((po) => !po.items || po.items.length === 0)
        .slice(0, MAX_PO_DETAIL_FETCHES);
      if (missingItems.length > 0) {
        const details = await Promise.allSettled(
          missingItems.map((po) => purchaseApi.getPurchaseOrderById(po.id))
        );
        const detailById = new Map<string, PurchaseOrder>();
        details.forEach((res) => {
          if (res.status === 'fulfilled' && res.value) detailById.set(res.value.id, res.value);
        });
        for (let i = 0; i < sorted.length; i++) {
          const detail = detailById.get(sorted[i].id);
          if (detail) sorted[i] = detail;
        }
      }

      setAllPos(sorted);
      setAllPosLoaded(true);
    } catch {
      showToast('Failed to load purchase line items', 'error');
    } finally {
      setIsAllPosLoading(false);
    }
  };

  useEffect(() => {
    loadSupportingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPurchases(poPage, poStatusTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poPage, poStatusTab]);

  // Lazy-load the wide PO snapshot the first time Purchase Items / Purchase History is opened
  useEffect(() => {
    if ((subTab === 'purchase-items' || subTab === 'purchase-history') && !allPosLoaded && !isAllPosLoading) {
      loadAllPos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, allPosLoaded]);

  // Deep links: /admin/purchases/:id and /admin/suppliers/:id
  useEffect(() => {
    if (!routeParams.id) return;
    if (initialSubTab === 'purchases') openPoDetail(routeParams.id);
    if (initialSubTab === 'suppliers') openSupplierDetail(routeParams.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.id]);

  // ---------- Purchase Order detail & workflow ----------

  const openPoDetail = async (id: string) => {
    setSubTab('purchases');
    setIsPoDetailLoading(true);
    try {
      const po = await api.getPurchaseOrderById(id);
      if (po) setSelectedPo(po);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load purchase order details', 'error');
    } finally {
      setIsPoDetailLoading(false);
    }
  };

  const runPoWorkflow = async (action: 'submit' | 'approve' | 'reject' | 'cancel', reason?: string) => {
    if (!selectedPo) return;
    setWorkflowBusy(true);
    try {
      let updated: PurchaseOrder | undefined;
      if (action === 'submit') {
        updated = await purchaseApi.submitPurchaseOrder(selectedPo.id);
        showToast(`${selectedPo.poNumber} submitted for approval`, 'success');
      } else if (action === 'approve') {
        updated = await purchaseApi.approvePurchaseOrder(selectedPo.id);
        showToast(`${selectedPo.poNumber} approved — ready for goods receipt`, 'success');
      } else if (action === 'reject') {
        updated = await purchaseApi.rejectPurchaseOrder(selectedPo.id, reason || 'Rejected by admin');
        showToast(`${selectedPo.poNumber} rejected`, 'success');
      } else {
        updated = await purchaseApi.cancelPurchaseOrder(selectedPo.id, reason || 'Cancelled by admin');
        showToast(`${selectedPo.poNumber} cancelled`, 'success');
      }
      if (updated) {
        setSelectedPo(updated);
      } else {
        await openPoDetail(selectedPo.id);
      }
      loadData(poPage);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || `Failed to ${action} purchase order`, 'error');
    } finally {
      setWorkflowBusy(false);
      setReasonDialog(null);
    }
  };

  // ---------- Supplier detail / edit / delete ----------

  const openSupplierDetail = async (id: string) => {
    setSubTab('suppliers');
    try {
      const sup = await purchaseApi.getSupplierById(id);
      if (sup) {
        setSelectedSupplier(sup);
        return;
      }
    } catch {
      // Endpoint may be unavailable — fall back to the already-loaded directory row.
    }
    const cached = suppliers.find((s) => s.id === id);
    if (cached) setSelectedSupplier(cached);
    else showToast('Failed to load supplier details', 'error');
  };

  const handleSaveSupplierEdit = async () => {
    if (!selectedSupplier) return;
    if (!supplierEditForm.name || !supplierEditForm.phone) {
      showToast('Supplier name and phone are required', 'warning');
      return;
    }
    try {
      const updated = await purchaseApi.updateSupplier(selectedSupplier.id, supplierEditForm);
      showToast('Supplier details updated!', 'success');
      setIsSupplierEditOpen(false);
      if (updated) setSelectedSupplier(updated);
      else setSelectedSupplier({ ...selectedSupplier, ...supplierEditForm } as Supplier);
      loadData(poPage);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to update supplier', 'error');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierDeleteTarget) return;
    try {
      await purchaseApi.deleteSupplier(supplierDeleteTarget.id);
      showToast(`Supplier "${supplierDeleteTarget.name}" removed from directory`, 'success');
      setSupplierDeleteTarget(null);
      setSelectedSupplier(null);
      loadData(poPage);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to delete supplier', 'error');
      setSupplierDeleteTarget(null);
    }
  };

  // ---------- Create PO / Create supplier ----------

  const handleCreatePo = async () => {
    if (!poSupplierId || !poWarehouseId || !poProductId || poQuantity <= 0 || poUnitPrice <= 0) {
      showToast('Please fill all required PO fields', 'warning');
      return;
    }

    try {
      const po = await purchaseApi.createPurchaseOrder({
        supplierId: poSupplierId,
        warehouseId: poWarehouseId,
        expectedDeliveryDateUtc: new Date(Date.now() + 86400000 * 7).toISOString(),
        notes: poNotes,
        items: [{ productId: poProductId, quantity: poQuantity, unitPrice: poUnitPrice }]
      });
      showToast(`Purchase Order ${po?.poNumber || ''} created as Draft`, 'success');
      setIsPoModalOpen(false);
      loadData(poPage);
      if (po?.id) openPoDetail(po.id);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to create purchase order', 'error');
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name || !supplierForm.phone) {
      showToast('Supplier name and phone are required', 'warning');
      return;
    }

    try {
      await api.createSupplier({
        ...supplierForm,
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`
      });
      showToast('Supplier added to directory!', 'success');
      setIsSupplierModalOpen(false);
      loadData(poPage);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to add supplier', 'error');
    }
  };

  // ---------- Derived lists ----------

  const filteredPurchases = purchases.filter((po) => {
    if (!poSearch.trim()) return true;
    const q = poSearch.toLowerCase();
    return po.poNumber?.toLowerCase().includes(q) || po.supplierName?.toLowerCase().includes(q);
  });

  // "Sent" merges two backend statuses, so it paginates client-side; other tabs are server-paged.
  const pagedPurchases =
    poStatusTab === 'Sent'
      ? filteredPurchases.slice((poPage - 1) * PO_PAGE_SIZE, poPage * PO_PAGE_SIZE)
      : filteredPurchases;
  const poPagerTotal = poStatusTab === 'Sent' ? filteredPurchases.length : poTotal;

  /** Outstanding balance from loaded supplier bills; null when no bill rows exist for the supplier. */
  const supplierBillBalance = (supplierId: string): number | null => {
    const supplierBills = bills.filter((b) => b.supplierId === supplierId);
    if (supplierBills.length === 0) return null;
    return supplierBills.reduce((sum, b) => sum + (b.balanceAmount || 0), 0);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearch.trim()) return true;
    const q = supplierSearch.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.contactPerson?.toLowerCase().includes(q)
    );
  });
  const pagedSuppliers = filteredSuppliers.slice(
    (supplierPage - 1) * SUPPLIER_PAGE_SIZE,
    supplierPage * SUPPLIER_PAGE_SIZE
  );

  const supplierLinkedPos = selectedSupplier
    ? purchases.filter((po) => po.supplierId === selectedSupplier.id)
    : [];

  // Purchase Items: flattened line items across the loaded PO snapshot (newest PO first)
  const flatPurchaseItems: FlatPurchaseItem[] = allPos.flatMap((po) =>
    (po.items || []).map((it, idx) => ({
      key: `${po.id}-${it.id || idx}`,
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      orderDateUtc: po.orderDateUtc,
      productName: it.productName,
      sku: it.sku,
      quantityOrdered: it.quantityOrdered,
      quantityReceived: it.quantityReceived,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal ?? it.unitPrice * it.quantityOrdered
    }))
  );
  const filteredPurchaseItems = flatPurchaseItems.filter((it) => {
    if (!itemsSearch.trim()) return true;
    const q = itemsSearch.toLowerCase();
    return (
      it.productName?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q) ||
      it.poNumber?.toLowerCase().includes(q) ||
      it.supplierName?.toLowerCase().includes(q)
    );
  });
  const pagedPurchaseItems = filteredPurchaseItems.slice(
    (itemsPage - 1) * ITEMS_PAGE_SIZE,
    itemsPage * ITEMS_PAGE_SIZE
  );

  // Purchase History: closed-out POs (Received or Cancelled), newest first
  const historyPos = allPos
    .filter((po) => po.status === 'Received' || po.status === 'Cancelled')
    .sort((a, b) => new Date(b.orderDateUtc).getTime() - new Date(a.orderDateUtc).getTime());
  const pagedHistoryPos = historyPos.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
  const historyReceivedTotal = historyPos
    .filter((po) => po.status === 'Received')
    .reduce((sum, po) => sum + (po.grandTotal || 0), 0);
  const historyGrandTotal = historyPos.reduce((sum, po) => sum + (po.grandTotal || 0), 0);

  const poStatus = (selectedPo?.status as string) || '';
  const canSubmit = poStatus === 'Draft';
  const canApprove = poStatus === 'Submitted';
  const canReject = poStatus === 'Submitted';
  const canCancel = ['Draft', 'Submitted', 'Approved'].includes(poStatus);
  const canReceive = ['Approved', 'PartiallyReceived'].includes(poStatus);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — client Purchase screen or a standalone routed screen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{standaloneHeader ? standaloneHeader.title : 'Purchase'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {standaloneHeader
              ? standaloneHeader.subtitle
              : 'Purchase orders, suppliers and procurement history.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(poPage)}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(!standaloneHeader || initialSubTab === 'suppliers') && (
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}

          {!standaloneHeader && (
            <button
              onClick={() => setIsPoModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create PO</span>
            </button>
          )}
        </div>
      </div>

      {/* Internal tab bar — client Purchase screen only (standalone screens have no tabs) */}
      {!standaloneHeader && (
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'purchases', label: `Purchase Orders (${poTotal})`, icon: Truck },
          { id: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Store },
          {
            id: 'purchase-items',
            label: `Purchase Items${allPosLoaded ? ` (${flatPurchaseItems.length})` : ''}`,
            icon: Package
          },
          {
            id: 'purchase-history',
            label: `Purchase History${allPosLoaded ? ` (${historyPos.length})` : ''}`,
            icon: History
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSubTab(tab.id as any);
                if (tab.id !== 'purchases') setSelectedPo(null);
                if (tab.id !== 'suppliers') setSelectedSupplier(null);
              }}
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
      )}

      {/* 1. PURCHASE ORDERS TAB */}
      {subTab === 'purchases' && !selectedPo && (
        <div className="space-y-4">
          {/* Status tab bar (spec 7: All | Draft | Sent | Partial | Received | Cancelled) */}
          <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto">
            {PO_TABS.map((t) => {
              const isActive = poStatusTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setPoStatusTab(t.id);
                    setPoPage(1);
                  }}
                  className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive ? 'border-purple text-purple' : 'border-transparent text-slate-500 hover:text-navy'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-96 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO number or supplier..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <button className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedPurchases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                        {isLoading ? 'Loading purchase orders...' : 'No purchase orders match your search.'}
                      </td>
                    </tr>
                  )}
                  {pagedPurchases.map((po) => (
                    <tr
                      key={po.id}
                      onClick={() => openPoDetail(po.id)}
                      className="hover:bg-purple/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-navy text-xs">{po.poNumber}</div>
                        <div className="text-[10px] text-slate-400">{po.warehouseName}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{po.supplierName}</td>
                      <td className="py-3 px-3 font-black text-navy">{inr(po.grandTotal)}</td>
                      <td className="py-3 px-3">
                        <PoStatusPill status={po.status as string} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(po.orderDateUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPoDetail(po.id);
                          }}
                          className="px-3 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark text-xs font-bold shadow-2xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination page={poPage} pageSize={PO_PAGE_SIZE} total={poPagerTotal} onPageChange={setPoPage} />
            </div>
          </div>
        </div>
      )}

      {/* 1b. PURCHASE ORDER DETAIL VIEW */}
      {subTab === 'purchases' && selectedPo && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedPo(null)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Purchase Orders</span>
            </button>

            {/* Workflow action buttons */}
            <div className="flex items-center space-x-2">
              {canSubmit && (
                <button
                  onClick={() => runPoWorkflow('submit')}
                  disabled={workflowBusy}
                  className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Approval</span>
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => runPoWorkflow('approve')}
                  disabled={workflowBusy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setReasonDialog({ type: 'reject', reason: '' })}
                  disabled={workflowBusy}
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-red-500/20 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              )}
              {canReceive && (
                <button
                  onClick={() => {
                    showToast(`Record a GRN against ${selectedPo.poNumber} on the Goods Received screen`, 'info');
                    setSelectedPo(null);
                    navigate('/admin/goods-received');
                  }}
                  className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Receive Goods</span>
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setReasonDialog({ type: 'cancel', reason: '' })}
                  disabled={workflowBusy}
                  className="px-4 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel PO</span>
                </button>
              )}
            </div>
          </div>

          {isPoDetailLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center text-xs text-slate-400">
              Loading purchase order details...
            </div>
          ) : (
            <>
              {/* PO Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h2 className="font-mono font-black text-lg text-navy">{selectedPo.poNumber}</h2>
                      <PoStatusPill status={selectedPo.status as string} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Ordered on{' '}
                      {new Date(selectedPo.orderDateUtc).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      {selectedPo.expectedDeliveryDateUtc && (
                        <>
                          {' '}• Expected delivery{' '}
                          {new Date(selectedPo.expectedDeliveryDateUtc).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Grand Total</div>
                    <div className="text-2xl font-black text-navy">{inr(selectedPo.grandTotal)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Store className="w-3 h-3" />
                      <span>Supplier</span>
                    </div>
                    <div className="font-bold text-navy mt-1">{selectedPo.supplierName}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Building className="w-3 h-3" />
                      <span>Receiving Warehouse</span>
                    </div>
                    <div className="font-bold text-navy mt-1">{selectedPo.warehouseName}</div>
                  </div>
                </div>

                {selectedPo.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-3">"{selectedPo.notes}"</p>
                )}

                {/* Workflow trail */}
                {(() => {
                  const anyPo = selectedPo as PurchaseOrder & {
                    submittedAtUtc?: string;
                    submittedBy?: string;
                    approvedAtUtc?: string;
                    approvedBy?: string;
                    rejectedAtUtc?: string;
                    rejectedBy?: string;
                    rejectionReason?: string;
                    cancelledAtUtc?: string;
                    cancelledBy?: string;
                    cancellationReason?: string;
                  };
                  const trail: string[] = [];
                  if (anyPo.submittedAtUtc)
                    trail.push(`Submitted ${new Date(anyPo.submittedAtUtc).toLocaleString('en-IN')}${anyPo.submittedBy ? ` by ${anyPo.submittedBy}` : ''}`);
                  if (anyPo.approvedAtUtc)
                    trail.push(`Approved ${new Date(anyPo.approvedAtUtc).toLocaleString('en-IN')}${anyPo.approvedBy ? ` by ${anyPo.approvedBy}` : ''}`);
                  if (anyPo.rejectedAtUtc)
                    trail.push(`Rejected ${new Date(anyPo.rejectedAtUtc).toLocaleString('en-IN')}${anyPo.rejectionReason ? ` — "${anyPo.rejectionReason}"` : ''}`);
                  if (anyPo.cancelledAtUtc)
                    trail.push(`Cancelled ${new Date(anyPo.cancelledAtUtc).toLocaleString('en-IN')}${anyPo.cancellationReason ? ` — "${anyPo.cancellationReason}"` : ''}`);
                  if (trail.length === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                      {trail.map((t, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {t}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Items table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-3">SKU</th>
                        <th className="py-3 px-3">Unit Price</th>
                        <th className="py-3 px-3">Ordered</th>
                        <th className="py-3 px-3">Received</th>
                        <th className="py-3 px-4 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(selectedPo.items || []).map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-navy">{it.productName}</td>
                          <td className="py-3 px-3 font-mono text-purple">{it.sku}</td>
                          <td className="py-3 px-3">{inr(it.unitPrice)}</td>
                          <td className="py-3 px-3 font-bold">{it.quantityOrdered}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-bold ${
                                it.quantityReceived >= it.quantityOrdered ? 'text-emerald-600' : 'text-slate-500'
                              }`}
                            >
                              {it.quantityReceived}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-navy">{inr(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 flex justify-end">
                  <div className="w-full sm:w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-700">{inr(selectedPo.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Tax (GST 18%)</span>
                      <span className="font-bold text-slate-700">{inr(selectedPo.tax)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-navy">
                      <span>Grand Total</span>
                      <span className="text-orange">{inr(selectedPo.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 1c. PURCHASE ITEMS TAB — flattened line items across POs */}
      {subTab === 'purchase-items' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-96 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product, SKU, PO number or supplier..."
                value={itemsSearch}
                onChange={(e) => {
                  setItemsSearch(e.target.value);
                  setItemsPage(1);
                }}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <div className="text-[11px] font-bold text-slate-400 shrink-0">
              {filteredPurchaseItems.length} line item{filteredPurchaseItems.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">PO Number</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Qty Ordered</th>
                    <th className="py-3 px-3">Qty Received</th>
                    <th className="py-3 px-3">Unit Price</th>
                    <th className="py-3 px-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedPurchaseItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                        {isAllPosLoading
                          ? 'Loading purchase line items...'
                          : 'No purchase line items match your search.'}
                      </td>
                    </tr>
                  )}
                  {pagedPurchaseItems.map((it) => (
                    <tr
                      key={it.key}
                      onClick={() => openPoDetail(it.poId)}
                      className="hover:bg-purple/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy">{it.productName}</div>
                        {it.sku && <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-purple">{it.poNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(it.orderDateUtc).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{it.supplierName}</td>
                      <td className="py-3 px-3 font-bold text-navy">{it.quantityOrdered}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold ${
                            it.quantityReceived >= it.quantityOrdered ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {it.quantityReceived}
                        </span>
                      </td>
                      <td className="py-3 px-3">{inr(it.unitPrice)}</td>
                      <td className="py-3 px-4 text-right font-black text-navy">{inr(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={itemsPage}
                pageSize={ITEMS_PAGE_SIZE}
                total={filteredPurchaseItems.length}
                onPageChange={setItemsPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 1d. PURCHASE HISTORY TAB — closed-out POs (Received / Cancelled), newest first */}
      {subTab === 'purchase-history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Warehouse</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedHistoryPos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                        {isAllPosLoading
                          ? 'Loading purchase history...'
                          : 'No received or cancelled purchase orders yet.'}
                      </td>
                    </tr>
                  )}
                  {pagedHistoryPos.map((po) => (
                    <tr
                      key={po.id}
                      onClick={() => openPoDetail(po.id)}
                      className="hover:bg-purple/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-navy">{po.poNumber}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{po.supplierName}</td>
                      <td className="py-3 px-3 text-slate-600">{po.warehouseName}</td>
                      <td className="py-3 px-3 font-bold text-navy">{po.items?.length || 0}</td>
                      <td className="py-3 px-3">
                        <PoStatusPill status={po.status as string} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(po.orderDateUtc).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-navy">{inr(po.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                {historyPos.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-navy">
                    <tr>
                      <td colSpan={6} className="py-3 px-4">
                        Total — {historyPos.length} PO{historyPos.length === 1 ? '' : 's'}{' '}
                        <span className="text-[10px] text-slate-400 font-bold">
                          (Received value {inr(historyReceivedTotal)})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-orange">{inr(historyGrandTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={historyPage}
                pageSize={HISTORY_PAGE_SIZE}
                total={historyPos.length}
                onPageChange={setHistoryPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. SUPPLIERS DIRECTORY TAB (design 17) */}
      {subTab === 'suppliers' && !selectedSupplier && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-96 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search supplier name or phone..."
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setSupplierPage(1);
                }}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>
            <button className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-3">Contact Person</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Total POs</th>
                    <th className="py-3 px-3">Balance</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pagedSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                        {isLoading ? 'Loading suppliers...' : 'No suppliers match your search.'}
                      </td>
                    </tr>
                  )}
                  {pagedSuppliers.map((sup) => {
                    const balance = sup.outstandingBalance ?? supplierBillBalance(sup.id);
                    return (
                    <tr
                      key={sup.id}
                      onClick={() => openSupplierDetail(sup.id)}
                      className="hover:bg-purple/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy">{sup.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{sup.code}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{sup.contactPerson || '—'}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{sup.phone}</td>
                      <td className="py-3 px-3 font-bold text-navy">{sup.totalPurchaseOrders ?? 0}</td>
                      <td className="py-3 px-3 font-black text-navy">{balance === null ? '—' : inr(balance)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sup.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {sup.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSupplierDetail(sup.id);
                          }}
                          className="px-3 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark text-xs font-bold shadow-2xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={supplierPage}
                pageSize={SUPPLIER_PAGE_SIZE}
                total={filteredSuppliers.length}
                onPageChange={setSupplierPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2b. SUPPLIER DETAIL PANEL */}
      {subTab === 'suppliers' && selectedSupplier && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedSupplier(null)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Suppliers</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setPoSupplierId(selectedSupplier.id);
                  setIsPoModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create PO</span>
              </button>
              <button
                onClick={() => {
                  setSupplierEditForm({
                    name: selectedSupplier.name,
                    contactPerson: selectedSupplier.contactPerson,
                    email: selectedSupplier.email,
                    phone: selectedSupplier.phone,
                    address: selectedSupplier.address,
                    gstNumber: selectedSupplier.gstNumber,
                    isActive: selectedSupplier.isActive
                  });
                  setIsSupplierEditOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => setSupplierDeleteTarget(selectedSupplier)}
                className="px-4 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Supplier profile card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-purple/15 text-purple flex items-center justify-center font-black text-lg">
                  {selectedSupplier.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-black text-lg text-navy">{selectedSupplier.name}</h2>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedSupplier.code}</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedSupplier.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {selectedSupplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contact Person</div>
                <div className="font-bold text-navy mt-1">{selectedSupplier.contactPerson || 'Sales Desk'}</div>
                <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                  <Phone className="w-3 h-3" />
                  <span className="font-mono">{selectedSupplier.phone}</span>
                </div>
                {selectedSupplier.email && (
                  <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span>{selectedSupplier.email}</span>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">GSTIN & Terms</div>
                <div className="font-mono text-slate-700 mt-1">{selectedSupplier.gstNumber || '—'}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Terms: {selectedSupplier.paymentTerms || 'Net 30'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Address</div>
                <div className="text-slate-700 mt-1 flex items-start space-x-1">
                  <MapPin className="w-3 h-3 mt-0.5 text-slate-400" />
                  <span>{selectedSupplier.address || 'Sivakasi, Tamil Nadu'}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Account</div>
                <div className="font-bold text-navy mt-1">{selectedSupplier.totalPurchaseOrders ?? supplierLinkedPos.length} Purchase Orders</div>
                <div className="text-[10px] text-red-600 font-bold mt-0.5">
                  {(() => {
                    const balance = selectedSupplier.outstandingBalance ?? supplierBillBalance(selectedSupplier.id);
                    return <>Outstanding: {balance === null ? '—' : inr(balance)}</>;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Linked purchase orders */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Linked Purchase Orders ({supplierLinkedPos.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {supplierLinkedPos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-slate-400">
                        No purchase orders on the current page for this supplier.
                      </td>
                    </tr>
                  )}
                  {supplierLinkedPos.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy">{po.poNumber}</td>
                      <td className="py-3 px-3 font-black text-navy">{inr(po.grandTotal)}</td>
                      <td className="py-3 px-3">
                        <PoStatusPill status={po.status as string} />
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(po.orderDateUtc).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (standaloneHeader) {
                              // Standalone Suppliers screen has no Purchase Orders tab —
                              // deep-link into the Purchase screen instead.
                              navigate(`/admin/purchases/${po.id}`);
                            } else {
                              setSelectedSupplier(null);
                              openPoDetail(po.id);
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark text-xs font-bold shadow-2xs"
                        >
                          View PO
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

      {/* 3. GOODS RECEIVED NOTES (GRN) TAB */}
      {subTab === 'grn' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grns.map((g) => (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-black text-emerald-600 text-xs">{g.grnNumber}</span>
                    <h3 className="font-bold text-xs text-navy mt-0.5">PO Ref: {g.poNumber}</h3>
                    <p className="text-[10px] text-slate-400">Supplier: {g.supplierName}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Stock Restocked
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                  {g.items.map((it, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between font-bold text-navy">
                        <span>{it.productName}</span>
                        <span>{it.receivedQty} / {it.orderedQty} boxes</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Damaged: {it.damagedQty} • Rejected: {it.rejectedQty}</span>
                        <span className="font-mono">{it.remarks}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Inspector: {g.receivedBy}</span>
                  <span>{new Date(g.receivedDateUtc).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SUPPLIER BILLS TAB */}
      {subTab === 'bills' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">PO Reference</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Paid Amount</th>
                  <th className="py-3 px-3">Balance Due</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{b.billNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{b.supplierName}</td>
                    <td className="py-3 px-3 font-mono text-purple">{b.poNumber || '—'}</td>
                    <td className="py-3 px-3 font-bold text-navy">{inr(b.totalAmount)}</td>
                    <td className="py-3 px-3 text-emerald-600 font-bold">{inr(b.paidAmount)}</td>
                    <td className="py-3 px-3 text-red-600 font-black">{inr(b.balanceAmount)}</td>
                    <td className="py-3 px-3 text-slate-500">{new Date(b.dueDateUtc).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Generate Purchase Order (PO)
              </h3>
              <button onClick={() => setIsPoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Select Supplier *</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Receiving Warehouse / Depot *</label>
                <select
                  value={poWarehouseId}
                  onChange={(e) => setPoWarehouseId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Product to Order *</label>
                <select
                  value={poProductId}
                  onChange={(e) => {
                    setPoProductId(e.target.value);
                    const pr = products.find((p) => p.id === e.target.value);
                    if (pr?.costPrice) setPoUnitPrice(pr.costPrice);
                  }}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none font-bold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Order Quantity (Boxes) *</label>
                  <input
                    type="number"
                    value={poQuantity}
                    onChange={(e) => setPoQuantity(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Purchase Unit Price (₹) *</label>
                  <input
                    type="number"
                    value={poUnitPrice}
                    onChange={(e) => setPoUnitPrice(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between font-black text-navy text-xs">
                <span>Calculated PO Total (with 18% GST):</span>
                <span className="text-orange">₹{Math.round(poQuantity * poUnitPrice * 1.18).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePo}
                className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md shadow-orange/20"
              >
                Create Draft PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Add Supplier to Directory
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Supplier / Brand Name *</label>
                <input
                  type="text"
                  value={supplierForm.name || ''}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Vanitha Crackers Factory"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Contact Person</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Phone Number *</label>
                  <input
                    type="text"
                    value={supplierForm.phone || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-navy">GSTIN Number</label>
                <input
                  type="text"
                  value={supplierForm.gstNumber || ''}
                  onChange={(e) => setSupplierForm({ ...supplierForm, gstNumber: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSupplier}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {isSupplierEditOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Edit Supplier — {selectedSupplier.code}
              </h3>
              <button onClick={() => setIsSupplierEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Supplier / Brand Name *</label>
                <input
                  type="text"
                  value={supplierEditForm.name || ''}
                  onChange={(e) => setSupplierEditForm({ ...supplierEditForm, name: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Contact Person</label>
                  <input
                    type="text"
                    value={supplierEditForm.contactPerson || ''}
                    onChange={(e) => setSupplierEditForm({ ...supplierEditForm, contactPerson: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Phone Number *</label>
                  <input
                    type="text"
                    value={supplierEditForm.phone || ''}
                    onChange={(e) => setSupplierEditForm({ ...supplierEditForm, phone: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-navy">Email</label>
                <input
                  type="email"
                  value={supplierEditForm.email || ''}
                  onChange={(e) => setSupplierEditForm({ ...supplierEditForm, email: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Address</label>
                <input
                  type="text"
                  value={supplierEditForm.address || ''}
                  onChange={(e) => setSupplierEditForm({ ...supplierEditForm, address: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-navy">GSTIN Number</label>
                  <input
                    type="text"
                    value={supplierEditForm.gstNumber || ''}
                    onChange={(e) => setSupplierEditForm({ ...supplierEditForm, gstNumber: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none"
                  />
                </div>
                <label className="flex items-center space-x-2 pb-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supplierEditForm.isActive ?? true}
                    onChange={(e) => setSupplierEditForm({ ...supplierEditForm, isActive: e.target.checked })}
                    className="accent-purple w-4 h-4"
                  />
                  <span className="font-bold text-navy">Active Vendor</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsSupplierEditOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSupplierEdit}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT / CANCEL REASON DIALOG */}
      {reasonDialog && selectedPo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-black text-sm text-navy">
              {reasonDialog.type === 'reject' ? 'Reject Purchase Order?' : 'Cancel Purchase Order?'}
            </h3>
            <p className="text-xs text-slate-500">
              {reasonDialog.type === 'reject'
                ? `${selectedPo.poNumber} will be rejected and sent back to the purchase team.`
                : `${selectedPo.poNumber} will be cancelled permanently. This cannot be undone.`}
            </p>
            <div>
              <label className="text-xs font-bold text-navy">Reason *</label>
              <textarea
                value={reasonDialog.reason}
                onChange={(e) => setReasonDialog({ ...reasonDialog, reason: e.target.value })}
                rows={3}
                placeholder={
                  reasonDialog.type === 'reject'
                    ? 'e.g. Pricing above negotiated rate card'
                    : 'e.g. Duplicate order raised by mistake'
                }
                className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-xs text-navy outline-none focus:border-purple resize-none"
              />
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setReasonDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Keep PO
              </button>
              <button
                onClick={() => {
                  if (!reasonDialog.reason.trim()) {
                    showToast('Please provide a reason', 'warning');
                    return;
                  }
                  runPoWorkflow(reasonDialog.type, reasonDialog.reason.trim());
                }}
                disabled={workflowBusy}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {workflowBusy
                  ? 'Working...'
                  : reasonDialog.type === 'reject'
                  ? 'Reject PO'
                  : 'Cancel PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUPPLIER CONFIRMATION */}
      <ErpConfirmDialog
        open={!!supplierDeleteTarget}
        title="Delete Supplier?"
        message={
          supplierDeleteTarget ? (
            <>
              <span className="font-bold text-navy">{supplierDeleteTarget.name}</span> (
              {supplierDeleteTarget.code}) will be removed from the supplier directory. Existing purchase
              orders and bills are preserved for audit history.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete Supplier"
        onConfirm={handleDeleteSupplier}
        onCancel={() => setSupplierDeleteTarget(null)}
      />
    </div>
  );
};
