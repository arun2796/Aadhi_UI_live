import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Tag,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ArrowUpDown,
  Upload,
  RefreshCw,
  Gift,
  Boxes,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { Product, Category, Brand, GiftBox, ComboOffer, ProductReview, HomepageBanner } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpCatalogModuleProps {
  initialSubTab?: 'products' | 'categories' | 'combos' | 'reviews' | 'banners';
}

export const ErpCatalogModule: React.FC<ErpCatalogModuleProps> = ({
  initialSubTab = 'products'
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'products' | 'categories' | 'combos' | 'reviews' | 'banners'>(initialSubTab);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [giftBoxes, setGiftBoxes] = useState<GiftBox[]>([]);
  const [combos, setCombos] = useState<ComboOffer[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [banners, setBanners] = useState<HomepageBanner[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Product Creation / Edit Modal state (Multi-step Form)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productFormStep, setProductFormStep] = useState(1);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState<Partial<Category>>({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 1,
    isActive: true
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, cats, brs, gbs, cmbs, revs, bans] = await Promise.all([
        api.getProducts(),
        api.getCategories(true),
        api.getBrands(),
        api.getGiftBoxes(),
        api.getComboOffers(),
        api.getProductReviews(),
        api.getHomepageBanners()
      ]);
      setProducts(prods);
      setCategories(cats);
      setBrands(brs);
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

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' ||
      p.categoryId === selectedCategoryFilter ||
      p.categoryName?.toLowerCase() === selectedCategoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Handle Product Save (Multi-Step Form)
  const handleSaveProduct = async () => {
    if (!editingProduct?.name || !editingProduct?.sku || !editingProduct?.price) {
      showToast('Please fill in required fields (Name, SKU, Price)', 'warning');
      return;
    }

    try {
      if (editingProduct.id) {
        await api.updateProduct(editingProduct.id, editingProduct);
        showToast('Product updated successfully!', 'success');
      } else {
        await api.createProduct(editingProduct);
        showToast('Product created successfully!', 'success');
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      loadData();
    } catch {
      showToast('Error saving product', 'error');
    }
  };

  // Handle Category Save
  const handleSaveCategory = async () => {
    if (!categoryFormData.name?.trim()) {
      showToast('Category name is required', 'warning');
      return;
    }
    try {
      if (categoryFormData.id) {
        await api.updateCategory(categoryFormData.id, categoryFormData);
        showToast('Category updated successfully!', 'success');
      } else {
        await api.createCategory(categoryFormData);
        showToast('Category created successfully!', 'success');
      }
      setIsCategoryModalOpen(false);
      setCategoryFormData({ name: '', slug: '', description: '', imageUrl: '', displayOrder: 1, isActive: true });
      loadData();
    } catch {
      showToast('Error saving category', 'error');
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
            <span>Catalog & Merchandising</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage live products, categories, gift boxes, combo bundles, customer reviews, and promotional banners.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {subTab === 'products' && (
            <button
              onClick={() => {
                setEditingProduct({
                  name: '',
                  sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                  price: 999,
                  costPrice: 650,
                  taxRate: 18,
                  stockQuantity: 50,
                  reorderLevel: 10,
                  unit: 'Box',
                  isActive: true,
                  isFeatured: false,
                  productType: 'Standard',
                  categoryId: categories[0]?.id || ''
                });
                setProductFormStep(1);
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-orange/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}

          {subTab === 'categories' && (
            <button
              onClick={() => {
                setCategoryFormData({
                  name: '',
                  slug: '',
                  description: '',
                  imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80',
                  displayOrder: categories.length + 1,
                  isActive: true
                });
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'products', label: `Products (${products.length})`, icon: Package },
          { id: 'categories', label: `Categories (${categories.length})`, icon: Layers },
          { id: 'combos', label: `Gift Boxes & Combos (${giftBoxes.length + combos.length})`, icon: Gift },
          { id: 'reviews', label: `Reviews & Moderation (${reviews.length})`, icon: Star },
          { id: 'banners', label: `Homepage Banners (${banners.length})`, icon: ImageIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. PRODUCTS TAB */}
      {subTab === 'products' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by product name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">Category:</span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-navy outline-none"
              >
                <option value="all">All Categories ({products.length})</option>
                {categories.map((c) => (
                  <option key={c.id || c.slug} value={c.id || c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                    <th className="py-3 px-3">Selling Price</th>
                    <th className="py-3 px-3">Stock Available</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredProducts.map((p) => (
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
                          {p.categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-navy text-xs">₹{p.price.toLocaleString('en-IN')}</div>
                        {p.costPrice && <div className="text-[10px] text-slate-400">Cost: ₹{p.costPrice}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.availableQuantity > 10 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                            }`}
                          />
                          <span className="font-bold text-navy">{p.availableQuantity || p.stockQuantity} units</span>
                        </div>
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
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setProductFormStep(1);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES TAB */}
      {subTab === 'categories' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <div
                key={c.id || c.slug}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-3">
                  <img
                    src={c.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=200&auto=format&fit=crop&q=80'}
                    alt={c.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                  />
                  <div>
                    <h3 className="font-bold text-xs text-navy">{c.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">/{c.slug}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[10px] font-bold">
                      {c.productCount || 0} Products
                    </span>
                  </div>
                </div>

                {c.description && <p className="text-[11px] text-slate-500 line-clamp-2">{c.description}</p>}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Order: #{c.displayOrder}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setCategoryFormData(c);
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-1 text-slate-500 hover:text-purple"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete category "${c.name}"?`)) {
                          await api.deleteCategory(c.id);
                          showToast('Category removed', 'info');
                          loadData();
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. GIFT BOXES & COMBOS TAB */}
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

      {/* 4. REVIEWS & MODERATION TAB */}
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

      {/* 5. HOMEPAGE BANNERS TAB */}
      {subTab === 'banners' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <img src={b.imageUrl} alt={b.title} className="w-full h-36 object-cover" />
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-navy">{b.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      Live
                    </span>
                  </div>
                  {b.subtitle && <p className="text-xs text-slate-500">{b.subtitle}</p>}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>Target: {b.targetUrl}</span>
                    <span className="font-bold text-orange">CTA: {b.ctaText}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MULTI-STEP PRODUCT CREATION / EDIT MODAL */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                  {editingProduct.id ? 'Edit Product' : 'Add New Product (Multi-Step)'}
                </h3>
                <div className="text-[10px] text-slate-400">Step {productFormStep} of 3</div>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="px-6 pt-3 flex items-center space-x-2">
              {['1. Basic Info & Category', '2. Pricing & Tax', '3. Stock & Safety'].map((lbl, idx) => (
                <button
                  key={idx}
                  onClick={() => setProductFormStep(idx + 1)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center border transition-all ${
                    productFormStep === idx + 1
                      ? 'bg-orange text-white border-orange shadow-2xs'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {/* Modal Form Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              {/* Step 1: Basic Info & Category */}
              {productFormStep === 1 && (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-navy">Product Name *</label>
                    <input
                      type="text"
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      placeholder="e.g. Aadhi Deluxe 30 Shots"
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-navy">SKU Code *</label>
                      <input
                        type="text"
                        value={editingProduct.sku || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none focus:border-orange"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-navy">Category *</label>
                      <select
                        value={editingProduct.categoryId || ''}
                        onChange={(e) => {
                          const cat = categories.find((c) => c.id === e.target.value);
                          setEditingProduct({
                            ...editingProduct,
                            categoryId: e.target.value,
                            categoryName: cat?.name || ''
                          });
                        }}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      >
                        {categories.map((c) => (
                          <option key={c.id || c.slug} value={c.id || c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-navy">Short Description</label>
                    <textarea
                      rows={2}
                      value={editingProduct.shortDescription || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, shortDescription: e.target.value })}
                      placeholder="Brief highlight of the firecracker effect..."
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-navy">Primary Image URL</label>
                    <input
                      type="text"
                      value={editingProduct.primaryImageUrl || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, primaryImageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Pricing & Tax */}
              {productFormStep === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-navy">Selling Price (₹) *</label>
                      <input
                        type="number"
                        value={editingProduct.price || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange font-bold text-navy"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-navy">Cost Price (₹) *</label>
                      <input
                        type="number"
                        value={editingProduct.costPrice || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-navy">Compare at Price / MRP (₹)</label>
                      <input
                        type="number"
                        value={editingProduct.compareAtPrice || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, compareAtPrice: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-navy">GST Tax Rate (%)</label>
                      <input
                        type="number"
                        value={editingProduct.taxRate || 18}
                        onChange={(e) => setEditingProduct({ ...editingProduct, taxRate: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                    Calculated Gross Profit Margin: <span className="font-bold">
                      ₹{((editingProduct.price || 0) - (editingProduct.costPrice || 0)).toLocaleString('en-IN')} (
                      {editingProduct.price ? Math.round((((editingProduct.price - (editingProduct.costPrice || 0)) / editingProduct.price) * 100)) : 0}%
                    )</span>
                  </div>
                </div>
              )}

              {/* Step 3: Stock & Safety */}
              {productFormStep === 3 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-navy">Initial Stock Quantity</label>
                      <input
                        type="number"
                        value={editingProduct.stockQuantity || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, stockQuantity: Number(e.target.value), availableQuantity: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-navy">Reorder Level Threshold</label>
                      <input
                        type="number"
                        value={editingProduct.reorderLevel || 10}
                        onChange={(e) => setEditingProduct({ ...editingProduct, reorderLevel: Number(e.target.value) })}
                        className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-navy">Safety & Lighting Instructions</label>
                    <textarea
                      rows={2}
                      value={editingProduct.safetyInformation || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, safetyInformation: e.target.value })}
                      placeholder="e.g. Maintain 5m distance. Light only using an agarbatti or incense stick outdoors."
                      className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-orange"
                    />
                  </div>

                  <div className="flex items-center space-x-4 pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.isActive ?? true}
                        onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                        className="accent-orange w-4 h-4"
                      />
                      <span className="font-bold text-navy">Active in Store</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.isFeatured ?? false}
                        onChange={(e) => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                        className="accent-orange w-4 h-4"
                      />
                      <span className="font-bold text-navy">Featured on Homepage</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              {productFormStep > 1 ? (
                <button
                  onClick={() => setProductFormStep((p) => p - 1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold"
                >
                  &larr; Back
                </button>
              ) : (
                <div />
              )}

              {productFormStep < 3 ? (
                <button
                  onClick={() => setProductFormStep((p) => p + 1)}
                  className="px-5 py-2 rounded-xl bg-navy text-white text-xs font-bold hover:bg-navy-dark"
                >
                  Continue &rarr;
                </button>
              ) : (
                <button
                  onClick={handleSaveProduct}
                  className="px-6 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-black uppercase tracking-wider shadow-md shadow-orange/20"
                >
                  Save Product
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
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
                      slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                    })
                  }
                  placeholder="e.g. Aerial Repeaters"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Category Slug</label>
                <input
                  type="text"
                  value={categoryFormData.slug || ''}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, slug: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono text-purple outline-none"
                />
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
                <label className="font-bold text-navy">Image URL</label>
                <input
                  type="text"
                  value={categoryFormData.imageUrl || ''}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
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
    </div>
  );
};
