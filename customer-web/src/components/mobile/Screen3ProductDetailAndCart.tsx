import React, { useState } from 'react';
import {
  Heart,
  Share2,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

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

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const images = [
    'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=600&auto=format&fit=crop&q=80'
  ];

  const productObj: Product = {
    id: 'prod-2',
    sku: 'GB-MGA-002',
    name: 'Mega Celebration Box',
    slug: 'mega-celebration-box',
    categoryId: 'cat-6',
    categoryName: 'Gift Boxes',
    price: 4499,
    compareAtPrice: 5999,
    costPrice: 2700,
    taxRate: 18,
    discountType: 'Percentage',
    discountValue: 25,
    discountPercentage: 25,
    stockQuantity: 95,
    availableQuantity: 80,
    reorderLevel: 25,
    unit: 'Box (62 Items)',
    weightKg: 7.0,
    isActive: true,
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: true,
    primaryImageUrl: images[0]
  };

  const inWish = isInWishlist(productObj.id);

  const handleAddToCart = () => {
    addToCart(productObj, quantity);
    showToast(`Added ${quantity}x Mega Celebration Box to cart!`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(productObj, quantity);
    onNavigate('checkout');
  };

  return (
    <div className="space-y-4 pb-6 font-sans bg-white">
      {/* 1. Large Hero Image Slider matching Screen 3 */}
      <div className="relative aspect-4/3 bg-slate-50 overflow-hidden">
        <img
          src={images[activeImageIdx]}
          alt="Mega Celebration Box"
          className="w-full h-full object-cover"
        />

        {/* Carousel indicator dots */}
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
      </div>

      {/* 2. Product Details Header */}
      <div className="px-4 space-y-2">
        <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
          AADHI CRACKERS
        </div>

        <h2 className="text-lg font-black text-navy leading-snug">
          Mega Celebration Box <br />
          <span className="text-xs text-slate-500 font-medium">(Includes 62 items)</span>
        </h2>

        {/* Rating & Sold count */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center text-amber-400 font-bold space-x-1">
            <span>★</span>
            <span className="text-slate-800">4.9</span>
            <span className="text-slate-400 font-normal">(181)</span>
          </div>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-medium">Sold 250+</span>
        </div>

        {/* Price Row */}
        <div className="flex items-baseline space-x-2 pt-1">
          <span className="text-2xl font-black text-navy">₹4,499</span>
          <span className="text-xs text-slate-400 line-through">₹5,999</span>
          <span className="text-xs font-black text-red-600">25% OFF</span>
        </div>

        {/* 4 Feature Bullet Points with orange diamond icon */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-700 font-medium">
          <div className="flex items-center space-x-2">
            <span className="text-orange text-xs font-bold">🔶</span>
            <span>62 Premium Items</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-orange text-xs font-bold">🔶</span>
            <span>Longer Burning Time</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-orange text-xs font-bold">🔶</span>
            <span>Safe & Eco Friendly</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-orange text-xs font-bold">🔶</span>
            <span>Perfect for All Celebrations</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons matching Screen 3 */}
      <div className="px-4 space-y-2.5 pt-2">
        <div className="flex items-center space-x-3">
          {/* Stepper */}
          <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 px-2 py-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1 text-slate-600 hover:text-navy"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 font-bold text-xs text-navy">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 text-slate-600 hover:text-navy"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAddToCart}
            className="flex-1 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-98 transition-all"
          >
            Add to Cart
          </button>
        </div>

        {/* Buy Now button */}
        <button
          onClick={handleBuyNow}
          className="w-full py-3 rounded-xl border-2 border-orange text-orange hover:bg-orange/5 font-bold text-xs uppercase tracking-wider active:scale-98 transition-all"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
};

interface Screen4CartProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Screen4Cart: React.FC<Screen4CartProps> = ({ onNavigate }) => {
  const { items, updateQuantity, removeFromCart, subtotal, discount, shippingCharge, grandTotal } = useCart();

  return (
    <div className="space-y-4 pb-6 font-sans bg-[#fbfbfb]">
      {/* Title */}
      <div className="px-4 pt-3">
        <h2 className="text-base font-black text-navy">My Cart ({items.reduce((a, b) => a + b.quantity, 0)} Items)</h2>
      </div>

      {/* 3 Cart Item Rows matching Screen 4 */}
      <div className="px-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between space-x-3"
          >
            <img
              src={item.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
              alt={item.name}
              className="w-14 h-14 rounded-xl object-cover bg-slate-50 border border-slate-100 flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-xs text-slate-800 truncate mb-0.5">{item.name}</h4>
              <div className="font-black text-xs text-navy mb-2">
                ₹{item.unitPrice.toLocaleString('en-IN')}
              </div>

              {/* Stepper */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 px-2 py-0.5">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="p-0.5 text-slate-500 hover:text-navy"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2 text-xs font-bold text-navy">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="p-0.5 text-slate-500 hover:text-navy"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-red-500 p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Apply Coupon Row */}
      <div className="px-4">
        <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between text-xs cursor-pointer">
          <span className="font-bold text-purple">Apply Coupon</span>
          <ChevronRight className="w-4 h-4 text-purple" />
        </div>
      </div>

      {/* Breakdown Summary matching Screen 4 */}
      <div className="px-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>Discount</span>
            <span>-₹{discount.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between">
            <span>Shipping</span>
            <span className="font-bold text-emerald-600">₹0</span>
          </div>

          <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-100">
            <span>Total</span>
            <span className="text-base text-navy font-black">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Proceed to Checkout CTA */}
      <div className="px-4 pt-1">
        <button
          onClick={() => onNavigate('checkout')}
          className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-98 transition-all"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};
