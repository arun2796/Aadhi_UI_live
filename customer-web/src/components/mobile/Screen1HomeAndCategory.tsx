import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  BadgeCheck,
  ShieldCheck,
  Truck,
  Package,
  CheckCircle2,
  Star,
  ChevronDown,
  ChevronRight,
  Check,
  ArrowUpDown,
  SlidersHorizontal,
  ShoppingCart,
  Gift,
  X
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import productPlaceholder from '../../assets/product-placeholder.svg';

/* ────────────────────────────── shared helpers ────────────────────────────── */

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

/** Real review data only — null when the DTO carries no rating/review count. */
const realRatingOf = (p: Product): { rating: number; reviews: number } | null => {
  const rating = typeof p.rating === 'number' && p.rating > 0 ? Math.round(p.rating * 10) / 10 : 0;
  const reviews = typeof p.reviewCount === 'number' && p.reviewCount > 0 ? p.reviewCount : 0;
  if (rating <= 0 && reviews <= 0) return null;
  return { rating, reviews };
};

const pctOff = (p: Product): number => {
  if (p.compareAtPrice && p.compareAtPrice > p.price) {
    return p.discountPercentage || Math.round((1 - p.price / p.compareAtPrice) * 100);
  }
  return 0;
};

const productImage = (p: Product): string =>
  p.primaryImageUrl || (p as any).imageUrl || productPlaceholder;

/** Small purple COMBO chip — renders nothing until the API sends `isCombo`. */
const ComboChip: React.FC<{ product: Product }> = ({ product }) => {
  if (product.isCombo !== true) return null;
  const count = product.comboItemCount ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-soft text-purple text-[8px] font-black uppercase tracking-wider">
      <Gift className="w-2.5 h-2.5" />
      Combo{count > 0 ? ` · ${count} items` : ''}
    </span>
  );
};

/* ── Combos view (shared by the mobile home section and the listing screen) ── */

const COMBOS_TITLE = 'Combo Packs & Gift Boxes';
const COMBOS_SUBTITLE = 'Everything you need in one bundle — at one price.';

/** Legacy category slugs the old (dead) nav links used — routed to the combos
 *  view so saved links still land somewhere real. */
const COMBO_VIEW_SLUGS = new Set(['combos', 'combo-offers', 'gift-boxes']);

const wantsCombosView = (view?: string, category?: string): boolean =>
  view === 'combos' || COMBO_VIEW_SLUGS.has((category || '').trim().toLowerCase());

/** ₹ saved on a combo versus its struck MRP — 0 when there is nothing to shout about. */
const comboSaving = (p: Product): number =>
  p.isCombo === true && p.compareAtPrice && p.compareAtPrice > p.price
    ? Math.round(p.compareAtPrice - p.price)
    : 0;

const prettifySlug = (slug: string) => {
  if (!slug) return 'Products';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(slug)) {
    return 'Products';
  }
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
};

/* ══════════════════════════════════════════════════════════════════════════════
   SCREEN 1 — HOME  (design 02_Customer_HD_Clear/01_home.png)
   ══════════════════════════════════════════════════════════════════════════════ */

interface Screen1HomeProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenSearch: () => void;
}

