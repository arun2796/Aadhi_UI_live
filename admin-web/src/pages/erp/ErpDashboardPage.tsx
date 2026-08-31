import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Truck,
  Receipt,
  FileSpreadsheet,
  ChevronRight,
  Eye,
  CheckCircle2
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
  Cell,
  Legend
} from 'recharts';
import { DashboardKpis, Order, Product } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/CommonComponents';

interface ErpDashboardPageProps {
  onNavigateTab: (tab: string, params?: any) => void;
}

export const ErpDashboardPage: React.FC<ErpDashboardPageProps> = ({ onNavigateTab }) => {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<string>('month');

  useEffect(() => {
    api.getDashboardKpis().then(setKpis);
    api.getSalesTrend().then(setSalesTrend);
    api.getCategorySales().then(setCategorySales);
    api.getPaymentMethodReports().then(setPaymentMethods);
    api.getOrders().then(orders => setRecentOrders(orders.slice(0, 5)));
    api.getProducts().then(prods => {
      setLowStockProducts(prods.filter(p => p.availableQuantity <= p.reorderLevel).slice(0, 5));
    });
  }, []);

  const CATEGORY_COLORS = ['#FF7A00', '#4F2ACB', '#3B82F6', '#10B981', '#64748B'];
  const PAYMENT_COLORS = ['#4F2ACB', '#3B82F6', '#FF7A00', '#10B981'];

  const topProducts = [
    { name: 'Aadhi Deluxe Gift Box', units: 324, revenue: 971676, img: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80' },
    { name: 'Mega Celebration Box', units: 210, revenue: 944790, img: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80' },
    { name: 'Sparklers (10 Pcs)', units: 560, revenue: 280000, img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80' },
    { name: 'Flower Pots (Big)', units: 430, revenue: 258000, img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80' },
    { name: 'Ground Chakkar Deluxe', units: 410, revenue: 246000, img: 'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=600&auto=format&fit=crop&q=80' }
  ];

  const recentActivities = [
    { title: 'New Order Received', desc: 'Order ORD#1248 placed by Ramesh Kumar (₹2,499)', time: '10 mins ago', type: 'order' },
    { title: 'Payment Confirmed', desc: 'Payment received for ORD#1247 via Credit Card', time: '45 mins ago', type: 'payment' },
    { title: 'Stock Adjusted', desc: 'Added 20 units to Aerial Shot - 30 Shots from Sivakasi Plant', time: '2 hours ago', type: 'stock' },
    { title: 'New Customer Registered', desc: 'Suresh Babu created an account', time: '3 hours ago', type: 'customer' },
    { title: 'Invoice Generated', desc: 'Invoice INV#1087 generated for ORD#1244', time: '5 hours ago', type: 'invoice' }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Business Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time sales, order fulfillment, and inventory analytics for Aadhi Crackers.
          </p>
        </div>

        {/* Quick Actions Header Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('products')}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-orange" />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => onNavigateTab('purchases')}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs"
          >
            <Truck className="w-3.5 h-3.5 text-purple" />
            <span>New Purchase</span>
          </button>
          <button
            onClick={() => onNavigateTab('orders')}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Manage Orders</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Total Sales */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Sales</span>
            <div className="w-8 h-8 rounded-xl bg-orange/10 text-orange flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-navy">
              ₹{kpis ? kpis.totalSales.toLocaleString('en-IN') : '24,85,650'}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+18.5% from last month</span>
            </div>
          </div>
        </div>

        {/* 2. Total Orders */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-purple/10 text-purple flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-navy">
              {kpis ? kpis.totalOrders.toLocaleString('en-IN') : '1,248'}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+12.4% this month</span>
            </div>
          </div>
        </div>

        {/* 3. Total Customers */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Customers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-navy">
              {kpis ? kpis.totalCustomers.toLocaleString('en-IN') : '856'}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+8.7% new accounts</span>
            </div>
          </div>
        </div>

        {/* 4. Total Profit */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Net Profit</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-navy">
              ₹{kpis ? kpis.totalProfit.toLocaleString('en-IN') : '6,45,230'}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center space-x-0.5 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+22.1% profit margin</span>
            </div>
          </div>
        </div>

        {/* 5. Low Stock Alert */}
        <div
          onClick={() => onNavigateTab('inventory')}
          className="p-4 rounded-2xl bg-red-50/50 border border-red-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700">Low Stock Items</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-red-700">
              {kpis ? kpis.lowStockItems : '23'} Items
            </div>
            <div className="text-[10px] text-red-600 font-semibold mt-0.5">
              Requires immediate PO reorder
            </div>
          </div>
        </div>

        {/* 6. Pending Orders */}
        <div
          onClick={() => onNavigateTab('orders')}
          className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-amber-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Pending Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-amber-800">
              {kpis ? kpis.pendingOrders : '17'} Orders
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              Awaiting packing & dispatch
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row: Sales Overview (8 cols) + Categories Donut (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Overview Area Chart */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-navy">Sales Overview</h3>
              <p className="text-[11px] text-slate-500">Revenue and order volume progression</p>
            </div>

            {/* Time Period Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              {['today', 'week', 'month', 'year'].map((p) => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase transition-colors ${
                    trendPeriod === p ? 'bg-white text-navy shadow-xs' : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7A00" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#FF7A00" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F2ACB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4F2ACB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name === 'sales' ? `₹${Number(value).toLocaleString('en-IN')}` : value,
                    name === 'sales' ? 'Revenue' : 'Orders'
                  ]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#FF7A00" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
                <Area type="monotone" dataKey="orders" stroke="#4F2ACB" strokeWidth={2} fillOpacity={1} fill="url(#ordersGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Categories Donut */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-navy">Top Selling Categories</h3>
            <p className="text-[11px] text-slate-500">Revenue contribution by product category</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categorySales}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="revenue"
                >
                  {categorySales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => `₹${Number(val).toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {categorySales.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                  <span className="font-medium text-slate-700">{item.categoryName}</span>
                </div>
                <span className="font-bold text-navy">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Recent Orders (8 cols) + Top Products & Payment Methods (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Orders Table */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-navy">Recent Customer Orders</h3>
              <p className="text-[11px] text-slate-500">Latest transactions from website and wholesale desk</p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-bold text-purple hover:underline flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-navy">{ord.orderNumber}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{ord.customerName}</td>
                    <td className="py-3 px-3 font-black text-navy">₹{ord.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={ord.paymentStatus} type="payment" />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={ord.orderStatus} type="order" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onNavigateTab('orders', { selectedOrderId: ord.id })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
                        title="View Order Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products Leaderboard */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-sm text-navy">Top Selling Products</h3>
            <p className="text-[11px] text-slate-500">Highest volume performers</p>
          </div>

          <div className="space-y-3">
            {topProducts.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-3 min-w-0">
                  <img src={p.img} alt="" className="w-10 h-10 rounded-lg object-cover bg-white border flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-navy truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.units} units sold</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-xs text-orange">₹{p.revenue.toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Low Stock Alerts + Live Activity Feed + Business Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Low Stock Alerts Table (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="font-bold text-sm text-navy">Low Stock Alert</h3>
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-xs font-bold text-orange hover:underline"
            >
              Manage Stock →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3">Reorder Level</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-3 font-bold text-navy">{p.name}</td>
                    <td className="py-3 px-3 font-black text-red-600">{p.availableQuantity}</td>
                    <td className="py-3 px-3 text-slate-500">{p.reorderLevel}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onNavigateTab('purchases')}
                        className="px-2.5 py-1 rounded bg-orange text-white text-[11px] font-bold hover:bg-orange-hover transition-colors"
                      >
                        Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Recent Activities (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-navy">Recent Activity Feed</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Updates</span>
            </span>
          </div>

          <div className="space-y-3">
            {recentActivities.map((act, i) => (
              <div key={i} className="flex items-start space-x-3 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-navy">{act.title}</div>
                  <div className="text-slate-600 text-[11px]">{act.desc}</div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
