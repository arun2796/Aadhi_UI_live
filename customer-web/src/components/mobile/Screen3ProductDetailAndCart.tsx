import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Heart,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Star,
  Share2,
  RotateCcw,
  User,
  BadgePercent,
  X,
  Tag
} from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';
import productPlaceholder from '../../assets/product-placeholder.svg';

/* ────────────────────────────── shared helpers ────────────────────────────── */

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

const pctOff = (price: number, mrp?: number, explicit?: number): number => {
  if (mrp && mrp > price) return explicit || Math.round((1 - price / mrp) * 100);
  return 0;
};

/** Star strip used on the rating line, e.g. ★★★★☆ */
const Stars: React.FC<{ rating: number; className?: string }> = ({ rating, className = 'w-3.5 h-3.5' }) => (
  <span className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`${className} ${i <= Math.round(rating) ? 'text-gold fill-gold' : 'text-slate-300'}`}
      />
    ))}
  </span>
);

/* ══════════════════════════════════════════════════════════════════════════════
   SCREEN 3 — PRODUCT DETAILS  (design 03_product_details.png)
   ══════════════════════════════════════════════════════════════════════════════ */

interface Screen3ProductDetailProps {
  slug?: string;
  onNavigate: (page: string, params?: any) => void;
  onBack: () => void;
}

