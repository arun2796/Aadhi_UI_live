import React from 'react';
import { Heart, ShoppingBag, Eye, Check } from 'lucide-react';
import { Product } from '../../types';
import { RatingStars } from '../common/CommonComponents';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

interface ProductCardProps {
  product: Product;
  onNavigate: (page: string, params?: any) => void;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onQuickView }) => {
  const { addToCart, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const inWish = isInWishlist(product.id);
  const cartItem = items.find(i => i.productId === product.id);
  const isOutOfStock = product.availableQuantity <= 0;

  const discountPct =
    product.discountPercentage && product.discountPercentage > 0
      ? Math.round(product.discountPercentage)
      : product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
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
        <img
          src={product.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
          alt={product.name}
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
            {discountPct > 0 && (
              <span className="text-xs font-bold text-orange">{discountPct}% OFF</span>
            )}
          </div>

          {/* Star rating + count */}
          {(product.rating || product.reviewCount) ? (
            <div className="mb-2">
              <RatingStars rating={product.rating || 0} reviewCount={product.reviewCount || 0} size="w-3.5 h-3.5" />
            </div>
          ) : null}

          {product.availableQuantity <= 5 && product.availableQuantity > 0 && (
            <span className="text-[10px] text-red-600 font-semibold">
              Only {product.availableQuantity} left!
            </span>
          )}
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
