import React, { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Tag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Drawer } from '../common/CommonComponents';
import { useToast } from '../../context/ToastContext';

interface CartDrawerProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const {
    items,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    updateQuantity,
    removeFromCart,
    subtotal,
    discount,
    couponCode,
    applyCoupon,
    removeCoupon,
    itemsTotal
  } = useCart();

  const { showToast } = useToast();
  const [inputCoupon, setInputCoupon] = useState('');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    const ok = applyCoupon(inputCoupon);
    if (ok) {
      showToast(`Coupon "${inputCoupon.toUpperCase()}" applied successfully!`, 'success');
      setInputCoupon('');
    } else {
      showToast(`Invalid coupon code. Try "DIWALI2026" or "WELCOME10"`, 'error');
    }
  };

  const handleProceedCheckout = () => {
    setIsCartDrawerOpen(false);
    onNavigate('checkout');
  };

  return (
    <Drawer
      isOpen={isCartDrawerOpen}
      onClose={() => setIsCartDrawerOpen(false)}
      title={`Your Shopping Cart (${items.reduce((a, b) => a + b.quantity, 0)})`}
      width="max-w-md"
    >
      {items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-16">
          <div className="w-20 h-20 rounded-full bg-orange/10 flex items-center justify-center text-orange mb-4">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-navy mb-1">Your cart is currently empty</h3>
          <p className="text-xs text-slate-500 max-w-xs mb-6">
            Explore our bestselling festive gift boxes and sparklers to light up your celebrations!
          </p>
          <button
            onClick={() => { setIsCartDrawerOpen(false); onNavigate('shop'); }}
            className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs shadow-md transition-colors"
          >
            Explore Fireworks Catalog
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between">
          {/* Items List */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.productId}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3"
              >
                <img
                  src={item.imageUrl || '/product-placeholder.svg'}
                  alt={item.name}
                  className="w-16 h-16 rounded-lg object-cover bg-white border flex-shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-800 truncate mb-0.5">{item.name}</h4>
                  <div className="text-[11px] text-slate-500 mb-2">
                    ₹{item.unitPrice.toLocaleString('en-IN')}
                    {item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
                      <span className="ml-1 text-[10px] text-slate-400 line-through">
                        ₹{item.compareAtPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="px-2 py-1 text-slate-500 hover:text-navy hover:bg-slate-100 text-xs transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 py-1 text-xs font-bold text-navy">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="px-2 py-1 text-slate-500 hover:text-navy hover:bg-slate-100 text-xs transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-navy">
                    ₹{item.lineTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon Code Input */}
          <div className="pt-4 border-t border-slate-200 mt-4">
            {couponCode ? (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Coupon applied: <strong>{couponCode}</strong> (-₹{discount.toLocaleString('en-IN')})</span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-xs font-bold text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex space-x-2">
                <input
                  type="text"
                  value={inputCoupon}
                  onChange={(e) => setInputCoupon(e.target.value)}
                  placeholder="Enter Coupon (e.g. DIWALI2026)"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange uppercase"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-bold hover:bg-navy-light transition-colors"
                >
                  Apply
                </button>
              </form>
            )}
          </div>

          {/* Totals Summary */}
          <div className="pt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Festive Coupon Discount:</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}

            {/* Items total, not the payable amount — GST and packing charges are
                billed by the server and quoted at checkout. */}
            <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-200">
              <span>Items Total:</span>
              <span className="text-base text-orange font-black">₹{itemsTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              GST and packing charges are added at checkout.
            </div>
          </div>

          {/* Checkout CTA */}
          <div className="pt-4 space-y-2">
            <button
              onClick={handleProceedCheckout}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-glow hover:shadow-lg transition-all"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => { setIsCartDrawerOpen(false); onNavigate('shop'); }}
              className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-navy transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
};
