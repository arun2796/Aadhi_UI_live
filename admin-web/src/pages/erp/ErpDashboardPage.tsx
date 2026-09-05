import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Download,
  Loader2,
  BarChart3,
  PackageSearch,
  Trophy
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { DashboardKpis, OrderStatus, TopProduct } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ErpDashboardPageProps {
  onNavigateTab: (tab: string, params?: any) => void;
}

interface OrderOverviewSlice {
  name: string;
  value: number;
  color: string;
}

// Donut colors follow the design legend (01_dashboard.png): Delivered purple, Pending gold, Cancelled orange
const ORDER_OVERVIEW_STATUSES: { status: OrderStatus; name: string; color: string }[] = [
  { status: 'Delivered', name: 'Delivered', color: '#4F2ACB' },
  { status: 'Pending', name: 'Pending', color: '#FFB000' },
  { status: 'Cancelled', name: 'Cancelled', color: '#FF7A00' }
];

// Normalises backend change strings like "12.4", "+12.4%" or "-3.1" into a signed percentage label
const formatDelta = (raw?: string): string | null => {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (!s.startsWith('+') && !s.startsWith('-')) s = `+${s}`;
  if (!s.endsWith('%')) s = `${s}%`;
  return s;
};

export const ErpDashboardPage: React.FC<ErpDashboardPageProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [salesTrend, setSalesTrend] = useState<{ date: string; sales: number; orders: number }[]>([]);
  const [orderOverview, setOrderOverview] = useState<OrderOverviewSlice[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [outOfStockCount, setOutOfStockCount] = useState<number>(0);
  const [lowStockFallback, setLowStockFallback] = useState<number>(0);
  const [totalProductCount, setTotalProductCount] = useState<number>(0);
  const [trendPeriod, setTrendPeriod] = useState<string>('month');
  const [isExporting, setIsExporting] = useState(false);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Admin';

  useEffect(() => {
    api.getDashboardKpis().then(setKpis).catch(() => setKpis(null));
    api.getTopProducts(5).then(setTopProducts).catch(() => setTopProducts([]));

    // Stock health + catalogue size derived from the products endpoint (paged result carries totalCount)
    api
      .getProducts()
      .then((prods) => {
        setTotalProductCount(prods.totalCount ?? prods.length);
        setOutOfStockCount(prods.filter((p) => (p.availableQuantity ?? 0) <= 0).length);
        setLowStockFallback(
          prods.filter((p) => (p.availableQuantity ?? 0) > 0 && p.availableQuantity <= p.reorderLevel).length
        );
      })
      .catch(() => undefined);

    // Order Overview donut — real per-status totals (paged endpoints expose totalCount)
    Promise.all(
      ORDER_OVERVIEW_STATUSES.map((s) =>
        api
          .getOrders({ status: s.status, pageSize: 1 })
          .then((res) => ({ name: s.name, value: res.totalCount ?? 0, color: s.color }))
          .catch(() => ({ name: s.name, value: 0, color: s.color }))
      )
    ).then(setOrderOverview);
  }, []);

  useEffect(() => {
    api
      .getSalesTrend(trendPeriod)
      .then((res: any) => {
        if (res?.dataPoints?.length) {
          setSalesTrend(
            res.dataPoints.map((d: any) => ({
              date: d.label || d.date,
              sales: d.revenue || d.amount || 0,
              orders: d.orderCount || d.orders || 0
            }))
          );
        } else if (Array.isArray(res) && res.length) {
          setSalesTrend(res);
        } else {
          setSalesTrend([]);
        }
      })
      .catch(() => setSalesTrend([]));
  }, [trendPeriod]);

  const rangeLabel = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (trendPeriod === 'today') return fmt(now);
    const start = new Date(now);
    if (trendPeriod === 'week') start.setDate(now.getDate() - 6);
    else if (trendPeriod === 'month') start.setDate(now.getDate() - 29);
    else start.setFullYear(now.getFullYear() - 1);
    return `${fmt(start)} - ${fmt(now)}`;
  }, [trendPeriod]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportCsv('sales');
      const url = URL.createObjectURL(blob as Blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // export endpoint unavailable — fail silently, button re-enables
    } finally {
      setIsExporting(false);
    }
  };

  const orderOverviewTotal = orderOverview.reduce((sum, s) => sum + s.value, 0);

  // Two rows of four KPI cards per the design sheet (spec 1).
  // Deltas come from the dashboard KPI DTO where the backend provides them; cards
  // without a backend change metric (Products / Pending / Low Stock / Out of Stock)
  // render without a badge rather than showing fabricated percentages.
  const primaryKpis: {
    label: string;
    value: string;
    delta: string | null;
    onClick?: () => void;
  }[] = [
    {
      label: 'Total Orders',
      value: (kpis?.totalOrders ?? 0).toLocaleString('en-IN'),
      delta: formatDelta(kpis?.ordersChangePercentage),
      onClick: () => onNavigateTab('orders')
    },
    {
      label: 'Total Sales',
      value: `₹${(kpis?.totalSales ?? 0).toLocaleString('en-IN')}`,
      delta: formatDelta(kpis?.salesChangePercentage)
    },
    {
      label: 'Total Customers',
      value: (kpis?.totalCustomers ?? 0).toLocaleString('en-IN'),
      delta: formatDelta(kpis?.customersChangePercentage),
      onClick: () => onNavigateTab('customers')
    },
    {
      label: 'Total Products',
      value: totalProductCount.toLocaleString('en-IN'),
      delta: null, // backend exposes no products change metric
      onClick: () => onNavigateTab('products')
    }
  ];

  const secondaryKpis: typeof primaryKpis = [
    {
      label: 'Pending Orders',
      value: (kpis?.pendingOrders ?? 0).toLocaleString('en-IN'),
      delta: null,
      onClick: () => onNavigateTab('orders')
    },
    {
      label: 'Low Stock Items',
      value: (kpis?.lowStockItems ?? lowStockFallback).toLocaleString('en-IN'),
      delta: null,
      onClick: () => onNavigateTab('low-stock')
    },
    {
      label: 'Out of Stock',
      value: outOfStockCount.toLocaleString('en-IN'),
      delta: null,
      onClick: () => onNavigateTab('inventory')
    },
    {
      // The KPI DTO has no distinct revenue field, so Total Revenue mirrors Total
      // Sales (and its delta) per the alignment note — deviation documented.
      label: 'Total Revenue',
      value: `₹${(kpis?.totalSales ?? 0).toLocaleString('en-IN')}`,
      delta: formatDelta(kpis?.salesChangePercentage),
      onClick: () => onNavigateTab('reports')
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header — welcome message left, date range + purple Export right (per design) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Welcome back, {firstName} 👋</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-xs">
            <CalendarDays className="w-3.5 h-3.5 text-purple" />
            <span>{rangeLabel}</span>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-purple hover:opacity-90 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Rows 1 & 2 — eight KPI cards in two rows of four (per spec 1) */}
      {[primaryKpis, secondaryKpis].map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {row.map((card) => (
            <div
              key={card.label}
              onClick={card.onClick}
              className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-xs ${
                card.onClick ? 'cursor-pointer hover:border-purple/40 hover:shadow-md transition-all' : ''
              }`}
            >
              <div className="text-xs font-bold text-slate-500">{card.label}</div>
              <div className="text-2xl font-black text-navy mt-2">{card.value}</div>
              {card.delta && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-1.5 ${
                    card.delta.startsWith('-')
                      ? 'bg-red-50 text-red-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {card.delta}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Row 3 — Sales Overview line chart + Order Overview donut + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Sales Overview */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-navy">Sales Overview</h3>

            {/* Time Period Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              {['today', 'week', 'month', 'year'].map((p) => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase transition-colors ${
                    trendPeriod === p ? 'bg-white text-navy shadow-xs' : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      name === 'sales' ? `₹${Number(value).toLocaleString('en-IN')}` : value,
                      name === 'sales' ? 'Revenue' : 'Orders'
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#4F2ACB"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#4F2ACB', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#CBD5E1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <BarChart3 className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-medium">No sales recorded for this period yet.</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Overview Donut */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col">
          <h3 className="font-bold text-sm text-navy">Order Overview</h3>

          {orderOverviewTotal > 0 ? (
            <>
              <div className="flex-1 min-h-44 w-full flex items-center justify-center my-2">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={orderOverview}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderOverview.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString('en-IN')} orders`,
                        name
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-3 border-t border-slate-100">
                {orderOverview.map((slice) => (
                  <div key={slice.name} className="flex items-center space-x-1.5 text-[11px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-medium text-slate-600 truncate">{slice.name}</span>
                    <span className="font-bold text-navy ml-auto">
                      {slice.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2 py-10">
              <PackageSearch className="w-8 h-8 text-slate-300" />
              <span className="text-xs font-medium text-center">No order activity yet.</span>
            </div>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col">
          <h3 className="font-bold text-sm text-navy">Top Selling Products</h3>

          <div className="mt-4 space-y-2.5 flex-1">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div key={p.productId || idx} className="flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-lg bg-purple/10 text-purple flex items-center justify-center text-[11px] font-black flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-navy truncate">{p.productName}</div>
                  </div>
                  {/* Sheet shows rank / name / qty right-aligned */}
                  <div className="text-[11px] font-black text-navy flex-shrink-0">
                    {(p.unitsSold ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-10">
                <Trophy className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-medium text-center">No sales data available yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
