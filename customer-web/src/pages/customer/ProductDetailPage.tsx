import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  ShieldCheck,
  RotateCcw,
  Check,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Award,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../services/api';
import { RatingStars } from '../../components/common/CommonComponents';
import { ProductCard } from '../../components/customer/ProductCard';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

interface ProductDetailPageProps {
  slug: string;
  onNavigate: (page: string, params?: any) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug, onNavigate }) => {
  const { addToCart, setIsCartDrawerOpen } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [pincode, setPincode] = useState<string>('641012');
  const [pincodeStatus, setPincodeStatus] = useState<string | null>('Delivery available in 2-3 business days (Express Sivakasi Route)');
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'safety' | 'reviews'>('overview');

  useEffect(() => {
    api.getProductBySlug(slug).then((prod) => {
      if (prod) {
        setProduct(prod);
        setSelectedImage(prod.primaryImageUrl || '');
        setQuantity(1);

        // Fetch related products
        api.getProducts({ category: prod.categoryName }).then((list) => {
          setRelatedProducts(list.filter(p => p.id !== prod.id).slice(0, 4));
        });
      }
    });
  }, [slug]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-navy">Loading product details...</h2>
      </div>
    );
  }

  const inWish = isInWishlist(product.id);
  const isOutOfStock = product.availableQuantity <= 0;
  const youSave = product.compareAtPrice ? product.compareAtPrice - product.price : 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`Added ${quantity}x "${product.name}" to cart!`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    setIsCartDrawerOpen(false);
    onNavigate('checkout');
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPincodeStatus(`✓ Delivery available to PIN ${pincode} in 2-3 business days!`);
    } else {
      setPincodeStatus('Please enter a valid 6-digit Indian PIN code.');
    }
  };

  const boxContents = [
    { name: '10 Pcs Electric Sparklers', count: '2 Boxes' },
    { name: 'Flower Pots (Special Big)', count: '2 Boxes (10 Pcs)' },
    { name: 'Ground Chakkar Deluxe', count: '2 Boxes (10 Pcs)' },
    { name: 'Aerial 12-Shot Sky Symphony', count: '1 Unit' },
    { name: 'Whistling Rockets', count: '1 Pack (10 Pcs)' },
    { name: 'Color Twinkling Stars', count: '2 Boxes' },
    { name: 'Fancy Peacock Novelty', count: '2 Pcs' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button onClick={() => onNavigate('home')} className="hover:text-navy">Home</button>
        <span>/</span>
        <button onClick={() => onNavigate('shop', { category: product.categoryName.toLowerCase().replace(/\s+/g, '-') })} className="hover:text-navy">
          {product.categoryName}
        </button>
        <span>/</span>
        <span className="text-slate-800 font-semibold truncate">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Gallery (5 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="aspect-square w-full rounded-3xl bg-slate-50 border border-slate-200 overflow-hidden shadow-card relative">
            <img
              src={selectedImage || product.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.discountPercentage && (
              <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-xl shadow-md uppercase">
                {product.discountPercentage}% OFF
              </div>
            )}
            <button
              onClick={() => toggleWishlist(product)}
              className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors ${
                inWish ? 'bg-red-50 text-red-500' : 'bg-white/90 text-slate-400 hover:text-red-500'
              }`}
            >
              <Heart className={`w-5 h-5 ${inWish ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Thumbnails */}
          <div className="grid grid-cols-4 gap-3">
            {[
              product.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=600&auto=format&fit=crop&q=80'
            ].map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(img)}
                className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                  selectedImage === img ? 'border-orange shadow-md scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Info & Actions (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-orange uppercase tracking-wider mb-1">
              <span>{product.brandName || 'AADHI CRACKERS'}</span>
              <span>•</span>
              <span>{product.categoryName}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-navy leading-snug">
              {product.name}
            </h1>

            <div className="flex items-center space-x-4 mt-2">
              {(product.rating || product.reviewCount) ? (
                <>
                  <RatingStars rating={product.rating || 0} reviewCount={product.reviewCount || 0} />
                  <span className="text-xs text-slate-300">|</span>
                </>
              ) : null}
              <span className="text-xs text-slate-500 font-medium">SKU: <strong className="text-slate-700">{product.sku}</strong></span>
              <span className="text-xs text-slate-300">|</span>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                100% Certified Safe
              </span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="p-5 rounded-2xl bg-orange/5 border border-orange/15 space-y-2">
            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-black text-navy">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{product.compareAtPrice.toLocaleString('en-IN')}
                </span>
              )}
              {youSave > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  You Save ₹{youSave.toLocaleString('en-IN')} ({product.discountPercentage}% OFF)
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              Inclusive of all GST taxes. Free express shipping on orders over ₹3,000.
            </div>
          </div>

          {/* Highlights */}
          {product.shortDescription && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium leading-relaxed">
              ✨ <strong>Highlights:</strong> {product.shortDescription}
            </div>
          )}

          {/* Pincode Delivery Checker */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-700 block">Check Delivery Date & Serviceability:</label>
            <form onSubmit={handleCheckPincode} className="flex space-x-2 max-w-sm">
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-navy hover:bg-navy-light text-white text-xs font-bold rounded-xl transition-colors"
              >
                Check
              </button>
            </form>
            {pincodeStatus && (
              <div className="text-xs text-emerald-700 font-medium flex items-center space-x-1">
                <span>{pincodeStatus}</span>
              </div>
            )}
          </div>

          {/* Quantity & CTA Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-slate-500 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 font-bold text-sm text-navy">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.availableQuantity || 99, quantity + 1))}
                  className="p-2 text-slate-500 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                {product.availableQuantity > 0 ? (
                  <span className="text-emerald-600 font-bold">In Stock ({product.availableQuantity} units available)</span>
                ) : (
                  <span className="text-red-600 font-bold">Out of Stock</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-glow hover:shadow-lg transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add To Cart</span>
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-light text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all"
              >
                <Zap className="w-4 h-4 text-gold" />
                <span>Buy Now (Instant Checkout)</span>
              </button>
            </div>
          </div>

          {/* Direct Trust Badges */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Award className="w-5 h-5 text-orange mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Sivakasi Direct</div>
              <div className="text-[10px] text-slate-400">100% Genuine</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Truck className="w-5 h-5 text-purple mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Safe Transit</div>
              <div className="text-[10px] text-slate-400">5-Ply Corrugated</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Green Pyros</div>
              <div className="text-[10px] text-slate-400">Low Smoke</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Description, Box Contents, Safety Instructions, Reviews */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
          {[
            { id: 'overview', label: 'Product Overview' },
            { id: 'items', label: 'What’s In The Box' },
            { id: 'safety', label: 'Safety Guidelines' },
            { id: 'reviews', label: `Customer Reviews (${product.reviewCount || 120})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-orange text-orange bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
              <h3 className="text-base font-bold text-navy">About {product.name}</h3>
              <p>{product.description}</p>
              <p>
                Manufactured using high-grade chemical compositions with lower sulfur content, resulting in vibrant colors, longer burning duration, and reduced smoke emissions. Suitable for all celebratory events, weddings, Diwali, New Year, and festivals.
              </p>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-base font-bold text-navy">Assorted Fireworks Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {boxContents.map((c, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-orange" />
                      <span>{c.name}</span>
                    </span>
                    <span className="text-slate-500 font-normal">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Important Fireworks Safety Instructions</span>
                </div>
                <p>{product.safetyInformation || 'Always light in open outdoors with minimum 5m clearance. Light from arms length using agarbathi.'}</p>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6 max-w-3xl">
              <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border">
                <div className="text-3xl font-black text-navy">{product.rating ? product.rating.toFixed(1) : '0.0'}</div>
                <div>
                  <RatingStars rating={product.rating || 0} />
                  <div className="text-xs text-slate-500 mt-1">
                    {product.reviewCount ? `Based on ${product.reviewCount} customer reviews` : 'No customer reviews yet'}
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                {product.reviewCount ? 'Customer reviews are verified upon delivery.' : 'There are no reviews for this product yet. Purchase and review to share your feedback!'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-navy">You May Also Like</h2>
            <button
              onClick={() => onNavigate('shop')}
              className="text-xs font-bold text-purple hover:underline"
            >
              View Full Catalog →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
