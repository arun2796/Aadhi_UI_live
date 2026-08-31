import React, { useState, useEffect } from 'react';
import {
  Search,
  Award,
  ShieldCheck,
  Truck,
  RotateCcw
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';

interface Screen1HomeProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenSearch: () => void;
}

export const Screen1Home: React.FC<Screen1HomeProps> = ({ onNavigate, onOpenSearch }) => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  return (
    <div className="space-y-4 pb-4 font-sans bg-[#fbfbfb]">
      {/* 1. Search Bar */}
      <div className="px-4 pt-3">
        <div
          onClick={onOpenSearch}
          className="w-full bg-slate-100/90 rounded-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 cursor-pointer shadow-inner border border-slate-200/50"
        >
          <span>Search for crackers, gift boxes...</span>
          <Search className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* 2. Hero Festive Card matching Screen 1 */}
      <div className="px-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#111238] via-[#1f1b54] to-[#111238] text-white p-5 relative overflow-hidden shadow-xl border border-purple/30">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 pointer-events-none bg-[radial-gradient(#FF7A00_1px,transparent_1px)] [background-size:12px_12px]" />

          <div className="relative z-10 space-y-2 max-w-[210px]">
            <div className="text-[10px] text-gold font-bold uppercase tracking-wider">
              Celebrate Every Moment with
            </div>
            <h2 className="text-xl font-black tracking-tight leading-tight">
              AADHI <br />
              <span className="text-orange">CRACKERS</span>
            </h2>
            <p className="text-[10px] text-slate-300 leading-snug">
              Quality You Trust, <br />
              Celebrations You Love!
            </p>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('shop')}
                className="px-4 py-1.5 rounded-full bg-orange hover:bg-orange-hover text-white text-[11px] font-black uppercase tracking-wider shadow-glow active:scale-95 transition-all"
              >
                SHOP NOW
              </button>
            </div>
          </div>

          {/* Right Hero graphic */}
          <div className="absolute right-2 bottom-2 w-32 h-32 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80"
              alt="Fireworks"
              className="w-full h-full object-contain filter drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* 3. Four Trust Badges */}
      <div className="px-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col items-center">
            <Award className="w-4 h-4 text-orange mb-1" />
            <span className="text-[9px] font-bold text-slate-800 leading-tight">100% Original</span>
            <span className="text-[7px] text-slate-400">Trusted Brands</span>
          </div>

          <div className="p-2 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col items-center">
            <ShieldCheck className="w-4 h-4 text-purple mb-1" />
            <span className="text-[9px] font-bold text-slate-800 leading-tight">Safe & Secure</span>
            <span className="text-[7px] text-slate-400">Quality Assured</span>
          </div>

          <div className="p-2 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col items-center">
            <Truck className="w-4 h-4 text-gold mb-1" />
            <span className="text-[9px] font-bold text-slate-800 leading-tight">Fast Delivery</span>
            <span className="text-[7px] text-slate-400">On Time</span>
          </div>

          <div className="p-2 rounded-2xl bg-white border border-slate-100 shadow-xs flex flex-col items-center">
            <RotateCcw className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-[9px] font-bold text-slate-800 leading-tight">Best Prices</span>
            <span className="text-[7px] text-slate-400">Lowest Guaranteed</span>
          </div>
        </div>
      </div>

      {/* 4. Shop by Category (Dynamic Live Categories) */}
      <div className="px-4 space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-navy">Shop by Category</h3>
          <button
            onClick={() => onNavigate('category-menu')}
            className="text-[11px] font-bold text-purple hover:underline"
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {categories.map((c) => (
            <div
              key={c.id || c.slug}
              onClick={() => onNavigate('category', { category: c.slug })}
              className="flex flex-col items-center text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full bg-[#111238] border-2 border-orange/40 flex items-center justify-center text-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden relative">
                <img
                  src={c.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=300&auto=format&fit=crop&q=80'}
                  alt={c.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <span className="text-[10px] font-bold text-slate-800 mt-1 group-hover:text-orange transition-colors line-clamp-1">
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface Screen2CategoryProps {
  categorySlug?: string;
  onNavigate: (page: string, params?: any) => void;
  onOpenFilter: () => void;
  onOpenSort: () => void;
}

export const Screen2Category: React.FC<Screen2CategoryProps> = ({
  categorySlug = 'gift-boxes',
  onNavigate,
  onOpenFilter,
  onOpenSort
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState<string>('Gift Boxes');

  useEffect(() => {
    api.getCategories().then(cats => {
      const found = cats.find(c => c.slug === categorySlug || c.id === categorySlug);
      if (found) setCategoryName(found.name);
    });

    api.getProducts().then(all => {
      const slug = categorySlug.toLowerCase().replace(/\s+/g, '-');
      const filtered = all.filter(p =>
        p.categoryName?.toLowerCase().replace(/\s+/g, '-') === slug ||
        p.categoryId === categorySlug
      );
      setProducts(filtered.length > 0 ? filtered : all.slice(0, 6));
    });
  }, [categorySlug]);

  return (
    <div className="space-y-3 pb-4 font-sans bg-[#fbfbfb]">
      {/* Title & Breadcrumb */}
      <div className="px-4 pt-3">
        <h2 className="text-base font-black text-navy">{categoryName}</h2>
        <div className="text-[10px] text-slate-400 font-medium">
          Home &gt; <span className="text-slate-600 font-semibold">{categoryName}</span>
        </div>
      </div>

      {/* Filter and Sort bar */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <button
          onClick={onOpenFilter}
          className="py-2 px-4 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center space-x-2 shadow-xs active:bg-slate-50"
        >
          <span className="text-slate-500">⚙️</span>
          <span>Filter</span>
        </button>

        <button
          onClick={onOpenSort}
          className="py-2 px-4 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center space-x-2 shadow-xs active:bg-slate-50"
        >
          <span className="text-slate-500">⇅</span>
          <span>Sort</span>
        </button>
      </div>

      {/* 2-Column Product Grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => onNavigate('product-detail', { slug: p.slug })}
            className="bg-white rounded-2xl border border-slate-100 shadow-card p-2.5 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div>
              {/* Product Image + Badges */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2">
                <img
                  src={p.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
                {p.isBestSeller && (
                  <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs uppercase">
                    BEST SELLER
                  </div>
                )}
              </div>

              {/* Title */}
              <h4 className="font-bold text-xs text-slate-800 line-clamp-1 mb-1">
                {p.name}
              </h4>

              {/* Price Row */}
              <div className="flex items-baseline space-x-1.5">
                <span className="font-black text-xs text-navy">₹{p.price.toLocaleString('en-IN')}</span>
                {p.compareAtPrice && p.compareAtPrice > p.price && (
                  <span className="text-[10px] text-red-600 font-bold">
                    {p.discountPercentage || Math.round((1 - p.price / p.compareAtPrice) * 100)}% OFF
                  </span>
                )}
              </div>
            </div>

            {/* Stock status */}
            <div className="flex items-center space-x-1 mt-2 text-[10px] text-emerald-600 font-bold">
              <span>● In Stock ({p.availableQuantity} units)</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-2 text-[11px] text-slate-400 font-medium flex items-center justify-center space-x-2">
        <span>Showing {products.length} products in {categoryName}</span>
      </div>
    </div>
  );
};
