import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Check,
  X,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { Product, Category } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

export const ErpProductsPage: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New product state
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    sku: '',
    categoryId: 'cat-6',
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

  useEffect(() => {
    api.getProducts().then(setProducts);
    api.getCategories().then(setCategories);
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    try {
      const created = await api.createProduct(newProduct);
      setProducts([created, ...products]);
      setIsAddModalOpen(false);
      showToast(`Product "${created.name}" created successfully!`, 'success');
    } catch {
      showToast('Failed to create product', 'error');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Products & Gift Boxes Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKUs, retail pricing, wholesale costs, tax rates, and stock thresholds.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center space-x-1.5 shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by SKU, name, or category..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Total Products: <strong className="text-navy">{filtered.length}</strong>
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
                <th className="py-3 px-4">Retail Price</th>
                <th className="py-3 px-4">Cost Price</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={prod.primaryImageUrl || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-white border flex-shrink-0"
                      />
                      <div>
                        <div className="font-bold text-navy">{prod.name}</div>
                        <div className="text-[10px] text-slate-400">{prod.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-600">{prod.sku}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{prod.categoryName}</td>
                  <td className="py-3 px-4 font-black text-navy">₹{prod.price.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-slate-500">₹{prod.costPrice.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4">
                    {prod.availableQuantity <= prod.reorderLevel ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        Low ({prod.availableQuantity})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        In Stock ({prod.availableQuantity})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => showToast(`Edit modal for ${prod.name}`, 'info')}
                      className="p-1.5 text-slate-400 hover:text-navy rounded-lg hover:bg-slate-100"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Fireworks Product"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
              <input
                required
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="e.g. Royal Diwali Assortment Box"
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">SKU *</label>
              <input
                required
                type="text"
                value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                placeholder="GB-ROY-99"
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Unit / Packaging *</label>
              <input
                type="text"
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                placeholder="Box (50 Pcs)"
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Retail Price (₹) *</label>
              <input
                required
                type="number"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Cost Price (₹) *</label>
              <input
                required
                type="number"
                value={newProduct.costPrice}
                onChange={(e) => setNewProduct({ ...newProduct, costPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Initial Stock *</label>
              <input
                required
                type="number"
                value={newProduct.stockQuantity}
                onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Reorder Level *</label>
              <input
                required
                type="number"
                value={newProduct.reorderLevel}
                onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Image URL</label>
            <input
              type="text"
              value={newProduct.primaryImageUrl}
              onChange={(e) => setNewProduct({ ...newProduct, primaryImageUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-orange"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-slate-500 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-orange hover:bg-orange-hover text-white font-bold rounded-xl shadow-glow transition-all"
            >
              Create Product
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
