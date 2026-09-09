import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  IndianRupee,
  ShoppingCart,
  Users,
  Receipt,
  BarChart3,
  CreditCard,
  Layers
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { DashboardKpis, SalesReport, TopProduct, CategorySales, PaymentMethodReport } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type PeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'year';

const PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' }
];

type CompareMode = 'previous' | 'year' | 'none';

const COMPARE_OPTIONS: { id: CompareMode; label: string }[] = [
  { id: 'previous', label: 'Previous Period' },
  { id: 'year', label: 'Previous Year' },
  { id: 'none', label: 'None' }
];

// The backend sales-overview endpoint only accepts a relative period preset
// ("7days" | "month" | "quarter" | "year"; anything else falls back to 30 days),
// so UI presets are mapped onto the closest supported window.
const API_PERIOD: Record<PeriodPreset, string> = {
  today: '7days',
  week: '7days',
  month: 'month',
  quarter: 'quarter',
  year: 'year'
};

// There is no compare endpoint server-side. "Previous Period" deltas are computed
// client-side: fetch a series roughly twice the selected window, then slice it by
// date into the current window vs the immediately preceding window of equal length.
const COMPARE_FETCH_PERIOD: Record<PeriodPreset, string> = {
  today: '7days',
  week: 'month',
  month: 'quarter',
  quarter: 'year',
  year: 'year' // 365 days is the API's maximum — 'year' compares H2 vs H1 of the trailing year
};

const COMPARE_WINDOW_DAYS: Record<PeriodPreset, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 182
};

interface TrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

/** Accepts both the FE contract shape (salesByDate/revenue) and the live API shape (salesTrend/sales). */
const normalizeSeries = (report?: SalesReport | null): TrendPoint[] => {
  const raw: any[] = (report as any)?.salesByDate ?? (report as any)?.salesTrend ?? [];
  return raw.map((d: any) => ({
    date: String(d.date ?? d.label ?? ''),
    revenue: Number(d.revenue ?? d.sales ?? d.amount ?? 0),
    orders: Number(d.orders ?? d.orderCount ?? 0)
  }));
};

/** Backend trend labels are "dd MMM" (no year); resolve to the most recent past occurrence. */
const parseTrendDate = (label: string, now: Date): Date | null => {
  if (!label) return null;
  if (/\d{4}/.test(label)) {
    const full = new Date(label);
    return Number.isNaN(full.getTime()) ? null : full;
  }
  const withYear = new Date(`${label} ${now.getFullYear()}`);
  if (Number.isNaN(withYear.getTime())) return null;
  if (withYear.getTime() > now.getTime() + 86400000) withYear.setFullYear(withYear.getFullYear() - 1);
  return withYear;
};

