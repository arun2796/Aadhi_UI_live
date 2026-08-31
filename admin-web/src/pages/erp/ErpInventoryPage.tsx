import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  SlidersHorizontal,
  History,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Product, Warehouse } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpInventoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'warehouses'>('stock');

  // Adjust stock modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Transfer stock modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferQty, setTransferQty] = useState<number>(10);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');

  const loadData = async () => {
    try {
      const [prods, whs, movs] = await Promise.all([
        api.getProducts(),
        api.getWarehouses(),
        api.getStockMovements()
      ]);
      setProducts(prods);
      setWarehouses(whs);
      setMovements(movs);
      if (whs.length >= 2) {
        setSourceWarehouseId(whs[0].id);
        setTargetWarehouseId(whs[1].id);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustReason.trim()) return;

    const delta = newQuantity - (selectedProduct.stockQuantity || selectedProduct.availableQuantity);
    try {
      await api.adjustStock(selectedProduct.id, delta, adjustReason, warehouses[0]?.id);
      await loadData();
      setIsAdjustModalOpen(false);
      showToast(`Stock updated for ${selectedProduct.name} to ${newQuantity}!`, 'success');
    } catch {
      showToast('Adjustment failed', 'error');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!sourceWarehouseId || !targetWarehouseId || sourceWarehouseId === targetWarehouseId) {
      showToast('Please select distinct source and target warehouses', 'error');
      return;
    }

    try {
      await api.transferStock({
        productId: selectedProduct.id,
        sourceWarehouseId,
        targetWarehouseId,
        quantity: transferQty,
        reason: `Transfer requested from ERP portal`
      });
      await loadData();
      showToast(`Transferred ${transferQty} units of ${selectedProduct.name}!`, 'success');
      setIsTransferModalOpen(false);
    } catch {
      showToast('Stock transfer failed', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Inventory & Warehouse Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock ledger, multi-warehouse allocations, and adjustment audits.
          </p>
        </div>
      </div>

      {/* Warehouses Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.length > 0 ? (
          warehouses.slice(0, 2).map((wh, idx) => (
            <div key={wh.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl ${idx === 0 ? 'bg-orange/10 text-orange' : 'bg-purple/10 text-purple'} flex items-center justify-center flex-shrink-0`}>
                <WarehouseIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-navy text-sm">{wh.name}</span>
                  {wh.isPrimary && <span className="px-2 py-0.5 rounded bg-orange text-white text-[9px] font-bold">Primary</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{wh.address || 'Sivakasi, TN'} • Total Stock: <strong>{(wh.totalStock || 50000).toLocaleString()} units</strong></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-orange/10 text-orange flex items-center justify-center flex-shrink-0">
                <WarehouseIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-navy text-sm">Sivakasi Main Godown</span>
                  <span className="px-2 py-0.5 rounded bg-orange text-white text-[9px] font-bold">Primary</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Thiruthangal, Sivakasi</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'stock' ? 'bg-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Stock on Hand ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'movements' ? 'bg-navy text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Immutable Stock Movements Ledger ({movements.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Product Info</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Total Stock</th>
                  <th className="py-3 px-4">Available Qty</th>
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isLow = p.availableQuantity <= p.reorderLevel;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-navy">{p.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{p.sku}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">{p.stockQuantity}</td>
                      <td className="py-3.5 px-4 font-black text-sm text-navy">{p.availableQuantity}</td>
                      <td className="py-3.5 px-4 text-slate-500">{p.reorderLevel}</td>
                      <td className="py-3.5 px-4">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setNewQuantity(p.availableQuantity);
                            setAdjustReason('');
                            setIsAdjustModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-navy font-bold text-[11px]"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setIsTransferModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-purple hover:bg-purple-light text-white font-bold text-[11px]"
                        >
                          Transfer
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

      {activeTab === 'movements' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Qty Delta</th>
                  <th className="py-3 px-4">Before → After</th>
                  <th className="py-3 px-4">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {movements.length > 0 ? (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-sans text-slate-500 text-[11px]">
                        {m.timestampUtc ? new Date(m.timestampUtc).toLocaleString('en-IN') : (m.date || 'Recently')}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <strong className="text-navy block">{m.productName || m.product}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{m.sku || ''}</span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                          {m.movementType || m.type}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold ${(m.quantityChange ?? m.change) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {(m.quantityChange ?? m.change) > 0 ? `+${m.quantityChange ?? m.change}` : (m.quantityChange ?? m.change)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{m.quantityBefore ?? m.before} → {m.quantityAfter ?? m.after}</td>
                      <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">{m.reason || m.ref || m.referenceId}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No stock movements recorded yet. Movements appear on order fulfillment and adjustments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={selectedProduct ? `Adjust Stock - ${selectedProduct.name}` : ''}
        maxWidth="max-w-md"
      >
        {selectedProduct && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border text-slate-600">
              Current Available Quantity: <strong className="text-navy">{selectedProduct.availableQuantity}</strong>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">New Total Quantity *</label>
              <input
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Audit Reason (Required) *</label>
              <textarea
                required
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Physical inventory recount at Sivakasi Godown"
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 text-slate-500 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold"
              >
                Save Adjustment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Transfer Stock Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={selectedProduct ? `Transfer Stock - ${selectedProduct.name}` : ''}
        maxWidth="max-w-md"
      >
        {selectedProduct && (
          <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Source Warehouse</label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Destination Warehouse</label>
              <select
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Quantity to Transfer</label>
              <input
                type="number"
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
                min={1}
                max={selectedProduct.availableQuantity}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 text-slate-500 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold"
              >
                Dispatch Transfer
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
