import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowLeftRight,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Store,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  History,
  Building2,
  Download
} from 'lucide-react';
import { Product, Warehouse, StockMovement, StockTransfer, StockItem, LowStockAlert, Supplier, PurchaseOrder } from '../../types';
import { api, purchaseApi, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';

const STOCK_PAGE_SIZE = 10;

/** Maps a stock line to its design-system status pill. */
const stockStatus = (available: number, onHand: number, reorderLevel: number): { label: string; cls: string } => {
  if (available <= 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' };
  if (onHand <= reorderLevel) return { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-700' };
};

/** Backend low-stock statuses: Critical (out of stock), Low (very low), Medium (low). */
const alertSeverity = (a: LowStockAlert): 'out' | 'veryLow' | 'low' => {
  if (a.quantityAvailable <= 0 || a.status === 'Critical') return 'out';
  if (a.status === 'Low' || a.quantityAvailable <= Math.floor(a.reorderLevel / 2)) return 'veryLow';
  return 'low';
};

const ALERT_PILLS: Record<'out' | 'veryLow' | 'low', { label: string; cls: string }> = {
  out: { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' },
  veryLow: { label: 'Very Low Stock', cls: 'bg-orange-100 text-orange-700' },
  low: { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700' }
};

interface ErpInventoryLedgerModuleProps {
  initialSubTab?: 'overview' | 'movements' | 'transfers' | 'low-stock' | 'warehouses';
}

export const ErpInventoryLedgerModule: React.FC<ErpInventoryLedgerModuleProps> = ({
  initialSubTab = 'overview'
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'overview' | 'movements' | 'transfers' | 'low-stock' | 'warehouses'>(initialSubTab);

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);

  // Server-paged stock ledger (design 09)
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockPage, setStockPage] = useState(1);
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [isStockFilterOpen, setIsStockFilterOpen] = useState(false);

  // Low stock alerts via GET /inventory/low-stock (design 13)
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseOrder[]>([]);
  const [quickPoBusyId, setQuickPoBusyId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Stock Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQtyChange, setAdjustQtyChange] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Physical Stock Verification Count');
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('');

  // Stock Transfer Modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceWh, setTransferSourceWh] = useState('');
  const [transferTargetWh, setTransferTargetWh] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number>(50);
  const [transferReason, setTransferReason] = useState('Metro branch stock replenishment');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, whs, mvts, trfs] = await Promise.all([
        api.getProducts(),
        api.getWarehouses(),
        api.getStockMovements(),
        api.getStockTransfers()
      ]);
      setProducts(prods);
      setWarehouses(whs);
      setMovements(mvts);
      setTransfers(trfs);
      if (whs.length > 0) {
        setAdjustWarehouseId(whs[0].id);
        setTransferSourceWh(whs[0].id);
        setTransferTargetWh(whs[1]?.id || whs[0].id);
      }
    } catch {
      showToast('Failed to load inventory ledger data', 'error');
    } finally {
      setIsLoading(false);
    }

    // Low stock alerts + supplier context for Quick PO (permission-tolerant)
    api
      .getLowStockAlerts(100)
      .then(setLowStockAlerts)
      .catch(() => setLowStockAlerts([]));
    api
      .getSuppliers()
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
    api
      .getPurchases(1, 100)
      .then((pos) => setRecentPurchases([...pos]))
      .catch(() => setRecentPurchases([]));
  };

  const loadStockItems = async (page: number, search: string) => {
    try {
      const res = await api.getStockItems({
        page,
        pageSize: STOCK_PAGE_SIZE,
        search: search || undefined,
        warehouseId: stockWarehouseFilter !== 'all' ? stockWarehouseFilter : undefined,
        lowStockOnly: stockStatusFilter === 'low' ? true : undefined
      });
      setStockItems([...res]);
      setStockTotal(res.totalCount);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load stock ledger', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Debounced server-side search + paging for the stock ledger
  useEffect(() => {
    const t = setTimeout(() => {
      loadStockItems(stockPage, searchQuery);
    }, searchQuery ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockPage, searchQuery, stockWarehouseFilter, stockStatusFilter]);

  // In Stock / Out of Stock have no server-side filter — applied client-side over the current page
  // (warehouse uses the API's warehouseId param; Low Stock uses the API's lowStockOnly param).
  const displayedStockItems =
    stockStatusFilter === 'in'
      ? stockItems.filter((si) => stockStatus(si.quantityAvailable, si.quantityOnHand, si.reorderLevel).label === 'In Stock')
      : stockStatusFilter === 'out'
      ? stockItems.filter((si) => si.quantityAvailable <= 0)
      : stockItems;

  const alertCounts = lowStockAlerts.reduce(
    (acc, a) => {
      acc[alertSeverity(a)] += 1;
      return acc;
    },
    { low: 0, veryLow: 0, out: 0 } as Record<'low' | 'veryLow' | 'out', number>
  );

  const visibleAlerts = showAllAlerts ? lowStockAlerts : lowStockAlerts.slice(0, 8);

  // Quick PO: real draft purchase order for a low stock product.
  // Products have no direct supplier link, so we use the supplier from the most
  // recent PO containing this product, else fall back to the first supplier.
  const handleQuickPo = async (alert: LowStockAlert) => {
    if (suppliers.length === 0) {
      showToast('No suppliers found — add a supplier before creating a Quick PO', 'warning');
      return;
    }
    if (warehouses.length === 0) {
      showToast('No warehouse configured — cannot create a purchase order', 'warning');
      return;
    }

    const previousPo = [...recentPurchases]
      .filter((po) => (po.items || []).some((it) => it.productId === alert.productId))
      .sort((a, b) => new Date(b.orderDateUtc).getTime() - new Date(a.orderDateUtc).getTime())[0];
    const supplier = suppliers.find((s) => s.id === previousPo?.supplierId) || suppliers[0];
    const warehouse = warehouses.find((w) => w.isPrimary) || warehouses[0];

    const product = products.find((p) => p.id === alert.productId);
    const unitPrice = Math.max(1, Math.round(product?.costPrice || product?.price || 100));
    const quantity = Math.max(alert.reorderLevel * 2 - alert.quantityAvailable, alert.reorderLevel, 10);

    setQuickPoBusyId(alert.productId);
    try {
      const po = await purchaseApi.createPurchaseOrder({
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        notes: `Quick PO from low stock alert — ${alert.productName} (${alert.sku})`,
        items: [{ productId: alert.productId, quantity, unitPrice }]
      });
      showToast(
        `Draft PO ${po?.poNumber || ''} created — ${quantity} units of ${alert.productName} from ${supplier.name}`,
        'success'
      );
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to create Quick PO', 'error');
    } finally {
      setQuickPoBusyId(null);
    }
  };

  // Download Report — client-side CSV of the low stock table (design 13)
  const handleDownloadReport = () => {
    if (lowStockAlerts.length === 0) {
      showToast('No low stock data to export', 'info');
      return;
    }
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['Product', 'SKU', 'Available Stock', 'Reorder Level', 'Status'],
      ...lowStockAlerts.map((a) => [
        a.productName,
        a.sku,
        a.quantityAvailable,
        a.reorderLevel,
        ALERT_PILLS[alertSeverity(a)].label
      ])
    ];
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `low-stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Low stock report downloaded', 'success');
  };

  // Handle Submit Adjustment
  const handlePerformAdjustment = async () => {
    if (!adjustProductId || adjustQtyChange === 0) {
      showToast('Please select a product and specify quantity change', 'warning');
      return;
    }

    try {
      await api.adjustStock(adjustProductId, adjustQtyChange, adjustReason, adjustWarehouseId);
      showToast('Stock adjusted and movement ledger entry recorded!', 'success');
      setIsAdjustModalOpen(false);
      setAdjustQtyChange(0);
      loadData();
    } catch {
      showToast('Stock adjustment failed', 'error');
    }
  };

  // Handle Submit Transfer
  const handlePerformTransfer = async () => {
    if (!transferProductId || transferQuantity <= 0) {
      showToast('Please specify valid transfer quantity and product', 'warning');
      return;
    }
    if (transferSourceWh === transferTargetWh) {
      showToast('Source and destination warehouses cannot be the same', 'warning');
      return;
    }

    try {
      await api.transferStock({
        productId: transferProductId,
        sourceWarehouseId: transferSourceWh,
        targetWarehouseId: transferTargetWh,
        quantity: transferQuantity,
        reason: transferReason
      });
      showToast('Inter-warehouse stock transfer initiated!', 'success');
      setIsTransferModalOpen(false);
      loadData();
    } catch {
      showToast('Stock transfer failed', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Inventory, Warehouses & Stock Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock ledger, inter-warehouse movements, damage adjustments, and low stock threshold alerts.
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

          <button
            onClick={() => {
              setAdjustProductId(products[0]?.id || '');
              setIsAdjustModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20 transition-all"
          >
            <Sliders className="w-4 h-4" />
            <span>Adjust Stock</span>
          </button>

          <button
            onClick={() => {
              setTransferProductId(products[0]?.id || '');
              setIsTransferModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transfer Stock</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: `Stock Overview (${stockTotal})`, icon: Layers },
          { id: 'movements', label: `Stock Movements (${movements.length})`, icon: History },
          { id: 'transfers', label: `Warehouse Transfers (${transfers.length})`, icon: ArrowLeftRight },
          { id: 'low-stock', label: `Low Stock Alerts (${lowStockAlerts.length})`, icon: AlertTriangle, badge: lowStockAlerts.length > 0 ? String(lowStockAlerts.length) : undefined },
          { id: 'warehouses', label: `Warehouses (${warehouses.length})`, icon: Building2 }
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
              {tab.badge && (
                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. STOCK OVERVIEW TAB (design 09) */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU or Name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setStockPage(1);
                }}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>

            <div className="relative w-full sm:w-auto flex justify-end">
              <button
                onClick={() => setIsStockFilterOpen((v) => !v)}
                className={`px-4 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                  isStockFilterOpen || stockWarehouseFilter !== 'all' || stockStatusFilter !== 'all'
                    ? 'border-purple text-purple bg-purple/5'
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              {isStockFilterOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-navy">Warehouse</label>
                    <select
                      value={stockWarehouseFilter}
                      onChange={(e) => {
                        setStockWarehouseFilter(e.target.value);
                        setStockPage(1);
                      }}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-navy outline-none"
                    >
                      <option value="all">All Warehouses</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-navy">Status</label>
                    <select
                      value={stockStatusFilter}
                      onChange={(e) => {
                        setStockStatusFilter(e.target.value as 'all' | 'in' | 'low' | 'out');
                        setStockPage(1);
                      }}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-navy outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="in">In Stock</option>
                      <option value="low">Low Stock</option>
                      <option value="out">Out of Stock</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setStockWarehouseFilter('all');
                        setStockStatusFilter('all');
                        setStockPage(1);
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={() => setIsStockFilterOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-purple hover:bg-purple-dark text-white text-[11px] font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Warehouse</th>
                    <th className="py-3 px-3">Stock</th>
                    <th className="py-3 px-3">Reserved</th>
                    <th className="py-3 px-3">Available</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {displayedStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 px-4 text-center text-slate-400">
                        {isLoading ? 'Loading stock ledger...' : 'No stock records match your search.'}
                      </td>
                    </tr>
                  )}
                  {displayedStockItems.map((si) => {
                    const status = stockStatus(si.quantityAvailable, si.quantityOnHand, si.reorderLevel);
                    return (
                      <tr key={si.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={si.imageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&auto=format&fit=crop&q=80'}
                              alt={si.productName}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-100"
                            />
                            <div className="font-bold text-navy text-xs">{si.productName}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-purple">{si.sku}</td>
                        <td className="py-3 px-3 text-slate-600">{si.warehouseName}</td>
                        <td className="py-3 px-3 font-bold text-navy">{si.quantityOnHand}</td>
                        <td className="py-3 px-3 text-slate-500">{si.quantityReserved}</td>
                        <td className="py-3 px-3 font-black text-navy">{si.quantityAvailable}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setAdjustProductId(si.productId);
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-bold text-navy"
                          >
                            Adjust
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
                page={stockPage}
                pageSize={STOCK_PAGE_SIZE}
                total={stockTotal}
                onPageChange={setStockPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. STOCK MOVEMENTS TAB */}
      {subTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">Depot / Warehouse</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3">Quantity Delta</th>
                  <th className="py-3 px-3">Balance After</th>
                  <th className="py-3 px-4">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {movements.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(m.createdAtUtc || Date.now()).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-bold text-navy">{m.productName || 'Aadhi Crackers Item'}</td>
                    <td className="py-3 px-3 text-slate-600">{m.warehouseName || 'Sivakasi Central Depot'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-black flex items-center space-x-1 ${
                          m.quantityChange > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {m.quantityChange > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-navy">{m.quantityAfter || 150}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. WAREHOUSE TRANSFERS TAB */}
      {subTab === 'transfers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transfers.map((tr) => (
              <div key={tr.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-purple text-xs">{tr.transferNumber}</span>
                    <h3 className="font-bold text-xs text-navy mt-0.5">
                      {tr.sourceWarehouseName} &rarr; {tr.destinationWarehouseName}
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                    {tr.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                  <div className="font-bold text-slate-500 text-[10px] uppercase">Transfer Line Items:</div>
                  {tr.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between font-bold text-navy">
                      <span>{it.productName}</span>
                      <span>x{it.quantity} boxes</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500 italic">"{tr.reason}"</p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Requested By: {tr.requestedBy}</span>
                  <span className="font-mono">{new Date(tr.createdAtUtc).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. LOW STOCK ALERTS TAB (design 13) */}
      {subTab === 'low-stock' && (
        <div className="space-y-4">
          {/* Severity tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs font-bold text-amber-700">Low Stock</div>
              <div className="text-3xl font-black text-navy mt-1">{alertCounts.low}</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs font-bold text-amber-700">Very Low Stock</div>
              <div className="text-3xl font-black text-navy mt-1">{alertCounts.veryLow}</div>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
              <div className="text-xs font-bold text-red-700">Out of Stock</div>
              <div className="text-3xl font-black text-navy mt-1">{alertCounts.out}</div>
            </div>
          </div>

          {/* Alerts table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Available Stock</th>
                    <th className="py-3 px-3">Reorder Level</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {visibleAlerts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-slate-400">
                        {isLoading ? 'Loading low stock alerts...' : 'No products are below their reorder level. All good!'}
                      </td>
                    </tr>
                  )}
                  {visibleAlerts.map((a) => {
                    const pill = ALERT_PILLS[alertSeverity(a)];
                    return (
                      <tr key={a.productId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={a.imageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&auto=format&fit=crop&q=80'}
                              alt={a.productName}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-100"
                            />
                            <div className="font-bold text-navy text-xs">{a.productName}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-purple">{a.sku}</td>
                        <td className="py-3 px-3 font-black text-navy">{a.quantityAvailable}</td>
                        <td className="py-3 px-3 text-slate-600">{a.reorderLevel}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pill.cls}`}>
                            {pill.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleQuickPo(a)}
                            disabled={quickPoBusyId === a.productId}
                            className="px-3 py-1.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-xs disabled:opacity-50"
                          >
                            {quickPoBusyId === a.productId ? 'Creating...' : 'Quick PO →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={handleDownloadReport}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>

              {lowStockAlerts.length > 8 && (
                <button
                  onClick={() => setShowAllAlerts((v) => !v)}
                  className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
                >
                  {showAllAlerts ? 'Show Less' : `View All (${lowStockAlerts.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. WAREHOUSES TAB */}
      {subTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] text-purple font-bold">{wh.code}</div>
                  <h3 className="font-bold text-sm text-navy">{wh.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{wh.address}</p>
                </div>
                {wh.isPrimary && (
                  <span className="px-2.5 py-0.5 rounded-full bg-gold/20 text-gold-dark text-[10px] font-black uppercase">
                    Primary Depot
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Depot Manager:</div>
                  <div className="font-bold text-slate-700">{wh.managerName || 'Murugan S.'}</div>
                  <div className="text-[10px] text-slate-500">{wh.phone || '+91 94431 22334'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold">Stock Capacity:</div>
                  <div className="font-bold text-navy">{wh.totalStock?.toLocaleString('en-IN') || '14,250'} Boxes</div>
                  <div className="text-[10px] text-emerald-600 font-bold">Valuation: ₹1.25 Cr</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Adjust Physical Stock Quantity
              </h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Select Product *</label>
                <select
                  value={adjustProductId}
                  onChange={(e) => setAdjustProductId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.availableQuantity || p.stockQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Depot / Warehouse *</label>
                <select
                  value={adjustWarehouseId}
                  onChange={(e) => setAdjustWarehouseId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Quantity Change (+ to add, - to subtract) *</label>
                <input
                  type="number"
                  value={adjustQtyChange}
                  onChange={(e) => setAdjustQtyChange(Number(e.target.value))}
                  placeholder="e.g. +25 or -5"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none focus:border-orange"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Reason for Adjustment *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  <option value="Physical Stock Verification Count">Physical Stock Verification Count</option>
                  <option value="Damaged / Moisture in Box">Damaged / Moisture in Box</option>
                  <option value="Supplier Replacement Received">Supplier Replacement Received</option>
                  <option value="Sample / Festival Demonstration">Sample / Festival Demonstration</option>
                  <option value="Correction of Entry">Correction of Entry</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handlePerformAdjustment}
                className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md shadow-orange/20"
              >
                Confirm & Record Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Inter-Warehouse Stock Transfer
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Source Warehouse (Origin) *</label>
                <select
                  value={transferSourceWh}
                  onChange={(e) => setTransferSourceWh(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Destination Warehouse (Target) *</label>
                <select
                  value={transferTargetWh}
                  onChange={(e) => setTransferTargetWh(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Select Product *</label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Transfer Quantity (Boxes) *</label>
                <input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Transfer Reason</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-navy outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handlePerformTransfer}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20"
              >
                Initiate Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
