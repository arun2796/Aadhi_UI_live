import React, { useState, useEffect } from 'react';
import {
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  Grid,
  List,
  Search,
  X,
  Sparkles,
  Check
} from 'lucide-react';
import { Product, Category, Brand } from '../../types';
import { api } from '../../services/api';
import { ProductCard } from '../../components/customer/ProductCard';

interface ShopPageProps {
  onNavigate: (page: string, params?: any) => void;
  initialCategory?: string;
  initialSearch?: string;
  initialSortBy?: string;
}

export const ShopPage: React.FC<ShopPageProps> = ({
  onNavigate,
  initialCategory,
  initialSearch,
  initialSortBy = 'popular'
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(8000);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>(initialSortBy);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch || '');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  useEffect(() => {
    api.getCategories().then(setCategories);
    api.getBrands().then(setBrands);
  }, []);

  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const params: Record<string, any> = { pageSize: 100 };
    if (selectedCategory && selectedCategory !== 'all') {
      params.categorySlug = selectedCategory.toLowerCase().replace(/\s+/g, '-');
    }
    if (selectedBrand && selectedBrand !== 'all') {
      params.brandId = selectedBrand;
    }
    if (maxPrice) {
      params.maxPrice = maxPrice;
    }
    if (inStockOnly) {
      params.inStockOnly = true;
    }
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    if (sortBy) {
      params.sortBy = sortBy;
    }

    api.getProducts(params).then(all => {
      let list = [...all];

      if (sortBy === 'price_asc') {
        list.sort((a, b) => a.price - b.price);
      } else if (sortBy === 'price_desc') {
        list.sort((a, b) => b.price - a.price);
      } else if (sortBy === 'new') {
        list.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
      } else if (sortBy === 'popular') {
        list.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
      }

      setProducts(list);
    });
  }, [selectedCategory, selectedBrand, maxPrice, inStockOnly, searchQuery, sortBy]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMaxPrice(8000);
    setInStockOnly(false);
    setSearchQuery('');
    setSortBy('popular');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
          <button onClick={() => onNavigate('home')} className="hover:text-navy">Home</button>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Fireworks Catalog</span>
          {selectedCategory !== 'all' && (
            <>
              <span>/</span>
              <span className="text-orange font-bold capitalize">{selectedCategory.replace(/-/g, ' ')}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-navy">
          Explore All Fireworks & Gift Boxes
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Browse certified Sivakasi sparklers, flower pots, ground chakkars, rockets, and gift packs.
        </p>
      </div>

      {/* Main Grid: Filters Sidebar + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs sticky top-28">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-navy flex items-center space-x-2">
              <Filter className="w-4 h-4 text-orange" />
              <span>Filter Fireworks</span>
            </h3>
            <button
              onClick={resetFilters}
              className="text-xs text-orange hover:underline font-semibold"
            >
              Reset All
            </button>
          </div>

          {/* Categories Filter */}
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">Categories</h4>
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  selectedCategory === 'all' ? 'bg-orange text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>All Categories</span>
              </button>
              {categories.map((c) => {
                const slug = c.slug || c.name.toLowerCase().replace(/\s+/g, '-');
                const isSelected = selectedCategory === slug || selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(slug)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-orange text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-white' : 'text-slate-400'}`}>
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
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Max Price</h4>
              <span className="text-xs font-black text-navy">₹{maxPrice.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="100"
              max="8000"
              step="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-orange cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>₹100</span>
              <span>₹4,000</span>
              <span>₹8,000+</span>
            </div>
          </div>

          {/* Brands Filter */}
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">Brands</h4>
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedBrand('all')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  selectedBrand === 'all' ? 'bg-navy text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>All Brands</span>
              </button>
              {brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrand(b.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    selectedBrand === b.id ? 'bg-navy text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{b.name}</span>
                  <span className={`text-[10px] ${selectedBrand === b.id ? 'text-white' : 'text-slate-400'}`}>
                    {b.productCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stock Filter Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 text-orange rounded accent-orange"
              />
              <span>In Stock Only</span>
            </label>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Sort & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden px-3 py-2 rounded-xl bg-navy text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              <div className="text-xs text-slate-600 font-medium">
                Showing <strong className="text-navy">{products.length}</strong> items
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 font-medium">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-orange"
              >
                <option value="popular">Best Sellers</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="new">New Arrivals</option>
              </select>
            </div>
          </div>

          {/* Active Search Filter Badge */}
          {searchQuery && (
            <div className="flex items-center space-x-2 bg-orange/10 border border-orange/20 px-3.5 py-2 rounded-xl text-xs text-orange font-semibold">
              <span>Search results for: <strong>"{searchQuery}"</strong></span>
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-orange/20 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center text-orange mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-navy">No products match your selected filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your price slider, clearing search keywords, or selecting a different category.
              </p>
              <button
                onClick={resetFilters}
                className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
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
