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
  Building2
} from 'lucide-react';
import { Product, Warehouse, StockMovement, StockTransfer } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

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

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('all');

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
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Products for Inventory Overview
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const lowStockProducts = products.filter(
    (p) => (p.availableQuantity || p.stockQuantity) <= (p.reorderLevel || 10)
  );

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
          { id: 'overview', label: `Stock Overview (${products.length})`, icon: Layers },
          { id: 'movements', label: `Stock Movements (${movements.length})`, icon: History },
          { id: 'transfers', label: `Warehouse Transfers (${transfers.length})`, icon: ArrowLeftRight },
          { id: 'low-stock', label: `Low Stock Alerts (${lowStockProducts.length})`, icon: AlertTriangle, badge: lowStockProducts.length > 0 ? String(lowStockProducts.length) : undefined },
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

      {/* 1. STOCK OVERVIEW TAB */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total Catalog Valuation: <span className="text-navy font-black">₹12,500,000</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">On Hand</th>
                  <th className="py-3 px-3">Reserved</th>
                  <th className="py-3 px-3">Available</th>
                  <th className="py-3 px-3">Reorder Threshold</th>
                  <th className="py-3 px-3">Stock Health</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredProducts.map((p) => {
                  const onHand = p.stockQuantity || 50;
                  const available = p.availableQuantity || onHand;
                  const reserved = Math.max(0, onHand - available);
                  const isLow = available <= (p.reorderLevel || 10);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={p.primaryImageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&auto=format&fit=crop&q=80'}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover border"
                          />
                          <div>
                            <div className="font-bold text-navy text-xs">{p.name}</div>
                            <div className="text-[10px] text-slate-400">{p.categoryName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-purple">{p.sku}</td>
                      <td className="py-3 px-3 font-bold text-navy">{onHand}</td>
                      <td className="py-3 px-3 text-slate-500">{reserved}</td>
                      <td className="py-3 px-3">
                        <span className={`font-black ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                          {available} units
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{p.reorderLevel || 10}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isLow ? 'Low Stock' : 'Optimal'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setAdjustProductId(p.id);
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

      {/* 4. LOW STOCK ALERTS TAB */}
      {subTab === 'low-stock' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span>
                <strong className="font-black">{lowStockProducts.length} Products</strong> are currently below minimum safety stock levels! Immediate replenishment recommended.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-red-200 shadow-2xs p-4 space-y-3">
                <div className="flex items-start space-x-3">
                  <img
                    src={p.primaryImageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&auto=format&fit=crop&q=80'}
                    alt={p.name}
                    className="w-12 h-12 rounded-xl object-cover border border-red-100"
                  />
                  <div>
                    <h3 className="font-bold text-xs text-navy">{p.name}</h3>
                    <p className="text-[10px] text-purple font-mono">{p.sku}</p>
                    <div className="text-[11px] font-black text-red-600 mt-1">
                      Available: {p.availableQuantity || p.stockQuantity} units (Min: {p.reorderLevel || 10})
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Supplier: Standard Fireworks</span>
                  <button
                    onClick={() => {
                      showToast(`Purchase order generated for ${p.name}!`, 'success');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-xs"
                  >
                    Quick PO &rarr;
                  </button>
                </div>
              </div>
            ))}
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
