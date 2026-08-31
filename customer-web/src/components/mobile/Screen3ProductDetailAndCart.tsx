import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

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

  useEffect(() => {
    setLoading(true);
    api.getProductBySlug(slug)
      .then(p => {
        if (p) setProduct(p);
        else {
          api.getProducts().then(list => {
            if (list.length > 0) setProduct(list[0]);
          });
        }
      })
      .catch(() => {
        api.getProducts().then(list => {
          if (list.length > 0) setProduct(list[0]);
        });
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 font-sans">
        Loading cracker details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 font-sans space-y-3">
        <div>Product not found.</div>
        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-orange text-white font-bold">Go Back</button>
      </div>
    );
  }

  const images = (product.images && product.images.length > 0)
    ? product.images.map(i => i.url)
    : [product.primaryImageUrl || 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80'];

  const inWish = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`Added ${quantity}x ${product.name} to cart!`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    onNavigate('checkout');
  };

  return (
    <div className="space-y-4 pb-6 font-sans bg-white">
      {/* 1. Large Hero Image Slider matching Screen 3 */}
      <div className="relative aspect-4/3 bg-slate-50 overflow-hidden">
        <img
          src={images[activeImageIdx] || product.primaryImageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
        />

        {/* Carousel indicator dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-black/20 backdrop-blur-xs px-2.5 py-1 rounded-full">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImageIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeImageIdx === i ? 'w-4 bg-orange' : 'bg-white/70'
                }`}
              />
            ))}
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={() => toggleWishlist(product)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-slate-600 hover:text-red-500"
        >
          <Heart className={`w-4 h-4 ${inWish ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>

      {/* 2. Product Title & Pricing Header */}
      <div className="px-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange">
            {product.categoryName || 'Sivakasi Special'}
          </span>
          <span className="text-[10px] font-mono text-slate-400 font-semibold">{product.sku}</span>
        </div>

        <h1 className="text-lg font-black text-navy leading-tight">{product.name}</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          {product.shortDescription || product.description || 'Premium genuine Sivakasi fireworks with multi-color visual effects.'}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline space-x-2 pt-1">
          <span className="text-xl font-black text-navy">₹{product.price.toLocaleString('en-IN')}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <>
              <span className="text-xs text-slate-400 line-through">₹{product.compareAtPrice.toLocaleString('en-IN')}</span>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {product.discountPercentage || Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3. Quantity & Action Buttons */}
      <div className="px-4 pt-2 space-y-3">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-xs font-bold text-slate-700">Quantity</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold text-xs text-navy w-4 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(product.availableQuantity || 99, quantity + 1))}
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleAddToCart}
            className="py-3 rounded-2xl border border-navy text-navy font-bold text-xs flex items-center justify-center space-x-1.5 hover:bg-slate-50 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Add to Cart</span>
          </button>
          <button
            onClick={handleBuyNow}
            className="py-3 rounded-2xl bg-orange hover:bg-orange-hover text-white font-bold text-xs flex items-center justify-center shadow-glow transition-all"
          >
            <span>Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const Screen4Cart: React.FC<{ onNavigate: (page: string, params?: any) => void; onBack?: () => void }> = ({
  onNavigate
}) => {
  const { items, updateQuantity, removeFromCart, subtotal, discount, grandTotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="p-8 text-center space-y-4 font-sans bg-white min-h-[50vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-navy">Your Festive Cart is Empty</h2>
        <p className="text-xs text-slate-500 max-w-xs">Explore our Sivakasi fireworks collection and add exciting gift boxes.</p>
        <button
          onClick={() => onNavigate('home')}
          className="px-6 py-2.5 rounded-xl bg-orange text-white text-xs font-bold shadow-glow"
        >
          Browse Crackers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6 font-sans bg-[#fbfbfb]">
      <div className="px-4 pt-3 space-y-3">
        <h1 className="text-base font-black text-navy">My Cart ({items.length} items)</h1>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.productId} className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center space-x-3">
              <img
                src={item.imageUrl || 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80'}
                alt={item.name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-100 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xs text-navy truncate">{item.name}</h3>
                <div className="text-[10px] font-mono text-slate-400">{item.sku}</div>
                <div className="text-xs font-black text-navy mt-1">₹{item.unitPrice.toLocaleString('en-IN')}</div>
              </div>

              <div className="flex flex-col items-end space-y-2">
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-slate-400 hover:text-red-500 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="text-slate-600">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-navy w-3 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="text-slate-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Price Breakdown */}
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Items Subtotal</span>
            <span className="font-bold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Festival Savings</span>
              <span>-₹{discount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Dangerous-Goods Shipping</span>
            <span className="font-bold text-emerald-600">FREE</span>
          </div>
          <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-100">
            <span>Grand Total</span>
            <span className="text-base text-navy font-black">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('checkout')}
          className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-98 transition-all flex items-center justify-center space-x-1"
        >
          <span>Proceed to Checkout</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
