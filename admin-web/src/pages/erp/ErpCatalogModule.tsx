import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  XCircle,
  RefreshCw,
  Gift,
  Filter,
  ChevronRight,
  Monitor,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { Product, Category, GiftBox, ComboOffer, ProductReview, HomepageBanner } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { flattenCategories, slugifyCategoryName } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';

const PRODUCTS_PAGE_SIZE = 10;
const CATEGORIES_PAGE_SIZE = 8;

/**
 * Friendly server error text: the backend returns ProblemDetails for business-rule 400s
 * (e.g. { title: "Business Rule Violation", detail: "A category named 'test' already exists..." }).
 * Prefer `detail`, then `message`, then whatever getApiErrorDetails extracts, then the fallback.
 */
const getServerErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } } | null)
    ?.response?.data;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  const { message } = getApiErrorDetails(error);
  return message || fallback;
};

// ---------- Banner placements (?placement=home|mobile; backend `placement` field in flight) ----------

type BannerPlacement = 'Home' | 'Mobile';

/** HomepageBanner + the placement field being added server-side (old rows have none → Home). */
type BannerRow = HomepageBanner & { placement?: string };

/** Old rows carry no placement — treat them as Home banners. */
const bannerPlacementOf = (b: BannerRow): BannerPlacement =>
  String(b.placement || 'Home').toLowerCase() === 'mobile' ? 'Mobile' : 'Home';

const EMPTY_BANNER_FORM: Partial<BannerRow> = {
  title: '',
  subtitle: '',
  imageUrl: '',
  targetUrl: '/',
  ctaText: 'Shop Now',
  displayOrder: 1,
  isActive: true,
  placement: 'Home'
};

type CatalogSubTab = 'products' | 'categories' | 'combos' | 'reviews' | 'banners';

/** Every sidebar item is its own standalone screen — per-screen header copy. */
const SCREEN_HEADERS: Record<CatalogSubTab, { title: string; subtitle: string }> = {
  products: { title: 'Products', subtitle: 'Manage the live product catalog.' },
  categories: { title: 'Categories', subtitle: 'Top-level catalog categories.' },
  combos: { title: 'Gift Boxes & Combos', subtitle: 'Pre-packed gift boxes and special combo deals.' },
  reviews: { title: 'Reviews & Moderation', subtitle: 'Approve, reject or hide customer product reviews.' },
  banners: { title: 'Banners', subtitle: 'Manage homepage web and mobile app promotional banners.' }
};

interface ErpCatalogModuleProps {
  initialSubTab?: CatalogSubTab;
  initialSelectedProductId?: string;
  initialSelectedCategoryId?: string;
}

