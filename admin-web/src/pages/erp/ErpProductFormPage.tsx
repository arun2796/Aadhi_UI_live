import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  UploadCloud,
  Star,
  Trash2,
  Plus,
  ImageIcon,
  Link as LinkIcon
} from 'lucide-react';
import { Product, Category, Brand } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { flattenCategories } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ErpLoadingState } from '../../components/common/ErpLoadingState';

interface ErpProductFormPageProps {
  productId?: string;
}

/** Local form model — extends Product with fields not yet in the shared type (HSN, SEO meta). */
type ProductFormState = Partial<Product> & {
  hsnCode?: string;
  metaTitle?: string;
  metaDescription?: string;
};

interface GalleryImage {
  id?: string;
  url: string;
  isPrimary: boolean;
}

type FormTab = 'general' | 'pricing' | 'inventory' | 'images' | 'seo';

const ALL_TABS: { id: FormTab; label: string }[] = [
  { id: 'general', label: 'General Information' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'images', label: 'Images' },
  { id: 'seo', label: 'SEO' }
];

/**
 * Inventory and SEO tabs are hidden per owner request — flip SHOW_EXTRA_TABS to true to
 * restore them (this single flag gates both the tab bar entries and the tab panels below).
 * While hidden, the required inventory values are still sent on save with sensible defaults
 * (stock 0, reorder level 10, featured false) and the General tab's Status toggle keeps
 * controlling isActive.
 */
const SHOW_EXTRA_TABS: boolean = false;

const TABS = SHOW_EXTRA_TABS
  ? ALL_TABS
  : ALL_TABS.filter((t) => t.id !== 'inventory' && t.id !== 'seo');

/** Fields the form can highlight inline when the server returns field-level validation errors. */
type ServerFieldKey = 'name' | 'sku' | 'description' | 'price';
const SERVER_FIELD_KEYS: ServerFieldKey[] = ['name', 'sku', 'description', 'price'];

/**
 * Friendly server error text: the backend returns ProblemDetails for business-rule 400s
 * (e.g. { title: "Business Rule Violation", detail: "A product named 'x' already exists..." }).
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

/** URL-slug helper — mirrors the backend's slug generation from the product name. */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy outline-none focus:border-purple transition-colors';

const RequiredMark = () => <span className="text-red-500"> *</span>;

