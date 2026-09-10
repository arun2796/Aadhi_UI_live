import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Calendar,
  XCircle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { Expense, ProfitAndLossStatement, ReceivableItem, ExpenseCategory } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpFinanceAndPnlModuleProps {
  initialSubTab?: 'pnl' | 'expenses' | 'receivables';
}

/** Each route is its own standalone screen — the sidebar "Sales" item lands on 'pnl'. */
const SCREEN_HEADERS: Record<'pnl' | 'expenses' | 'receivables', { title: string; subtitle: string }> = {
  pnl: { title: 'Sales', subtitle: 'Revenue, profit & loss overview.' },
  expenses: { title: 'Expenses', subtitle: 'Operating expenses ledger.' },
  receivables: { title: 'Receivables', subtitle: 'Outstanding customer invoice balances.' }
};

export const ErpFinanceAndPnlModule: React.FC<ErpFinanceAndPnlModuleProps> = ({
  initialSubTab = 'pnl'
}) => {
  const { showToast } = useToast();
  // No in-module tab switching — the route decides which standalone screen is shown.
  const subTab = initialSubTab;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pnl, setPnl] = useState<ProfitAndLossStatement | null>(null);
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Expense Modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Transport');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(1500);
  const [expenseRef, setExpenseRef] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exp, pnlData, recs] = await Promise.all([
        api.getExpenses(),
        api.getProfitAndLoss(),
        api.getReceivables()
      ]);
      setExpenses(exp);
      setPnl(pnlData);
      setReceivables(recs);
    } catch {
      showToast('Failed to load financial records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Add Expense
  const handleSaveExpense = async () => {
    if (!expenseDescription || expenseAmount <= 0) {
      showToast('Please provide valid description and amount', 'warning');
      return;
    }

    try {
      await api.createExpense({
        expenseNumber: `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        category: expenseCategory,
        description: expenseDescription,
        amount: expenseAmount,
        tax: 0,
        paymentMethod: 'UPI',
        expenseDateUtc: new Date().toISOString(),
        reference: expenseRef || 'Receipt on file'
      });
      showToast('Expense recorded in general ledger!', 'success');
      setIsExpenseModalOpen(false);
      setExpenseDescription('');
      loadData();
    } catch {
      showToast('Failed to save expense', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — per-screen title (each sidebar item is its own screen) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{SCREEN_HEADERS[subTab].title}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{SCREEN_HEADERS[subTab].subtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {subTab === 'expenses' && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Operating Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. SALES SCREEN — profit & loss statement */}
      {subTab === 'pnl' && pnl && (
        <div className="space-y-6">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Revenue</div>
              <div className="text-xl font-black text-navy">₹{pnl.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-slate-500 font-medium">Total sales before returns</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost of Goods Sold (COGS)</div>
              <div className="text-xl font-black text-slate-700">₹{pnl.costOfGoodsSold.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-slate-500 font-medium">Direct fireworks procurement</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operating Expenses</div>
              <div className="text-xl font-black text-orange">₹{pnl.operatingExpenses.total.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-slate-500 font-medium">Transport, Packing, Utilities, Salaries</div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-navy to-[#1f1b54] text-white shadow-md shadow-navy/20 p-4 space-y-1">
              <div className="text-[10px] font-bold text-gold uppercase tracking-wider">Net Operating Profit</div>
              <div className="text-xl font-black text-white">₹{pnl.netOperatingProfit.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-emerald-400 font-bold">Net Margin: {pnl.netProfitMarginPercentage}%</div>
            </div>
          </div>

          {/* Full Detailed P&L Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <h3 className="font-black text-sm text-navy uppercase tracking-wider">
              Comprehensive Financial Statement (Fiscal Year 2026)
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-3 bg-slate-50 font-bold text-navy flex justify-between">
                <span>1. OPERATING REVENUE</span>
                <span>₹{pnl.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Gross Customer Fireworks Sales</span>
                <span>₹{pnl.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-red-600 font-medium">
                <span>Less: Customer Discounts & Coupons</span>
                <span>-₹{pnl.discountsTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-red-600 font-medium">
                <span>Less: Damaged Returns & Refunds</span>
                <span>-₹{pnl.returnsTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 bg-slate-50 font-bold text-navy flex justify-between">
                <span>NET SALES REVENUE</span>
                <span>₹{pnl.netSales.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3 bg-slate-50 font-bold text-navy flex justify-between">
                <span>2. COST OF GOODS SOLD (COGS)</span>
                <span>₹{pnl.costOfGoodsSold.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Opening Stock + Raw Material Purchases - Ending Stock</span>
                <span>₹{pnl.costOfGoodsSold.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-900 font-black flex justify-between">
                <span>GROSS PROFIT (Margin: {pnl.grossMarginPercentage}%)</span>
                <span>₹{pnl.grossProfit.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-3 bg-slate-50 font-bold text-navy flex justify-between">
                <span>3. OPERATING EXPENSES (OPEX)</span>
                <span>₹{pnl.operatingExpenses.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Transport & Sivakasi Courier Dispatches</span>
                <span>₹{pnl.operatingExpenses.transport.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Festive Cartons & Packaging Materials</span>
                <span>₹{pnl.operatingExpenses.packaging.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Depot Rent, Electricity & Safety Compliances</span>
                <span>₹{pnl.operatingExpenses.rentAndUtilities.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Warehouse Staff & Packing Salaries</span>
                <span>₹{pnl.operatingExpenses.salaries.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 pl-6 flex justify-between text-slate-600">
                <span>Marketing & Digital Promotion</span>
                <span>₹{pnl.operatingExpenses.marketing.toLocaleString('en-IN')}</span>
              </div>

              <div className="p-4 bg-gradient-to-r from-navy to-[#181944] text-white font-black text-sm flex justify-between">
                <span>NET OPERATING PROFIT (EBITDA)</span>
                <span className="text-gold">₹{pnl.netOperatingProfit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXPENSES SCREEN */}
      {subTab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Expense #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payment Method</th>
                  <th className="py-3 px-4">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isLoading
                        ? 'Loading expenses...'
                        : 'No operating expenses recorded yet. Use "Add Operating Expense" to post the first entry.'}
                    </td>
                  </tr>
                )}
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy">{exp.expenseNumber}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(exp.expenseDateUtc).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">{exp.description}</td>
                    <td className="py-3 px-3 font-black text-navy">₹{exp.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">{exp.paymentMethod}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">{exp.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. RECEIVABLES SCREEN */}
      {subTab === 'receivables' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Invoice Total</th>
                  <th className="py-3 px-3">Amount Received</th>
                  <th className="py-3 px-3">Balance Receivable</th>
                  <th className="py-3 px-3">Days Overdue</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {receivables.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isLoading
                        ? 'Loading receivables...'
                        : 'No outstanding receivables — every invoice is settled.'}
                    </td>
                  </tr>
                )}
                {receivables.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-navy">{rec.customerName}</td>
                    <td className="py-3 px-3 font-mono text-purple">{rec.invoiceNumber}</td>
                    <td className="py-3 px-3">₹{rec.invoiceAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-emerald-600 font-bold">₹{rec.paidAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-red-600 font-black">₹{rec.balanceAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                        {rec.daysOverdue} Days
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => showToast(`Payment reminder sent to ${rec.customerName}`, 'success')}
                        className="px-3 py-1 rounded-lg bg-orange text-white hover:bg-orange-hover text-xs font-bold shadow-2xs"
                      >
                        Send Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ADD OPERATING EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                Record Operating Expense
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Expense Category *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                >
                  <option value="Transport">Transport & Dispatch</option>
                  <option value="Packaging">Packaging Cartons & Strapping</option>
                  <option value="Electricity">Electricity & DG Fuel</option>
                  <option value="Rent">Depot Rent</option>
                  <option value="Salary">Staff / Packing Wages</option>
                  <option value="Marketing">Marketing & Banners</option>
                  <option value="Office">Office & Stationary</option>
                  <option value="Other">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Description / Payee *</label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="e.g. Sivakasi Lorry Freight Charges to Chennai"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Amount (₹) *</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Invoice / Voucher Reference</label>
                <input
                  type="text"
                  value={expenseRef}
                  onChange={(e) => setExpenseRef(e.target.value)}
                  placeholder="e.g. VOUCHER-984"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExpense}
                className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-md shadow-orange/20"
              >
                Record Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
