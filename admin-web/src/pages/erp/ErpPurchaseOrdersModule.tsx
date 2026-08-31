import React, { useState, useEffect } from 'react';
import {
  Truck,
  Store,
  DollarSign,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileCheck,
  Building,
  Phone,
  Mail,
  Receipt,
  Eye,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Supplier, PurchaseOrder, GoodsReceivedNote, SupplierBill, Product, Warehouse } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpPurchaseOrdersModuleProps {
  initialSubTab?: 'purchases' | 'suppliers' | 'grn' | 'bills';
}

export const ErpPurchaseOrdersModule: React.FC<ErpPurchaseOrdersModuleProps> = ({
  initialSubTab = 'purchases'
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'purchases' | 'suppliers' | 'grn' | 'bills'>(initialSubTab);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sups, pos, gnotes, blls, prods, whs] = await Promise.all([
        api.getSuppliers(),
        api.getPurchases(),
        api.getGoodsReceivedNotes(),
        api.getSupplierBills(),
        api.getProducts(),
        api.getWarehouses()
      ]);
      setSuppliers(sups);
      setPurchases(pos);
      setGrns(gnotes);
      setBills(blls);
      setProducts(prods);
      setWarehouses(whs);

      if (sups.length > 0) setPoSupplierId(sups[0].id);
      if (whs.length > 0) setPoWarehouseId(whs[0].id);
      if (prods.length > 0) {
        setPoProductId(prods[0].id);
        setPoUnitPrice(prods[0].costPrice || 600);
      }
    } catch {
      showToast('Failed to load purchase & supplier data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle PO Creation
  const handleCreatePo = async () => {
    if (!poSupplierId || !poProductId || poQuantity <= 0) {
      showToast('Please fill all required PO fields', 'warning');
      return;
    }

    const selectedSup = suppliers.find((s) => s.id === poSupplierId);
    const selectedWh = warehouses.find((w) => w.id === poWarehouseId);
    const selectedProd = products.find((p) => p.id === poProductId);

    const subtotal = poQuantity * poUnitPrice;
    const tax = Math.round(subtotal * 0.18);
    const grandTotal = subtotal + tax;

    const newPo: Partial<PurchaseOrder> = {
      poNumber: `PO-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      supplierId: poSupplierId,
      supplierName: selectedSup?.name || 'Standard Fireworks',
      warehouseId: poWarehouseId,
      warehouseName: selectedWh?.name || 'Sivakasi Depot',
      status: 'Approved',
      subtotal,
      tax,
      grandTotal,
      orderDateUtc: new Date().toISOString(),
      expectedDeliveryDateUtc: new Date(Date.now() + 86400000 * 7).toISOString(),
      notes: poNotes,
      items: [
        {
          id: `poi-${Date.now()}`,
          productId: poProductId,
          productName: selectedProd?.name || 'Crackers Box',
          sku: selectedProd?.sku || 'SKU-001',
          unitPrice: poUnitPrice,
          quantityOrdered: poQuantity,
          quantityReceived: 0,
          lineTotal: subtotal
        }
      ]
    };

    try {
      await api.createPurchaseOrder(newPo);
      showToast('Purchase Order generated and submitted for approval!', 'success');
      setIsPoModalOpen(false);
      loadData();
    } catch {
      showToast('Failed to create purchase order', 'error');
    }
  };

  // Handle Supplier Save
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
      loadData();
    } catch {
      showToast('Failed to add supplier', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Purchases, Suppliers & Goods Receiving (GRN)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage raw materials & finished goods procurement, vendor accounts, GRN receipt inspections, and supplier bills.
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
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-navy hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-purple" />
            <span>Add Supplier</span>
          </button>

          <button
            onClick={() => setIsPoModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'purchases', label: `Purchase Orders (${purchases.length})`, icon: Truck },
          { id: 'suppliers', label: `Suppliers Directory (${suppliers.length})`, icon: Store },
          { id: 'grn', label: `Goods Received Notes (${grns.length})`, icon: FileCheck },
          { id: 'bills', label: `Supplier Bills (${bills.length})`, icon: Receipt }
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

      {/* 1. PURCHASE ORDERS TAB */}
      {subTab === 'purchases' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">PO Number & Date</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Target Depot</th>
                  <th className="py-3 px-3">Items Count</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Lifecycle Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-navy text-xs">{po.poNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(po.orderDateUtc).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">{po.supplierName}</td>
                    <td className="py-3 px-3 text-slate-600">{po.warehouseName}</td>
                    <td className="py-3 px-3 font-bold">{po.items?.length || 1} line items</td>
                    <td className="py-3 px-3 font-black text-navy">₹{po.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          showToast(`GRN verification opened for ${po.poNumber}`, 'info');
                          setSubTab('grn');
                        }}
                        className="px-3 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark text-xs font-bold shadow-2xs"
                      >
                        Receive Goods
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SUPPLIERS DIRECTORY TAB */}
      {subTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-purple font-bold">{sup.code}</span>
                  <h3 className="font-bold text-sm text-navy mt-0.5">{sup.name}</h3>
                  <p className="text-xs text-slate-500">{sup.companyName || sup.name}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  Active Vendor
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Contact Person:</div>
                  <div className="font-bold text-slate-700">{sup.contactPerson || 'Sales Desk'}</div>
                  <div className="text-[10px] text-slate-500">{sup.phone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">GSTIN:</div>
                  <div className="font-mono text-slate-700">{sup.gstNumber || '33AAAAA0000A1Z5'}</div>
                  <div className="text-[10px] text-slate-500">Terms: {sup.paymentTerms || 'Net 30'}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Outstanding: <strong className="text-red-600">₹{sup.outstandingBalance?.toLocaleString('en-IN') || '0'}</strong></span>
                <button
                  onClick={() => {
                    setPoSupplierId(sup.id);
                    setIsPoModalOpen(true);
                  }}
                  className="px-3 py-1 rounded-xl bg-orange text-white hover:bg-orange-hover text-xs font-bold"
                >
                  Create PO &rarr;
                </button>
              </div>
            </div>
          ))}
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
                    <td className="py-3 px-3 font-bold text-navy">₹{b.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-emerald-600 font-bold">₹{b.paidAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-red-600 font-black">₹{b.balanceAmount.toLocaleString('en-IN')}</td>
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
                Submit Purchase Order
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
    </div>
  );
};
