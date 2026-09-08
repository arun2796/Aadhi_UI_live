import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Trash2,
  Plus,
  ImageIcon,
  Link as LinkIcon,
  Wand2,
  X,
  Sparkles
} from 'lucide-react';
import { Product, Category, Brand } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { brandApi } from '../../services/brandApi';
import { flattenCategories } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ErpLoadingState } from '../../components/common/ErpLoadingState';

interface ErpProductFormPageProps {
  productId?: string;
}

/** Local form model — extends Product with fields not yet in the shared type. */
type ProductFormState = Partial<Product> & {
  metaTitle?: string;
  metaDescription?: string;
};

interface GalleryImage {
  id?: string;
  url: string;
  isPrimary: boolean;
}

/** Fields the form can highlight inline when the server returns field-level validation errors. */
type ServerFieldKey = 'name' | 'sku' | 'description' | 'price';
const SERVER_FIELD_KEYS: ServerFieldKey[] = ['name', 'sku', 'description', 'price'];

const getServerErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } } | null)
    ?.response?.data;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  const { message } = getApiErrorDetails(error);
  return message || fallback;
};

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy outline-none focus:border-purple transition-colors';

const RequiredMark = () => <span className="text-red-500"> *</span>;

export const ErpProductFormPage: React.FC<ErpProductFormPageProps> = ({ productId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = Boolean(productId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [form, setForm] = useState<ProductFormState>({
    name: '',
    sku: '',
    description: '',
    price: 0,
    compareAtPrice: 0,
    costPrice: 0,
    taxRate: 0,
    stockQuantity: 9999,
    reorderLevel: 10,
    unit: 'Box',
    isActive: true,
    isFeatured: false,
    productType: 'Simple'
  });
  const [topCategoryId, setTopCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // Inline Brand creation modal state
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDesc, setNewBrandDesc] = useState('');
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  // Product Image Google Drive helpers
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [galleryBatchUrls, setGalleryBatchUrls] = useState('');

  // Inline field errors
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ServerFieldKey, string>>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const topCategories = allCategories.filter((c) => !c.parentCategoryId);
  const subCategories = allCategories.filter((c) => c.parentCategoryId === topCategoryId);
  const primaryImage = gallery.find((g) => g.isPrimary) || gallery[0];

  const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const errKey = key as string;
    if ((SERVER_FIELD_KEYS as string[]).includes(errKey)) {
      setFieldErrors((prev) =>
        prev[errKey as ServerFieldKey] ? { ...prev, [errKey]: undefined } : prev
      );
    }
  };

  const fieldCls = (key: ServerFieldKey) =>
    `${inputCls}${fieldErrors[key] ? ' border-red-400! focus:border-red-400!' : ''}`;

  const focusField = useCallback((key: ServerFieldKey) => {
    requestAnimationFrame(() => {
      const refs: Record<ServerFieldKey, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
        name: nameRef,
        sku: skuRef,
        description: descriptionRef,
        price: priceRef
      };
      refs[key]?.current?.focus();
      refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  // ---- Data Loading ------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [catsRes, brandsRes, product] = await Promise.all([
          api.getCategories(true),
          brandApi.getBrands(),
          productId ? api.getProductById(productId) : Promise.resolve(undefined)
        ]);
        if (!isMounted) return;

        const flat = flattenCategories(catsRes);
        setAllCategories(flat);
        setBrands(brandsRes || []);

        if (isEdit && product) {

          setForm({
            ...product,
            price: product.price ?? 0,
            compareAtPrice: product.compareAtPrice ?? 0,
            costPrice: product.costPrice ?? 0,
            stockQuantity: product.stockQuantity ?? 9999,
            reorderLevel: product.reorderLevel ?? 10,
            unit: product.unit || 'Box',
            isActive: product.isActive ?? true,
            isFeatured: product.isFeatured ?? false,
            productType: product.productType || 'Simple'
          });

          // Resolve Category & Sub Category
          if (product.categoryId) {
            const currentCat = flat.find((c) => c.id === product.categoryId);
            if (currentCat?.parentCategoryId) {
              setTopCategoryId(currentCat.parentCategoryId);
              setSubCategoryId(currentCat.id);
            } else {
              setTopCategoryId(product.categoryId);
            }
          }

          // Build gallery
          const imgs: GalleryImage[] = (product.images || []).map((img) => ({
            id: img.id,
            url: normalizeImageUrl(img.url) ?? img.url,
            isPrimary: Boolean(img.isPrimary)
          }));
          if (imgs.length === 0 && product.primaryImageUrl) {
            imgs.push({
              url: normalizeImageUrl(product.primaryImageUrl) ?? product.primaryImageUrl,
              isPrimary: true
            });
          }
          if (imgs.length > 0 && !imgs.some((g) => g.isPrimary)) {
            imgs[0].isPrimary = true;
          }
          setGallery(imgs);
        }
      } catch (error) {
        showToast(getServerErrorMessage(error, 'Failed to load form data'), 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFormData();
    return () => {
      isMounted = false;
    };
  }, [productId, isEdit]);

  // ---- Image Handling ----------------------------------------------------

  const setPrimaryImageUrl = (rawUrl: string) => {
    if (!rawUrl.trim()) return;
    const normalized = normalizeImageUrl(rawUrl.trim()) ?? rawUrl.trim();
    setGallery((prev) => {
      const existing = prev.find((g) => g.url === normalized);
      if (existing) {
        return prev.map((g) => ({ ...g, isPrimary: g.url === normalized }));
      }
      return [{ url: normalized, isPrimary: true }, ...prev.map((g) => ({ ...g, isPrimary: false }))];
    });
    setImageUrlInput('');
    showToast('Primary image updated!', 'success');
  };

  const addMultipleGalleryUrls = (urlsText: string) => {
    if (!urlsText.trim()) return;
    const tokens = urlsText
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tokens.length === 0) return;

    let addedCount = 0;
    setGallery((prev) => {
      const current = [...prev];
      for (const token of tokens) {
        const url = normalizeImageUrl(token) ?? token;
        if (!current.some((g) => g.url === url)) {
          current.push({ url, isPrimary: current.length === 0 });
          addedCount++;
        }
      }
      return current;
    });

    if (addedCount > 0) {
      showToast(`Added ${addedCount} image${addedCount > 1 ? 's' : ''} to gallery`, 'success');
    } else {
      showToast('Image already in gallery', 'info');
    }
  };

  const markPrimary = (index: number) => {
    setGallery((prev) => prev.map((g, i) => ({ ...g, isPrimary: i === index })));
  };

  const removeImage = (index: number) => {
    setGallery((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((g) => g.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  // ---- Brand Helper ------------------------------------------------------

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) {
      showToast('Brand name is required', 'warning');
      return;
    }
    setIsCreatingBrand(true);
    try {
      const created = await brandApi.createBrand({
        name: newBrandName.trim(),
        description: newBrandDesc.trim() || undefined
      });
      if (created) {
        setBrands((prev) => [...prev, created]);
        setForm((prev) => ({
          ...prev,
          brandId: created.id,
          brandName: created.name
        }));
        showToast(`Brand "${created.name}" created and selected!`, 'success');
        setNewBrandName('');
        setNewBrandDesc('');
        setShowAddBrandModal(false);
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to create brand', 'error');
    } finally {
      setIsCreatingBrand(false);
    }
  };

  // ---- SKU Auto Generator ------------------------------------------------

  const generateAutoSku = () => {
    const cat = allCategories.find((c) => c.id === (subCategoryId || topCategoryId));
    const catPrefix = cat
      ? cat.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
      : 'AC';
    const namePrefix = form.name
      ? form.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
      : 'CK';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    const sku = `${catPrefix || 'AC'}-${namePrefix || 'CK'}-${randomDigits}`;
    setField('sku', sku);
  };

  // ---- Save -------------------------------------------------------------

  const handleSave = async () => {
    setFieldErrors({});
    if (!form.name?.trim()) {
      setFieldErrors({ name: 'Product Name is required' });
      showToast('Product Name is required', 'warning');
      focusField('name');
      return;
    }
    if (!form.sku?.trim()) {
      setFieldErrors({ sku: 'SKU is required' });
      showToast('SKU is required', 'warning');
      focusField('sku');
      return;
    }
    if (!topCategoryId) {
      showToast('Please select a Category', 'warning');
      return;
    }
    if (subCategories.length > 0 && !subCategoryId) {
      showToast('Please select a Sub Category', 'warning');
      return;
    }
    if (!form.description?.trim()) {
      setFieldErrors({ description: 'Description is required' });
      showToast('Description is required', 'warning');
      focusField('description');
      return;
    }
    const numericPrice = Number(form.price);
    if (!numericPrice || numericPrice <= 0) {
      setFieldErrors({ price: 'Selling Price must be greater than 0' });
      showToast('Selling Price is required', 'warning');
      focusField('price');
      return;
    }

    const finalCategoryId = subCategoryId || topCategoryId;
    const finalCategory = allCategories.find((c) => c.id === finalCategoryId);
    const primary = gallery.find((g) => g.isPrimary) || gallery[0];

    const { metaTitle: _metaTitle, metaDescription: _metaDescription, ...persistedForm } = form;

    const payload: ProductFormState = {
      ...persistedForm,
      price: numericPrice,
      compareAtPrice: persistedForm.compareAtPrice ? Number(persistedForm.compareAtPrice) : undefined,
      costPrice: persistedForm.costPrice ? Number(persistedForm.costPrice) : 0,
      taxRate: 0,
      stockQuantity: (persistedForm.stockQuantity && persistedForm.stockQuantity > 0) ? persistedForm.stockQuantity : 9999,
      reorderLevel: persistedForm.reorderLevel ?? 10,
      isActive: persistedForm.isActive ?? true,
      isFeatured: persistedForm.isFeatured ?? false,
      categoryId: finalCategoryId,
      categoryName: finalCategory?.name || form.categoryName,
      primaryImageUrl: primary?.url || form.primaryImageUrl,
      images: gallery.map((g, i) => ({
        id: g.id || '',
        url: g.url,
        altText: form.name,
        sortOrder: i,
        isPrimary: Boolean(g.isPrimary)
      }))
    };

    setIsSaving(true);
    try {
      if (isEdit && productId) {
        await api.updateProduct(productId, payload);
        showToast('Product updated successfully!', 'success');
      } else {
        await api.createProduct(payload);
        showToast('Product created successfully!', 'success');
      }
      navigate('/admin/products');
    } catch (error) {
      const data = (error as { response?: { data?: { errors?: unknown } } } | null)?.response?.data;
      const validationErrors =
        data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)
          ? (data.errors as Record<string, unknown>)
          : undefined;

      let toastMessage: string | undefined;
      if (validationErrors) {
        const [field, messages] = Object.entries(validationErrors)[0] ?? [];
        const firstMessage = Array.isArray(messages)
          ? String(messages[0] ?? '')
          : typeof messages === 'string'
          ? messages
          : '';
        if (field && firstMessage) {
          toastMessage = firstMessage;
          const key = field.toLowerCase() as ServerFieldKey;
          if (SERVER_FIELD_KEYS.includes(key)) {
            setFieldErrors((prev) => ({ ...prev, [key]: firstMessage }));
            focusField(key);
          }
        }
      }

      showToast(toastMessage || getServerErrorMessage(error, 'Error saving product'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Pricing calculations
  const sellingPrice = Number(form.price) || 0;
  const costPrice = Number(form.costPrice) || 0;
  const profitMargin = sellingPrice > 0 ? sellingPrice - costPrice : 0;
  const profitPercent = sellingPrice > 0 ? Math.round((profitMargin / sellingPrice) * 100) : 0;

  if (isLoading) {
    return <ErpLoadingState message="Loading product form..." height="h-96" />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin/products')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
            title="Back to Products"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-navy tracking-tight">
              {isEdit ? 'Edit Product' : 'Add Product'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `Update details for ${form.name || 'this product'}${form.sku ? ` (${form.sku})` : ''}.`
                : 'Create and publish a new product in the live catalog.'}
            </p>
          </div>
        </div>
      </div>

      {/* Unified Single-Page Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Product Information & Pricing (7 cols) */}
            <div className="lg:col-span-7 space-y-5 text-xs">
              {/* Product Name */}
              <div>
                <label className="font-bold text-navy">
                  Product Name
                  <RequiredMark />
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Aadhi Deluxe 30 Shots"
                  className={fieldCls('name')}
                />
                {fieldErrors.name && (
                  <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* SKU with Auto-SKU button */}
              <div>
                <label className="font-bold text-navy">
                  SKU
                  <RequiredMark />
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    ref={skuRef}
                    type="text"
                    value={form.sku || ''}
                    onChange={(e) => setField('sku', e.target.value.toUpperCase())}
                    placeholder="e.g. AC-SP-010"
                    className={`${fieldCls('sku')} font-mono uppercase flex-1`}
                  />
                  <button
                    type="button"
                    onClick={generateAutoSku}
                    className="mt-1 px-3 py-2.5 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/10 text-purple text-xs font-bold shrink-0 transition-colors flex items-center space-x-1.5"
                    title="Auto generate unique SKU"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto SKU</span>
                  </button>
                </div>
                {fieldErrors.sku && (
                  <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.sku}</p>
                )}
              </div>

              {/* Category & Sub Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-navy">
                    Category
                    <RequiredMark />
                  </label>
                  <select
                    value={topCategoryId}
                    onChange={(e) => {
                      setTopCategoryId(e.target.value);
                      setSubCategoryId('');
                    }}
                    className={inputCls}
                  >
                    <option value="">Select Category</option>
                    {topCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-navy">
                    Sub Category
                    <RequiredMark />
                  </label>
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    disabled={!topCategoryId || subCategories.length === 0}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <option value="">
                      {!topCategoryId
                        ? 'Select Category first'
                        : subCategories.length === 0
                        ? 'No sub categories'
                        : 'Select Sub Category'}
                    </option>
                    {subCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Brand Selection with Inline Add Brand button */}
              <div>
                <label className="font-bold text-navy">Brand</label>
                <div className="flex items-center space-x-2">
                  <select
                    value={form.brandId || ''}
                    onChange={(e) => {
                      const brand = brands.find((b) => b.id === e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        brandId: e.target.value || undefined,
                        brandName: brand?.name
                      }));
                    }}
                    className={`${inputCls} flex-1`}
                  >
                    <option value="">Select Brand (Optional)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddBrandModal(true)}
                    className="mt-1 px-3 py-2.5 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/15 text-purple shadow-2xs shrink-0 transition-colors flex items-center space-x-1"
                    title="Add new Brand dynamically"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-bold">Add Brand</span>
                  </button>
                </div>
              </div>

              {/* Pricing & Profitability Card */}
              <div className="p-4 rounded-2xl bg-purple/5 border border-purple/15 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-navy flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple" />
                    <span>Pricing</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-purple/10">
                    GST 0% Inclusive
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-navy">
                      Selling Price (₹)
                      <RequiredMark />
                    </label>
                    <input
                      ref={priceRef}
                      type="number"
                      min={0}
                      value={form.price ? form.price : ''}
                      placeholder="e.g. 300"
                      onChange={(e) => setField('price', e.target.value === '' ? ('' as any) : Number(e.target.value))}
                      className={`${fieldCls('price')} font-bold text-navy bg-white`}
                    />
                    {fieldErrors.price && (
                      <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.price}</p>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-navy">MRP / Compare at (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.compareAtPrice ? form.compareAtPrice : ''}
                      placeholder="e.g. 500"
                      onChange={(e) => setField('compareAtPrice', e.target.value === '' ? ('' as any) : Number(e.target.value))}
                      className={`${inputCls} bg-white`}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-navy">Cost Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.costPrice ? form.costPrice : ''}
                      placeholder="e.g. 200"
                      onChange={(e) => setField('costPrice', e.target.value === '' ? ('' as any) : Number(e.target.value))}
                      className={`${inputCls} bg-white`}
                    />
                  </div>
                </div>

                {/* Profit Margin Indicator */}
                {sellingPrice > 0 && costPrice > 0 && (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center justify-between">
                    <span>Gross Profit Margin:</span>
                    <span className="font-black text-xs">
                      ₹{profitMargin.toLocaleString('en-IN')} ({profitPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-navy">
                  Description
                  <RequiredMark />
                </label>
                <textarea
                  ref={descriptionRef}
                  rows={4}
                  value={form.description || ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Describe the firecracker effect, contents and safety guidelines..."
                  className={fieldCls('description')}
                />
                {fieldErrors.description && (
                  <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.description}</p>
                )}
              </div>

              {/* Short Description */}
              <div>
                <label className="font-bold text-navy">Short Description</label>
                <input
                  type="text"
                  value={form.shortDescription || ''}
                  onChange={(e) => setField('shortDescription', e.target.value)}
                  placeholder="One-line summary shown on product cards and listings..."
                  className={inputCls}
                />
              </div>

              {/* Status Toggle (Active / Inactive) */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <div className="font-bold text-navy">Catalog Visibility</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {form.isActive ?? true
                      ? 'Product is active, visible, and purchasable by customers.'
                      : 'Product is hidden from the store catalog.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive ?? true}
                  onClick={() => setField('isActive', !(form.isActive ?? true))}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <span
                    className={`text-[10px] font-bold ${
                      form.isActive ?? true ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {form.isActive ?? true ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      form.isActive ?? true ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${
                        form.isActive ?? true ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Product Imagery (5 cols) */}
            <div className="lg:col-span-5 space-y-5 text-xs">
              <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-navy flex items-center space-x-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-purple" />
                    <span>Product Imagery</span>
                  </h3>
                  <span className="text-[10px] font-bold text-purple bg-purple/10 px-2.5 py-0.5 rounded-full">
                    {gallery.length} in Gallery
                  </span>
                </div>

                {/* Primary Preview Card */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden relative shadow-2xs">
                  {primaryImage ? (
                    <div className="relative">
                      <img
                        src={primaryImage.url}
                        alt="Product preview"
                        className="w-full h-52 object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 px-2.5 py-1 rounded-md bg-purple/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-xs">
                        <Star className="w-3 h-3 fill-current text-gold" />
                        <span>Primary Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 min-h-48 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-2 shadow-2xs">
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-navy">No Primary Image Set</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                        Paste a Google Drive image link below to set the primary image
                      </p>
                    </div>
                  )}
                </div>

                {/* Google Drive Link Input for Primary Image */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy flex items-center justify-between">
                    <span>Set Primary Image</span>
                    <span className="text-[10px] text-purple font-semibold">Auto-converts Drive links</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl focus-within:border-purple transition-all">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="Paste Google Drive share link..."
                        className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (imageUrlInput.trim()) setPrimaryImageUrl(imageUrlInput.trim());
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (imageUrlInput.trim()) setPrimaryImageUrl(imageUrlInput.trim());
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-all flex-shrink-0 shadow-xs"
                    >
                      Set Primary
                    </button>
                  </div>
                </div>

                {/* Gallery Images Section */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-navy">Gallery Images</span>
                    <span className="text-[10px] text-slate-400">Click any thumbnail to set as primary</span>
                  </div>

                  {/* Thumbnail Row / Grid */}
                  {gallery.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {gallery.map((img, idx) => (
                        <div
                          key={`${img.url.slice(0, 64)}-${idx}`}
                          className="relative group rounded-xl overflow-hidden border-2 bg-white aspect-square"
                          style={{ borderColor: img.isPrimary ? '#6366f1' : '#e2e8f0' }}
                        >
                          <button
                            type="button"
                            onClick={() => markPrimary(idx)}
                            className="w-full h-full block"
                            title={img.isPrimary ? 'Current primary image' : 'Click to set as primary'}
                          >
                            <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                          {img.isPrimary && (
                            <div className="absolute top-1 left-1 p-0.5 rounded bg-purple text-white">
                              <Star className="w-2.5 h-2.5 fill-current text-gold" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(idx);
                            }}
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                            title="Remove image"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Batch Add Images via Multiple Drive Links */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-navy">Add Gallery Images (Google Drive)</label>
                    <textarea
                      rows={2}
                      value={galleryBatchUrls}
                      onChange={(e) => setGalleryBatchUrls(e.target.value)}
                      placeholder={"Paste Google Drive links (one per line or comma separated)..."}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none text-xs text-navy font-mono placeholder-slate-400 focus:border-purple transition-all"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (galleryBatchUrls.trim()) {
                            addMultipleGalleryUrls(galleryBatchUrls.trim());
                            setGalleryBatchUrls('');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Gallery</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Cancel + Save Product */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-end space-x-3">
          <button
            onClick={() => navigate('/admin/products')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </div>

      {/* Dynamic Add Brand Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-navy">Create New Brand</h3>
              <button
                type="button"
                onClick={() => setShowAddBrandModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-navy transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-navy block mb-1">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Standard Fireworks, Sony Fireworks"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="font-bold text-navy block mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={newBrandDesc}
                  onChange={(e) => setNewBrandDesc(e.target.value)}
                  placeholder="Brand details, manufacturer info..."
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBrandModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBrand}
                disabled={isCreatingBrand || !newBrandName.trim()}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all disabled:opacity-50"
              >
                {isCreatingBrand ? 'Creating...' : 'Create Brand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErpProductFormPage;
