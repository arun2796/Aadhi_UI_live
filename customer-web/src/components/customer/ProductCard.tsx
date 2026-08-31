import React from 'react';
import { Heart, ShoppingBag, Eye, Check, ShieldCheck, Sparkles } from 'lucide-react';
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
      {/* Top Badges & Actions */}
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
        <img
          src={product.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
        />

        {/* Discount Badge */}
        {product.discountPercentage && product.discountPercentage > 0 && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider">
            {product.discountPercentage}% OFF
          </div>
        )}

        {/* Best Seller / New Badge */}
        {product.isBestSeller && (
          <div className="absolute top-3 right-11 bg-orange text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase">
            Best Seller
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
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

          {/* Rating */}
          <div className="mb-2">
            <RatingStars rating={product.rating || 4.8} reviewCount={product.reviewCount || 45} size="w-3.5 h-3.5" />
          </div>

          {/* Short Specs / Bullet */}
          {product.shortDescription && (
            <p className="text-xs text-slate-500 line-clamp-1 mb-3">
              {product.shortDescription}
            </p>
          )}
        </div>

        {/* Price & Add to Cart */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base sm:text-lg font-black text-navy">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{product.compareAtPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {product.availableQuantity <= 5 && product.availableQuantity > 0 && (
              <span className="text-[10px] text-red-600 font-semibold">
                Only {product.availableQuantity} left!
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : cartItem
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-orange hover:bg-orange-hover text-white'
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
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
