import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  Package,
  Layers,
  Users,
  DollarSign,
  Truck,
  Receipt,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const ErpReportsCenterModule: React.FC = () => {
  const { showToast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string>('sales');
  const [dateRange, setDateRange] = useState<string>('month');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const reportTypes = [
    { id: 'sales', name: 'Sales & Revenue Report', icon: TrendingUp, desc: 'Gross sales, taxes, discounts, net volume and daily trends.' },
    { id: 'products', name: 'Product Performance Report', icon: Package, desc: 'Top sellers, slow movers, margins, and units dispatched.' },
    { id: 'inventory', name: 'Stock Valuation & Aging Report', icon: Layers, desc: 'Depot stock on-hand, safety thresholds, and valuation.' },
    { id: 'purchases', name: 'Purchases & Vendor Ledger', icon: Truck, desc: 'PO procurements, raw materials, GRN, and supplier balances.' },
    { id: 'expenses', name: 'Operating Expenses Breakdown', icon: DollarSign, desc: 'Categorized OPEX, freight, packing wages, and utility bills.' },
    { id: 'tax', name: 'GST Tax Compliance Report', icon: Receipt, desc: '18% GST (CGST/SGST) input-output tax breakdown for filing.' }
  ];

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      showToast(`Generating ${selectedReport.toUpperCase()} CSV report...`, 'info');
      const blob = await api.exportCsv(selectedReport);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aadhi_${selectedReport}_report_${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('CSV export downloaded successfully!', 'success');
    } catch {
      showToast('Failed to export report CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Enterprise Analytics & CSV Export Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Download verified accounting ledgers, sales breakdowns, inventory valuation summaries, and GST tax statements.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none shadow-2xs"
          >
            <option value="today">Today's Transactions</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month (August 2026)</option>
            <option value="quarter">This Quarter (Q3 2026)</option>
            <option value="year">Full Fiscal Year (2026)</option>
          </select>

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-orange/20 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export Selected CSV'}</span>
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((rep) => {
          const Icon = rep.icon;
          const isSelected = selectedReport === rep.id;
          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-gradient-to-br from-navy to-[#1f1b54] text-white border-purple/50 shadow-lg shadow-navy/20'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-purple/40 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-orange text-white' : 'bg-slate-100 text-navy'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {isSelected && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-orange px-2 py-0.5 rounded-full text-white">
                    Selected
                  </span>
                )}
              </div>

              <h3 className={`font-black text-sm mt-3 ${isSelected ? 'text-white' : 'text-navy'}`}>
                {rep.name}
              </h3>
              <p className={`text-xs mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                {rep.desc}
              </p>

              <div className="pt-4 mt-3 border-t border-slate-200/20 flex items-center justify-between text-xs">
                <span className={`text-[10px] font-bold ${isSelected ? 'text-gold' : 'text-purple'}`}>
                  Server-side CSV Ready
                </span>
                <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  Format: .CSV / Excel
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Preview Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-navy uppercase tracking-wider">
              Data Structure Preview: {reportTypes.find((r) => r.id === selectedReport)?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Columns included in the generated server-side CSV stream for period: <span className="font-bold font-mono">{dateRange}</span>
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-bold flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Download .CSV</span>
          </button>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-xs text-slate-700 space-y-2 overflow-x-auto">
          {selectedReport === 'sales' && (
            <div className="text-xs space-y-1">
              <div className="font-bold text-navy">
                OrderId, OrderNumber, PlacedAt, CustomerName, Phone, City, Subtotal, Discount, Tax18Pct, ShippingFee, GrandTotal, PaymentMethod, Status
              </div>
              <div className="text-slate-500 text-[11px]">
                ord-001, ORD-2026-001248, 2026-08-31T10:30:00Z, Karthik Raja, 9876543210, Chennai, 2499.00, 0.00, 449.82, 0.00, 2499.00, UPI, Processing
              </div>
              <div className="text-slate-500 text-[11px]">
                ord-002, ORD-2026-001247, 2026-08-31T09:15:00Z, Priya Raman, 9840155667, Madurai, 4499.00, 500.00, 719.82, 0.00, 3999.00, Card, Delivered
              </div>
            </div>
          )}

          {selectedReport === 'products' && (
            <div className="text-xs space-y-1">
              <div className="font-bold text-navy">
                ProductId, SKU, ProductName, Category, Brand, SellingPrice, CostPrice, GrossMargin, UnitsSoldTotal, RevenueGenerated
              </div>
              <div className="text-slate-500 text-[11px]">
                prod-001, GB-DLX-001, Aadhi Deluxe Gift Box, Gift Boxes, Aadhi Crackers, 2999.00, 1850.00, 1149.00 (38.3%), 342, 1025658.00
              </div>
            </div>
          )}

          {selectedReport === 'inventory' && (
            <div className="text-xs space-y-1">
              <div className="font-bold text-navy">
                ProductId, SKU, ProductName, DepotCode, DepotName, QuantityOnHand, ReservedQty, AvailableStock, ReorderLevel, TotalValuation
              </div>
              <div className="text-slate-500 text-[11px]">
                prod-001, GB-DLX-001, Aadhi Deluxe Gift Box, WH-SVK-01, Sivakasi Central Depot, 150, 12, 138, 20, 449850.00
              </div>
            </div>
          )}

          {(selectedReport === 'purchases' || selectedReport === 'expenses' || selectedReport === 'tax') && (
            <div className="text-xs space-y-1">
              <div className="font-bold text-navy">
                ReferenceNumber, Date, CounterParty, Category, AmountExclusiveTax, GST18Pct, TotalAmount, SettlementStatus
              </div>
              <div className="text-slate-500 text-[11px]">
                TXN-2026-9812, 2026-08-31, Standard Fireworks Pvt Ltd, Raw Material Procurements, 285000.00, 51300.00, 336300.00, Paid
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
