import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, RefreshCw, XCircle, Power, Layers } from 'lucide-react';
import { Category } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { flattenCategories } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';
import { ErpLoadingState } from '../../components/common/ErpLoadingState';

const PAGE_SIZE = 8;

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy outline-none focus:border-purple transition-colors';

/** Sub Categories management screen (design 05): list with parent category, CRUD + activate/deactivate. */
export const ErpSubCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [parentFilter, setParentFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Category>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const parentCategories = useMemo(
    () => allCategories.filter((c) => !c.parentCategoryId),
    [allCategories]
  );
  const subCategories = useMemo(
    () => allCategories.filter((c) => c.parentCategoryId),
    [allCategories]
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const cats = await api.getCategories(true);
      setAllCategories(flattenCategories(cats || []));
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load sub categories', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parentNameOf = (sub: Category) =>
    sub.parentCategoryName ||
    allCategories.find((c) => c.id === sub.parentCategoryId)?.name ||
    '—';

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subCategories
      .filter((sc) => {
        const matchesSearch =
          !q ||
          sc.name.toLowerCase().includes(q) ||
          (sc.description || '').toLowerCase().includes(q) ||
          parentNameOf(sc).toLowerCase().includes(q);
        const matchesParent = parentFilter === 'all' || sc.parentCategoryId === parentFilter;
        return matchesSearch && matchesParent;
      })
      // Group rows by parent category (design 05), then by display order / name within each group.
      .sort(
        (a, b) =>
          parentNameOf(a).localeCompare(parentNameOf(b)) ||
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories, searchQuery, parentFilter, allCategories]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, parentFilter]);

  const openCreateModal = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      parentCategoryId: parentFilter !== 'all' ? parentFilter : parentCategories[0]?.id || '',
      displayOrder: subCategories.length + 1,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sub: Category) => {
    setFormData({ ...sub });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showToast('Sub category name is required', 'warning');
      return;
    }
    if (!formData.parentCategoryId) {
      showToast('Please select a parent category', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Partial<Category> = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        imageUrl: formData.imageUrl,
        parentCategoryId: formData.parentCategoryId,
        displayOrder: formData.displayOrder ?? 1,
        isActive: formData.isActive ?? true
      };
      if (formData.id) {
        await api.updateCategory(formData.id, payload);
        showToast('Sub category updated successfully!', 'success');
      } else {
        await api.createCategory(payload);
        showToast('Sub category created successfully!', 'success');
      }
      setIsModalOpen(false);
      setFormData({});
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Error saving sub category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (sub: Category) => {
    try {
      await api.updateCategory(sub.id, {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        imageUrl: sub.imageUrl,
        parentCategoryId: sub.parentCategoryId,
        displayOrder: sub.displayOrder,
        isActive: !sub.isActive
      });
      showToast(`"${sub.name}" ${sub.isActive ? 'deactivated' : 'activated'}`, 'success');
      setAllCategories((prev) =>
        prev.map((c) => (c.id === sub.id ? { ...c, isActive: !sub.isActive } : c))
      );
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteCategory(deleteTarget.id);
      showToast(`Sub category "${deleteTarget.name}" removed`, 'info');
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to delete sub category', 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Sub Categories</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage second-level catalog hierarchy under each parent category.
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
          <button
            onClick={() => navigate('/admin/categories')}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        {/* Card header: Category filter + Add button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Category:</span>
            <select
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy outline-none"
            >
              <option value="all">All Categories</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sub Category</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2 w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sub categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <ErpLoadingState message="Loading sub categories..." height="h-64" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Sub Category Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No sub categories found.
                    </td>
                  </tr>
                )}
                {paged.map((sc) => (
                  <tr key={sc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-navy">{sc.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[10px] font-bold">
                        {parentNameOf(sc)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{sc.description || '—'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(sc)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Edit Sub Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(sc)}
                          className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 ${
                            sc.isActive ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                          title={sc.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(sc)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          title="Delete Sub Category"
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
        )}

        {!isLoading && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        )}
      </div>

      {/* CREATE / EDIT SUB CATEGORY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                {formData.id ? 'Edit Sub Category' : 'Add Sub Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy">
                  Sub Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                    })
                  }
                  placeholder="e.g. Electric Sparklers"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="font-bold text-navy">
                  Parent Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.parentCategoryId || ''}
                  onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select Parent Category</option>
                  {parentCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-navy">Description</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this sub category..."
                  className={inputCls}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  checked={formData.isActive ?? true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="accent-purple w-4 h-4"
                />
                <span className="font-bold text-navy">Sub Category Active</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Sub Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      <ErpConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Sub Category?"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-bold text-navy">"{deleteTarget?.name}"</span> under{' '}
            <span className="font-bold text-navy">{deleteTarget ? parentNameOf(deleteTarget) : ''}</span>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ErpSubCategoriesPage;