export const ErpCatalogModule: React.FC<ErpCatalogModuleProps> = ({
  initialSubTab = 'products',
  initialSelectedProductId,
  initialSelectedCategoryId
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // Each routed entry (/admin/products, /admin/categories, ...) is its own standalone
  // screen — the route fixes the view, there is no module-level tab bar anymore.
  const subTab: CatalogSubTab = initialSubTab;

  // Banner placement split driven by ?placement=home|mobile (sidebar deep links) — default Home
  const bannerPlacement: BannerPlacement = searchParams.get('placement') === 'mobile' ? 'Mobile' : 'Home';
  const setBannerPlacement = (p: BannerPlacement) => {
    const next = new URLSearchParams(searchParams);
    next.set('placement', p.toLowerCase());
    setSearchParams(next, { replace: true });
  };

  // Products state (server-side paged)
  const [products, setProducts] = useState<Product[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsPage, setProductsPage] = useState(1);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);

  // Categories state (flattened: top-level + sub-categories)
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);

  // Other catalog data
  const [giftBoxes, setGiftBoxes] = useState<GiftBox[]>([]);
  const [combos, setCombos] = useState<ComboOffer[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Banner create/edit modal + delete confirmation
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [bannerFormData, setBannerFormData] = useState<Partial<BannerRow>>(EMPTY_BANNER_FORM);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [deleteBannerTarget, setDeleteBannerTarget] = useState<BannerRow | null>(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  // True once the admin typed in the Slug field (or is editing an existing category):
  // the slug is then sent verbatim instead of being auto-suggested from the name.
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 1,
    isActive: true
  });

  const loadProducts = async () => {
    setIsProductsLoading(true);
    try {
      const res = await api.getProducts({
        page: productsPage,
        pageSize: PRODUCTS_PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined
      });
      setProducts([...res]);
      setProductsTotal(res.totalCount);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load products', 'error');
    } finally {
      setIsProductsLoading(false);
    }
  };

  const loadAuxData = async () => {
    setIsLoading(true);
    try {
      const [cats, gbs, cmbs, revs, bans] = await Promise.all([
        api.getCategories(true),
        api.getGiftBoxes(),
        api.getComboOffers(),
        api.getProductReviews(),
        api.getHomepageBanners()
      ]);
      setCategories(flattenCategories(cats || []));
      setGiftBoxes(gbs);
      setCombos(cmbs);
      setReviews(revs);
      setBanners(bans);
    } catch {
      showToast('Failed to load catalog data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([loadAuxData(), loadProducts()]);
  };

  useEffect(() => {
    loadAuxData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setProductsPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsPage, debouncedSearch, selectedCategoryFilter]);

  // Deep link: /admin/products/:id → dedicated edit page
  useEffect(() => {
    if (initialSelectedProductId) {
      navigate(`/admin/products/${initialSelectedProductId}/edit`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedProductId]);

  // Deep link: /admin/categories/:id → open the category editor once categories are loaded
  // (the route already renders this component with initialSubTab="categories")
  const categoryDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (!initialSelectedCategoryId || categoryDeepLinkHandled.current || categories.length === 0) return;
    categoryDeepLinkHandled.current = true;
    const cat = categories.find((c) => c.id === initialSelectedCategoryId);
    if (cat) {
      setCategoryFormData({ ...cat });
      setIsSlugTouched(true); // existing slug — keep it unless deliberately edited
      setIsCategoryModalOpen(true);
    } else {
      showToast('Category not found', 'warning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedCategoryId, categories]);

  // Category lookups
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const topLevelCategories = useMemo(() => categories.filter((c) => !c.parentCategoryId), [categories]);

  /** Resolves Category / Sub Category display cells for a product row. */
  const resolveCategoryCells = (p: Product): { category: string; subCategory: string } => {
    const cat = categoryById.get(p.categoryId);
    if (cat?.parentCategoryId) {
      return {
        category: categoryById.get(cat.parentCategoryId)?.name || cat.parentCategoryName || '—',
        subCategory: cat.name
      };
    }
    return { category: cat?.name || p.categoryName || '—', subCategory: '—' };
  };

  // Status filter is applied client-side over the current page (backend GET /products has no isActive filter)
  const displayedProducts = useMemo(() => {
    if (selectedStatusFilter === 'all') return products;
    return products.filter((p) => (selectedStatusFilter === 'active' ? p.isActive : !p.isActive));
  }, [products, selectedStatusFilter]);

  // Categories tab: search + client-side pagination over top-level categories
  const filteredTopCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return topLevelCategories;
    return topLevelCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }, [topLevelCategories, categorySearch]);

  const pagedCategories = filteredTopCategories.slice(
    (categoriesPage - 1) * CATEGORIES_PAGE_SIZE,
    categoriesPage * CATEGORIES_PAGE_SIZE
  );

  useEffect(() => {
    setCategoriesPage(1);
  }, [categorySearch]);

  // Handle Category Save
  const handleSaveCategory = async () => {
    if (!categoryFormData.name?.trim()) {
      showToast('Category name is required', 'warning');
      return;
    }
    try {
      const payload: Partial<Category> = {
        name: categoryFormData.name,
        // Backend accepts an optional slug: send whatever the admin sees in the Slug field
        // (custom or auto-suggested); when blank the backend generates one from the name.
        slug: categoryFormData.slug?.trim() || undefined,
        description: categoryFormData.description,
        imageUrl: (categoryFormData.imageUrl ? normalizeImageUrl(categoryFormData.imageUrl.trim()) ?? categoryFormData.imageUrl.trim() : undefined),
        parentCategoryId: categoryFormData.parentCategoryId || undefined,
        displayOrder: categoryFormData.displayOrder ?? 1,
        isActive: categoryFormData.isActive ?? true
      };
      if (categoryFormData.id) {
        await api.updateCategory(categoryFormData.id, payload);
        showToast('Category updated successfully!', 'success');
      } else {
        await api.createCategory(payload);
        showToast('Category created successfully!', 'success');
      }
      setIsCategoryModalOpen(false);
      setCategoryFormData({ name: '', slug: '', description: '', imageUrl: '', displayOrder: 1, isActive: true });
      setIsSlugTouched(false);
      loadAuxData();
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Error saving category'), 'error');
    }
  };

  // Handle deletes (with design-system confirmation dialogs)
  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    try {
      await api.deleteProduct(deleteProductTarget.id);
      showToast(`Product "${deleteProductTarget.name}" removed`, 'info');
      setDeleteProductTarget(null);
      loadProducts();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to delete product', 'error');
      setDeleteProductTarget(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    try {
      await api.deleteCategory(deleteCategoryTarget.id);
      showToast(`Category "${deleteCategoryTarget.name}" removed`, 'info');
      setDeleteCategoryTarget(null);
      loadAuxData();
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Failed to delete category'), 'error');
      setDeleteCategoryTarget(null);
    }
  };

  // ---------- Banner CRUD (placement-aware; backend placement support in flight) ----------

  const reloadBanners = async () => {
    try {
      const bans = await api.getHomepageBanners();
      setBanners(bans);
    } catch {
      showToast('Failed to reload banners', 'error');
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerFormData.title?.trim() || !bannerFormData.imageUrl?.trim()) {
      showToast('Banner title and image URL are required', 'warning');
      return;
    }
    setIsSavingBanner(true);
    try {
      const payload = {
        title: bannerFormData.title.trim(),
        subtitle: bannerFormData.subtitle || '',
        imageUrl: (normalizeImageUrl(bannerFormData.imageUrl.trim()) ?? bannerFormData.imageUrl.trim()),
        targetUrl: bannerFormData.targetUrl || '/',
        ctaText: bannerFormData.ctaText || 'Shop Now',
        displayOrder: bannerFormData.displayOrder ?? 1,
        isActive: bannerFormData.isActive ?? true,
        placement: bannerFormData.placement || 'Home'
      };
      if (bannerFormData.id) {
        await api.updateBanner(bannerFormData.id, payload);
        showToast('Banner updated successfully!', 'success');
      } else {
        await api.createBanner(payload);
        showToast('Banner created successfully!', 'success');
      }
      setIsBannerModalOpen(false);
      setBannerFormData(EMPTY_BANNER_FORM);
      reloadBanners();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Error saving banner', 'error');
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!deleteBannerTarget) return;
    try {
      await api.deleteBanner(deleteBannerTarget.id);
      showToast(`Banner "${deleteBannerTarget.title}" removed`, 'info');
      setDeleteBannerTarget(null);
      reloadBanners();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to delete banner', 'error');
      setDeleteBannerTarget(null);
    }
  };

  // Handle Review Moderation
  const handleReviewAction = async (id: string, newStatus: 'Approved' | 'Rejected' | 'Hidden') => {
    try {
      await api.updateReviewStatus(id, newStatus);
      showToast(`Review marked as ${newStatus}`, 'success');
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch {
      showToast('Failed to update review status', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>{SCREEN_HEADERS[subTab].title}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{SCREEN_HEADERS[subTab].subtitle}</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isProductsLoading ? 'animate-spin' : ''}`} />
          </button>

          {subTab === 'products' && (
            <button
              onClick={() => navigate('/admin/products/new')}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}

          {subTab === 'categories' && (
            <>
              <button
                onClick={() => navigate('/admin/sub-categories')}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sub Categories</span>
              </button>
              <button
                onClick={() => {
                  setCategoryFormData({
                    name: '',
                    slug: '',
                    description: '',
                    imageUrl: '',
                    displayOrder: topLevelCategories.length + 1,
                    isActive: true
                  });
                  setIsSlugTouched(false);
                  setIsCategoryModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </>
          )}

          {subTab === 'banners' && (
            <button
              onClick={() => {
                setBannerFormData({ ...EMPTY_BANNER_FORM, placement: bannerPlacement });
                setIsBannerModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add {bannerPlacement === 'Home' ? 'Web' : 'Mobile'} Banner</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. PRODUCTS SCREEN (design 07) */}
      {subTab === 'products' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>

            <div className="relative w-full sm:w-auto flex justify-end">
              <button
                onClick={() => setIsFilterOpen((v) => !v)}
                className={`px-4 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                  isFilterOpen || selectedCategoryFilter !== 'all' || selectedStatusFilter !== 'all'
                    ? 'border-purple text-purple bg-purple/5'
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-navy">Category</label>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => {
                        setSelectedCategoryFilter(e.target.value);
                        setProductsPage(1);
                      }}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-navy outline-none"
                    >
                <option value="all">All Categories</option>
                {topLevelCategories.map((parent) => (
                  <React.Fragment key={parent.id}>
                    <option value={parent.id}>{parent.name}</option>
                    {categories
                      .filter((c) => c.parentCategoryId === parent.id)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {'  — ' + sub.name}
                        </option>
                      ))}
                  </React.Fragment>
                ))}
              </select>
                  </div>

                  <div>
                    <label className="font-bold text-navy">Status</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                      className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-navy outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedCategoryFilter('all');
                        setSelectedStatusFilter('all');
                        setProductsPage(1);
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear all
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-purple hover:bg-purple-dark text-white text-[11px] font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Stock</th>
                    <th className="py-3 px-3">Price</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {isProductsLoading && displayedProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Loading products...
                      </td>
                    </tr>
                  )}
                  {!isProductsLoading && displayedProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No products found.
                      </td>
                    </tr>
                  )}
                  {displayedProducts.map((p) => {
                    const cells = resolveCategoryCells(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={p.primaryImageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&auto=format&fit=crop&q=80'}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-navy text-xs">{p.name}</div>
                              <div className="text-[10px] text-slate-400">Unit: {p.unit || 'Box'} • Weight: {p.weightKg || 0.5}kg</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-purple">{p.sku}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            {cells.category}
                          </span>
                          {cells.subCategory !== '—' && (
                            <div className="text-[10px] text-slate-400 mt-1 pl-0.5">{cells.subCategory}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                (p.availableQuantity ?? p.stockQuantity) > 10 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                              }`}
                            />
                            <span className="font-bold text-navy">{p.availableQuantity ?? p.stockQuantity}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-black text-navy text-xs">₹{p.price.toLocaleString('en-IN')}</div>
                          {p.costPrice ? <div className="text-[10px] text-slate-400">Cost: ₹{p.costPrice}</div> : null}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              title="Edit Product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteProductTarget(p)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              title="View Details"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={productsPage}
                pageSize={PRODUCTS_PAGE_SIZE}
                total={productsTotal}
                onPageChange={setProductsPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES SCREEN (design 04 — top-level categories only) */}
      {subTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2 w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
            />
          </div>

          {/* Categories Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Products</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pagedCategories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      {isLoading ? 'Loading categories...' : 'No categories found.'}
                    </td>
                  </tr>
                )}
                {pagedCategories.map((c) => (
                  <tr key={c.id || c.slug} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={c.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=200&auto=format&fit=crop&q=80'}
                          alt={c.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-navy text-xs">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">/{c.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{c.description || '—'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[10px] font-bold">
                        {c.productCount || 0} Products
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => {
                            setCategoryFormData({ ...c });
                            setIsSlugTouched(true); // existing slug — keep it unless deliberately edited
                            setIsCategoryModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCategoryTarget(c)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={categoriesPage}
            pageSize={CATEGORIES_PAGE_SIZE}
            total={filteredTopCategories.length}
            onPageChange={setCategoriesPage}
          />
        </div>
      )}

      {/* 3. GIFT BOXES & COMBOS SCREEN */}
      {subTab === 'combos' && (
        <div className="space-y-6">
          {/* Gift Boxes */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-navy uppercase tracking-wider flex items-center space-x-2">
              <Gift className="w-4 h-4 text-orange" />
              <span>Pre-Packed Gift Boxes ({giftBoxes.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {giftBoxes.map((gb) => (
                <div key={gb.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <img src={gb.imageUrl} alt={gb.name} className="w-16 h-16 rounded-xl object-cover border" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-xs text-navy">{gb.name}</h3>
                        <span className="font-mono text-[10px] text-purple font-bold">{gb.sku}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{gb.theme} • {gb.occasion}</div>
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className="font-black text-sm text-navy">₹{gb.price.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] line-through text-slate-400">MRP ₹{gb.mrp}</span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                          {gb.itemCount} items inside
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                    <div className="font-bold text-slate-600 text-[10px] uppercase">Box Contents Breakdown:</div>
                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                      {gb.components.map((comp, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="truncate">{comp.productName}</span>
                          <span className="font-bold text-navy">x{comp.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combos */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h2 className="text-sm font-black text-navy uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple" />
              <span>Special Combo Deals ({combos.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {combos.map((cmb) => (
                <div key={cmb.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex items-start space-x-3">
                  <img src={cmb.imageUrl} alt={cmb.name} className="w-16 h-16 rounded-xl object-cover border" />
                  <div className="flex-1 space-y-1">
                    <h3 className="font-bold text-xs text-navy">{cmb.name}</h3>
                    <p className="text-[10px] text-slate-500">{cmb.description}</p>
                    <div className="flex items-baseline space-x-2 pt-1">
                      <span className="font-black text-sm text-navy">₹{cmb.comboPrice.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] line-through text-slate-400">₹{cmb.normalValue}</span>
                      <span className="text-[10px] font-black text-orange bg-orange/10 px-1.5 py-0.5 rounded-full">
                        Save ₹{cmb.savings} ({cmb.discountPercentage}% OFF)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. REVIEWS & MODERATION SCREEN */}
      {subTab === 'reviews' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center space-x-2">
                    <div className="flex text-amber-400 text-xs">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </div>
                    <span className="font-bold text-xs text-navy">{r.title || 'Customer Review'}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.2 rounded-full ${
                        r.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'Rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">"{r.comment}"</p>
                  <div className="text-[10px] text-slate-400">
                    By <span className="font-bold text-slate-600">{r.customerName}</span> on product <span className="font-bold text-purple">{r.productName}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReviewAction(r.id, 'Approved')}
                    className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReviewAction(r.id, 'Rejected')}
                    className="px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReviewAction(r.id, 'Hidden')}
                    className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold"
                  >
                    Hide
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. BANNERS SCREEN */}
      {subTab === 'banners' && (
        <div className="space-y-4">
          {/* Top Placement Segmented Switch & Size Guidance */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBannerPlacement('Home')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  bannerPlacement === 'Home'
                    ? 'bg-white text-purple shadow-xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Web / Desktop</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  bannerPlacement === 'Home' ? 'bg-purple/10 text-purple' : 'bg-slate-200 text-slate-500'
                }`}>
                  {banners.filter((b) => bannerPlacementOf(b) === 'Home').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBannerPlacement('Mobile')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  bannerPlacement === 'Mobile'
                    ? 'bg-white text-purple shadow-xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile App</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  bannerPlacement === 'Mobile' ? 'bg-purple/10 text-purple' : 'bg-slate-200 text-slate-500'
                }`}>
                  {banners.filter((b) => bannerPlacementOf(b) === 'Mobile').length}
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5">
              <span className="font-semibold text-slate-700">Recommended Size:</span>
              {bannerPlacement === 'Home' ? (
                <span className="text-purple font-mono font-bold">1920 × 600 px (Landscape)</span>
              ) : (
                <span className="text-purple font-mono font-bold">1080 × 1350 px or 750 × 400 px</span>
              )}
            </div>
          </div>

          {(() => {
            const placementBanners = banners.filter((b) => bannerPlacementOf(b) === bannerPlacement);
            if (placementBanners.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs p-12 text-center">
                  {bannerPlacement === 'Home' ? (
                    <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  ) : (
                    <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  )}
                  <div className="font-black text-sm text-navy">
                    No {bannerPlacement === 'Home' ? 'Web / Desktop' : 'Mobile App'} Banners Yet
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {isLoading
                      ? 'Loading banners...'
                      : `Add a banner to feature special promotions or announcements on the ${
                          bannerPlacement === 'Home' ? 'storefront homepage' : 'mobile app'
                        }.`}
                  </p>
                  {!isLoading && (
                    <button
                      onClick={() => {
                        setBannerFormData({ ...EMPTY_BANNER_FORM, placement: bannerPlacement });
                        setIsBannerModalOpen(true);
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold inline-flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First {bannerPlacement === 'Home' ? 'Web' : 'Mobile'} Banner</span>
                    </button>
                  )}
                </div>
              );
            }

            if (bannerPlacement === 'Home') {
              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {placementBanners.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                      <div className="relative aspect-[16/6] bg-slate-900 overflow-hidden group">
                        <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                        <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-navy/80 backdrop-blur-xs text-white text-[10px] font-bold">
                            Web Desktop
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-bold">
                            Order #{b.displayOrder ?? 1}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-xs ${
                              b.isActive !== false
                                ? 'bg-emerald-500/90 text-white'
                                : 'bg-slate-700/90 text-slate-200'
                            }`}
                          >
                            {b.isActive !== false ? 'Live' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <h3 className="font-black text-sm text-navy">{b.title}</h3>
                          {b.subtitle && <p className="text-xs text-slate-500 line-clamp-1">{b.subtitle}</p>}
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 text-slate-500 truncate mr-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Target:</span>
                            <span className="font-mono text-[11px] text-purple truncate max-w-[160px]">{b.targetUrl || '/'}</span>
                          </div>
                          {b.ctaText && (
                            <span className="px-2.5 py-1 rounded-lg bg-orange/10 text-orange font-bold text-[11px] flex-shrink-0">
                              {b.ctaText}
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setBannerFormData({ ...b, placement: bannerPlacementOf(b) });
                              setIsBannerModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteBannerTarget(b)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-red-500 hover:bg-red-50 text-xs font-bold flex items-center space-x-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {placementBanners.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                    <div className="relative aspect-[4/5] bg-slate-900 overflow-hidden group">
                      <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-purple/90 backdrop-blur-xs text-white text-[10px] font-bold flex items-center space-x-1">
                          <Smartphone className="w-3 h-3" />
                          <span>Mobile View</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-bold">
                          #{b.displayOrder ?? 1}
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-xs ${
                            b.isActive !== false
                              ? 'bg-emerald-500/90 text-white'
                              : 'bg-slate-700/90 text-slate-200'
                          }`}
                        >
                          {b.isActive !== false ? 'Live' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-xs text-navy truncate">{b.title}</h3>
                        {b.subtitle && <p className="text-[11px] text-slate-500 truncate">{b.subtitle}</p>}
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 truncate max-w-[120px] font-mono">{b.targetUrl || '/'}</span>
                        {b.ctaText && (
                          <span className="font-bold text-orange text-[10px] bg-orange/10 px-2 py-0.5 rounded">
                            {b.ctaText}
                          </span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => {
                            setBannerFormData({ ...b, placement: bannerPlacementOf(b) });
                            setIsBannerModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Edit Banner"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteBannerTarget(b)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          title="Delete Banner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* CATEGORY MODAL (create / edit — supports optional parent for sub-category deep links) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                {categoryFormData.id ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Category Name *</label>
                <input
                  type="text"
                  value={categoryFormData.name || ''}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      name: e.target.value,
                      // Auto-suggest the slug from the name only while the admin hasn't customized it
                      ...(isSlugTouched ? {} : { slug: slugifyCategoryName(e.target.value) })
                    })
                  }
                  placeholder="e.g. Aerial Repeaters"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Parent Category</label>
                <select
                  value={categoryFormData.parentCategoryId || ''}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, parentCategoryId: e.target.value || undefined })
                  }
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                >
                  <option value="">None (Top Level)</option>
                  {topLevelCategories
                    .filter((c) => c.id !== categoryFormData.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Category Slug</label>
                <input
                  type="text"
                  value={categoryFormData.slug || ''}
                  onChange={(e) => {
                    // Clearing the field hands slug generation back to the server (from the name)
                    setIsSlugTouched(e.target.value.trim().length > 0);
                    setCategoryFormData({ ...categoryFormData, slug: e.target.value });
                  }}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono text-purple outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Saved exactly as shown. Leave empty to auto-generate from the category name.
                </p>
              </div>

              <div>
                <label className="font-bold text-navy">Description</label>
                <textarea
                  rows={2}
                  value={categoryFormData.description || ''}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  placeholder="Brief description for SEO and catalog merchandising..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-navy flex items-center justify-between">
                  <span>Category Image (Google Drive or Web URL)</span>
                  <span className="text-[10px] text-purple font-semibold">Auto-converts Drive links</span>
                </label>
                <input
                  type="text"
                  value={categoryFormData.imageUrl || ''}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, imageUrl: e.target.value })}
                  placeholder="Paste Google Drive link (e.g. drive.google.com/file/d/...) or web URL..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports Google Drive sharing links. They automatically convert to direct high-res images.
                </p>
                {categoryFormData.imageUrl && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview</div>
                    <div className="h-28 rounded-lg overflow-hidden bg-slate-200">
                      <img
                        src={normalizeImageUrl(categoryFormData.imageUrl) || categoryFormData.imageUrl}
                        alt="Category Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  checked={categoryFormData.isActive ?? true}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                  className="accent-purple w-4 h-4"
                />
                <span className="font-bold text-navy">Category Active</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT CONFIRMATION */}
      <ErpConfirmDialog
        open={Boolean(deleteProductTarget)}
        title="Delete Product?"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-bold text-navy">"{deleteProductTarget?.name}"</span>
            {deleteProductTarget?.sku ? (
              <>
                {' '}(<span className="font-mono">{deleteProductTarget.sku}</span>)
              </>
            ) : null}
            ? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteProductTarget(null)}
      />

      {/* BANNER MODAL (create / edit — with Home/Mobile placement selector) */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                {bannerFormData.id
                  ? 'Edit Banner'
                  : `Create New ${bannerFormData.placement === 'Mobile' ? 'Mobile App' : 'Web / Desktop'} Banner`}
              </h3>
              <button onClick={() => setIsBannerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">Banner Title *</label>
                <input
                  type="text"
                  value={bannerFormData.title || ''}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, title: e.target.value })}
                  placeholder="e.g. Diwali Mega Sale"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Subtitle</label>
                <input
                  type="text"
                  value={bannerFormData.subtitle || ''}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, subtitle: e.target.value })}
                  placeholder="e.g. Up to 60% off on gift boxes"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Placement *</label>
                  <select
                    value={String(bannerFormData.placement || 'Home').toLowerCase() === 'mobile' ? 'Mobile' : 'Home'}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, placement: e.target.value })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  >
                    <option value="Home">Web / Desktop</option>
                    <option value="Mobile">Mobile App</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-navy">Display Order</label>
                  <input
                    type="number"
                    value={bannerFormData.displayOrder ?? 1}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, displayOrder: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none font-bold text-navy"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-navy flex items-center justify-between">
                  <span>Banner Image (Google Drive or Web URL) *</span>
                  <span className="text-[10px] text-purple font-semibold">Auto-converts Drive links</span>
                </label>
                <input
                  type="text"
                  value={bannerFormData.imageUrl || ''}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, imageUrl: e.target.value })}
                  placeholder="Paste Google Drive share link (e.g. drive.google.com/file/d/...) or web URL..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Recommended size for {bannerFormData.placement === 'Mobile' ? 'Mobile' : 'Web'}:{' '}
                  <span className="font-mono text-purple font-semibold">
                    {bannerFormData.placement === 'Mobile' ? '1080 × 1350 px or 750 × 400 px' : '1920 × 600 px'}
                  </span>
                </p>

                {/* Live Image Preview */}
                {bannerFormData.imageUrl && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Preview</div>
                    <div
                      className={`overflow-hidden rounded-lg bg-slate-200 ${
                        bannerFormData.placement === 'Mobile'
                          ? 'aspect-[4/5] max-h-44 mx-auto'
                          : 'aspect-[16/6] max-h-32'
                      }`}
                    >
                      <img
                        src={normalizeImageUrl(bannerFormData.imageUrl) || bannerFormData.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">Target URL</label>
                  <input
                    type="text"
                    value={bannerFormData.targetUrl || ''}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, targetUrl: e.target.value })}
                    placeholder="/products"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">CTA Text</label>
                  <input
                    type="text"
                    value={bannerFormData.ctaText || ''}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, ctaText: e.target.value })}
                    placeholder="Shop Now"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  checked={bannerFormData.isActive ?? true}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, isActive: e.target.checked })}
                  className="accent-purple w-4 h-4"
                />
                <span className="font-bold text-navy">Banner Live</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBanner}
                disabled={isSavingBanner}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 disabled:opacity-50"
              >
                {isSavingBanner ? 'Saving...' : 'Save Banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BANNER CONFIRMATION */}
      <ErpConfirmDialog
        open={Boolean(deleteBannerTarget)}
        title="Delete Banner?"
        message={
          <>
            Are you sure you want to delete banner{' '}
            <span className="font-bold text-navy">"{deleteBannerTarget?.title}"</span>? It will disappear from the
            storefront immediately. This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteBanner}
        onCancel={() => setDeleteBannerTarget(null)}
      />

      {/* DELETE CATEGORY CONFIRMATION */}
      <ErpConfirmDialog
        open={Boolean(deleteCategoryTarget)}
        title="Delete Category?"
        message={
          <>
            Are you sure you want to delete category{' '}
            <span className="font-bold text-navy">"{deleteCategoryTarget?.name}"</span>? Products and
            sub-categories under it may become uncategorized. This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCategoryTarget(null)}
      />
    </div>
  );
};