const EXPORT_TYPES: { id: string; label: string }[] = [
  { id: 'sales', label: 'Sales & Revenue' },
  { id: 'products', label: 'Product Performance' },
  { id: 'expenses', label: 'Operating Expenses' },
  { id: 'tax', label: 'GST Tax Report' }
];

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const presetRange = (p: PeriodPreset): { from: string; to: string } => {
  const now = new Date();
  let from = new Date(now);
  if (p === 'week') {
    from.setDate(now.getDate() - 7);
  } else if (p === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (p === 'quarter') {
    from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (p === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
  }
  return { from: toIsoDate(from), to: toIsoDate(now) };
};

/** Parses "+21.2%", "21.2" or "-3.1" into a signed percentage. */
const parseDelta = (raw?: string): number | null => {
  if (raw === undefined || raw === null) return null;
  const n = parseFloat(String(raw).replace(/[+%\s]/g, ''));
  return Number.isNaN(n) ? null : n;
};

const DeltaPill: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center space-x-0.5 text-[11px] font-bold ${
        positive ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>
        {positive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
    </span>
  );
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const ErpReportsCenterModule: React.FC = () => {
  const { showToast } = useToast();

  const [period, setPeriod] = useState<PeriodPreset>('month');
  const initial = presetRange('month');
  const [fromDate, setFromDate] = useState<string>(initial.from);
  const [toDate, setToDate] = useState<string>(initial.to);
  const [showFilters, setShowFilters] = useState(true);
  const [exportType, setExportType] = useState('sales');
  const [compareDraft, setCompareDraft] = useState<CompareMode>('previous');
  // Controls are staged: the selects/date pickers are drafts, Apply commits them.
  const [applied, setApplied] = useState<{ period: PeriodPreset; compare: CompareMode }>({
    period: 'month',
    compare: 'previous'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [compareSeries, setCompareSeries] = useState<TrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCategories, setTopCategories] = useState<CategorySales[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodReport[]>([]);

  const loadData = useCallback(async (selectedPeriod: PeriodPreset, compare: CompareMode) => {
    setIsLoading(true);
    try {
      // Second, wider sales-overview fetch that feeds the client-side comparison
      const comparePromise: Promise<SalesReport | null | undefined> =
        compare === 'previous'
          ? api.getSalesOverview(COMPARE_FETCH_PERIOD[selectedPeriod]).catch(() => null)
          : Promise.resolve(null);

      const [kpiRes, salesRes, prodRes, catRes, payRes] = await Promise.allSettled([
        api.getDashboardKpis(),
        api.getSalesOverview(API_PERIOD[selectedPeriod]),
        api.getTopProducts(5),
        api.getTopCategories(),
        api.getPaymentMethods()
      ]);

      if (kpiRes.status === 'fulfilled' && kpiRes.value) setKpis(kpiRes.value);
      if (salesRes.status === 'fulfilled' && salesRes.value) setSalesReport(salesRes.value);
      if (prodRes.status === 'fulfilled') setTopProducts(prodRes.value || []);
      if (catRes.status === 'fulfilled') setTopCategories(catRes.value || []);
      if (payRes.status === 'fulfilled') setPaymentMethods(payRes.value || []);

      setCompareSeries(normalizeSeries(await comparePromise));

      if (kpiRes.status === 'rejected' && salesRes.status === 'rejected') {
        const { message } = getApiErrorDetails(kpiRes.reason);
        showToast(message || 'Failed to load sales report data', 'error');
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(applied.period, applied.compare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const handlePeriodChange = (p: PeriodPreset) => {
    setPeriod(p);
    const range = presetRange(p);
    setFromDate(range.from);
    setToDate(range.to);
  };

  // Apply commits the staged controls; a fresh object always re-triggers the load effect
  const handleApply = () => setApplied({ period, compare: compareDraft });

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportCsv(exportType, fromDate || undefined, toDate || undefined);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aadhi_${exportType}_report_${fromDate || 'start'}_to_${toDate || 'now'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Report CSV downloaded successfully!', 'success');
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to export report CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // KPI values are period-scoped where the sales report provides them (falling
  // back to the all-time dashboard KPIs). The live DTO names the total
  // `totalSales`, the FE contract `totalRevenue` — accept both.
  const reportRevenue = (salesReport as any)?.totalRevenue ?? (salesReport as any)?.totalSales;
  const totalSales = Number(reportRevenue ?? kpis?.totalSales ?? 0);
  const totalOrders = salesReport?.totalOrders ?? kpis?.totalOrders ?? 0;
  const avgOrderValue = salesReport?.averageOrderValue ?? (totalOrders > 0 ? totalSales / totalOrders : 0);
  const totalCustomers = kpis?.totalCustomers ?? 0; // no period-scoped customer metric exists

  /**
   * Client-side comparison (the backend has no compare endpoint):
   * - "Previous Period": the compare series (a sales-overview fetch spanning ~2x
   *   the selected window) is sliced by date into the current window vs the
   *   preceding window of equal length, and % deltas computed from the sums.
   *   Falls back to the backend's 30d-vs-prior-30d dashboard change metrics when
   *   the comparison window holds no usable data.
   * - "Previous Year": the API serves at most 365 days of history, so a true
   *   same-window-last-year slice is unreachable — deltas are hidden and a note
   *   is shown instead of fabricating numbers.
   * - "None": deltas hidden.
   * The customers delta always comes from the backend metric (no customer time
   * series is exposed), so it only renders in "Previous Period" mode.
   */
  const comparison = useMemo(() => {
    const empty = {
      sales: null as number | null,
      orders: null as number | null,
      aov: null as number | null,
      customers: null as number | null
    };
    if (applied.compare !== 'previous') return empty;

    const now = new Date();
    const days = COMPARE_WINDOW_DAYS[applied.period];
    const currentStart = now.getTime() - days * 86400000;
    const prevStart = now.getTime() - 2 * days * 86400000;

    let curSales = 0;
    let prevSales = 0;
    let curOrders = 0;
    let prevOrders = 0;
    for (const pt of compareSeries) {
      const d = parseTrendDate(pt.date, now);
      if (!d) continue;
      const t = d.getTime();
      if (t >= currentStart) {
        curSales += pt.revenue;
        curOrders += pt.orders;
      } else if (t >= prevStart) {
        prevSales += pt.revenue;
        prevOrders += pt.orders;
      }
    }

    const pct = (cur: number, prev: number): number | null =>
      prev > 0 ? ((cur - prev) / prev) * 100 : null;
    const sales = pct(curSales, prevSales);
    const orders = pct(curOrders, prevOrders);
    const aov =
      curOrders > 0 && prevOrders > 0 && prevSales > 0
        ? pct(curSales / curOrders, prevSales / prevOrders)
        : null;

    const backendSales = parseDelta(kpis?.salesChangePercentage);
    const backendOrders = parseDelta(kpis?.ordersChangePercentage);
    const backendAov = (() => {
      if (backendSales === null || backendOrders === null) return null;
      const denom = 1 + backendOrders / 100;
      if (denom === 0) return null;
      return ((1 + backendSales / 100) / denom - 1) * 100;
    })();

    return {
      sales: sales ?? backendSales,
      orders: orders ?? backendOrders,
      aov: aov ?? backendAov,
      customers: parseDelta(kpis?.customersChangePercentage)
    };
  }, [applied, compareSeries, kpis]);

  const chartNow = new Date();
  const chartData = normalizeSeries(salesReport).map((d) => {
    const parsed = parseTrendDate(d.date, chartNow);
    return {
      label: parsed ? parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : d.date,
      revenue: d.revenue,
      orders: d.orders
    };
  });

  const kpiCards = [
    { label: 'Total Sales', value: inr(totalSales), delta: comparison.sales, icon: IndianRupee, iconBg: 'bg-purple/10 text-purple' },
    { label: 'Total Orders', value: totalOrders.toLocaleString('en-IN'), delta: comparison.orders, icon: ShoppingCart, iconBg: 'bg-orange/10 text-orange' },
    { label: 'Avg Order Value', value: inr(avgOrderValue), delta: comparison.aov, icon: Receipt, iconBg: 'bg-gold/15 text-gold-dark' },
    { label: 'Total Customers', value: totalCustomers.toLocaleString('en-IN'), delta: comparison.customers, icon: Users, iconBg: 'bg-emerald-100 text-emerald-600' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight">Sales Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Revenue performance, order trends, top sellers and payment mix — with server-side CSV export.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(applied.period, applied.compare)}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border shadow-2xs transition-all ${
              showFilters
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-purple/20 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Filters / Date Range Row */}
      {showFilters && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-end gap-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Period Preset</label>
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodPreset)}
              className="mt-1 block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Compare With</label>
            <select
              value={compareDraft}
              onChange={(e) => setCompareDraft(e.target.value as CompareMode)}
              className="mt-1 block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            >
              {COMPARE_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Export Report Type</label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="mt-1 block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            >
              {EXPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleApply}
            className="px-6 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all"
          >
            Apply
          </button>

          <div className="text-[11px] text-slate-400 lg:ml-auto pb-1">
            {applied.compare === 'year'
              ? 'Previous-year comparison needs more than 12 months of history (the API serves at most 365 days), so deltas are hidden.'
              : 'Chart & KPIs follow the applied preset; CSV export uses the exact from/to dates.'}
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{card.label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-navy mt-2 tracking-tight">{card.value}</div>
              <div className="mt-1">
                <DeltaPill value={card.delta} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-sm text-navy flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-purple" />
              <span>Sales Over Time</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {PERIOD_OPTIONS.find((p) => p.id === applied.period)?.label}
            </span>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
              {isLoading ? 'Loading sales trend...' : 'No sales data for this period yet.'}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                  />
                  <Tooltip
                    formatter={(value: number | string, name: string) =>
                      name === 'revenue' ? [inr(Number(value)), 'Revenue'] : [value, 'Orders']
                    }
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4F2ACB"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#4F2ACB', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <h3 className="font-black text-sm text-navy mb-4">Top Selling Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-xs text-slate-400">No product sales recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.productId || idx} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-black flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-navy truncate">{p.productName}</div>
                      <div className="text-[10px] text-slate-400">{p.unitsSold.toLocaleString('en-IN')} units sold</div>
                    </div>
                  </div>
                  <span className="font-black text-xs text-navy flex-shrink-0 ml-2">{inr(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Categories + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <h3 className="font-black text-sm text-navy mb-4 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-orange" />
            <span>Top Categories</span>
          </h3>
          {topCategories.length === 0 ? (
            <p className="text-xs text-slate-400">No category sales recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map((c, idx) => (
                <div key={c.categoryName || idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-navy">{c.categoryName}</span>
                    <span className="text-slate-500 font-medium">
                      {inr(c.revenue)} <span className="text-slate-400">({c.percentage.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple"
                      style={{ width: `${Math.min(100, Math.max(2, c.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <h3 className="font-black text-sm text-navy mb-4 flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-purple" />
            <span>Sales by Payment Method</span>
          </h3>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-slate-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((m, idx) => (
                <div key={m.method || idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-navy">{m.method}</span>
                    <span className="text-slate-500 font-medium">
                      {inr(m.totalAmount)} <span className="text-slate-400">({m.percentage.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${Math.min(100, Math.max(2, m.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
