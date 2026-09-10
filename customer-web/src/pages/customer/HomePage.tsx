import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  BadgeCheck,
  Truck,
  BadgePercent,
  CheckCircle2,
  HelpCircle,
  Percent
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { ProductCard } from '../../components/customer/ProductCard';
import { SafetySection } from '../../components/customer/CustomerSections';
import { Modal } from '../../components/common/CommonComponents';
import { useSettings } from '../../context/SettingsContext';
import productPlaceholder from '../../assets/product-placeholder.svg';

interface HomePageProps {
  onNavigate: (page: string, params?: any) => void;
}

interface HeroSlide {
  badge: string;
  image: string;
  imageAlt: string;
}

/** Shown until (or unless) admin-managed banners arrive from GET /banners. */
const LOGO_HERO_SLIDE: HeroSlide = {
  badge: '',
  // Brand logo (public/logo.png) — the only static hero asset.
  image: '/logo.png',
  imageAlt: 'Aadhi Crackers'
};

const TRUST_TILES = [
  { icon: ShieldCheck, title: '100% Original', subtitle: 'Trusted Brands', color: 'text-orange bg-orange/10 border-orange/20' },
  { icon: BadgeCheck, title: 'Safe & Secure', subtitle: 'Quality Assured', color: 'text-purple bg-purple/10 border-purple/20' },
  { icon: Truck, title: 'Transport Delivery', subtitle: 'Arrives in 1–2 weeks', color: 'text-gold-dark bg-gold/10 border-gold/20' },
  { icon: BadgePercent, title: 'Best Prices', subtitle: 'Lowest Guaranteed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { headerPromoText, storePhone } = useSettings();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Product[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([LOGO_HERO_SLIDE]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    api.getCategories().then(setCategories);
    api.getProducts({ excludeCombos: true }).then(setProducts);
    api.getBestSellers().then((list) => {
      if (list.length > 0) {
        setBestSellers(list);
      } else {
        api.getFeaturedProducts().then(setBestSellers);
      }
    });
    // Real combos only — the section renders nothing at all when this is empty.
    api.getCombos().then(setCombos);

    // Hero slides come from admin-managed banners; single logo slide when none exist.
    api.getBanners('Home').then((banners) => {
      const slides = banners
        .filter((b) => b.imageUrl || b.title || b.subtitle)
        .map((b) => ({
          badge: b.subtitle || b.title || '',
          image: b.imageUrl || '/logo.png',
          imageAlt: b.title || 'Banner'
        }));
      if (slides.length > 0) {
        setHeroSlides(slides);
        setHeroIndex(0);
      }
    });
  }, []);

  const giftBoxes = products.filter(p => p.categoryName?.toLowerCase().includes('gift')).slice(0, 4);
  const localBestSellers = products.filter(p => p.isBestSeller);
  const bestSelling = (
    bestSellers.length > 0 ? bestSellers : localBestSellers.length > 0 ? localBestSellers : products
  ).slice(0, 8);

  const slide = heroSlides[Math.min(heroIndex, heroSlides.length - 1)];
  const prevSlide = () => setHeroIndex((heroIndex - 1 + heroSlides.length) % heroSlides.length);
  const nextSlide = () => setHeroIndex((heroIndex + 1) % heroSlides.length);

  const faqs = [
    {
      q: 'How do you ensure safe shipment of fireworks?',
      a: 'We ship all fireworks in heavy-gauge corrugated safety boxes with internal cushioning, through transport partners who follow PESO safety protocols for dangerous goods.'
    },
    {
      q: 'Are your fireworks 100% genuine?',
      a: 'Yes, all products are quality-checked and adhere to Indian Fireworks Standards.'
    },
    {
      q: 'How long does delivery take and what does it cost?',
      a: 'Your order is dispatched by lorry and typically arrives at the destination transport office in 1–2 weeks. We do not charge anything for delivery — the freight is paid directly to the transport company when you collect the parcel.'
    },
    {
      q: 'Do you offer bulk wholesale pricing for distributors and apartments?',
      a: `Yes! For bulk bookings, please reach out to our wholesale support team${storePhone ? ` on ${storePhone}` : ''} or via the Contact Us page for customized volume discounts.`
    }
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero navy card with carousel arrows */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#111238] via-[#1a1c54] to-[#111238] text-white shadow-2xl">
          {/* Ambient decorative glowing particles */}
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange/20 rounded-full blur-3xl pointer-events-none" />

          {/* Carousel arrows (only when there is more than one banner) */}
          {heroSlides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={nextSlide}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 backdrop-blur-md flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10 px-10 sm:px-16 py-10 sm:py-14">
            <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
              {slide.badge && (
                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-gold text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-orange" />
                  <span>{slide.badge}</span>
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Celebrate Every Moment with{' '}
                <span className="text-gold">AADHI CRACKERS</span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Quality You Trust, Celebrations You Love!
              </p>

              {/* ✓ bullet trio */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
                {['100% Original', 'Safe & Secure', 'Transport Delivery'].map((b) => (
                  <span key={b} className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-gold" />
                    <span>{b}</span>
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-8 py-4 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-sm uppercase tracking-wider flex items-center space-x-2 shadow-glow hover:shadow-xl hover:scale-105 transition-all"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slide image */}
            <div className="lg:col-span-5 hidden lg:flex justify-center">
              <div className="relative w-full max-w-md rounded-3xl p-1 bg-gradient-to-b from-gold/50 via-purple/40 to-transparent">
                <div className="rounded-[22px] overflow-hidden border border-white/10 aspect-4/3 bg-navy-dark">
                  <img
                    src={slide.image}
                    alt={slide.imageAlt}
                    onError={(e) => {
                      // Broken banner image → brand logo; broken logo → hide.
                      const img = e.currentTarget;
                      if (!img.src.endsWith('/logo.png')) img.src = '/logo.png';
                      else img.style.display = 'none';
                    }}
                    className={slide.image === '/logo.png' ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Carousel dots (only when there is more than one banner) */}
          {heroSlides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === heroIndex ? 'w-6 bg-gold' : 'w-2 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. Four Trust Tiles */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.title}
                className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-4"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${tile.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{tile.title}</h4>
                  <p className="text-xs text-slate-500">{tile.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Shop by Category */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-navy">Shop by Category</h2>
            <p className="text-xs text-slate-500">Explore Sivakasi’s widest fireworks collection</p>
          </div>
          <button
            onClick={() => onNavigate('shop')}
            className="text-xs font-bold text-purple hover:text-purple-dark flex items-center space-x-1"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-scrolling marquee (left → right); pauses on hover. */}
        <div className="overflow-hidden">
          <div className="flex w-max animate-marquee-ltr">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-4 pr-4" aria-hidden={dup === 1}>
                {categories.map((c) => (
                  <div
                    key={`${dup}-${c.id}`}
                    onClick={() => onNavigate('shop', { category: c.slug })}
                    className="group flex flex-col items-center text-center cursor-pointer p-3 w-32 flex-shrink-0 rounded-2xl bg-white border border-slate-100 hover:border-orange/30 shadow-xs hover:shadow-md transition-all transform hover:-translate-y-1"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2.5 p-1 border-2 border-orange/20 group-hover:border-orange transition-colors">
                      <img
                        src={c.imageUrl || productPlaceholder}
                        alt={c.name}
                        className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 group-hover:text-orange transition-colors">
                      {c.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">{c.productCount} Items</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Best Selling Products */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-navy">Best Selling Products</h2>
            <p className="text-xs text-slate-500">Handpicked top performers for vibrant night displays</p>
          </div>
          <button
            onClick={() => onNavigate('shop', { sortBy: 'popular' })}
            className="text-xs font-bold text-purple hover:text-purple-dark flex items-center space-x-1"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {bestSelling.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={onNavigate}
              onQuickView={setQuickViewProduct}
            />
          ))}
        </div>
      </section>

      {/* 4b. Combo Packs & Gift Boxes — real combos only; hidden entirely when empty */}
      {combos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-navy">Combo Packs &amp; Gift Boxes</h2>
              <p className="text-xs text-slate-500">Everything you need in one bundle — at one price.</p>
            </div>
            <button
              onClick={() => onNavigate('shop', { view: 'combos' })}
              className="text-xs font-bold text-purple hover:text-purple-dark flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {combos.slice(0, 8).map((combo) => (
              <ProductCard
                key={combo.id}
                product={combo}
                onNavigate={onNavigate}
                onQuickView={setQuickViewProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. Special Festival Offers Banner — storefront-controlled (Website.HeaderPromoText) */}
      {headerPromoText && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-r from-[#111238] via-[#2d1b7a] to-[#111238] text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-purple/30">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none bg-[radial-gradient(#FF7A00_1px,transparent_1px)] [background-size:16px_16px]" />

            <div className="relative z-10 max-w-xl space-y-4">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange text-white text-xs font-black uppercase tracking-wider">
                <Percent className="w-3.5 h-3.5" />
                <span>Special Offer</span>
              </span>

              <h2 className="text-3xl sm:text-4xl font-black">
                Make Every Celebration Brighter!
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {headerPromoText}
              </p>

              <div className="pt-2 flex items-center space-x-4">
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all"
                >
                  Claim Offer Now
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. Gift Boxes Showcase */}
      {giftBoxes.length > 0 && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs font-bold text-orange uppercase tracking-wider">Family Celebrations</div>
              <h2 className="text-2xl font-black text-navy">Exclusive Gift Boxes</h2>
            </div>
            <button
              onClick={() => onNavigate('shop', { view: 'combos' })}
              className="text-xs font-bold text-purple hover:text-purple-dark flex items-center space-x-1"
            >
              <span>View All Boxes</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {giftBoxes.map((box) => (
              <ProductCard
                key={box.id}
                product={box}
                onNavigate={onNavigate}
                onQuickView={setQuickViewProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. Safety Precautions Section */}
      <section className="max-w-7xl mx-auto px-4">
        <SafetySection />
      </section>

      {/* 8. FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-1 text-xs font-bold text-orange uppercase tracking-wider mb-1">
            <HelpCircle className="w-4 h-4" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-2xl font-black text-navy">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-bold text-xs sm:text-sm text-navy flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180 text-orange' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Quick View Modal */}
      <Modal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        title={quickViewProduct?.name || 'Product Details'}
        maxWidth="max-w-2xl"
      >
        {quickViewProduct && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square rounded-xl overflow-hidden bg-slate-100">
              <img
                src={quickViewProduct.primaryImageUrl || productPlaceholder}
                alt={quickViewProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs text-slate-400 font-semibold">{quickViewProduct.categoryName}</div>
                <h3 className="text-lg font-black text-navy mt-0.5">{quickViewProduct.name}</h3>
                <div className="text-xs text-slate-500 font-medium mb-2">SKU: {quickViewProduct.sku}</div>
                <div className="flex items-baseline space-x-2 mb-3">
                  <span className="text-2xl font-black text-navy">₹{quickViewProduct.price.toLocaleString('en-IN')}</span>
                  {quickViewProduct.compareAtPrice && (
                    <span className="text-sm text-slate-400 line-through">₹{quickViewProduct.compareAtPrice.toLocaleString('en-IN')}</span>
                  )}
                  {quickViewProduct.discountPercentage && (
                    <span className="text-xs font-bold text-orange">
                      {quickViewProduct.discountPercentage}% OFF
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {quickViewProduct.description || quickViewProduct.shortDescription}
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    const slug = quickViewProduct.slug;
                    setQuickViewProduct(null);
                    onNavigate('product-detail', { slug });
                  }}
                  className="w-full py-3 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  View Full Product Page
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
