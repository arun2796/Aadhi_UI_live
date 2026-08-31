import React, { useState } from 'react';
import {
  Truck,
  Plus,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpPurchasesPage: React.FC = () => {
  const { showToast } = useToast();
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);

  const purchaseOrders = [
    { id: 'PO-2024-001', supplier: 'Sri Kaliswari Fireworks Ltd', date: '28 May 2024', status: 'Received', items: 500, amount: 450000 },
    { id: 'PO-2024-002', supplier: 'Standard Fireworks Pvt Ltd', date: '25 May 2024', status: 'PartiallyReceived', items: 300, amount: 280000 },
    { id: 'PO-2024-003', supplier: 'Sony Fireworks Sivakasi', date: '20 May 2024', status: 'Received', items: 400, amount: 360000 }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">Purchase Orders & Goods Receipt (GRN)</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage raw material and finished fireworks procurement.</p>
        </div>
        <button
          onClick={() => setIsPoModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">PO Number</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Order Date</th>
              <th className="py-3 px-4">Total Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchaseOrders.map((po) => (
              <tr key={po.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-bold text-navy">{po.id}</td>
                <td className="py-3.5 px-4 font-semibold text-slate-700">{po.supplier}</td>
                <td className="py-3.5 px-4 text-slate-500">{po.date}</td>
                <td className="py-3.5 px-4 font-black text-navy">₹{po.amount.toLocaleString('en-IN')}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {po.status}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => showToast(`Goods Receipt generated for ${po.id}!`, 'success')}
                    className="px-3 py-1 bg-slate-100 hover:bg-navy hover:text-white rounded-lg text-navy font-bold text-xs transition-colors"
                  >
                    Receive Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isPoModalOpen} onClose={() => setIsPoModalOpen(false)} title="Create Purchase Order" maxWidth="max-w-md">
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Supplier</label>
            <select className="w-full px-3 py-2 rounded-xl border">
              <option>Sri Kaliswari Fireworks Ltd (Sivakasi)</option>
              <option>Standard Fireworks Pvt Ltd</option>
              <option>Sony Fireworks</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Destination Warehouse</label>
            <input disabled value="Sivakasi Main Factory & Godown" className="w-full px-3 py-2 rounded-xl border bg-slate-100" />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Estimated Total (₹)</label>
            <input type="number" defaultValue={250000} className="w-full px-3 py-2 rounded-xl border" />
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <button onClick={() => setIsPoModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
            <button
              onClick={() => { setIsPoModalOpen(false); showToast('Purchase Order PO-2024-004 created!', 'success'); }}
              className="px-5 py-2 bg-orange text-white font-bold rounded-xl shadow-glow"
            >
              Submit PO
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const ErpFinancePage: React.FC = () => {
  const { showToast } = useToast();

  const expenses = [
    { id: 'EXP-101', category: 'Transport', desc: 'Sivakasi to Coimbatore Dangerous Goods Freight', amount: 35000, date: '30 May 2024' },
    { id: 'EXP-102', category: 'Packaging', desc: '5-Ply Corrugated Gift Boxes & Bubble Roll Batch', amount: 48000, date: '28 May 2024' },
    { id: 'EXP-103', category: 'Electricity', desc: 'Factory & Godown HT Power Bill', amount: 22500, date: '25 May 2024' },
    { id: 'EXP-104', category: 'Salary', desc: 'Warehouse & Logistics Staff Payout', amount: 145000, date: '20 May 2024' }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">Finance, Invoices & Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track financial health, operating expenditures, and profit margins.</p>
        </div>
      </div>

      {/* P&L Snapshot Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-navy text-white shadow-card space-y-1">
          <div className="text-xs text-slate-300 font-medium">Gross Revenue (Month)</div>
          <div className="text-2xl font-black text-white">₹24,85,650</div>
          <div className="text-xs text-emerald-400 font-semibold pt-2">+18.5% YoY Growth</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium">Total Operating Expenses</div>
          <div className="text-2xl font-black text-red-600">₹2,50,500</div>
          <div className="text-xs text-slate-400 pt-2">Freight, Packing, Power & Payroll</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium">Net Operating Profit</div>
          <div className="text-2xl font-black text-emerald-600">₹6,45,230</div>
          <div className="text-xs text-emerald-600 font-bold pt-2">25.9% Net Profit Margin</div>
        </div>
      </div>

      {/* Expenses Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-navy">Operating Expenses Ledger</h3>
          <button
            onClick={() => showToast('New expense recorded', 'success')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-navy hover:text-white text-navy text-xs font-bold transition-colors"
          >
            + Add Expense
          </button>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y">
            <tr>
              <th className="py-2.5 px-3">Expense ID</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="py-3 px-3 font-bold text-navy">{exp.id}</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-[11px] text-slate-700">
                    {exp.category}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-700">{exp.desc}</td>
                <td className="py-3 px-3 text-slate-500">{exp.date}</td>
                <td className="py-3 px-3 text-right font-black text-navy">₹{exp.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ErpReportsPage: React.FC = () => {
  const { showToast } = useToast();

  const handleExportCsv = (reportType: string) => {
    // Generate CSV data client-side and trigger download
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,OrderNumber,Customer,Product,Quantity,Amount,PaymentMethod,Status\n"
      + "2024-05-31,ORD#1248,Ramesh Kumar,Aadhi Deluxe Gift Box,1,2499,UPI,Paid\n"
      + "2024-05-31,ORD#1247,Suresh Babu,Festival Special Box,1,1999,CreditCard,Paid\n"
      + "2024-05-31,ORD#1246,Vijay Kumar,Mega Celebration Box,1,3499,COD,Pending\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aadhi_${reportType}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Downloaded ${reportType.toUpperCase()} report as CSV!`, 'success');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">Enterprise Reports & Data Export</h1>
          <p className="text-xs text-slate-500 mt-0.5">Generate exportable audit-ready spreadsheets and sales insights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Sales & Orders Report', desc: 'Itemized revenue, discounts, taxes, and customer breakdown', type: 'sales' },
          { title: 'Inventory & Stock Ledger', desc: 'Warehouse balance, reorder limits, and stock valuation', type: 'inventory' },
          { title: 'Tax & GST Statement', desc: 'CGST, SGST, IGST breakdown for monthly GSTR-1 filings', type: 'gst' },
          { title: 'Profit & Loss Statement', desc: 'Net revenue versus COGS and direct operating costs', type: 'pnl' }
        ].map((rep, idx) => (
          <div key={idx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange/10 text-orange flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-navy">{rep.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rep.desc}</p>
            </div>

            <button
              onClick={() => handleExportCsv(rep.type)}
              className="w-full py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
