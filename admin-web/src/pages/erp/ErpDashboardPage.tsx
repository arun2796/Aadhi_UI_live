import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Download,
  Loader2,
  BarChart3,
  PackageSearch,
  Trophy,
  ShoppingBag,
  Banknote,
  Users,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
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

  const primaryKpis: {
    label: string;
    value: string;
    delta: string | null;
    icon: any;
    iconBg: string;
    iconColor: string;
    onClick?: () => void;
  }[] = [
    {
      label: 'Total Orders',
      value: (kpis?.totalOrders ?? 0).toLocaleString('en-IN'),
      delta: formatDelta(kpis?.ordersChangePercentage),
      icon: ShoppingBag,
      iconBg: 'bg-purple/10 border border-purple/20',
      iconColor: 'text-purple',
      onClick: () => onNavigateTab('orders')
    },
    {
      label: 'Total Sales',
      value: `₹${(kpis?.totalSales ?? 0).toLocaleString('en-IN')}`,
      delta: formatDelta(kpis?.salesChangePercentage),
      icon: Banknote,
      iconBg: 'bg-emerald-500/10 border border-emerald-500/20',
      iconColor: 'text-emerald-600'
    },
    {
      label: 'Total Customers',
      value: (kpis?.totalCustomers ?? 0).toLocaleString('en-IN'),
      delta: formatDelta(kpis?.customersChangePercentage),
      icon: Users,
      iconBg: 'bg-blue-500/10 border border-blue-500/20',
      iconColor: 'text-blue-600',
      onClick: () => onNavigateTab('customers')
    },
    {
      label: 'Total Products',
      value: totalProductCount.toLocaleString('en-IN'),
      delta: null,
      icon: Package,
      iconBg: 'bg-amber-500/10 border border-amber-500/20',
      iconColor: 'text-amber-600',
      onClick: () => onNavigateTab('products')
    }
  ];

  const secondaryKpis: typeof primaryKpis = [
    {
      label: 'Pending Orders',
      value: (kpis?.pendingOrders ?? 0).toLocaleString('en-IN'),
      delta: null,
      icon: Clock,
      iconBg: 'bg-yellow-500/15 border border-yellow-500/30',
      iconColor: 'text-amber-600',
      onClick: () => onNavigateTab('orders')
    },
    {
      label: 'Low Stock Items',
      value: (kpis?.lowStockItems ?? lowStockFallback).toLocaleString('en-IN'),
      delta: null,
      icon: AlertTriangle,
      iconBg: 'bg-orange-500/10 border border-orange-500/20',
      iconColor: 'text-orange-600',
      onClick: () => onNavigateTab('low-stock')
    },
    {
      label: 'Out of Stock',
      value: outOfStockCount.toLocaleString('en-IN'),
      delta: null,
      icon: ShieldAlert,
      iconBg: 'bg-rose-500/10 border border-rose-500/20',
      iconColor: 'text-rose-600',
      onClick: () => onNavigateTab('inventory')
    },
    {
      label: 'Total Revenue',
      value: `₹${(kpis?.totalSales ?? 0).toLocaleString('en-IN')}`,
      delta: formatDelta(kpis?.salesChangePercentage),
      icon: TrendingUp,
      iconBg: 'bg-indigo-500/10 border border-indigo-500/20',
      iconColor: 'text-indigo-600',
      onClick: () => onNavigateTab('reports')
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-purple/10 border border-purple/20 text-purple text-[10px] font-extrabold uppercase tracking-widest mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Management Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Here is your live business overview, sales trajectory, and fulfillment pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-purple" />
            <span className="tabular-nums font-mono text-[11px]">{rangeLabel}</span>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="group px-4 py-2 rounded-xl bg-purple hover:bg-purple-900 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-purple/20 transition-all disabled:opacity-50"
          >
            <span className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center transition-transform group-hover:scale-105">
              {isExporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
            </span>
            <span>{isExporting ? 'Exporting...' : 'Export Sales CSV'}</span>
          </button>
        </div>
      </div>

      {[primaryKpis, secondaryKpis].map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {row.map((card) => {
            const Icon = card.icon;
            const isNegative = card.delta?.startsWith('-');
            return (
              <div
                key={card.label}
                onClick={card.onClick}
                className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm transition-all duration-200 ${
                  card.onClick ? 'cursor-pointer hover:border-purple/40 hover:-translate-y-0.5' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 tracking-tight">{card.label}</span>
                  <div className={`w-8 h-8 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <div className="text-2xl font-black text-navy tabular-nums font-mono tracking-tight">
                    {card.value}
                  </div>

                  {card.delta && (
                    <span
                      className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex-shrink-0 ${
                        isNegative
                          ? 'bg-red-50 text-red-600 border border-red-200/60'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                      }`}
                    >
                      {isNegative ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      <span>{card.delta}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-navy tracking-tight">Sales Trajectory</h3>
              <p className="text-[11px] text-slate-400 font-medium">Revenue & Order velocity over time</p>
            </div>

            <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              {['today', 'week', 'month', 'year'].map((p) => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  className={`px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                    trendPeriod === p
                      ? 'bg-white text-navy shadow-sm font-black'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F2ACB" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#4F2ACB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
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
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#4F2ACB"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#salesGradient)"
                    activeDot={{ r: 6, fill: '#4F2ACB', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <BarChart3 className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-medium">No sales recorded for this period yet.</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div>
            <h3 className="font-extrabold text-sm text-navy tracking-tight">Order Status</h3>
            <p className="text-[11px] text-slate-400 font-medium">Fulfillment distribution</p>
          </div>

          {orderOverviewTotal > 0 ? (
            <>
              <div className="relative flex-1 min-h-48 w-full flex items-center justify-center my-1">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={orderOverview}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={74}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {orderOverview.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString('en-IN')} orders`,
                        name
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                        fontSize: '11px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-navy tabular-nums font-mono">
                    {orderOverviewTotal.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Total
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                {orderOverview.map((slice) => (
                  <div key={slice.name} className="flex items-center space-x-2 text-[11px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-semibold text-slate-600 truncate">{slice.name}</span>
                    <span className="font-bold text-navy ml-auto tabular-nums font-mono">
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

        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div>
            <h3 className="font-extrabold text-sm text-navy tracking-tight">Top Velocity Items</h3>
            <p className="text-[11px] text-slate-400 font-medium">Best performing products</p>
          </div>

          <div className="mt-3 space-y-2 flex-1">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => {
                const medalColors = [
                  'bg-amber-400/20 text-amber-700 border-amber-400/40',
                  'bg-slate-200/80 text-slate-700 border-slate-300',
                  'bg-orange-300/25 text-orange-700 border-orange-300/50'
                ];
                const rankClass = medalColors[idx] || 'bg-slate-100 text-slate-500 border-slate-200';
                return (
                  <div key={p.productId || idx} className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border flex-shrink-0 ${rankClass}`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-navy truncate">{p.productName}</div>
                    </div>
                    <div className="text-[11px] font-extrabold text-navy tabular-nums font-mono flex-shrink-0 px-2 py-0.5 rounded-md bg-slate-100">
                      {(p.unitsSold ?? 0).toLocaleString('en-IN')} <span className="text-[9px] font-medium text-slate-400">sold</span>
                    </div>
                  </div>
                );
              })
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
