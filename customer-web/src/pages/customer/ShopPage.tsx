import React, { useState, useEffect, useMemo } from 'react';
import { Filter, X, Sparkles, Star, Gift } from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { ProductCard } from '../../components/customer/ProductCard';

interface ShopPageProps {
  onNavigate: (page: string, params?: any) => void;
  /** `view: 'combos'` switches the whole listing over to api.getCombos(). */
  initialView?: string;
  initialCategory?: string;
  initialSearch?: string;
  initialSortBy?: string;
}

/** Legacy category slugs the old (dead) nav links used. They are not real
 *  categories, so they route to the combos view instead of an empty page. */
const COMBO_VIEW_SLUGS = new Set(['combos', 'combo-offers', 'gift-boxes']);

const wantsCombosView = (view?: string, category?: string): boolean =>
  view === 'combos' || COMBO_VIEW_SLUGS.has((category || '').trim().toLowerCase());

const COMBOS_TITLE = 'Combo Packs & Gift Boxes';
const COMBOS_SUBTITLE = 'Everything you need in one bundle — at one price.';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' }
];

const RATING_STEPS = [4.5, 4, 3.5, 3];

const PRICE_MAX = 5000;

export const ShopPage: React.FC<ShopPageProps> = ({
  onNavigate,
  initialView,
  initialCategory,
  initialSearch,
  initialSortBy = 'popular'
}) => {
  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Combos view: the listing is fed by api.getCombos() instead of the category query.
  const [combosView, setCombosView] = useState<boolean>(() => wantsCombosView(initialView, initialCategory));
  const [combos, setCombos] = useState<Product[]>([]);
  const [combosLoaded, setCombosLoaded] = useState<boolean>(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>(
    wantsCombosView(initialView, initialCategory) ? 'all' : initialCategory || 'all'
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(PRICE_MAX);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>(
    SORT_OPTIONS.some(o => o.value === initialSortBy) ? initialSortBy : 'popular'
  );
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch || '');

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    const wantCombos = wantsCombosView(initialView, initialCategory);
    setCombosView(wantCombos);
    if (wantCombos) setSelectedCategory('all');
    else if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialView, initialCategory]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearchQuery(initialSearch);
  }, [initialSearch]);

  // Combos come straight from the (filtered) combo endpoint — never from the
  // category query, which has no combos/gift-boxes category to point at.
  useEffect(() => {
    if (!combosView) return;
    let live = true;
    setCombosLoaded(false);
    api.getCombos().then((list) => {
      if (!live) return;
      setCombos(list);
      setCombosLoaded(true);
    });
    return () => { live = false; };
  }, [combosView]);

  // Fetch products for the current category / search scope.
  // Price, brand, rating and stock filters are applied client-side so
  // sidebar counts stay live.
  useEffect(() => {
    if (combosView) return;
    const params: Record<string, any> = { pageSize: 100 };
    if (selectedCategory && selectedCategory !== 'all') {
      params.categorySlug = selectedCategory.toLowerCase().replace(/\s+/g, '-');
    }
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    api.getProducts(params).then(setBaseProducts);
  }, [combosView, selectedCategory, searchQuery]);

  const brandKeyOf = (p: Product) => p.brandName?.trim() || 'Others';

  // The listing source: combos endpoint in combos view, category query otherwise.
  const sourceProducts = combosView ? combos : baseProducts;

  // Everything except the brand filter — used for live brand counts.
  const preBrandFiltered = useMemo(() => {
    const term = combosView ? searchQuery.trim().toLowerCase() : '';
    return sourceProducts.filter(p => {
      if (maxPrice < PRICE_MAX && p.price > maxPrice) return false;
      if (minRating !== null && (p.rating ?? 0) < minRating) return false;
      if (inStockOnly && p.availableQuantity <= 0) return false;
      // The combos endpoint takes no search term, so match it client-side.
      if (term && !`${p.name} ${p.sku}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [sourceProducts, combosView, searchQuery, maxPrice, minRating, inStockOnly]);

  // Brand list with live counts, derived from products.
  const brandOptions = useMemo(() => {
    const counts = new Map<string, number>();
    preBrandFiltered.forEach(p => {
      const key = brandKeyOf(p);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === 'Others') return 1;
        if (b.name === 'Others') return -1;
        return b.count - a.count;
      });
    return entries;
  }, [preBrandFiltered]);

  const products = useMemo(() => {
    let list = preBrandFiltered;
    if (selectedBrands.length > 0) {
      list = list.filter(p => selectedBrands.includes(brandKeyOf(p)));
    }
    const sorted = [...list];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => b.price - a.price);
    } else {
      // Popularity: best sellers first, then featured, then rating
      sorted.sort((a, b) => {
        const score = (p: Product) =>
          (p.isBestSeller ? 4 : 0) + (p.isFeatured ? 2 : 0) + (p.rating || 0) / 5;
        return score(b) - score(a);
      });
    }
    return sorted;
  }, [preBrandFiltered, selectedBrands, sortBy]);

  const toggleBrand = (name: string) => {
    setSelectedBrands(prev =>
      prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name]
    );
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrands([]);
    setMaxPrice(PRICE_MAX);
    setMinRating(null);
    setInStockOnly(false);
    setSearchQuery('');
    setSortBy('popular');
  };

  /** Picking a category leaves the combos view and goes back to the normal query. */
  const selectCategory = (slug: string) => {
    setCombosView(false);
    setSelectedCategory(slug);
  };

  const activeCategory = categories.find(
    c => c.slug === selectedCategory || c.id === selectedCategory ||
      (c.slug || c.name.toLowerCase().replace(/\s+/g, '-')) === selectedCategory
  );
  const pageTitle = combosView
    ? COMBOS_TITLE
    : selectedCategory === 'all'
    ? 'All Products'
    : activeCategory?.name || selectedCategory.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-4">
        <button onClick={() => onNavigate('home')} className="hover:text-navy">Home</button>
        <span>›</span>
        <span className={selectedCategory === 'all' && !combosView ? 'text-slate-700 font-semibold' : ''}>Shop</span>
        {(combosView || selectedCategory !== 'all') && (
          <>
            <span>›</span>
            <span className="text-slate-700 font-semibold capitalize">{pageTitle}</span>
          </>
        )}
      </div>

      {/* Main Grid: Filters Sidebar + Products */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Filter Sidebar */}
        <aside className="hidden md:block bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs sticky top-28">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-navy flex items-center space-x-2">
              <Filter className="w-4 h-4 text-purple" />
              <span>Filters</span>
            </h3>
            <button
              onClick={resetFilters}
              className="text-xs text-purple hover:underline font-semibold"
            >
              Reset All
            </button>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">Categories</h4>
            <div className="space-y-1.5">
              <button
                onClick={() => selectCategory('all')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  selectedCategory === 'all' && !combosView ? 'bg-purple text-white font-bold' : 'text-slate-600 hover:bg-purple-soft hover:text-purple'
                }`}
              >
                <span>All Categories</span>
              </button>
              <button
                onClick={() => { setCombosView(true); setSelectedCategory('all'); }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  combosView ? 'bg-purple text-white font-bold' : 'text-slate-600 hover:bg-purple-soft hover:text-purple'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Combos &amp; Gift Boxes</span>
                </span>
              </button>
              {categories.map((c) => {
                const slug = c.slug || c.name.toLowerCase().replace(/\s+/g, '-');
                const isSelected = !combosView && (selectedCategory === slug || selectedCategory === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCategory(slug)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-purple text-white font-bold' : 'text-slate-600 hover:bg-purple-soft hover:text-purple'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                      {c.productCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Price Range</h4>
              <span className="text-xs font-black text-navy">
                ₹0 — ₹{maxPrice.toLocaleString('en-IN')}{maxPrice >= PRICE_MAX ? '+' : ''}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={PRICE_MAX}
              step="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-purple cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>₹0</span>
              <span>₹2,500</span>
              <span>₹5,000+</span>
            </div>
          </div>

          {/* Brand checkboxes with live counts */}
          {brandOptions.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">Brand</h4>
              <div className="space-y-2">
                {brandOptions.map((b) => (
                  <label
                    key={b.name}
                    className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-600 hover:text-navy"
                  >
                    <span className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(b.name)}
                        onChange={() => toggleBrand(b.name)}
                        className="w-4 h-4 rounded accent-purple"
                      />
                      <span>{b.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">({b.count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Rating */}
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">Rating</h4>
            <div className="space-y-1.5">
              {RATING_STEPS.map((r) => {
                const isSelected = minRating === r;
                return (
                  <button
                    key={r}
                    onClick={() => setMinRating(isSelected ? null : r)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                      isSelected ? 'bg-purple-soft text-purple font-bold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold">{r}</span>
                    <Star className="w-3.5 h-3.5 text-gold fill-current" />
                    <span>& above</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stock Filter Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-purple"
              />
              <span>In Stock Only</span>
            </label>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="md:col-span-3 space-y-6">
          {/* Title + Sort Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-navy capitalize">
                {pageTitle}{' '}
                <span className="text-sm font-bold text-slate-400">({products.length} Products)</span>
              </h1>
              {combosView && (
                <p className="text-xs text-slate-500 mt-1">{COMBOS_SUBTITLE}</p>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Search Filter Badge */}
          {searchQuery && (
            <div className="flex items-center space-x-2 bg-purple-soft border border-purple/20 px-3.5 py-2 rounded-xl text-xs text-purple font-semibold">
              <span>Search results for: <strong>"{searchQuery}"</strong></span>
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="p-1 hover:bg-purple/10 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Products Grid */}
          {combosView && !combosLoaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="aspect-square rounded-xl bg-slate-100 animate-pulse mb-3" />
                  <div className="h-3 rounded bg-slate-100 animate-pulse mb-2" />
                  <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            combosView ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-purple-soft flex items-center justify-center text-purple mx-auto">
                  <Gift className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-navy">No combo packs available right now</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Our combo packs and gift boxes are being put together. Browse the full
                  collection meanwhile — new bundles land here as soon as they go live.
                </p>
                <button
                  onClick={() => { setCombosView(false); resetFilters(); }}
                  className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold"
                >
                  Browse All Products
                </button>
              </div>
            ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-soft flex items-center justify-center text-purple mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-navy">No products match your selected filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your price slider, clearing search keywords, or selecting a different category.
              </p>
              <button
                onClick={resetFilters}
                className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold"
              >
                Clear All Filters
              </button>
            </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
