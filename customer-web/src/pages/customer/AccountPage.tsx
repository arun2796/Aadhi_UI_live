import React, { useState, useEffect } from 'react';
import {
  User,
  ShoppingBag,
  Heart,
  MapPin,
  FileText,
  LogOut,
  ChevronRight,
  Download,
  Trash2
} from 'lucide-react';
import { Order } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { StatusBadge } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

interface AccountPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'addresses' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.getMyOrders().then(setOrders);
  }, [user]);

  const handleMoveToCart = (product: any) => {
    addToCart(product, 1);
    toggleWishlist(product);
    showToast(`Moved "${product.name}" to cart!`, 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* User Banner */}
      <div className="rounded-3xl bg-navy text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-card">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange to-gold flex items-center justify-center text-navy font-black text-2xl shadow-glow">
            {user ? user.firstName.charAt(0) : 'U'}
          </div>
          <div>
            <div className="text-xs text-gold font-bold uppercase tracking-wider">Customer Portal</div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'Guest Customer'}
            </h1>
            <div className="text-xs text-slate-300">
              {user?.email || 'customer@aadhicrackers.com'} • {user?.phone || '+91 98765 43210'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('shop')}
            className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold transition-colors"
          >
            Shop More Fireworks
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-3 space-y-1 shadow-xs">
          {[
            { id: 'orders', label: 'Order History', icon: ShoppingBag, count: orders.length },
            { id: 'wishlist', label: 'My Wishlist', icon: Heart, count: wishlist.length },
            { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
            { id: 'profile', label: 'Profile Settings', icon: User }
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-orange text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white text-orange' : 'bg-slate-100 text-slate-600'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          {/* Orders History Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-navy">Your Orders</h2>
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No orders placed yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.map((ord) => (
                    <div key={ord.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-navy">{ord.orderNumber}</span>
                          <StatusBadge status={ord.orderStatus} />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Placed on {new Date(ord.placedAtUtc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {ord.paymentMethod}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-black text-sm text-navy">₹{ord.grandTotal.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-emerald-600 font-semibold">{ord.paymentStatus}</div>
                        </div>

                        <button
                          onClick={() => onNavigate('track-order', { orderNumber: ord.orderNumber })}
                          className="px-3.5 py-1.5 rounded-lg bg-navy text-white text-xs font-bold hover:bg-navy-light transition-colors"
                        >
                          Track
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Wishlist Tab */}
          {activeTab === 'wishlist' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-navy">Saved Fireworks ({wishlist.length})</h2>
              {wishlist.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Your wishlist is empty. Browse products and tap the heart icon to save items!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlist.map((prod) => (
                    <div key={prod.id} className="p-4 rounded-xl border border-slate-100 flex items-center space-x-3 bg-slate-50">
                      <img
                        src={prod.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
                        alt={prod.name}
                        className="w-16 h-16 rounded-lg object-cover bg-white border"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-navy truncate">{prod.name}</h4>
                        <div className="text-xs font-black text-orange mt-0.5">₹{prod.price.toLocaleString('en-IN')}</div>
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            onClick={() => handleMoveToCart(prod)}
                            className="px-2.5 py-1 rounded bg-orange text-white text-[11px] font-bold hover:bg-orange-hover transition-colors"
                          >
                            Move to Cart
                          </button>
                          <button
                            onClick={() => toggleWishlist(prod)}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Addresses Tab */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-navy">Saved Delivery Addresses</h2>
              <div className="p-4 rounded-2xl border-2 border-orange bg-orange/5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy text-sm">Primary Home Address</span>
                  <span className="px-2 py-0.5 rounded bg-orange text-white text-[10px] font-bold">Default</span>
                </div>
                <div className="text-slate-700 font-semibold">Ramesh Kumar • +91 98765 43210</div>
                <div className="text-slate-600 leading-relaxed">
                  123, West Cross Street, Sivanandapuram, Near Saravanampatti Junction, Coimbatore, Tamil Nadu - 641012, India
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-md">
              <h2 className="text-lg font-black text-navy">Personal Details</h2>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">First Name</label>
                  <input type="text" defaultValue={user?.firstName || 'Ramesh'} className="w-full px-3 py-2 rounded-xl border" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Last Name</label>
                  <input type="text" defaultValue={user?.lastName || 'Kumar'} className="w-full px-3 py-2 rounded-xl border" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <input type="email" defaultValue={user?.email || 'ramesh@example.com'} className="w-full px-3 py-2 rounded-xl border" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input type="tel" defaultValue={user?.phone || '+91 98765 43210'} className="w-full px-3 py-2 rounded-xl border" />
                </div>
                <button
                  onClick={() => showToast('Profile updated successfully!', 'success')}
                  className="px-6 py-2.5 bg-navy hover:bg-navy-light text-white font-bold rounded-xl transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
