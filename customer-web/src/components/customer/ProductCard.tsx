import React from 'react';
import { Heart, ShoppingBag, Eye, Check, Gift, Package } from 'lucide-react';
import { Product } from '../../types';
import { RatingStars } from '../common/CommonComponents';
import productPlaceholder from '../../assets/product-placeholder.svg';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

interface ProductCardProps {
  product: Product;
  onNavigate: (page: string, params?: any) => void;
  onQuickView?: (product: Product) => void;
  /**
   * Set on the handful of cards that are visible without scrolling — the first row of the first
   * grid on a page. Those images are the LCP candidate, so they are fetched eagerly and at high
   * priority; everything else stays lazy.
   *
   * Why this is a prop and not a default: `loading="lazy"` on an above-the-fold image makes LCP
   * WORSE, because the browser defers it behind the initial layout pass instead of racing it.
   * Lazy-loading everything is the mistake this exists to prevent.
   */
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onQuickView, priority = false }) => {
  const { addToCart, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const inWish = isInWishlist(product.id);
  const cartItem = items.find(i => i.productId === product.id);
  const isOutOfStock = product.isActive === false;

  // Combo / gift-box chip — hidden entirely until the API sends the fields.
  // A product is one or the other: a gift box is a sealed single SKU with no
  // contents to count, so it takes the chip without an item count.
  const comboCount = product.comboItemCount ?? 0;
  const isGiftBox = product.isGiftBox === true;
  const showComboChip = product.isCombo === true && !isGiftBox;
  const showBundleChip = showComboChip || isGiftBox;

  const discountPct =
    product.discountPercentage && product.discountPercentage > 0
      ? Math.round(product.discountPercentage)
      : product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  // A combo's or gift box's whole pitch is the bundled price against the MRP, so
  // the same orange discount slot spells the saving out in rupees, not just a %.
  const bundleSaving =
    showBundleChip && product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(product.compareAtPrice - product.price)
      : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1);
    showToast(`Added "${product.name}" to cart!`, 'success');
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
    showToast(inWish ? `Removed from wishlist` : `Added "${product.name}" to wishlist!`, 'info');
  };

  return (
    <div
      onClick={() => onNavigate('product-detail', { slug: product.slug })}
      className="group bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col overflow-hidden cursor-pointer relative transform hover:-translate-y-1"
    >
      {/* Image, Ribbon & Actions */}
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
        {/* The wrapper is aspect-square, so the box is reserved before the image arrives and
            there is no layout shift — width/height attributes would be redundant here. */}
        <img
          src={product.primaryImageUrl || productPlaceholder}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
        />

        {/* BESTSELLER red ribbon */}
        {product.isBestSeller && (
          <div className="absolute top-3 left-0 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-r-lg shadow-md uppercase tracking-wider">
            Bestseller
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-md ${
            inWish ? 'bg-red-50 text-red-500' : 'bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${inWish ? 'fill-current' : ''}`} />
        </button>

        {/* Quick View Button on Hover */}
        {onQuickView && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickView(product); }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-navy/90 hover:bg-navy text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 backdrop-blur-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Quick View</span>
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Unit */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1">
            <span>{product.categoryName}</span>
            <span>{product.unit}</span>
          </div>

          {/* COMBO / GIFT BOX chip — what makes this product its own thing */}
          {showComboChip && (
            <span className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-md bg-purple-soft text-purple text-[10px] font-black uppercase tracking-wider">
              <Package className="w-3 h-3" />
              Combo{comboCount > 0 ? ` · ${comboCount} items` : ''}
            </span>
          )}
          {isGiftBox && (
            <span className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-md bg-gold-soft text-gold-dark text-[10px] font-black uppercase tracking-wider">
              <Gift className="w-3 h-3" />
              Gift Box
            </span>
          )}

          {/* Title */}
          <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-purple transition-colors line-clamp-1 mb-1.5">
            {product.name}
          </h3>

          {/* Price row: price + strikethrough MRP + orange % OFF */}
          <div className="flex items-baseline flex-wrap gap-x-1.5 mb-1.5">
            <span className="text-base sm:text-lg font-black text-navy">
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-slate-400 line-through">
                ₹{product.compareAtPrice.toLocaleString('en-IN')}
              </span>
            )}
            {(discountPct > 0 || bundleSaving > 0) && (
              <span className="text-xs font-bold text-orange">
                {bundleSaving > 0
                  ? `Save ₹${bundleSaving.toLocaleString('en-IN')}${discountPct > 0 ? ` (${discountPct}% OFF)` : ''}`
                  : `${discountPct}% OFF`}
              </span>
            )}
          </div>

          {/* Star rating + count — only when the DTO carries real review data */}
          {(product.rating ?? 0) > 0 || (product.reviewCount ?? 0) > 0 ? (
            <div className="mb-2">
              <RatingStars rating={product.rating || 0} reviewCount={product.reviewCount || 0} size="w-3.5 h-3.5" />
            </div>
          ) : null}
        </div>

        {/* Purple-outline Add to Cart */}
        <div className="pt-3 mt-2 border-t border-slate-100">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : cartItem
                ? 'bg-purple text-white border border-purple hover:bg-purple-dark'
                : 'bg-white text-purple border-[1.5px] border-purple hover:bg-purple hover:text-white'
            }`}
          >
            {cartItem ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added ({cartItem.quantity})</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
