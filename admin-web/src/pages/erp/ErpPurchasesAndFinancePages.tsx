import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Receipt,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { PurchaseOrder, Supplier, Invoice, Expense } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpPurchasesPage: React.FC = () => {
  const { showToast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState(250000);

  const loadData = async () => {
    try {
      const [pos, sups] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers()
      ]);
      setPurchaseOrders(pos);
      setSuppliers(sups);
      if (sups.length > 0) setSelectedSupplierId(sups[0].id);
    } catch (err) {
      console.error('Failed to load purchases:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }

    try {
      const sup = suppliers.find(s => s.id === selectedSupplierId);
      await api.createPurchaseOrder({
        supplierId: selectedSupplierId,
        supplierName: sup?.name || 'Sivakasi Raw Chemicals',
        grandTotal: estimatedAmount,
        subtotal: Math.round(estimatedAmount / 1.18),
        tax: Math.round(estimatedAmount - (estimatedAmount / 1.18)),
        status: 'Submitted',
        notes: 'Seasonal bulk inventory procurement for Diwali 2026'
      });
      await loadData();
      setIsPoModalOpen(false);
      showToast('Purchase Order created successfully!', 'success');
    } catch {
      showToast('Failed to create Purchase Order', 'error');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">Procurement & Purchases</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage raw material suppliers, vendor purchase orders, and factory replenishment.</p>
        </div>
        <button
          onClick={() => setIsPoModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow"
        >
          <Plus className="w-4 h-4" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Suppliers Directory */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-navy">Approved Suppliers & Factories ({suppliers.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy text-xs">{sup.name}</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">{sup.code}</span>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed">
                Contact: {sup.contactPerson || 'Sales Desk'} • {sup.phone} <br />
                {sup.address || 'Sivakasi Industrial Estate, Tamil Nadu'}
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px]">
                <span className="font-bold text-emerald-600">Active Vendor</span>
                <span className="text-slate-400">{sup.totalPurchaseOrders || 0} POs Completed</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
        <h3 className="font-bold text-sm text-navy">Recent Purchase Orders ({purchaseOrders.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Grand Total</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.length > 0 ? (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono font-bold text-navy">{po.poNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{po.supplierName}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {po.orderDateUtc ? new Date(po.orderDateUtc).toLocaleDateString('en-IN') : 'Recently'}
                    </td>
                    <td className="py-3.5 px-4 font-black text-navy">₹{po.grandTotal?.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple/10 text-purple">
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">No purchase orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={isPoModalOpen} onClose={() => setIsPoModalOpen(false)} title="Create New Purchase Order" maxWidth="max-w-md">
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Supplier *</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Estimated Total (₹)</label>
            <input
              type="number"
              value={estimatedAmount}
              onChange={(e) => setEstimatedAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
            />
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <button type="button" onClick={() => setIsPoModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange hover:bg-orange-hover text-white font-bold rounded-xl shadow-glow"
            >
              Submit PO
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ErpFinancePage: React.FC = () => {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    category: 'Transport' as any,
    description: '',
    amount: 15000
  });

  const loadData = async () => {
    try {
      const [invs, exps] = await Promise.all([
        api.getInvoices(),
        api.getExpenses()
      ]);
      setInvoices(invs);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) {
      showToast('Description and amount required', 'error');
      return;
    }

    try {
      await api.createExpense(newExpense);
      await loadData();
      setIsExpenseModalOpen(false);
      showToast('Expense recorded successfully', 'success');
    } catch {
      showToast('Failed to record expense', 'error');
    }
  };

  const totalInvoiced = invoices.reduce((acc, i) => acc + (i.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netMargin = totalPaid - totalExpenses;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">Finance, Invoices & Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track financial health, operating expenditures, and profit margins.</p>
        </div>
        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-purple hover:bg-purple-light text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* P&L Snapshot Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-navy text-white shadow-card space-y-1">
          <div className="text-xs text-slate-300 font-medium">Total Invoiced (Revenue)</div>
          <div className="text-2xl font-black text-white">₹{totalInvoiced.toLocaleString('en-IN')}</div>
          <div className="text-xs text-emerald-400 font-semibold pt-2">₹{totalPaid.toLocaleString('en-IN')} collected</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-400 font-medium">Operating Expenses</div>
          <div className="text-2xl font-black text-red-600">₹{totalExpenses.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-500 pt-2">{expenses.length} expense entries</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-400 font-medium">Net Realized Balance</div>
          <div className={`text-2xl font-black ${netMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{netMargin.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 pt-2">Collection minus expenses</div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
        <h3 className="font-bold text-sm text-navy">Generated Tax Invoices ({invoices.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Issued Date</th>
                <th className="py-3 px-4">Grand Total</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono font-bold text-navy">{inv.invoiceNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{inv.customerName || 'Customer'}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {inv.issuedAtUtc ? new Date(inv.issuedAtUtc).toLocaleDateString('en-IN') : 'Recently'}
                    </td>
                    <td className="py-3.5 px-4 font-black text-navy">₹{inv.grandTotal?.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No invoices generated yet. Invoices are automatically created on order placement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses Modal */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Record Operational Expense" maxWidth="max-w-md">
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Expense Description *</label>
            <input
              required
              type="text"
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              placeholder="e.g. Sivakasi freight logistics"
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Category *</label>
            <select
              value={newExpense.category as string}
              onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as any })}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            >
              <option value="Transport">Freight & Transport</option>
              <option value="Packaging">Packaging Supplies</option>
              <option value="Electricity">Electricity & Utilities</option>
              <option value="Salary">Salaries & Labor</option>
              <option value="Other">Other Operating Expense</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
            <input
              required
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple hover:bg-purple-light text-white font-bold rounded-xl shadow-glow"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ErpReportsPage: React.FC = () => {
  const { showToast } = useToast();

  const handleExport = (type: string) => {
    window.open(`http://localhost:5050/api/v1/reports/export/${type}`, '_blank');
    showToast(`Downloading ${type} CSV export...`, 'info');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-navy">Business Reports & Data Export</h1>
        <p className="text-xs text-slate-500 mt-0.5">Export GST compliance records, sales registers, and inventory audit trails.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-orange/10 text-orange flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-navy">Sales & Revenue Register</h3>
            <p className="text-xs text-slate-500 mt-1">Detailed row-by-row breakdown of all verified and fulfilled orders with GST tax splits.</p>
          </div>
          <button
            onClick={() => handleExport('sales')}
            className="w-full py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-glow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-purple/10 text-purple flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-navy">Inventory Valuation Report</h3>
            <p className="text-xs text-slate-500 mt-1">Current warehouse inventory levels, safety stock deficits, and unit cost valuations.</p>
          </div>
          <button
            onClick={() => handleExport('inventory')}
            className="w-full py-2.5 rounded-xl bg-purple hover:bg-purple-light text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-glow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-navy">GST Filing Summary</h3>
            <p className="text-xs text-slate-500 mt-1">Aggregated B2C & B2B GST tax returns ready for monthly GSTR-1 and GSTR-3B filings.</p>
          </div>
          <button
            onClick={() => handleExport('gst')}
            className="w-full py-2.5 rounded-xl bg-navy hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-glow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