export const Screen3ProductDetail: React.FC<Screen3ProductDetailProps> = ({
  slug = 'mega-celebration-box',
  onNavigate,
  onBack
}) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setActiveImageIdx(0);
    setQuantity(1);

    (async () => {
      try {
        let p = await api.getProductBySlug(slug);
        if (!p) {
          const list = await api.getProducts();
          p = list.length > 0 ? list[0] : null;
        }
        if (live) setProduct(p);
      } catch {
        if (live) setProduct(null);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [slug]);

  const features = useMemo(() => {
    const raw = (product?.description || '')
      .split(/\r?\n|•|;/)
      .map((s) => s.replace(/^[\s\-–—*·]+/, '').trim())
      .filter((s) => s.length > 2 && s.length <= 48);
    // Only real feature lines from the product description — no fallback copy.
    return raw.length >= 2 ? raw.slice(0, 4) : [];
  }, [product]);

  if (loading) {
    return (
      <div className="font-sans bg-white animate-fade-in">
        <div className="aspect-square bg-slate-100 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-5 w-3/4 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-6 w-2/3 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 font-sans space-y-3">
        <div>Product not found.</div>
        <button onClick={onBack} className="px-5 py-2.5 rounded-xl bg-orange text-white font-bold shadow-glow">
          Go Back
        </button>
      </div>
    );
  }

  const images =
    product.images && product.images.length > 0
      ? [...product.images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((i) => i.url)
      : [product.primaryImageUrl || productPlaceholder];

  const inWish = isInWishlist(product.id);
  const inStock = product.isActive !== false;
  const off = pctOff(product.price, product.compareAtPrice, product.discountPercentage);

  // Real review data only — the rating line is omitted entirely when the DTO has none.
  const rating = typeof product.rating === 'number' && product.rating > 0 ? product.rating : 0;
  const reviews =
    typeof product.reviewCount === 'number' && product.reviewCount > 0 ? product.reviewCount : 0;
  const hasRating = rating > 0 || reviews > 0;

  const handleTrackScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(images.length - 1, idx));
    if (clamped !== activeImageIdx) setActiveImageIdx(clamped);
  };

  const scrollToImage = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setActiveImageIdx(i);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `${product.name} — ${inr(product.price)} at Aadhi Crackers`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: product.name, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        showToast('Product link copied to clipboard', 'success');
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`Added ${quantity} x ${product.name} to cart`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    onNavigate('checkout');
  };

  const handleWishlist = () => {
    toggleWishlist(product);
    showToast(inWish ? 'Removed from wishlist' : 'Added to wishlist', inWish ? 'info' : 'success');
  };

  return (
    <div className="pb-6 font-sans bg-white animate-fade-in">
      {/* 1. Image carousel with dots + share / wishlist overlay */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="flex h-full overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((src, i) => (
            <img
              key={i}
              src={src || productPlaceholder}
              alt={`${product.name} ${i + 1}`}
              className="w-full h-full object-cover flex-shrink-0 snap-center"
              draggable={false}
            />
          ))}
        </div>

        {off > 0 && (
          <span className="absolute top-3 left-3 bg-orange text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-glow">
            {off}% OFF
          </span>
        )}

        {/* share + wishlist icons */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleWishlist}
            className="w-9 h-9 rounded-full bg-white/95 shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Wishlist"
          >
            <Heart className={`w-4 h-4 ${inWish ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
          </button>
        </div>

        {/* carousel dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/25 backdrop-blur-xs px-2.5 py-1.5 rounded-full">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToImage(i)}
                aria-label={`Image ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  activeImageIdx === i ? 'w-4 bg-orange' : 'w-2 bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Breadcrumb + title + rating line */}
      <div className="px-4 pt-3 space-y-1.5">
        <div className="text-[10px] text-slate-400 font-medium truncate">
          Home &gt;{' '}
          <button
            className="text-slate-500 font-semibold"
            onClick={() => onNavigate('category', { category: product.categoryId || product.categoryName })}
          >
            {product.categoryName || 'Crackers'}
          </button>{' '}
          &gt; <span className="text-slate-600 font-semibold">{product.name}</span>
        </div>

        <h1 className="text-xl font-black text-navy leading-tight">{product.name}</h1>

        {hasRating && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Stars rating={rating} />
            <span className="text-[11px] font-bold text-slate-700">{rating}</span>
            <span className="text-[11px] text-slate-400">({reviews} Reviews)</span>
          </div>
        )}

        {/* 3. Price row */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-2xl font-black text-navy">{inr(product.price)}</span>
          {(product.compareAtPrice ?? 0) > product.price && product.compareAtPrice && (
            <>
              <span className="text-sm text-slate-400 line-through">
                {inr(product.compareAtPrice)}
              </span>
              <span className="text-[11px] font-black text-white bg-orange px-2 py-0.5 rounded">
                {off}% OFF
              </span>
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-400 font-medium">Inclusive of all taxes</div>
      </div>

      {/* 4. Feature checklist (from real description lines only; hidden when none) */}
      {features.length > 0 && (
        <div className="px-4 pt-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Stock + quantity stepper */}
      <div className="px-4 pt-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <span className={`text-xs font-black ${inStock ? 'text-emerald-600' : 'text-red-600'}`}>
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-xs font-bold text-slate-700">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 active:bg-slate-100"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-black text-sm text-navy w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(999, q + 1))}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:bg-slate-100"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 6. Add to Cart (outline purple) + Buy Now (filled purple) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className="py-3.5 rounded-2xl border-2 border-purple text-purple font-bold text-xs flex items-center justify-center gap-1.5 active:bg-purple/5 disabled:border-slate-200 disabled:text-slate-300 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!inStock}
            className="py-3.5 rounded-2xl bg-purple hover:bg-purple-dark text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-glow-purple disabled:bg-slate-300 disabled:shadow-none transition-colors"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7. Short description */}
      {(product.shortDescription || product.description) && (
        <div className="px-4 pt-4">
          <h3 className="text-xs font-black text-navy uppercase tracking-wider mb-1.5">Description</h3>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-5">
            {product.shortDescription || product.description}
          </p>
        </div>
      )}

      {/* 8. Bottom icon row: Share / Wishlist / Easy Returns / Account */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
          <button onClick={handleShare} className="flex flex-col items-center gap-1.5 active:opacity-70">
            <span className="w-10 h-10 rounded-full bg-purple-soft flex items-center justify-center">
              <Share2 className="w-4 h-4 text-purple" />
            </span>
            <span className="text-[9px] font-bold text-slate-600">Share</span>
          </button>

          <button onClick={handleWishlist} className="flex flex-col items-center gap-1.5 active:opacity-70">
            <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Heart className={`w-4 h-4 ${inWish ? 'fill-red-500 text-red-500' : 'text-red-400'}`} />
            </span>
            <span className="text-[9px] font-bold text-slate-600">Wishlist</span>
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <span className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
            </span>
            <span className="text-[9px] font-bold text-slate-600">Easy Returns</span>
          </div>

          <button
            onClick={() => onNavigate('account')}
            className="flex flex-col items-center gap-1.5 active:opacity-70"
          >
            <span className="w-10 h-10 rounded-full bg-gold-soft flex items-center justify-center">
              <User className="w-4 h-4 text-gold-dark" />
            </span>
            <span className="text-[9px] font-bold text-slate-600">Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   SCREEN 4 — MY CART  (design 04_cart.png)
   ══════════════════════════════════════════════════════════════════════════════ */

export const Screen4Cart: React.FC<{
  onNavigate: (page: string, params?: any) => void;
  onBack?: () => void;
}> = ({ onNavigate }) => {
  const {
    items,
    updateQuantity,
    removeFromCart,
    totalItems,
    subtotal,
    discount,
    couponCode,
    applyCoupon,
    removeCoupon,
    shippingCharge,
    grandTotal
  } = useCart();
  const { showToast } = useToast();
  const { promotionCodeEnabled, freeShippingThreshold } = useSettings();

  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  const handleApplyCoupon = async () => {
    const clean = code.trim();
    if (!clean || applying) return;
    setApplying(true);
    const ok = await applyCoupon(clean);
    setApplying(false);
    if (ok) {
      showToast(`Coupon ${clean.toUpperCase()} applied`, 'success');
      setCode('');
    } else {
      showToast('Invalid or expired coupon code', 'error');
    }
  };

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div className="p-8 text-center space-y-4 font-sans bg-white min-h-[60vh] flex flex-col items-center justify-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
          <ShoppingBag className="w-9 h-9" />
        </div>
        <h2 className="text-base font-black text-navy">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">
          Looks like you haven't added any crackers yet. Explore our festive collection!
        </p>
        <button
          onClick={() => onNavigate('category-menu')}
          className="px-6 py-3 rounded-xl bg-purple text-white text-xs font-bold shadow-glow-purple active:scale-95 transition-transform"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="pb-6 font-sans bg-[#fbfbfb] animate-fade-in">
      <div className="px-4 pt-3 space-y-3.5">
        {/* Heading */}
        <h1 className="text-base font-black text-navy">
          My Cart <span className="text-slate-400 font-bold text-sm">({totalItems} items)</span>
        </h1>

        {/* Item rows */}
        <div className="space-y-3">
          {items.map((item) => {
            const off = pctOff(item.unitPrice, item.compareAtPrice);
            return (
              <div
                key={item.productId}
                className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex gap-3"
              >
                <img
                  src={item.imageUrl || productPlaceholder}
                  alt={item.name}
                  className="w-[70px] h-[70px] rounded-xl object-cover border border-slate-100 flex-shrink-0"
                />

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-xs text-navy leading-snug line-clamp-2">{item.name}</h3>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-400 active:text-red-500 p-0.5 -mr-0.5 flex-shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[13px] font-black text-navy">{inr(item.unitPrice)}</span>
                    {(item.compareAtPrice ?? 0) > item.unitPrice && item.compareAtPrice && (
                      <span className="text-[10px] text-slate-400 line-through">
                        {inr(item.compareAtPrice)}
                      </span>
                    )}
                    {off > 0 && (
                      <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        {off}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="text-slate-600 disabled:opacity-35 p-0.5"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-black text-navy w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        className="text-slate-600 disabled:opacity-35 p-0.5"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-xs font-black text-slate-700">
                      {inr(item.lineTotal || item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coupon code (hidden when promotions are disabled from the storefront,
            unless a coupon is already applied so it can still be removed) */}
        {(promotionCodeEnabled || couponCode) && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-navy">
            <BadgePercent className="w-4 h-4 text-orange" />
            Coupon Code
          </div>

          {couponCode ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-black text-emerald-700 truncate">{couponCode}</span>
                <span className="text-[10px] font-semibold text-emerald-600">applied</span>
              </div>
              <button
                onClick={() => {
                  removeCoupon();
                  showToast('Coupon removed', 'info');
                }}
                className="w-6 h-6 rounded-full bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 active:scale-90 transition-transform flex-shrink-0"
                aria-label="Remove coupon"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                placeholder="Enter coupon code"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-navy placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:border-purple uppercase"
              />
              <button
                onClick={handleApplyCoupon}
                disabled={!code.trim() || applying}
                className="px-4 py-2.5 rounded-xl bg-navy text-white text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
            </div>
          )}
        </div>
        )}

        {/* Order summary */}
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2.5 text-xs">
          <h3 className="text-xs font-black text-navy uppercase tracking-wider">Order Summary</h3>

          <div className="flex justify-between text-slate-600">
            <span>Subtotal ({totalItems} items)</span>
            <span className="font-bold text-slate-800">{inr(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-600">Discount</span>
            {discount > 0 ? (
              <span className="font-bold text-emerald-600">- {inr(discount)}</span>
            ) : (
              <span className="font-bold text-slate-400">{inr(0)}</span>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-slate-600">Delivery Charges</span>
            {shippingCharge === 0 ? (
              <span className="font-black text-emerald-600">FREE</span>
            ) : (
              <span className="font-bold text-slate-800">{inr(shippingCharge)}</span>
            )}
          </div>

          {shippingCharge > 0 && freeShippingThreshold > 0 && (
            <div className="text-[10px] text-slate-400 font-medium">
              Free delivery on orders above {inr(freeShippingThreshold)}
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-100">
            <span className="text-sm font-black text-navy">Total</span>
            <span className="text-lg font-black text-navy">{inr(grandTotal)}</span>
          </div>
        </div>

        {/* Savings banner */}
        {discount > 0 && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold text-emerald-700">
              You saved {inr(discount)} on this order
            </span>
          </div>
        )}

        {/* Proceed to Checkout */}
        <button
          onClick={() => onNavigate('checkout')}
          className="w-full py-4 rounded-2xl bg-purple hover:bg-purple-dark text-white font-black text-xs uppercase tracking-widest shadow-glow-purple active:scale-[0.98] transition-all flex items-center justify-center gap-1"
        >
          Proceed to Checkout
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onNavigate('category-menu')}
          className="w-full text-center text-[11px] font-bold text-purple py-1 active:opacity-70"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};