export const Screen1Home: React.FC<Screen1HomeProps> = ({ onNavigate, onOpenSearch }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    let live = true;

    // Real combos only — the section below renders nothing when this is empty.
    api
      .getCombos()
      .then((list) => {
        if (live) setCombos(list);
      })
      .catch(() => {
        if (live) setCombos([]);
      });

    api
      .getCategories()
      .then((cats) => {
        if (live) setCategories(cats);
      })
      .catch(() => {
        if (live) setCategories([]);
      });

    (async () => {
      try {
        let list = await api.getBestSellers();
        list = Array.isArray(list) ? list.filter((p) => p && p.id) : [];
        if (list.length === 0) {
          // Ordinary home rail — combos have their own section below.
          const all = await api.getProducts({ excludeCombos: true });
          list = all.filter((p) => p.isBestSeller);
          if (list.length === 0) list = all.slice(0, 8);
        }
        if (live) setBestSellers(list.slice(0, 10));
      } catch {
        /* backend offline — sections render empty states */
      } finally {
        if (live) setLoadingProducts(false);
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-10 font-sans bg-[#fbfbfb] animate-fade-in">
      {/* 1. Search bar */}
      <div className="px-4 pt-3">
        <button
          onClick={onOpenSearch}
          className="w-full bg-white rounded-full pl-4 pr-3 py-2.5 flex items-center justify-between text-xs text-slate-400 border border-slate-200 shadow-xs active:bg-slate-50"
        >
          <span className="truncate">Search for crackers, gift boxes, sparklers</span>
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
        </button>
      </div>

      {/* 2. Navy hero banner */}
      <div className="px-4">
        <div className="rounded-3xl bg-navy bg-gradient-to-br from-navy via-[#241a63] to-navy text-white px-5 py-6 relative overflow-hidden shadow-xl">
          {/* decorative sparkle field */}
          <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(#FFB000_1px,transparent_1px)] [background-size:22px_22px]" />
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-orange/20 blur-2xl pointer-events-none" />
          <div className="absolute right-6 bottom-8 w-20 h-20 rounded-full bg-purple/40 blur-xl pointer-events-none" />

          {/* right hero graphic — brand logo (public/logo.png); hidden if the asset is missing */}
          <img
            src="/logo.png"
            alt="Aadhi Crackers"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-[92%] w-2/5 object-contain pointer-events-none drop-shadow-[0_0_18px_rgba(255,176,0,0.35)]"
          />

          <div className="relative z-10 space-y-2 max-w-[230px]">
            <div className="text-[11px] font-semibold text-white/90 tracking-wide">
              Celebrate Every Moment with
            </div>
            <h2 className="text-[26px] leading-none font-black tracking-tight text-gold drop-shadow-sm">
              AADHI CRACKERS
            </h2>
            <p className="text-[11px] font-semibold text-white leading-snug">
              Quality You Trust, Celebrations You Love!
            </p>

            {/* mini trust points inside hero */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pt-1">
              {['100% Original', 'Safe & Secure', 'Transport Delivery'].map((t) => (
                <span key={t} className="flex items-center gap-1 text-[9px] font-bold text-white/85">
                  <CheckCircle2 className="w-3 h-3 text-gold" />
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-2.5">
              <button
                onClick={() => onNavigate('category-menu')}
                className="px-6 py-2.5 rounded-lg bg-orange hover:bg-orange-hover text-white text-[11px] font-black uppercase tracking-widest shadow-glow active:scale-95 transition-all"
              >
                Shop Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Trust badge row */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: BadgeCheck, tint: 'bg-orange-soft text-orange', title: '100% Original', sub: 'Trusted Brands' },
            { icon: ShieldCheck, tint: 'bg-purple-soft text-purple', title: 'Safe & Secure', sub: 'Quality Assured' },
            { icon: Truck, tint: 'bg-emerald-50 text-emerald-600', title: 'Transport Delivery', sub: 'Arrives in 1–2 weeks' },
            { icon: Package, tint: 'bg-gold-soft text-gold-dark', title: 'Safe Packing', sub: 'Sivakasi Direct' }
          ].map(({ icon: Icon, tint, title, sub }) => (
            <div
              key={title}
              className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center gap-2.5"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tint}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-800 leading-tight truncate">{title}</div>
                <div className="text-[9px] text-slate-400 font-medium truncate">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Shop by Category — hidden entirely when the API returns no categories */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <div className="px-4 flex items-center justify-between">
            <h3 className="text-sm font-black text-navy">Shop by Category</h3>
            <button
              onClick={() => onNavigate('category-menu')}
              className="text-[11px] font-bold text-purple flex items-center gap-0.5 active:opacity-70"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto-scrolling marquee (left → right); pauses while pressed. */}
          <div className="overflow-hidden pb-1">
            <div className="flex w-max animate-marquee-ltr">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-4 pr-4 pl-4" aria-hidden={dup === 1}>
                  {categories.map((c) => (
                    <button
                      key={`${dup}-${c.id || c.slug}`}
                      onClick={() => onNavigate('category', { category: c.slug })}
                      tabIndex={dup === 1 ? -1 : 0}
                      className="flex flex-col items-center flex-shrink-0 w-[68px] group"
                    >
                      <div className="w-16 h-16 rounded-full bg-navy border-2 border-orange/50 shadow-md overflow-hidden group-active:scale-95 transition-transform">
                        <img
                          src={c.imageUrl || productPlaceholder}
                          alt={c.name}
                          className="w-full h-full object-cover opacity-90"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[9.5px] font-bold text-slate-700 mt-1.5 leading-tight text-center line-clamp-2">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Best Selling Products */}
      <div className="space-y-3">
        <div className="px-4 flex items-center justify-between">
          <h3 className="text-sm font-black text-navy">Best Selling Products</h3>
          <button
            onClick={() => onNavigate('category', { category: 'best-sellers' })}
            className="text-[11px] font-bold text-purple flex items-center gap-0.5 active:opacity-70"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-100 p-2.5">
                <div className="aspect-square rounded-xl bg-slate-100 animate-pulse mb-2" />
                <div className="h-3 rounded bg-slate-100 animate-pulse mb-1.5" />
                <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : bestSellers.length === 0 ? (
          <div className="mx-4 p-6 rounded-2xl bg-white border border-slate-100 text-center text-[11px] text-slate-400 font-medium">
            Products are loading soon — please check back!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4">
            {bestSellers.map((p) => {
              const real = realRatingOf(p);
              const off = pctOff(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onNavigate('product-detail', { slug: p.slug })}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-card p-2.5 text-left active:scale-[0.98] transition-transform flex flex-col justify-between"
                >
                  <div className="w-full">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2">
                      <img
                        src={productImage(p)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {off > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-orange text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs">
                          {off}% OFF
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-[11px] text-slate-800 leading-snug line-clamp-2 min-h-[30px] mb-1">
                      {p.name}
                    </h4>

                    <ComboChip product={p} />
                  </div>

                  <div className="w-full mt-1">
                    {real && (
                      <div className="flex items-center gap-1 mb-1">
                        <Star className="w-3 h-3 text-gold fill-gold" />
                        <span className="text-[9px] font-bold text-slate-600">
                          {real.rating} ({real.reviews})
                        </span>
                      </div>
                    )}

                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-black text-[13px] text-navy">{inr(p.price ?? 0)}</span>
                      {(p.compareAtPrice ?? 0) > p.price && p.compareAtPrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {inr(p.compareAtPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Combo Packs & Gift Boxes — real combos only; hidden entirely when empty */}
      {combos.length > 0 && (
        <div className="space-y-3">
          <div className="px-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-navy">{COMBOS_TITLE}</h3>
              <p className="text-[10px] text-slate-500 font-medium leading-snug">{COMBOS_SUBTITLE}</p>
            </div>
            <button
              onClick={() => onNavigate('shop', { view: 'combos' })}
              className="text-[11px] font-bold text-purple flex items-center gap-0.5 active:opacity-70 flex-shrink-0 pt-0.5"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4">
            {combos.slice(0, 6).map((p) => {
              const off = pctOff(p);
              const saving = comboSaving(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onNavigate('product-detail', { slug: p.slug })}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-card p-2.5 text-left active:scale-[0.98] transition-transform flex flex-col justify-between"
                >
                  <div className="w-full">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2">
                      <img
                        src={productImage(p)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {off > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-orange text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs">
                          {off}% OFF
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-[11px] text-slate-800 leading-snug line-clamp-2 min-h-[30px] mb-1">
                      {p.name}
                    </h4>

                    <ComboChip product={p} />
                  </div>

                  <div className="w-full mt-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-black text-[13px] text-navy">{inr(p.price ?? 0)}</span>
                      {(p.compareAtPrice ?? 0) > p.price && p.compareAtPrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {inr(p.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    {saving > 0 && (
                      <div className="text-[9.5px] font-black text-orange mt-0.5">
                        Save {inr(saving)}{off > 0 ? ` (${off}% OFF)` : ''}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   SCREEN 2 — CATEGORY / PRODUCT LISTING  (design 02_category.png)
   ══════════════════════════════════════════════════════════════════════════════ */

type SortKey = 'popularity' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popularity', label: 'Popularity' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' }
];

interface Screen2CategoryProps {
  categorySlug?: string;
  /** `view: 'combos'` switches the listing over to api.getCombos(). */
  view?: string;
  /** Applied filters from MobileFiltersModal: { maxPrice, categories, brands, minRating? } */
  filters?: { maxPrice: number; categories: string[]; brands: string[]; minRating?: number };
  onNavigate: (page: string, params?: any) => void;
  onOpenFilter: () => void;
  onOpenSort: () => void;
}

export const Screen2Category: React.FC<Screen2CategoryProps> = ({
  categorySlug = '',
  view,
  filters,
  onNavigate,
  onOpenFilter,
  onOpenSort
}) => {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('popularity');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const combosView = wantsCombosView(view, categorySlug);

  /** Where "Clear filters" goes back to — the combos view keeps its own param. */
  const clearFilters = () =>
    combosView ? onNavigate('shop', { view: 'combos' }) : onNavigate('category', { category: categorySlug });

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      api.getCategories().catch(() => [] as Category[]),
      combosView
        ? api.getCombos().catch(() => [] as Product[])
        // Ordinary category / all-products browsing: combos belong to the
        // Combos view only (this screen carries no text search of its own).
        : api.getProducts({ excludeCombos: true }).catch(() => [] as Product[])
    ])
      .then(([cats, prods]) => {
        if (!live) return;
        setCategories(cats as Category[]);
        setProducts(prods as Product[]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [categorySlug, combosView]);

  const categoryName = useMemo(() => {
    if (combosView) return COMBOS_TITLE;
    if (categorySlug === 'best-sellers') return 'Best Sellers';
    const found = categories.find((c) => c.slug === categorySlug || c.id === categorySlug);
    if (found) return found.name;
    for (const top of categories) {
      if (top.subCategories) {
        const sub = top.subCategories.find((s) => s.slug === categorySlug || s.id === categorySlug);
        if (sub) return sub.name;
      }
    }
    const prodMatch = products.find(
      (p) =>
        p.categoryId === categorySlug ||
        (p.categoryName || '').toLowerCase().replace(/\s+/g, '-') === categorySlug.toLowerCase()
    );
    if (prodMatch?.categoryName) return prodMatch.categoryName;
    return prettifySlug(categorySlug);
  }, [categories, categorySlug, products, combosView]);

  /* Client-side filtering (categorySlug + filters prop) and sorting */
  const visible = useMemo(() => {
    let list = [...products];

    const selectedCats = filters?.categories ?? [];
    if (combosView) {
      // Already the combos list — no category narrowing on top of it.
    } else if (selectedCats.length > 0) {
      const set = new Set(selectedCats.map((n) => n.toLowerCase()));
      list = list.filter((p) => set.has((p.categoryName || '').toLowerCase()));
    } else if (categorySlug === 'best-sellers') {
      const best = list.filter((p) => p.isBestSeller);
      if (best.length > 0) list = best;
    } else {
      const slug = categorySlug.toLowerCase().replace(/\s+/g, '-');
      const bySlug = list.filter(
        (p) =>
          (p.categoryName || '').toLowerCase().replace(/\s+/g, '-') === slug ||
          p.categoryId === categorySlug
      );
      if (bySlug.length > 0) list = bySlug;
    }

    if (filters?.maxPrice && filters.maxPrice > 0) {
      list = list.filter((p) => p.price <= filters.maxPrice);
    }
    if (filters?.brands && filters.brands.length > 0) {
      const set = new Set(filters.brands.map((n) => n.toLowerCase()));
      list = list.filter((p) => p.brandName && set.has(p.brandName.toLowerCase()));
    }
    if (filters?.minRating && filters.minRating > 0) {
      list = list.filter((p) => (p.rating ?? 0) >= (filters.minRating as number));
    }

    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    else {
      list.sort(
        (a, b) =>
          Number(b.isBestSeller) - Number(a.isBestSeller) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
      );
    }
    return list;
  }, [products, filters, categorySlug, sortBy, combosView]);

  const activeFilterCount =
    (combosView ? 0 : filters?.categories?.length ? 1 : 0) +
    (filters?.brands?.length ? 1 : 0) +
    (filters?.maxPrice && filters.maxPrice < 100000 ? 1 : 0) +
    (filters?.minRating ? 1 : 0);

  const handleAdd = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    addToCart(p, 1);
    showToast(`${p.name} added to cart`, 'success');
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Popularity';

  return (
    <div className="pb-4 font-sans bg-[#fbfbfb] animate-fade-in">
      {/* Title + count + breadcrumb */}
      <div className="px-4 pt-3">
        <div className="flex items-baseline gap-1.5">
          <h2 className="text-lg font-black text-navy">{categoryName}</h2>
          <span className="text-[11px] font-semibold text-slate-400">
            ({visible.length} Products)
          </span>
        </div>
        {combosView && (
          <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 leading-snug">
            {COMBOS_SUBTITLE}
          </p>
        )}
        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
          Home &gt; <span className="text-slate-600 font-semibold">{categoryName}</span>
        </div>
      </div>

      {/* Sort + Filter controls */}
      <div className="px-4 mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onOpenFilter}
          className="py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 shadow-xs active:bg-slate-50 relative"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-orange text-white text-[8px] font-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setSortSheetOpen(true)}
          className="py-2 px-3.5 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 shadow-xs active:bg-slate-50 min-w-0"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="truncate">
            Sort By: <span className="text-purple">{sortLabel}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="px-4 mt-2.5 flex items-center gap-1.5 flex-wrap">
          {(combosView ? [] : filters?.categories ?? []).map((c) => (
            <span key={c} className="px-2 py-0.5 rounded-full bg-orange/10 text-orange text-[9px] font-bold">
              {c}
            </span>
          ))}
          {(filters?.brands ?? []).map((b) => (
            <span key={b} className="px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[9px] font-bold">
              {b}
            </span>
          ))}
          {filters?.maxPrice && filters.maxPrice < 100000 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold">
              Under {inr(filters.maxPrice)}
            </span>
          )}
          {filters?.minRating ? (
            <span className="px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark text-[9px] font-bold">
              {filters.minRating}★ &amp; above
            </span>
          ) : null}
          <button
            onClick={clearFilters}
            className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center gap-0.5 active:opacity-80"
          >
            <X className="w-2.5 h-2.5" /> Clear
          </button>
        </div>
      )}

      {/* 2-column product grid */}
      {loading ? (
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white border border-slate-100 p-2.5">
              <div className="aspect-square rounded-xl bg-slate-100 animate-pulse mb-2" />
              <div className="h-3 rounded bg-slate-100 animate-pulse mb-1.5" />
              <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse mb-2" />
              <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 mt-6">
          {combosView ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-100 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-soft flex items-center justify-center">
                <Gift className="w-6 h-6 text-purple" />
              </div>
              <div className="text-sm font-bold text-navy">No combo packs available right now</div>
              <p className="text-[11px] text-slate-500">
                Our combo packs and gift boxes are being put together. New bundles show
                up here as soon as they go live.
              </p>
              <button
                onClick={() => onNavigate('category-menu')}
                className="px-5 py-2 rounded-xl bg-orange text-white text-[11px] font-bold shadow-glow active:scale-95 transition-transform"
              >
                Browse All Products
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white border border-slate-100 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-navy">No products found</div>
              <p className="text-[11px] text-slate-500">
                No products match the selected filters. Try widening your filters.
              </p>
              <button
                onClick={clearFilters}
                className="px-5 py-2 rounded-xl bg-orange text-white text-[11px] font-bold shadow-glow active:scale-95 transition-transform"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 mt-3 grid grid-cols-2 gap-3">
          {visible.map((p) => {
            const real = realRatingOf(p);
            const off = pctOff(p);
            const inStock = p.isActive !== false;
            return (
              <div
                key={p.id}
                onClick={() => onNavigate('product-detail', { slug: p.slug })}
                className="bg-white rounded-2xl border border-slate-100 shadow-card p-2.5 flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
              >
                {/* image + badge */}
                <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2">
                  <img
                    src={productImage(p)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {p.isBestSeller && (
                    <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wide">
                      Bestseller
                    </span>
                  )}
                  {!inStock && (
                    <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] font-black text-red-600 uppercase tracking-wider">
                      Out of Stock
                    </span>
                  )}
                </div>

                {/* name */}
                <h4 className="font-bold text-[11px] text-slate-800 leading-snug line-clamp-2 min-h-[28px] mb-1">
                  {p.name}
                </h4>

                {/* combo chip */}
                {p.isCombo === true && (
                  <div className="mb-1">
                    <ComboChip product={p} />
                  </div>
                )}

                {/* price + MRP + % badge */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="font-black text-[13px] text-navy">{inr(p.price)}</span>
                  {(p.compareAtPrice ?? 0) > p.price && p.compareAtPrice && (
                    <span className="text-[10px] text-slate-400 line-through">
                      {inr(p.compareAtPrice)}
                    </span>
                  )}
                  {off > 0 && (
                    <span className="text-[8px] font-black text-white bg-orange px-1.5 py-0.5 rounded">
                      {comboSaving(p) > 0 ? `Save ${inr(comboSaving(p))} · ${off}% OFF` : `${off}% OFF`}
                    </span>
                  )}
                </div>

                {/* rating — only when the DTO carries real review data */}
                {real && (
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3 h-3 text-gold fill-gold" />
                    <span className="text-[9.5px] font-bold text-slate-600">{real.rating}</span>
                    <span className="text-[9.5px] text-slate-400">({real.reviews})</span>
                  </div>
                )}

                {/* add to cart */}
                <button
                  onClick={(e) => handleAdd(e, p)}
                  disabled={!inStock}
                  className={`mt-auto w-full py-2 rounded-xl text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    inStock
                      ? 'border border-purple text-purple active:bg-purple/5'
                      : 'border border-slate-200 text-slate-300'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Add to Cart
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* footer count */}
      {!loading && visible.length > 0 && (
        <div className="text-center pt-4 text-[10px] text-slate-400 font-medium">
          Showing {visible.length} products in {categoryName}
        </div>
      )}

      {/* Sticky bottom Sort / Filters bar (per design) */}
      <div className="sticky bottom-20 z-30 mt-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-navy text-white rounded-full shadow-xl flex items-center overflow-hidden">
          <button
            onClick={() => setSortSheetOpen(true)}
            className="py-2.5 px-6 flex items-center gap-1.5 text-[11px] font-bold active:bg-white/10"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort
          </button>
          <div className="w-px self-stretch bg-white/25" />
          <button
            onClick={onOpenFilter}
            className="py-2.5 px-6 flex items-center gap-1.5 text-[11px] font-bold active:bg-white/10"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange text-white text-[8px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Inline sort bottom sheet (own UI — onOpenSort from App opens the filter modal instead) */}
      {sortSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setSortSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-4 pb-6 space-y-1 animate-fade-in max-w-[425px] w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-2" />
            <div className="text-xs font-black text-navy uppercase tracking-wider pb-1">Sort By</div>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  setSortBy(o.key);
                  setSortSheetOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-colors ${
                  sortBy === o.key ? 'bg-purple/10 text-purple' : 'text-slate-700 active:bg-slate-50'
                }`}
              >
                <span>{o.label}</span>
                {sortBy === o.key && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
