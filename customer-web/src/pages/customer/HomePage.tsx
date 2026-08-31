import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  Flame,
  Star,
  ChevronRight,
  Gift,
  ShieldCheck,
  Zap,
  Percent,
  CheckCircle2,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { ProductCard } from '../../components/customer/ProductCard';
import { TrustIndicators, SafetySection } from '../../components/customer/CustomerSections';
import { Modal } from '../../components/common/CommonComponents';

interface HomePageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    api.getCategories().then(setCategories);
    api.getProducts().then(setProducts);
  }, []);

  const giftBoxes = products.filter(p => p.categoryName === 'Gift Boxes');
  const bestSellers = products.filter(p => p.isBestSeller);
  const filteredProducts = activeTab === 'all'
    ? products.slice(0, 8)
    : products.filter(p => p.categoryName.toLowerCase() === activeTab.toLowerCase());

  const faqs = [
    {
      q: 'How does AADHI CRACKERS ensure safe shipment of fireworks?',
      a: 'We ship all fireworks in heavy-gauge 5-ply corrugated safety boxes with internal bubble cushioning. Our transport partners are licensed dangerous-goods carriers adhering to PESO safety protocols.'
    },
    {
      q: 'Are your fireworks 100% genuine and manufactured in Sivakasi?',
      a: 'Yes, all products are manufactured and quality-checked at our certified facility in Thiruthangal, Sivakasi, Tamil Nadu, adhering strictly to Indian Fireworks Standards.'
    },
    {
      q: 'What is the minimum order amount for free delivery?',
      a: 'Orders above ₹3,000 qualify for free express delivery across all serviceable PIN codes.'
    },
    {
      q: 'Do you offer bulk wholesale pricing for distributors and apartments?',
      a: 'Yes! For bulk bookings above ₹25,000, please reach out to our wholesale support team on +91 98765 43210 or via the Contact Us page for customized volume discounts.'
    }
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Festive Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#111238] via-[#1a1c54] to-[#111238] text-white pt-10 pb-16 px-4">
        {/* Ambient decorative glowing particles */}
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-purple/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-orange/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-gold text-xs font-bold uppercase tracking-wider animate-pulse-subtle">
              <Sparkles className="w-4 h-4 text-orange" />
              <span>Sivakasi’s Most Trusted Fireworks Direct Factory Portal</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Light Up Your Celebrations with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange via-gold to-yellow-300">
                AADHI CRACKERS
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Premium Sivakasi Green Fireworks, Sky Symphony Aerials, and Curated Family Gift Boxes with up to <strong className="text-gold font-bold">70% Direct Wholesale Savings</strong>!
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => onNavigate('shop')}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-orange to-orange-hover text-white font-bold text-sm uppercase tracking-wider flex items-center space-x-2 shadow-glow hover:shadow-xl hover:scale-105 transition-all"
              >
                <span>Shop Fireworks Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('shop', { category: 'gift-boxes' })}
                className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-md transition-all flex items-center space-x-2"
              >
                <Gift className="w-4 h-4 text-gold" />
                <span>Explore Gift Boxes</span>
              </button>
            </div>

            {/* Micro trust stats */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/10 max-w-md mx-auto lg:mx-0">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">25+</div>
                <div className="text-[11px] text-slate-400">Years Heritage</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-gold">100%</div>
                <div className="text-[11px] text-slate-400">Tested & Safe</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-orange">50,000+</div>
                <div className="text-[11px] text-slate-400">Happy Families</div>
              </div>
            </div>
          </div>

          {/* Hero Featured Box Spotlight */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md rounded-3xl p-1 bg-gradient-to-b from-gold/50 via-purple/40 to-transparent shadow-2xl">
              <div className="rounded-[22px] bg-navy-card p-6 border border-white/10 space-y-4 text-white">
                <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-navy-dark">
                  <img
                    src="https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop&q=80"
                    alt="Mega Celebration Box"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-lg shadow-md uppercase">
                    25% OFF
                  </div>
                  <div className="absolute bottom-3 right-3 bg-navy/90 text-gold text-xs font-bold px-3 py-1 rounded-lg backdrop-blur-md">
                    62 Premium Items
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gold font-semibold uppercase tracking-wider">Festival Master Box</div>
                  <h3 className="text-xl font-bold text-white mt-0.5">Mega Celebration Box</h3>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    Deluxe flower pots, high speed chakkars, 12-shot sky repeaters, and multi-color sparklers.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div>
                    <span className="text-2xl font-black text-gold">₹4,499</span>
                    <span className="text-xs text-slate-400 line-through ml-2">₹5,999</span>
                  </div>
                  <button
                    onClick={() => onNavigate('product-detail', { slug: 'mega-celebration-box' })}
                    className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Five Trust Indicators */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-20">
        <TrustIndicators />
      </div>

      {/* 3. Shop by Category (Circular Layout matching screenshot) */}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => onNavigate('shop', { category: c.slug })}
              className="group flex flex-col items-center text-center cursor-pointer p-3 rounded-2xl bg-white border border-slate-100 hover:border-orange/30 shadow-xs hover:shadow-md transition-all transform hover:-translate-y-1"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2.5 p-1 border-2 border-orange/20 group-hover:border-orange transition-colors">
                <img
                  src={c.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
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
      </section>

      {/* 4. Featured Products Grid */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-navy">Featured Fireworks</h2>
            <p className="text-xs text-slate-500">Handpicked top performers for vibrant night displays</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {['all', 'Gift Boxes', 'Sparklers', 'Ground Chakkar', 'Flower Pots', 'Aerial Shots'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Products' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={onNavigate}
              onQuickView={setQuickViewProduct}
            />
          ))}
        </div>
      </section>

      {/* 5. Special Festival Offers Banner */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-r from-[#111238] via-[#2d1b7a] to-[#111238] text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-purple/30">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none bg-[radial-gradient(#FF7A00_1px,transparent_1px)] [background-size:16px_16px]" />

          <div className="relative z-10 max-w-xl space-y-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange text-white text-xs font-black uppercase tracking-wider">
              <Percent className="w-3.5 h-3.5" />
              <span>Mega Festival Discount</span>
            </span>

            <h2 className="text-3xl sm:text-4xl font-black">
              Make Every Celebration Brighter!
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Order now and get an extra <strong>15% OFF</strong> on all family gift boxes with coupon code <strong className="text-gold">DIWALI2026</strong>. Free doorstep delivery on orders above ₹3,000.
            </p>

            <div className="pt-2 flex items-center space-x-4">
              <button
                onClick={() => onNavigate('shop', { category: 'gift-boxes' })}
                className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all"
              >
                Claim Offer Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Gift Boxes Showcase (Matching user screenshot) */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs font-bold text-orange uppercase tracking-wider">Family Celebrations</div>
            <h2 className="text-2xl font-black text-navy">Exclusive Gift Boxes</h2>
          </div>
          <button
            onClick={() => onNavigate('shop', { category: 'gift-boxes' })}
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
                src={quickViewProduct.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
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
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
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
