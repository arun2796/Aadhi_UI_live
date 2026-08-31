import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Check,
  X,
  Layers,
  Edit2,
  FolderPlus,
  Sparkles,
  Filter
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpProductsPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState<boolean>(false);

  // New product state
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    sku: '',
    categoryId: '',
    price: 1999,
    compareAtPrice: 2499,
    costPrice: 1200,
    stockQuantity: 100,
    reorderLevel: 25,
    unit: 'Box',
    shortDescription: 'Festive Fireworks Pack',
    isBestSeller: true,
    isFeatured: true,
    primaryImageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'
  });

  // New category state
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: '',
    slug: '',
    description: '',
    displayOrder: 1,
    imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
    isActive: true
  });

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.getProducts(),
        api.getCategories(true)
      ]);
      setProducts(prods);
      setCategories(cats);
      if (cats.length > 0 && !newProduct.categoryId) {
        setNewProduct(prev => ({ ...prev, categoryId: cats[0].id }));
      }
    } catch (err) {
      console.error('Failed to load products or categories:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      showToast('Name and price are required', 'error');
      return;
    }

    const payload = {
      ...newProduct,
      categoryId: newProduct.categoryId || categories[0]?.id,
      sku: newProduct.sku || `PROD-${Date.now().toString().slice(-6)}`
    };

    try {
      const created = await api.createProduct(payload);
      if (created) {
        setProducts(prev => [created, ...prev]);
        setIsAddModalOpen(false);
        showToast(`Product "${created.name}" created successfully!`, 'success');
      }
    } catch {
      showToast('Failed to create product on live server', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name) {
      showToast('Category name is required', 'error');
      return;
    }

    const payload = {
      ...newCategory,
      slug: newCategory.slug || newCategory.name.toLowerCase().replace(/\s+/g, '-')
    };

    try {
      const created = await api.createCategory(payload);
      if (created) {
        setCategories(prev => [...prev, created]);
        setIsAddCategoryModalOpen(false);
        setNewCategory({
          name: '',
          slug: '',
          description: '',
          displayOrder: 1,
          imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
          isActive: true
        });
        showToast(`Category "${created.name}" created successfully!`, 'success');
      }
    } catch {
      showToast('Failed to create category', 'error');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast(`Product "${name}" deleted`, 'success');
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await api.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast(`Category "${name}" deleted`, 'success');
    } catch {
      showToast('Failed to delete category', 'error');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.categoryName || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategoryFilter === 'all' ||
      p.categoryId === selectedCategoryFilter ||
      p.categoryName?.toLowerCase() === selectedCategoryFilter.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Products & Catalog Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your dynamic fireworks catalogue, pricing, and product categories.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab Navigation Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeSubTab === 'products' ? 'bg-white text-navy shadow-xs' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products ({products.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('categories')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeSubTab === 'categories' ? 'bg-white text-navy shadow-xs' : 'text-slate-500 hover:text-navy'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categories ({categories.length})</span>
            </button>
          </div>

          {activeSubTab === 'products' ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddCategoryModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-light text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'products' ? (
        <>
          {/* Search and Category Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name, SKU, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.productCount || products.filter(p => p.categoryId === c.id).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Product Info</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Selling Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={p.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
                              alt=""
                              className="w-10 h-10 rounded-xl object-cover border border-slate-100 bg-slate-50 flex-shrink-0"
                            />
                            <div>
                              <div className="font-bold text-navy text-xs">{p.name}</div>
                              <div className="text-[10px] text-slate-400">{p.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{p.sku}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-[11px] text-slate-700">
                            {p.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-navy">
                          ₹{p.price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          <span className={p.availableQuantity <= p.reorderLevel ? 'text-red-600 font-black' : 'text-slate-700'}>
                            {p.availableQuantity} units
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No products found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Category Management View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((c) => {
              const productCount = products.filter(p => p.categoryId === c.id).length;
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-purple/30 transition-all"
                >
                  <div className="flex items-start space-x-3">
                    <img
                      src={c.imageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=300&auto=format&fit=crop&q=80'}
                      alt={c.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-100 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-navy truncate">{c.name}</h3>
                      <div className="text-[10px] font-mono text-slate-400 font-semibold">{c.slug}</div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {c.description || 'Festive crackers category'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-purple bg-purple/10 px-2 py-0.5 rounded-lg text-[11px]">
                      {productCount} Products
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Cracker Product" maxWidth="max-w-lg">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Name *</label>
              <input
                required
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="e.g. 1000 Wala Red Giant"
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">SKU (Auto or Custom)</label>
              <input
                type="text"
                value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                placeholder="e.g. GB-1000-WALA"
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Packaging Unit</label>
              <input
                type="text"
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                placeholder="e.g. Box (10 Pcs)"
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Selling Price (₹) *</label>
              <input
                required
                type="number"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">MRP Price (₹)</label>
              <input
                type="number"
                value={newProduct.compareAtPrice}
                onChange={(e) => setNewProduct({ ...newProduct, compareAtPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Initial Stock</label>
              <input
                type="number"
                value={newProduct.stockQuantity}
                onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Image URL</label>
            <input
              type="text"
              value={newProduct.primaryImageUrl}
              onChange={(e) => setNewProduct({ ...newProduct, primaryImageUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-orange"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-slate-500 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange hover:bg-orange-hover text-white font-bold rounded-xl shadow-glow"
            >
              Create Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal isOpen={isAddCategoryModalOpen} onClose={() => setIsAddCategoryModalOpen(false)} title="Create New Product Category" maxWidth="max-w-md">
        <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
            <input
              required
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="e.g. Multi-Color Sky Repeaters"
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Category Slug (URL Identifier)</label>
            <input
              type="text"
              value={newCategory.slug}
              onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
              placeholder="e.g. multi-color-sky-repeaters"
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={2}
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              placeholder="Brief summary of items in this category"
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Category Icon / Image URL</label>
            <input
              type="text"
              value={newCategory.imageUrl}
              onChange={(e) => setNewCategory({ ...newCategory, imageUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border focus:ring-1 focus:ring-purple"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAddCategoryModalOpen(false)}
              className="px-4 py-2 text-slate-500 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple hover:bg-purple-light text-white font-bold rounded-xl shadow-glow"
            >
              Create Category
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
