import React, { useState } from 'react';
import { Heart, ShoppingCart, Trash2, X } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

const inr = (n?: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

const isInStock = (p: Product): boolean => {
  const qty = typeof p.availableQuantity === 'number' ? p.availableQuantity : p.stockQuantity;
  return (qty ?? 0) > 0;
};

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80';

/** Design 13: Wishlist — real wishlist items, In Stock => Add to Cart, Out of Stock => Notify Me, Clear Wishlist. */
export const ScreenWishlist: React.FC<NavProps> = ({ onNavigate }) => {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const openProduct = (p: Product) => {
    if (p.slug) onNavigate('product-detail', { slug: p.slug });
  };

  const handleAddToCart = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    addToCart(p, 1);
    showToast(`${p.name} added to cart`, 'success');
  };

  const handleNotifyMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast("We'll notify you when it's back in stock", 'info');
  };

  const handleRemove = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    removeFromWishlist(p.id);
    showToast(`${p.name} removed from wishlist`, 'info');
  };

  const handleClear = () => {
    clearWishlist();
    setShowClearConfirm(false);
    showToast('Wishlist cleared', 'info');
  };

  /* ── Empty state ── */
  if (wishlist.length === 0) {
    return (
      <div className="p-4 pb-8 font-sans bg-[#fbfbfb] min-h-full animate-fade-in">
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3">
          <Heart className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-bold text-navy">Your wishlist is empty</p>
            <p className="text-xs text-slate-500 mt-1">
              Tap the heart on any product to save it here for later.
            </p>
          </div>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] min-h-full animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {/* Card header */}
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-base font-black text-navy">
            My Wishlist ({wishlist.length} {wishlist.length === 1 ? 'item' : 'items'})
          </h2>
        </div>

        {/* Items */}
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {wishlist.map((p) => {
            const inStock = isInStock(p);
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openProduct(p);
                }}
                className="flex items-start space-x-3 p-4 cursor-pointer active:bg-slate-50 transition-colors"
              >
                {/* Image */}
                <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img
                    src={p.primaryImageUrl || FALLBACK_IMG}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="text-[13px] font-bold text-navy leading-snug pr-2">{p.name}</div>
                    {inStock ? (
                      <button
                        onClick={(e) => handleRemove(e, p)}
                        aria-label={`Remove ${p.name} from wishlist`}
                        className="p-1 -mt-1 -mr-1 flex-shrink-0 text-red-500 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Heart className="w-5 h-5 fill-red-500" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleRemove(e, p)}
                        aria-label={`Remove ${p.name} from wishlist`}
                        className="p-1.5 -mt-1 -mr-1 flex-shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="text-lg font-black text-navy mt-0.5">{inr(p.price)}</div>

                  <div className="flex items-center justify-between mt-1.5">
                    {inStock ? (
                      <>
                        <span className="text-xs font-bold text-emerald-600">In Stock</span>
                        <button
                          onClick={(e) => handleAddToCart(e, p)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-glow-purple transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-red-500">Out of Stock</span>
                        <button
                          onClick={handleNotifyMe}
                          className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-light text-white text-xs font-bold transition-colors"
                        >
                          Notify Me
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clear wishlist footer */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-3 rounded-xl border border-slate-200 text-sm font-bold text-navy hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Clear Wishlist
          </button>
        </div>
      </div>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 animate-scale-up shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-navy">Clear wishlist?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will remove all {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} from
                your wishlist. This cannot be undone.
              </p>
            </div>
            <div className="flex space-x-3 pt-1">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
