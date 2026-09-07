import React, { useState } from 'react';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import productPlaceholder from '../../assets/product-placeholder.svg';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Desktop design 4: dedicated My Cart page (item list + Order Summary card). */
export const CartPage: React.FC<{ onNavigate: (page: string, params?: any) => void }> = ({ onNavigate }) => {
  const {
    items,
    totalItems,
    subtotal,
    discount,
    couponCode,
    applyCoupon,
    removeCoupon,
    shippingCharge,
    grandTotal,
    updateQuantity,
    removeFromCart
  } = useCart();
  const { showToast } = useToast();
  const { promotionCodeEnabled, freeShippingThreshold } = useSettings();

  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const mrpSavings = items.reduce(
    (acc, i) => acc + Math.max(0, ((i.compareAtPrice || 0) - i.unitPrice)) * i.quantity,
    0
  );
  const totalSaved = discount + mrpSavings;

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    const ok = await applyCoupon(code);
    setApplyingCoupon(false);
    if (ok) {
      showToast(`Coupon ${code.toUpperCase()} applied successfully!`, 'success');
      setCouponInput('');
    } else {
      showToast('This coupon code is invalid or not applicable to your cart.', 'error');
    }
  };

  /* ── Empty cart state ── */
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-orange-soft flex items-center justify-center text-orange mx-auto">
          <ShoppingBag className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-black text-navy">Your cart is empty</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Looks like you haven't added any crackers yet. Explore our festive collection and light up your celebrations!
        </p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-8 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-colors"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Left: cart item list ── */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h1 className="text-lg font-black text-navy">
                My Cart <span className="text-slate-400 font-bold text-sm">({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
              </h1>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.productId} className="p-4 sm:px-6 flex items-center gap-4">
                  <img
                    src={item.imageUrl || productPlaceholder}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-navy truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {inr(item.unitPrice)}
                      {item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
                        <span className="ml-1.5 line-through text-slate-400">{inr(item.compareAtPrice)}</span>
                      )}
                      <span className="text-slate-400"> / unit</span>
                    </div>
                  </div>

                  {/* Quantity stepper (clamped 1..maxStock) */}
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-navy transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center text-xs font-black text-navy select-none">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, Math.min(item.quantity + 1, item.maxStock))}
                      disabled={item.quantity >= item.maxStock}
                      className={`w-8 h-8 flex items-center justify-center transition-colors ${
                        item.quantity >= item.maxStock
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-navy'
                      }`}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line total */}
                  <div className="w-24 text-right text-sm font-black text-navy flex-shrink-0">
                    {inr(item.lineTotal || item.unitPrice * item.quantity)}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => {
                      removeFromCart(item.productId);
                      showToast(`${item.name} removed from cart`, 'info');
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('shop')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-navy hover:border-navy font-bold text-xs flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </button>
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-black text-navy">Order Summary</h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">{inr(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount{couponCode ? ` (${couponCode})` : ''}</span>
                  <span>-{inr(discount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery Charges</span>
                {shippingCharge === 0 ? (
                  <span className="font-bold text-emerald-600">FREE</span>
                ) : (
                  <span className="font-bold text-slate-800">{inr(shippingCharge)}</span>
                )}
              </div>

              {shippingCharge > 0 && freeShippingThreshold > 0 && (
                <div className="text-[10px] text-slate-400 font-medium">
                  Free delivery on orders above {inr(freeShippingThreshold)}
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-navy pt-3 border-t border-slate-100">
                <span>Total</span>
                <span className="text-base">{inr(grandTotal)}</span>
              </div>
            </div>

            {totalSaved > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold text-center">
                You saved {inr(totalSaved)} on this order
              </div>
            )}

            {/* Coupon (hidden when promotions are disabled from the storefront,
                unless a coupon is already applied so it can still be removed) */}
            {couponCode ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-soft border border-purple/20">
                <div className="flex items-center space-x-2 text-xs">
                  <Tag className="w-4 h-4 text-purple" />
                  <span className="font-black text-purple tracking-wide">{couponCode}</span>
                  <span className="text-slate-500 font-medium">applied</span>
                </div>
                <button
                  onClick={() => {
                    removeCoupon();
                    showToast('Coupon removed', 'info');
                  }}
                  className="p-1 rounded-full text-purple hover:bg-purple/10 transition-colors"
                  title="Remove coupon"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : promotionCodeEnabled ? (
              <div className="flex items-stretch space-x-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoupon(); }}
                  placeholder="Enter coupon code"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold tracking-wide focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none uppercase"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={applyingCoupon || !couponInput.trim()}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    applyingCoupon || !couponInput.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-purple hover:bg-purple-dark text-white'
                  }`}
                >
                  {applyingCoupon ? 'Applying...' : 'Apply'}
                </button>
              </div>
            ) : null}

            <button
              onClick={() => onNavigate('checkout')}
              className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
