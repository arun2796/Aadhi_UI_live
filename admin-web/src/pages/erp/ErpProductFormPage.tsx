import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Trash2,
  Plus,
  Minus,
  ImageIcon,
  Link as LinkIcon,
  Wand2,
  X,
  Sparkles,
  Gift,
  Search,
  AlertTriangle
} from 'lucide-react';
import { Product, Category, Brand, ComboItem, ComboItemInput } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { productApi, ProductWritePayload } from '../../services/productApi';
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

/**
 * One editable line of the Combo / Gift Box builder. Mirrors the server's
 * `ComboItem` minus `lineTotal`, which is always derived client-side while the
 * admin edits so the running total stays live.
 */
interface ComboRow {
  componentProductId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
}

/** How many picker matches to render at once (keeps the list snappy on big catalogues). */
const PICKER_VISIBLE_LIMIT = 40;

const formatMoney = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '0';

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

  // ---- Combo / Gift Box builder state ------------------------------------
  const [comboRows, setComboRows] = useState<ComboRow[]>([]);
  /** True when the product was already a combo when the form opened. */
  const [wasCombo, setWasCombo] = useState(false);
  /** Whole catalogue, loaded once, so the picker filters client-side per keystroke. */
  const [pickerProducts, setPickerProducts] = useState<Product[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(true);
  const [isPickerUnavailable, setIsPickerUnavailable] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerHighlight, setPickerHighlight] = useState(0);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const pickerListRef = useRef<HTMLUListElement>(null);
  const pickerListboxId = 'combo-product-picker-listbox';

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

          // Prefill the Combo / Gift Box contents (absent on servers without the feature).
          const serverComboItems: ComboItem[] = Array.isArray(product.comboItems)
            ? product.comboItems
            : [];
          setComboRows(
            serverComboItems.map((ci) => ({
              componentProductId: ci.componentProductId,
              productName: ci.productName,
              sku: ci.sku,
              imageUrl: normalizeImageUrl(ci.imageUrl),
              quantity: Math.max(1, Math.round(Number(ci.quantity) || 1)),
              unitPrice: Number(ci.unitPrice) || 0
            }))
          );
          setWasCombo(Boolean(product.isCombo) || serverComboItems.length > 0);
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

  // ---- Combo / Gift Box builder ------------------------------------------

  /**
   * The picker filters client-side, so the catalogue is pulled once on mount
   * (in the background — the form stays usable while it lands). A failure here
   * only disables the combo builder; every other form feature keeps working.
   */
  useEffect(() => {
    let isMounted = true;

    const loadPickerProducts = async () => {
      setIsPickerLoading(true);
      try {
        const all = await productApi.getAllProducts();
        if (!isMounted) return;
        setPickerProducts(all);
        setIsPickerUnavailable(false);
      } catch (error) {
        if (!isMounted) return;
        setIsPickerUnavailable(true);
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        showToast(
          status === 404
            ? 'Combo builder unavailable: this server build has no product list endpoint yet.'
            : 'Could not load the product list for the combo builder. You can still save the rest of the form.',
          'warning'
        );
      } finally {
        if (isMounted) setIsPickerLoading(false);
      }
    };

    loadPickerProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const comboTotal = useMemo(
    () => comboRows.reduce((sum, r) => sum + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 0), 0),
    [comboRows]
  );
  const comboUnitCount = useMemo(
    () => comboRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
    [comboRows]
  );

  /** Candidates: everything except this product itself and other combos (no nesting). */
  const comboCandidates = useMemo(
    () => pickerProducts.filter((p) => p.id !== productId && !p.isCombo),
    [pickerProducts, productId]
  );

  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const matched = q
      ? comboCandidates.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
        )
      : comboCandidates;
    return matched.slice(0, PICKER_VISIBLE_LIMIT);
  }, [comboCandidates, pickerQuery]);

  // Keep the highlighted row inside the visible list and inside its bounds.
  useEffect(() => {
    setPickerHighlight((prev) => (prev >= pickerMatches.length ? 0 : prev));
  }, [pickerMatches.length]);

  useEffect(() => {
    if (!isPickerOpen) return;
    pickerListRef.current
      ?.querySelector<HTMLElement>(`[data-index="${pickerHighlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [pickerHighlight, isPickerOpen]);

  const addComboItem = (product: Product) => {
    let bumped = false;
    setComboRows((prev) => {
      const existing = prev.find((r) => r.componentProductId === product.id);
      if (existing) {
        bumped = true;
        return prev.map((r) =>
          r.componentProductId === product.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [
        ...prev,
        {
          componentProductId: product.id,
          productName: product.name,
          sku: product.sku,
          imageUrl: normalizeImageUrl(product.primaryImageUrl),
          quantity: 1,
          unitPrice: Number(product.price) || 0
        }
      ];
    });
    setPickerQuery('');
    setPickerHighlight(0);
    showToast(
      bumped ? `Increased quantity of ${product.name}` : `${product.name} added to the combo`,
      'success'
    );
    pickerInputRef.current?.focus();
  };

  const setComboQuantity = (componentProductId: string, quantity: number) => {
    setComboRows((prev) =>
      prev.map((r) =>
        r.componentProductId === componentProductId
          ? { ...r, quantity: Math.max(1, Math.round(quantity) || 1) }
          : r
      )
    );
  };

  const removeComboItem = (componentProductId: string) => {
    setComboRows((prev) => prev.filter((r) => r.componentProductId !== componentProductId));
  };

  const handlePickerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isPickerOpen) {
        setIsPickerOpen(true);
        return;
      }
      setPickerHighlight((prev) => (pickerMatches.length === 0 ? 0 : (prev + 1) % pickerMatches.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPickerHighlight((prev) =>
        pickerMatches.length === 0 ? 0 : (prev - 1 + pickerMatches.length) % pickerMatches.length
      );
      return;
    }
    if (e.key === 'Home' && isPickerOpen) {
      e.preventDefault();
      setPickerHighlight(0);
      return;
    }
    if (e.key === 'End' && isPickerOpen) {
      e.preventDefault();
      setPickerHighlight(Math.max(0, pickerMatches.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const match = pickerMatches[pickerHighlight];
      if (match) {
        addComboItem(match);
        setIsPickerOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setIsPickerOpen(false);
    }
  };

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

    // The API persists images from `imageUrls: string[]` only (it ignores
    // `images`/`primaryImageUrl` on the request) and treats the FIRST url as the
    // primary image — so send a plain, de-duplicated list with primary first.
    const orderedImageUrls = Array.from(
      new Set(
        [primary?.url, ...gallery.map((g) => g.url)]
          .map((u) => (u || '').trim())
          .filter(Boolean)
      )
    );

    // Combo contents go up as `{ componentProductId, quantity }` pairs — the full
    // list replaces whatever the product had, and `[]` clears it (back to a simple
    // product). The read-only combo fields below are server-computed, never sent.
    const comboItemsPayload: ComboItemInput[] = comboRows.map((r) => ({
      componentProductId: r.componentProductId,
      quantity: Math.max(1, Math.round(Number(r.quantity) || 1))
    }));

    const {
      metaTitle: _metaTitle,
      metaDescription: _metaDescription,
      comboItems: _comboItems,
      comboItemsTotal: _comboItemsTotal,
      comboItemCount: _comboItemCount,
      isCombo: _isCombo,
      ...persistedForm
    } = form;

    const payload: ProductWritePayload = {
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
      })),
      // What the API actually reads (see comment above).
      imageUrls: orderedImageUrls,
      comboItems: comboItemsPayload
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
      // Graceful degradation: an older API that doesn't know about combos yet.
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 404 && comboItemsPayload.length > 0) {
        showToast(
          'This server build does not support gift box / combo contents yet. Remove the combo items to save this product.',
          'warning'
        );
        return;
      }

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
  const struckPrice = Number(form.compareAtPrice) || 0;
  const profitMargin = sellingPrice > 0 ? sellingPrice - costPrice : 0;
  const profitPercent = sellingPrice > 0 ? Math.round((profitMargin / sellingPrice) * 100) : 0;

  // Storefront read-out: the struck (compare-at) price only shows when it beats the price.
  const hasStorefrontDiscount = struckPrice > 0 && sellingPrice > 0 && struckPrice > sellingPrice;
  const storefrontSaving = hasStorefrontDiscount ? struckPrice - sellingPrice : 0;
  const storefrontSavingPercent = hasStorefrontDiscount
    ? Math.round((storefrontSaving / struckPrice) * 100)
    : 0;
  /** Amber, non-blocking: an MRP at/below the price never renders struck-through. */
  const showPriceOrderWarning = struckPrice > 0 && sellingPrice > 0 && struckPrice <= sellingPrice;
  /** Amber, non-blocking: this was a combo but every component was removed. */
  const showEmptyComboWarning = wasCombo && comboRows.length === 0;
  /** Nudge: contents total and struck price have drifted apart. */
  const showStruckMismatchHint =
    comboRows.length > 0 && comboTotal > 0 && Math.round(struckPrice) !== Math.round(comboTotal);

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

                {/* Storefront price read-out: what the customer actually sees */}
                {hasStorefrontDiscount && (
                  <div className="p-2.5 rounded-xl bg-white border border-purple/20 text-[11px] font-medium text-navy flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span className="text-slate-500">Customers see</span>
                    <span className="font-black text-xs text-navy">₹{formatMoney(sellingPrice)}</span>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-500">struck</span>
                    <span className="font-bold text-slate-400 line-through">₹{formatMoney(struckPrice)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold text-emerald-600">
                      saving ₹{formatMoney(storefrontSaving)} ({storefrontSavingPercent}% off)
                    </span>
                  </div>
                )}

                {/* Non-blocking warning: MRP at/below the selling price never strikes through */}
                {showPriceOrderWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      MRP / Compare-at (₹{formatMoney(struckPrice)}) is not above the selling price
                      (₹{formatMoney(sellingPrice)}) — the storefront will show no struck-through price
                      or discount. You can still save.
                    </span>
                  </div>
                )}

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

              {/* ---- Combo / Gift Box Contents ---- */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-navy flex items-center space-x-1.5">
                    <Gift className="w-3.5 h-3.5 text-purple" />
                    <span>Combo / Gift Box Contents</span>
                  </h3>
                  <span className="text-[10px] font-bold text-purple bg-purple/10 px-2.5 py-0.5 rounded-full">
                    {comboRows.length} product{comboRows.length === 1 ? '' : 's'}
                    {comboUnitCount !== comboRows.length ? ` · ${comboUnitCount} units` : ''}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 -mt-1">
                  Pack several catalogue products into one gift box. Their combined value becomes the
                  struck-through MRP; you type the actual selling price by hand.
                </p>

                {/* Searchable product picker (combobox) */}
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl focus-within:border-purple transition-colors">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        ref={pickerInputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={isPickerOpen}
                        aria-controls={pickerListboxId}
                        aria-autocomplete="list"
                        aria-activedescendant={
                          isPickerOpen && pickerMatches[pickerHighlight]
                            ? `combo-option-${pickerMatches[pickerHighlight].id}`
                            : undefined
                        }
                        aria-label="Search products to add to this combo"
                        disabled={isPickerUnavailable}
                        value={pickerQuery}
                        onChange={(e) => {
                          setPickerQuery(e.target.value);
                          setPickerHighlight(0);
                          setIsPickerOpen(true);
                        }}
                        onFocus={() => setIsPickerOpen(true)}
                        onBlur={() => setIsPickerOpen(false)}
                        onKeyDown={handlePickerKeyDown}
                        placeholder={
                          isPickerUnavailable
                            ? 'Product list unavailable'
                            : isPickerLoading
                            ? 'Loading products...'
                            : 'Search products by name or SKU to add...'
                        }
                        className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400 disabled:cursor-not-allowed"
                      />
                      {pickerQuery && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPickerQuery('');
                            pickerInputRef.current?.focus();
                          }}
                          className="text-slate-300 hover:text-slate-500 transition-colors"
                          title="Clear search"
                          aria-label="Clear product search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const match = pickerMatches[pickerHighlight] || pickerMatches[0];
                        if (!match) {
                          showToast('No matching product to add', 'info');
                          return;
                        }
                        addComboItem(match);
                        setIsPickerOpen(true);
                      }}
                      disabled={isPickerUnavailable || pickerMatches.length === 0}
                      className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shrink-0 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {isPickerOpen && !isPickerUnavailable && (
                    <ul
                      ref={pickerListRef}
                      id={pickerListboxId}
                      role="listbox"
                      aria-label="Matching products"
                      className="absolute z-30 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-50"
                    >
                      {pickerMatches.length === 0 && (
                        <li className="px-3 py-3 text-[11px] text-slate-400">
                          {isPickerLoading ? 'Loading products...' : 'No matching products'}
                        </li>
                      )}
                      {pickerMatches.map((p, idx) => {
                        const alreadyAdded = comboRows.find((r) => r.componentProductId === p.id);
                        return (
                          <li
                            key={p.id}
                            id={`combo-option-${p.id}`}
                            role="option"
                            data-index={idx}
                            aria-selected={idx === pickerHighlight}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setPickerHighlight(idx)}
                            onClick={() => {
                              addComboItem(p);
                              setIsPickerOpen(true);
                            }}
                            className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 ${
                              idx === pickerHighlight ? 'bg-purple/10' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-navy truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              {alreadyAdded && (
                                <span className="text-[9px] font-bold text-purple bg-purple/10 px-1.5 py-0.5 rounded-full">
                                  Added x{alreadyAdded.quantity}
                                </span>
                              )}
                              <span className="text-xs font-black text-navy">
                                ₹{formatMoney(Number(p.price) || 0)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {isPickerUnavailable && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                    The product list could not be loaded, so combo contents can't be edited right now.
                    Every other field on this form still saves normally.
                  </div>
                )}

                {/* Chosen component rows */}
                {comboRows.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {comboRows.map((row) => (
                      <div
                        key={row.componentProductId}
                        className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50/70 transition-colors"
                      >
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.productName}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-navy truncate">{row.productName}</div>
                          <div className="text-[10px] text-slate-400">
                            <span className="font-mono">{row.sku}</span>
                            <span className="mx-1">·</span>
                            <span>₹{formatMoney(row.unitPrice)} each</span>
                          </div>
                        </div>

                        {/* Quantity stepper */}
                        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => setComboQuantity(row.componentProductId, row.quantity - 1)}
                            disabled={row.quantity <= 1}
                            className="px-1.5 py-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Decrease quantity of ${row.productName}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              setComboQuantity(row.componentProductId, Number(e.target.value))
                            }
                            aria-label={`Quantity of ${row.productName}`}
                            className="w-10 text-center text-xs font-bold text-navy outline-none border-x border-slate-200 py-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => setComboQuantity(row.componentProductId, row.quantity + 1)}
                            className="px-1.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                            aria-label={`Increase quantity of ${row.productName}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="w-20 text-right text-xs font-black text-navy shrink-0">
                          ₹{formatMoney(row.unitPrice * row.quantity)}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeComboItem(row.componentProductId)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 transition-colors"
                          title={`Remove ${row.productName}`}
                          aria-label={`Remove ${row.productName} from the combo`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center">
                    <p className="text-[11px] font-bold text-navy">No products in this combo yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Leave this empty for a normal single product.
                    </p>
                  </div>
                )}

                {/* Live total + the two purple pricing actions */}
                {comboRows.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple/5 border border-purple/15 space-y-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold text-navy">
                          Combo Contents Total: <span className="text-sm font-black">₹{formatMoney(comboTotal)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {comboRows.length} product{comboRows.length === 1 ? '' : 's'} · {comboUnitCount} item
                          {comboUnitCount === 1 ? '' : 's'} inside
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Manual selling price</div>
                        <div className="text-sm font-black text-navy">
                          {sellingPrice > 0 ? `₹${formatMoney(sellingPrice)}` : 'Not set'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setField('compareAtPrice', Math.round(comboTotal));
                          showToast(
                            `MRP / Compare-at set to ₹${formatMoney(comboTotal)} — now type the actual selling price.`,
                            'success'
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-[11px] font-bold shadow-xs transition-colors"
                      >
                        Use as struck price
                      </button>
                      <button
                        type="button"
                        onClick={() => focusField('price')}
                        className="px-3.5 py-2 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/15 text-purple text-[11px] font-bold transition-colors"
                      >
                        Set selling price manually
                      </button>
                      <span className="text-[10px] text-slate-400">
                        The selling price is never calculated — you type it.
                      </span>
                    </div>

                    {showStruckMismatchHint && (
                      <div className="text-[10px] text-slate-500">
                        Current MRP / Compare-at is{' '}
                        <span className="font-bold">
                          {struckPrice > 0 ? `₹${formatMoney(struckPrice)}` : 'not set'}
                        </span>{' '}
                        — click "Use as struck price" to match the contents total.
                      </div>
                    )}
                  </div>
                )}

                {/* Non-blocking warning: a combo that lost all of its items */}
                {showEmptyComboWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      This gift box has no products inside. Saving now converts it back to a normal
                      single product.
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
