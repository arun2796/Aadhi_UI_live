import React, { useState, useEffect } from 'react';
import {
  Layers,
  Warehouse,
  ArrowLeftRight,
  SlidersHorizontal,
  History,
  AlertTriangle,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { Product, StockMovement } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpInventoryPage: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'warehouses'>('stock');

  // Adjust stock modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Transfer stock modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferQty, setTransferQty] = useState<number>(10);

  // Mock stock movements ledger
  const [movements, setMovements] = useState<any[]>([
    {
      id: 'sm-1',
      date: '31 May 2024, 11:30 AM',
      sku: 'GB-DLX-001',
      product: 'Aadhi Deluxe Gift Box',
      type: 'Sale',
      warehouse: 'Coimbatore Hub',
      change: -1,
      before: 141,
      after: 140,
      ref: 'ORD#1248'
    },
    {
      id: 'sm-2',
      date: '31 May 2024, 09:15 AM',
      sku: 'AER-30S-001',
      product: 'Aerial Shot - 30 Shots',
      type: 'Adjustment',
      warehouse: 'Sivakasi Main Plant',
      change: +20,
      before: 25,
      after: 45,
      ref: 'Stock transferred from Sivakasi factory'
    },
    {
      id: 'sm-3',
      date: '30 May 2024, 04:00 PM',
      sku: 'GB-MGA-002',
      product: 'Mega Celebration Box',
      type: 'TransferIn',
      warehouse: 'Coimbatore Hub',
      change: +30,
      before: 50,
      after: 80,
      ref: 'TRF-SIV-CBE-001'
    }
  ]);

  useEffect(() => {
    api.getProducts().then(setProducts);
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustReason.trim()) return;

    try {
      const updated = await api.adjustStock(selectedProduct.id, newQuantity, adjustReason);
      if (updated) {
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        setMovements([
          {
            id: 'sm-' + Date.now(),
            date: 'Just now',
            sku: updated.sku,
            product: updated.name,
            type: 'Adjustment',
            warehouse: 'Sivakasi Main Plant',
            change: newQuantity - selectedProduct.availableQuantity,
            before: selectedProduct.availableQuantity,
            after: newQuantity,
            ref: adjustReason
          },
          ...movements
        ]);
        setIsAdjustModalOpen(false);
        showToast(`Stock updated for ${updated.name} to ${newQuantity}!`, 'success');
      }
    } catch {
      showToast('Adjustment failed', 'error');
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    showToast(`Transferred ${transferQty} units of ${selectedProduct.name} to Coimbatore Hub!`, 'success');
    setIsTransferModalOpen(false);
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
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-orange/10 text-orange flex items-center justify-center flex-shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-navy text-sm">Sivakasi Main Factory & Godown</span>
              <span className="px-2 py-0.5 rounded bg-orange text-white text-[9px] font-bold">Primary</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Thiruthangal, Sivakasi • Total Stock: <strong>12,450 units</strong></div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple/10 text-purple flex items-center justify-center flex-shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-navy text-sm">Coimbatore Express Distribution Hub</span>
              <span className="px-2 py-0.5 rounded bg-purple text-white text-[9px] font-bold">Hub</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Saravanampatti, Coimbatore • Total Stock: <strong>4,820 units</strong></div>
          </div>
        </div>
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
                  <th className="py-3 px-4">Warehouse</th>
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
                      <td className="py-3.5 px-4 text-slate-600">Sivakasi Plant / Coimbatore</td>
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
                  <th className="py-3 px-4">SKU & Product</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Qty Delta</th>
                  <th className="py-3 px-4">Before → After</th>
                  <th className="py-3 px-4">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans text-slate-500 text-[11px]">{m.date}</td>
                    <td className="py-3 px-4 font-sans">
                      <strong className="text-navy block">{m.product}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{m.sku}</span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">{m.warehouse}</td>
                    <td className={`py-3 px-4 font-bold ${m.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.change > 0 ? `+${m.change}` : m.change}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{m.before} → {m.after}</td>
                    <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">{m.ref}</td>
                  </tr>
                ))}
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
              <input disabled value="Sivakasi Main Factory & Godown" className="w-full px-3 py-2 rounded-xl border bg-slate-100 text-slate-600" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Destination Warehouse</label>
              <input disabled value="Coimbatore Express Distribution Hub" className="w-full px-3 py-2 rounded-xl border bg-slate-100 text-slate-600" />
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
