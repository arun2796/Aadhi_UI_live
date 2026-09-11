import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShoppingBag,
  Zap,
  Truck,
  ShieldCheck,
  BadgeCheck,
  Package,
  Minus,
  Plus,
  Star,
  AlertTriangle,
  Gift,
  Plus as PlusIcon
} from 'lucide-react';
import { Product } from '../../types';
import { api } from '../../services/api';
import { RatingStars } from '../../components/common/CommonComponents';
import { ProductCard } from '../../components/customer/ProductCard';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import productPlaceholder from '../../assets/product-placeholder.svg';

interface ProductDetailPageProps {
  slug: string;
  onNavigate: (page: string, params?: any) => void;
}

const SAFETY_POINTS = [
  'Always light fireworks in an open outdoor area with a minimum 5-metre clearance.',
  'Light from arm’s length using an agarbathi (incense stick) — never bend over the product.',
  'Keep a bucket of water or sand nearby at all times during use.',
  'Never attempt to re-ignite a firework that failed to go off on the first attempt.',
  'Store in a cool, dry place away from heat sources and out of reach of children.',
  'Wear cotton clothing and avoid loose synthetic garments while bursting crackers.'
];

type TabId = 'description' | 'specifications' | 'reviews' | 'safety';

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ slug, onNavigate }) => {
  const { addToCart, setIsCartDrawerOpen } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<TabId>('description');

  useEffect(() => {
    api.getProductBySlug(slug).then((prod) => {
      if (prod) {
        setProduct(prod);
        setSelectedImage(prod.primaryImageUrl || '');
        setQuantity(1);
        setActiveTab('description');

        // Other products from the same category (Frequently Bought Together + related).
        // Combos and gift boxes never appear here — each has its own section.
        api
          .getProducts({ category: prod.categoryName, excludeCombos: true, excludeGiftBoxes: true })
          .then((list) => {
            setRelatedProducts(list.filter(p => p.id !== prod.id).slice(0, 7));
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
  const isOutOfStock = product.isActive === false;
  const youSave = product.compareAtPrice ? product.compareAtPrice - product.price : 0;
  const discountPct =
    product.discountPercentage && product.discountPercentage > 0
      ? Math.round(product.discountPercentage)
      : product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  // A gift box is sold as ONE sealed SKU: it never lists what is inside, so the
  // combo contents block is suppressed for it even if the DTO carried items.
  const isGiftBox = product.isGiftBox === true;
  const comboItems = !isGiftBox && Array.isArray(product.comboItems) ? product.comboItems : [];
  const comboItemsTotal = isGiftBox ? 0 : product.comboItemsTotal ?? 0;

  // Real review data only — the rating line/summary is omitted when the DTO has none.
  const rating = (product.rating ?? 0) > 0 ? (product.rating as number) : 0;
  const reviewCount = (product.reviewCount ?? 0) > 0 ? (product.reviewCount as number) : 0;
  const hasRating = rating > 0 || reviewCount > 0;

  // Gallery: real product images only; a single neutral placeholder when there are none.
  const productImages = [
    ...(product.primaryImageUrl ? [product.primaryImageUrl] : []),
    ...(product.images || []).map(i => i.url)
  ].filter((url, i, arr) => url && arr.indexOf(url) === i);
  const galleryImages = productImages.length > 0 ? productImages.slice(0, 4) : [productPlaceholder];

  // Gold-bullet feature list derived from real description lines only (hidden when none)
  const derivedFeatures = (product.description || '')
    .split(/\r?\n|•/)
    .map(s => s.replace(/^[-*\s]+/, '').trim())
    .filter(s => s.length > 3 && s.length < 90);
  const features = derivedFeatures.length >= 2 ? derivedFeatures.slice(0, 5) : [];

  const fbtProducts = relatedProducts.slice(0, 3);
  const alsoLikeProducts = relatedProducts.slice(3, 7);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`Added ${quantity}x "${product.name}" to cart!`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    setIsCartDrawerOpen(false);
    onNavigate('checkout');
  };

  const handleWishlistLink = () => {
    toggleWishlist(product);
    showToast(inWish ? 'Removed from wishlist' : `Added "${product.name}" to wishlist!`, 'info');
  };

  const handleQuickAdd = (p: Product) => {
    addToCart(p, 1);
    showToast(`Added "${p.name}" to cart!`, 'success');
  };

  // A combo or gift box presents itself as such, never as the category it happens
  // to be filed under. Driven by the flags only — never by the category name.
  const isCombo = !isGiftBox && product.isCombo === true;
  const crumbLabel = isGiftBox ? 'Gift Boxes' : isCombo ? 'Combos' : product.categoryName;
  const goToCrumb = () =>
    isGiftBox
      ? onNavigate('shop', { view: 'giftboxes' })
      : isCombo
      ? onNavigate('shop', { view: 'combos' })
      : onNavigate('shop', { category: product.categoryName.toLowerCase().replace(/\s+/g, '-') });

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'description', label: 'Description' },
    { id: 'specifications', label: 'Specifications' },
    { id: 'reviews', label: `Reviews (${reviewCount})` },
    { id: 'safety', label: 'Safety Info' }
  ];

  const specifications: Array<{ label: string; value: string }> = [
    { label: 'SKU', value: product.sku },
    { label: 'Category', value: isGiftBox ? 'Gift Box' : isCombo ? 'Combo Pack' : product.categoryName },
    { label: 'Brand', value: product.brandName || 'Aadhi' },
    { label: 'Unit', value: product.unit },
    { label: 'GST', value: 'Inclusive' },
    { label: 'Net Weight', value: `${product.weightKg} kg` },
    { label: 'Stock', value: isOutOfStock ? 'Out of Stock' : 'In Stock' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Breadcrumb: Home › Category › Name — "Combos" / "Gift Boxes" in place of
          the stored category for a combo or a gift box */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button onClick={() => onNavigate('home')} className="hover:text-navy">Home</button>
        <span>›</span>
        <button onClick={goToCrumb} className="hover:text-navy">
          {crumbLabel}
        </button>
        <span>›</span>
        <span className="text-slate-800 font-semibold truncate">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="aspect-square w-full rounded-3xl bg-slate-50 border border-slate-200 overflow-hidden shadow-card relative">
            <img
              src={selectedImage || galleryImages[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {discountPct > 0 && (
              <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-xl shadow-md uppercase">
                {discountPct}% OFF
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="grid grid-cols-4 gap-3">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(img)}
                className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                  (selectedImage || galleryImages[0]) === img
                    ? 'border-purple shadow-md scale-105'
                    : 'border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Info & Actions */}
        <div className="lg:col-span-6 space-y-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-orange uppercase tracking-wider mb-1">
              <span>{product.brandName || 'AADHI CRACKERS'}</span>
              <span>•</span>
              <span>{isGiftBox ? 'GIFT BOX' : isCombo ? 'COMBO' : product.categoryName}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-navy leading-snug">
              {product.name}
            </h1>

            {/* Rating line — only when the DTO carries real review data */}
            {hasRating && (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-slate-600">
                <span className="flex items-center space-x-1 font-bold text-navy">
                  <Star className="w-4 h-4 text-gold fill-current" />
                  <span>{rating.toFixed(1)}</span>
                </span>
                <span className="font-medium">({reviewCount} Reviews)</span>
              </div>
            )}
          </div>

          {/* Price row */}
          <div className="p-5 rounded-2xl bg-orange/5 border border-orange/15 space-y-1.5">
            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <span className="text-3xl font-black text-navy">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{product.compareAtPrice.toLocaleString('en-IN')}
                </span>
              )}
              {discountPct > 0 && (
                <span className="text-xs font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {discountPct}% OFF
                </span>
              )}
            </div>
            {youSave > 0 && (
              <div className="text-[11px] text-emerald-700 font-semibold">
                You save ₹{youSave.toLocaleString('en-IN')} on this product
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              Inclusive of all GST taxes. Dispatched by lorry to your transport office in 1–2 weeks;
              freight paid to the transport company on collection.
            </div>
          </div>

          {/* What's inside this combo — the key selling point for gift boxes */}
          {comboItems.length > 0 && (
            <div className="rounded-2xl border border-purple/20 overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2 bg-purple-soft">
                <Gift className="w-4.5 h-4.5 text-purple shrink-0" />
                <h3 className="text-sm font-black text-navy">What's inside this combo</h3>
                <span className="ml-auto text-xs font-black text-purple shrink-0">
                  {comboItems.length} items
                </span>
              </div>

              <div className="divide-y divide-slate-100 bg-white">
                {comboItems.map((c, i) => (
                  <div
                    key={c.componentProductId || `${c.sku}-${i}`}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <img
                      src={c.imageUrl || productPlaceholder}
                      alt={c.productName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-100 bg-slate-50 shrink-0"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                        {c.productName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        × {c.quantity}
                      </div>
                    </div>
                    {c.unitPrice > 0 && (
                      <div className="text-xs font-black text-slate-600 shrink-0">
                        ₹{c.unitPrice.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {comboItemsTotal > 0 && (
                <div className="px-5 py-3 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Total value inside
                  </span>
                  <span className="text-sm font-black text-navy">
                    ₹{comboItemsTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Gold-bullet feature list (real description lines only) */}
          {features.length > 0 && (
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-start space-x-2 text-xs sm:text-sm font-semibold text-slate-700">
                  <Star className="w-4 h-4 text-gold fill-current shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Stock + Quantity stepper */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center space-x-2 text-xs font-bold">
              <span className={`w-2.5 h-2.5 rounded-full ${isOutOfStock ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {isOutOfStock ? (
                <span className="text-red-600">Out of Stock</span>
              ) : (
                <span className="text-emerald-600">In Stock</span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-xs font-bold text-slate-700">Quantity:</span>
              <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                  className="p-2 text-slate-500 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 font-bold text-sm text-navy">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(999, quantity + 1))}
                  aria-label="Increase quantity"
                  className="p-2 text-slate-500 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CTAs: orange Add to Cart + purple Buy Now */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-glow hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add To Cart</span>
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-glow-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4 text-gold" />
                <span>Buy Now</span>
              </button>
            </div>

            {/* Wishlist link */}
            <button
              onClick={handleWishlistLink}
              className={`flex items-center space-x-1.5 text-xs font-bold transition-colors ${
                inWish ? 'text-red-500' : 'text-slate-500 hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${inWish ? 'fill-current' : ''}`} />
              <span>{inWish ? 'Added to Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          {/* Trust icon row */}
          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-200 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-orange mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">100% Original</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Package className="w-5 h-5 text-purple mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Safe Packaging</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Truck className="w-5 h-5 text-gold-dark mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Transport Delivery</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <BadgeCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-slate-800">Factory Direct</div>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together */}
      {fbtProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-black text-navy">Frequently Bought Together</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {fbtProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center space-x-3.5 shadow-xs hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => onNavigate('product-detail', { slug: p.slug })}
                  className="w-16 h-16 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0"
                >
                  <img
                    src={p.primaryImageUrl || productPlaceholder}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onNavigate('product-detail', { slug: p.slug })}
                    className="font-bold text-xs text-slate-800 hover:text-purple line-clamp-2 text-left"
                  >
                    {p.name}
                  </button>
                  <div className="text-sm font-black text-navy mt-1">
                    ₹{p.price.toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => handleQuickAdd(p)}
                  disabled={p.availableQuantity <= 0}
                  className="px-3 py-2 rounded-xl bg-white text-purple border-[1.5px] border-purple hover:bg-purple hover:text-white text-xs font-bold flex items-center space-x-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs: Description | Specifications | Reviews (n) | Safety Info */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-purple text-purple bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'description' && (
            <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
              <h3 className="text-base font-bold text-navy">About {product.name}</h3>
              {product.description || product.shortDescription ? (
                <p>{product.description || product.shortDescription}</p>
              ) : (
                <p className="text-slate-400">No description available for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === 'specifications' && (
            <div className="max-w-2xl">
              <h3 className="text-base font-bold text-navy mb-4">Product Specifications</h3>
              <table className="w-full text-xs sm:text-sm">
                <tbody>
                  {specifications.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-4 py-3 font-bold text-slate-700 w-1/3 border border-slate-100">
                        {row.label}
                      </td>
                      <td className="px-4 py-3 text-slate-600 border border-slate-100">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6 max-w-3xl">
              {hasRating ? (
                <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-3xl font-black text-navy">{rating.toFixed(1)}</div>
                  <div>
                    <RatingStars rating={rating} />
                    <div className="text-xs text-slate-500 mt-1">
                      Based on {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'} from verified buyers
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-2">
                  <Star className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-navy">No reviews yet</div>
                  <p className="text-xs text-slate-500">
                    Reviews from verified buyers will appear here after delivery.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Important Fireworks Safety Instructions</span>
                </div>
                {product.safetyInformation && <p>{product.safetyInformation}</p>}
              </div>
              <ul className="space-y-2.5">
                {SAFETY_POINTS.map((point, i) => (
                  <li key={i} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange mt-1.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {alsoLikeProducts.length > 0 && (
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
            {alsoLikeProducts.map((p) => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