/** Dedicated Add / Edit Product page (design 08) with General | Pricing | Inventory | Images tabs. */
export const ErpProductFormPage: React.FC<ErpProductFormPageProps> = ({ productId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = Boolean(productId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTab>('general');

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [form, setForm] = useState<ProductFormState>({
    name: '',
    sku: '',
    description: '',
    price: 0,
    compareAtPrice: 0,
    costPrice: 0,
    taxRate: 18,
    stockQuantity: 0,
    reorderLevel: 10,
    unit: 'Box',
    isActive: true,
    isFeatured: false,
    productType: 'Simple'
  });
  const [topCategoryId, setTopCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // Product Image dropzone helpers
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const primaryFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  // Inline field errors (client-side validation + server validation ProblemDetails `errors`)
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
    // Editing a highlighted field clears its inline error
    const errKey = key as string;
    if ((SERVER_FIELD_KEYS as string[]).includes(errKey)) {
      setFieldErrors((prev) =>
        prev[errKey as ServerFieldKey] ? { ...prev, [errKey]: undefined } : prev
      );
    }
  };

  /** Red-border style for a field with an inline error (wins over inputCls border colors). */
  const fieldCls = (key: ServerFieldKey) =>
    `${inputCls}${fieldErrors[key] ? ' border-red-400! focus:border-red-400!' : ''}`;

  /** Switches to the tab holding the field, then focuses it once the tab has rendered. */
  const focusField = (key: ServerFieldKey) => {
    setActiveTab(key === 'price' ? 'pricing' : 'general');
    const refs: Record<ServerFieldKey, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
      name: nameRef,
      sku: skuRef,
      description: descriptionRef,
      price: priceRef
    };
    window.setTimeout(() => refs[key].current?.focus(), 0);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cats, brs, prod] = await Promise.all([
        api.getCategories(true),
        api.getBrands(),
        productId ? api.getProductById(productId) : Promise.resolve(undefined)
      ]);
      const flat = flattenCategories(cats || []);
      setAllCategories(flat);
      setBrands(brs || []);

      if (productId) {
        if (!prod) {
          showToast('Product not found', 'error');
          navigate('/admin/products');
          return;
        }
        setForm({ ...(prod as ProductFormState) });

        // Resolve dependent Category / Sub Category dropdowns from the product's categoryId
        const assigned = flat.find((c) => c.id === prod.categoryId);
        if (assigned?.parentCategoryId) {
          setTopCategoryId(assigned.parentCategoryId);
          setSubCategoryId(assigned.id);
        } else if (assigned) {
          setTopCategoryId(assigned.id);
          setSubCategoryId('');
        }

        // Build image gallery from images[] + primaryImageUrl
        const imgs: GalleryImage[] = (prod.images || []).map((img) => ({
          id: img.id,
          url: img.url,
          isPrimary: img.isPrimary
        }));
        if (prod.primaryImageUrl && !imgs.some((g) => g.url === prod.primaryImageUrl)) {
          imgs.unshift({ url: prod.primaryImageUrl, isPrimary: true });
        }
        if (imgs.length > 0 && !imgs.some((g) => g.isPrimary)) {
          imgs[0] = { ...imgs[0], isPrimary: true };
        }
        setGallery(imgs);
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to load product form data', 'error');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Image helpers ----------------------------------------------------

  /** Sets / replaces the primary product image (from upload or pasted URL).
   *  Google Drive share links are converted to direct-image URLs. */
  const setPrimaryImageUrl = (rawUrl: string) => {
    const url = normalizeImageUrl(rawUrl) ?? rawUrl;
    setGallery((prev) => {
      const others = prev.filter((g) => !g.isPrimary).map((g) => ({ ...g, isPrimary: false }));
      return [{ url, isPrimary: true }, ...others];
    });
  };

  const addGalleryImage = (rawUrl: string) => {
    const url = normalizeImageUrl(rawUrl) ?? rawUrl;
    setGallery((prev) => {
      if (prev.some((g) => g.url === url)) return prev;
      return [...prev, { url, isPrimary: prev.length === 0 }];
    });
  };

  const readImageFile = (file: File, onDone: (dataUrl: string) => void) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file (JPG / PNG)', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be 2MB or smaller', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onDone(String(reader.result));
    reader.onerror = () => showToast('Could not read image file', 'error');
    reader.readAsDataURL(file);
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
      setActiveTab('general');
      showToast('Please select a Category', 'warning');
      return;
    }
    if (subCategories.length > 0 && !subCategoryId) {
      setActiveTab('general');
      showToast('Please select a Sub Category', 'warning');
      return;
    }
    // Description is required by the backend — catch it client-side before submit
    if (!form.description?.trim()) {
      setFieldErrors({ description: 'Description is required' });
      showToast('Description is required', 'warning');
      focusField('description');
      return;
    }
    if (!form.price || form.price <= 0) {
      setFieldErrors({ price: 'Selling Price is required' });
      showToast('Selling Price is required', 'warning');
      focusField('price');
      return;
    }

    const finalCategoryId = subCategoryId || topCategoryId;
    const finalCategory = allCategories.find((c) => c.id === finalCategoryId);
    const primary = gallery.find((g) => g.isPrimary) || gallery[0];

    // Meta Title / Meta Description are local-only (no backend fields yet) — exclude from payload.
    const { metaTitle: _metaTitle, metaDescription: _metaDescription, ...persistedForm } = form;

    const payload: ProductFormState = {
      ...persistedForm,
      // The Inventory tab is hidden (see SHOW_EXTRA_TABS) — its required values are still
      // sent with sensible defaults. The Status toggle on General keeps driving isActive.
      stockQuantity: persistedForm.stockQuantity ?? 0,
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
      // Validation ProblemDetails carry field-level errors, e.g.
      // { errors: { "Description": ["'Description' must not be empty."] } }
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
            // A field the form knows — highlight it inline and jump to it
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

  if (isLoading) {
    return <ErpLoadingState message="Loading product form..." height="h-96" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin/products')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
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
                : 'Create a new product for the live catalog.'}
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs">
        {/* Tabs */}
        <div className="flex items-center space-x-6 border-b border-slate-200 px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-purple text-purple'
                  : 'border-transparent text-slate-500 hover:text-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: form fields */}
              <div className="lg:col-span-2 space-y-4 text-xs">
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

                <div>
                  <label className="font-bold text-navy">
                    SKU
                    <RequiredMark />
                  </label>
                  <input
                    ref={skuRef}
                    type="text"
                    value={form.sku || ''}
                    onChange={(e) => setField('sku', e.target.value)}
                    placeholder="e.g. AC-SP-010"
                    className={`${fieldCls('sku')} font-mono`}
                  />
                  {fieldErrors.sku && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.sku}</p>
                  )}
                </div>

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
                    <label className="font-bold text-navy">Brand</label>
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
                      className={inputCls}
                    >
                      <option value="">Select Brand</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div>
                    <label className="font-bold text-navy">HSN Code</label>
                    <input
                      type="text"
                      value={form.hsnCode || ''}
                      onChange={(e) => setField('hsnCode', e.target.value)}
                      placeholder="e.g. 3604"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-navy">
                    Description
                    <RequiredMark />
                  </label>
                  <textarea
                    ref={descriptionRef}
                    rows={5}
                    value={form.description || ''}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Describe the firecracker effect, contents and highlights..."
                    className={fieldCls('description')}
                  />
                  {fieldErrors.description && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.description}</p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-navy">Short Description</label>
                  <input
                    type="text"
                    value={form.shortDescription || ''}
                    onChange={(e) => setField('shortDescription', e.target.value)}
                    placeholder="One-line summary shown on product cards..."
                    className={inputCls}
                  />
                </div>

                {/* Status toggle (Active / Inactive) */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div>
                    <div className="font-bold text-navy">Status</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {form.isActive ?? true
                        ? 'Product is visible and purchasable in the store.'
                        : 'Product is hidden from the store.'}
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

              {/* Right: Product Image card */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-navy">Product Image</h3>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) readImageFile(file, setPrimaryImageUrl);
                  }}
                  onClick={() => primaryFileRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center text-center p-6 min-h-56 ${
                    isDragging ? 'border-purple bg-purple/5' : 'border-slate-200 bg-slate-50/50 hover:border-purple/50'
                  }`}
                >
                  {primaryImage ? (
                    <div className="space-y-2 w-full">
                      <img
                        src={primaryImage.url}
                        alt="Product preview"
                        className="w-full h-44 object-cover rounded-xl border border-slate-200"
                      />
                      <p className="text-[10px] text-slate-400 font-medium">
                        Drag &amp; drop or click to replace
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center mb-3">
                        <UploadCloud className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-navy">Drag &amp; drop or click to upload</p>
                      <p className="text-[10px] text-slate-400 mt-1">JPG, PNG up to 2MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={primaryFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readImageFile(file, setPrimaryImageUrl);
                    e.target.value = '';
                  }}
                />

                {/* Thumbnail strip + Add More */}
                <div className="flex items-center gap-2 flex-wrap">
                  {gallery.map((img, idx) => (
                    <button
                      key={`${img.url.slice(0, 64)}-${idx}`}
                      onClick={() => markPrimary(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                        img.isPrimary
                          ? 'border-purple ring-2 ring-purple/20'
                          : 'border-slate-200 hover:border-purple/40'
                      }`}
                      title={img.isPrimary ? 'Primary image' : 'Set as primary'}
                    >
                      <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <button
                    onClick={() => galleryFileRef.current?.click()}
                    className="h-12 px-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-purple hover:text-purple flex items-center space-x-1 text-[10px] font-bold transition-colors"
                    title="Add more images"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More</span>
                  </button>
                </div>

                {/* Paste URL alternative */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="or paste image URL..."
                      className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (imageUrlInput.trim()) {
                        setPrimaryImageUrl(imageUrlInput.trim());
                        setImageUrlInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PRICING TAB */}
          {activeTab === 'pricing' && (
            <div className="max-w-2xl space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-navy">
                    Price (₹)
                    <RequiredMark />
                  </label>
                  <input
                    ref={priceRef}
                    type="number"
                    min={0}
                    value={form.price ?? 0}
                    onChange={(e) => setField('price', Number(e.target.value))}
                    className={`${fieldCls('price')} font-bold`}
                  />
                  {fieldErrors.price && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">{fieldErrors.price}</p>
                  )}
                </div>
                <div>
                  <label className="font-bold text-navy">MRP / Compare at Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.compareAtPrice ?? 0}
                    onChange={(e) => setField('compareAtPrice', Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-navy">Cost Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.costPrice ?? 0}
                    onChange={(e) => setField('costPrice', Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">GST Rate (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.taxRate ?? 18}
                    onChange={(e) => setField('taxRate', Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                Calculated Gross Profit Margin:{' '}
                <span className="font-bold">
                  ₹{((form.price || 0) - (form.costPrice || 0)).toLocaleString('en-IN')} (
                  {form.price
                    ? Math.round(((form.price - (form.costPrice || 0)) / form.price) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          )}

          {/* INVENTORY TAB — hidden while SHOW_EXTRA_TABS is false (defaults sent on save) */}
          {SHOW_EXTRA_TABS && activeTab === 'inventory' && (
            <div className="max-w-2xl space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-navy">Initial Stock Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={form.stockQuantity ?? 0}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      setForm((prev) => ({ ...prev, stockQuantity: qty, availableQuantity: qty }));
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Reorder Level Threshold</label>
                  <input
                    type="number"
                    min={0}
                    value={form.reorderLevel ?? 10}
                    onChange={(e) => setField('reorderLevel', Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-navy">Safety &amp; Lighting Instructions</label>
                <textarea
                  rows={3}
                  value={form.safetyInformation || ''}
                  onChange={(e) => setField('safetyInformation', e.target.value)}
                  placeholder="e.g. Maintain 5m distance. Light only using an agarbatti or incense stick outdoors."
                  className={inputCls}
                />
              </div>

              <div className="flex items-center space-x-6 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured ?? false}
                    onChange={(e) => setField('isFeatured', e.target.checked)}
                    className="accent-purple w-4 h-4"
                  />
                  <span className="font-bold text-navy">Featured on Homepage</span>
                </label>
              </div>
            </div>
          )}

          {/* IMAGES TAB */}
          {activeTab === 'images' && (
            <div className="space-y-4 text-xs">
              {gallery.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-10 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                  <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="font-bold text-navy">No images yet</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Upload files or add image URLs below. The first image becomes the primary image.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {gallery.map((img, idx) => (
                    <div
                      key={`${img.url.slice(0, 64)}-${idx}`}
                      className={`rounded-2xl border overflow-hidden bg-white ${
                        img.isPrimary ? 'border-purple ring-2 ring-purple/20' : 'border-slate-200'
                      }`}
                    >
                      <div className="relative">
                        <img src={img.url} alt={`Product ${idx + 1}`} className="w-full h-32 object-cover" />
                        {img.isPrimary && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple text-white text-[9px] font-black uppercase tracking-wider flex items-center space-x-1">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>Primary</span>
                          </span>
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        {img.isPrimary ? (
                          <span className="text-[10px] font-bold text-purple">Primary image</span>
                        ) : (
                          <button
                            onClick={() => markPrimary(idx)}
                            className="text-[10px] font-bold text-slate-500 hover:text-purple"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(idx)}
                          className="p-1 text-slate-400 hover:text-red-500"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add images row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={galleryUrlInput}
                    onChange={(e) => setGalleryUrlInput(e.target.value)}
                    placeholder="Paste image URL or data-URL..."
                    className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                  />
                </div>
                <button
                  onClick={() => {
                    if (galleryUrlInput.trim()) {
                      addGalleryImage(galleryUrlInput.trim());
                      setGalleryUrlInput('');
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add URL</span>
                </button>
                <button
                  onClick={() => galleryFileRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-bold flex items-center justify-center space-x-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Files</span>
                </button>
              </div>
            </div>
          )}

          {/* SEO TAB — hidden while SHOW_EXTRA_TABS is false */}
          {SHOW_EXTRA_TABS && activeTab === 'seo' && (
            <div className="max-w-2xl space-y-4 text-xs">
              <div>
                <label className="font-bold text-navy">URL Slug</label>
                <input
                  type="text"
                  value={form.slug ?? ''}
                  onChange={(e) => setField('slug', e.target.value)}
                  placeholder={slugify(form.name || '') || 'e.g. aadhi-deluxe-30-shots'}
                  className={`${inputCls} font-mono text-purple`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Public product URL: /products/{form.slug || slugify(form.name || '') || '...'}
                  {' '}— auto-generated from the product name when left blank.
                </p>
              </div>

              <div>
                <label className="font-bold text-navy">Meta Title</label>
                <input
                  type="text"
                  value={form.metaTitle ?? form.name ?? ''}
                  onChange={(e) => setField('metaTitle', e.target.value)}
                  placeholder="Title shown in search engine results..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className="font-bold text-navy">Meta Description</label>
                <textarea
                  rows={3}
                  value={form.metaDescription ?? form.shortDescription ?? ''}
                  onChange={(e) => setField('metaDescription', e.target.value)}
                  placeholder="Short summary shown under the title in search results..."
                  className={inputCls}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                Meta Title and Meta Description are not yet stored by the product API — they prefill
                from the product name and short description and are kept locally until the backend
                supports SEO meta fields.
              </div>
            </div>
          )}
        </div>

        {/* Shared hidden gallery input — used by "+ Add More" (General) and "Upload Files" (Images) */}
        <input
          ref={galleryFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files || []).forEach((file) =>
              readImageFile(file, addGalleryImage)
            );
            e.target.value = '';
          }}
        />

        {/* Footer: Cancel + Save Product */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-end space-x-3">
          <button
            onClick={() => navigate('/admin/products')}
            className="px-5 py-2.5 rounded-xl border border-red-400 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
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
    </div>
  );
};

export default ErpProductFormPage;
