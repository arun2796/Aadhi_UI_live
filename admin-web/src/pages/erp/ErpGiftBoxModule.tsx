import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Edit2,
  ImageIcon,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react';
import { Category, Product } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { productApi, ProductWritePayload } from '../../services/productApi';
import { flattenCategories } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ImageUploadField } from '../../components/common/ImageUploadField';
import { ErpLoadingState } from '../../components/common/ErpLoadingState';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';

/**
 * GIFT BOX MODULE
 * ---------------
 * A gift box is a pre-packed box sold as ONE sealed SKU. Unlike a combo it never lists the
 * products inside it — the owner only ever types an image, a name, an SKU, an MRP and a
 * selling price.
 *
 * It is modelled as a Product carrying `isGiftBox: true` so it stays purchasable through the
 * cart, orders, invoices and stock that already exist. See `handleSave` for the fields this
 * screen deliberately hides but still has to send.
 */

export type ErpGiftBoxModuleMode = 'list' | 'form';

interface ErpGiftBoxModuleProps {
  /** 'list' renders the gift box table, 'form' the create/edit screen. */
  mode?: ErpGiftBoxModuleMode;
  /** Product id of the gift box being edited (absent = create). */
  giftBoxId?: string;
}

const GIFT_BOXES_PAGE_SIZE = 10;

const formatMoney = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '0';

/** Server-computed / read-only fields that must never be echoed back on write. */
const stripReadOnlyProductFields = (product: Partial<Product>): Partial<Product> => {
  const {
    comboItems: _comboItems,
    comboItemsTotal: _comboItemsTotal,
    comboItemCount: _comboItemCount,
    isCombo: _isCombo,
    relatedProducts: _relatedProducts,
    ...rest
  } = product;
  return rest;
};

const getServerErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } } | null)
    ?.response?.data;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  const { message } = getApiErrorDetails(error);
  return message || fallback;
};

/** First field-level message out of a ProblemDetails `errors` dictionary. */
const getFirstValidationMessage = (error: unknown): string | undefined => {
  const data = (error as { response?: { data?: { errors?: unknown } } } | null)?.response?.data;
  const errors =
    data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)
      ? (data.errors as Record<string, unknown>)
      : undefined;
  if (!errors) return undefined;
  const [, messages] = Object.entries(errors)[0] ?? [];
  if (Array.isArray(messages)) return String(messages[0] ?? '') || undefined;
  if (typeof messages === 'string') return messages || undefined;
  return undefined;
};

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-navy outline-none focus:border-purple transition-colors';

const RequiredMark = () => <span className="text-red-500"> *</span>;

/** Slugs that already mean "the gift box bucket", most preferred first. */
const GIFT_BOX_CATEGORY_SLUGS = ['gift-boxes', 'gift-box', 'giftboxes'];
/** Last-resort match on the category name when none of the known slugs exist. */
const GIFT_BOX_CATEGORY_NAME_PATTERN = /gift\s*box(es)?/i;
/** Payload used the first time a gift box is saved on a store that has no gift box category. */
const GIFT_BOX_CATEGORY_SEED = {
  name: 'Gift Boxes',
  slug: 'gift-boxes',
  description: 'Pre-packed gift boxes sold as a single sealed SKU.',
  displayOrder: 1,
  isActive: true
};

/**
 * Picks the category every gift box is silently filed under: the `gift-boxes` slug first (their
 * live database already has one), then the other spellings, then anything whose name reads like
 * a gift box. Only when nothing matches is a category created — see `ensureGiftBoxCategory`.
 */
const findGiftBoxCategory = (list: Category[]): Category | undefined => {
  for (const slug of GIFT_BOX_CATEGORY_SLUGS) {
    const bySlug = list.find((c) => (c.slug || '').trim().toLowerCase() === slug);
    if (bySlug) return bySlug;
  }
  return list.find((c) => GIFT_BOX_CATEGORY_NAME_PATTERN.test(c.name || ''));
};

/**
 * Description is not on this screen at all, but the API's validator is NotEmpty — so one is
 * written from the name, e.g. "Diwali Deluxe Box — a ready-to-gift box, sold as one sealed pack."
 */
const buildGiftBoxDescription = (giftBoxName: string): string => {
  const cleaned = giftBoxName.trim() || 'Gift box';
  return `${cleaned} — a ready-to-gift box, sold as one sealed pack.`;
};

// ===========================================================================
// LIST VIEW
// ===========================================================================

const ErpGiftBoxListView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [giftBoxes, setGiftBoxes] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadGiftBoxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await productApi.getGiftBoxes();
      setGiftBoxes(rows);
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Failed to load gift boxes'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGiftBoxes();
  }, [loadGiftBoxes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return giftBoxes;
    return giftBoxes.filter(
      (g) => (g.name || '').toLowerCase().includes(q) || (g.sku || '').toLowerCase().includes(q)
    );
  }, [giftBoxes, search]);

  // Keep the pager inside its bounds when the filter shrinks the result set.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / GIFT_BOXES_PAGE_SIZE));
    setPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [filtered.length]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * GIFT_BOXES_PAGE_SIZE, page * GIFT_BOXES_PAGE_SIZE),
    [filtered, page]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteProduct(deleteTarget.id);
      showToast(`Gift box "${deleteTarget.name}" deleted.`, 'success');
      setGiftBoxes((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Failed to delete this gift box'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-purple/10 border border-purple/20 flex items-center justify-center shrink-0">
            <PackageOpen className="w-5 h-5 text-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy tracking-tight">Gift Box</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pre-packed boxes sold as one sealed SKU — just an image, a name, an SKU and a price.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/admin/gift-boxes/new')}
          className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-purple/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Gift Box</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search gift box name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search gift boxes by name or SKU"
            className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
          />
        </div>
        <div className="text-xs font-bold text-slate-500">
          Total Gift Boxes: <span className="text-navy">{giftBoxes.length}</span>
        </div>
      </div>

      {isLoading ? (
        <ErpLoadingState message="Loading gift boxes..." height="h-64" />
      ) : giftBoxes.length === 0 ? (
        /* Friendly first-run empty state */
        <div className="p-10 rounded-3xl bg-white border border-slate-200 shadow-2xs text-center space-y-4 max-w-md mx-auto my-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-purple/10 border border-purple/20 text-purple flex items-center justify-center mx-auto">
            <PackageOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-navy">No gift boxes yet</h3>
            <p className="text-xs text-slate-500 font-medium">
              A gift box is a ready-packed box you sell as a single sealed SKU. Give it a photo, a
              name, an SKU and a price — nothing else to fill in.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/admin/gift-boxes/new')}
              className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all"
            >
              Create your first gift box
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Gift Box</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">MRP</th>
                  <th className="py-3 px-3">Selling Price</th>
                  <th className="py-3 px-3">Customer Saves</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No gift boxes match "{search}".
                    </td>
                  </tr>
                )}
                {paged.map((g) => {
                  const sellingPrice = Number(g.price) || 0;
                  const mrp = Number(g.compareAtPrice) || 0;
                  const hasDiscount = mrp > 0 && sellingPrice > 0 && mrp > sellingPrice;
                  const saving = hasDiscount ? mrp - sellingPrice : 0;
                  const savingPercent = hasDiscount ? Math.round((saving / mrp) * 100) : 0;
                  const thumb = normalizeImageUrl(g.primaryImageUrl);

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={g.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple/5 border border-purple/15 flex items-center justify-center shrink-0">
                              <PackageOpen className="w-4 h-4 text-purple/60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-navy text-xs truncate">{g.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {g.categoryName || 'Gift Boxes'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-purple">{g.sku}</td>
                      <td className="py-3 px-3">
                        {mrp > 0 ? (
                          <div
                            className={
                              hasDiscount
                                ? 'text-slate-400 line-through font-bold'
                                : 'text-slate-500 font-bold'
                            }
                          >
                            ₹{formatMoney(mrp)}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-navy text-xs">₹{formatMoney(sellingPrice)}</div>
                      </td>
                      <td className="py-3 px-3">
                        {hasDiscount ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
                            Save ₹{formatMoney(saving)} ({savingPercent}% OFF)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            No MRP set
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {g.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => navigate(`/admin/gift-boxes/${g.id}`)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title={`Edit ${g.name}`}
                            aria-label={`Edit ${g.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(g)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            title={`Delete ${g.name}`}
                            aria-label={`Delete ${g.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              page={page}
              pageSize={GIFT_BOXES_PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ErpConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this gift box?"
        message={
          <>
            <span className="font-bold text-navy">{deleteTarget?.name}</span> ({deleteTarget?.sku}) will
            be removed from the catalogue and can no longer be ordered. This cannot be undone.
          </>
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Gift Box'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

// ===========================================================================
// CREATE / EDIT VIEW
// ===========================================================================

const ErpGiftBoxFormView: React.FC<{ giftBoxId?: string }> = ({ giftBoxId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = Boolean(giftBoxId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /** The loaded product, so fields this focused form doesn't expose survive a save. */
  const [baseProduct, setBaseProduct] = useState<Partial<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // ---- Form fields (the ONLY five the owner ever fills in) ----------------
  const [imageUrl, setImageUrl] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // ---- Data loading ------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [catsRes, product] = await Promise.all([
          api.getCategories(true),
          giftBoxId ? productApi.getProductById(giftBoxId) : Promise.resolve(undefined)
        ]);
        if (!isMounted) return;

        setCategories(flattenCategories(catsRes));

        if (giftBoxId) {
          if (!product) {
            showToast('That gift box could not be found.', 'error');
            navigate('/admin/gift-boxes');
            return;
          }

          setBaseProduct(product);
          setName(product.name || '');
          setSku(product.sku || '');
          setIsActive(product.isActive ?? true);
          setPrice(Number(product.price) || '');
          setMrp(Number(product.compareAtPrice) || '');

          const primary =
            (product.images || []).find((img) => img.isPrimary)?.url ||
            (product.images || [])[0]?.url ||
            product.primaryImageUrl;
          setImageUrl(primary ? normalizeImageUrl(primary) ?? primary : '');
        }
      } catch (error) {
        showToast(getServerErrorMessage(error, 'Failed to load the gift box form'), 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFormData();
    return () => {
      isMounted = false;
    };
  }, [giftBoxId]);

  // ---- Derived pricing (live as the admin types) -------------------------

  const sellingPrice = Number(price) || 0;
  const mrpValue = Number(mrp) || 0;
  const hasStorefrontDiscount = mrpValue > 0 && sellingPrice > 0 && mrpValue > sellingPrice;
  const storefrontSaving = hasStorefrontDiscount ? mrpValue - sellingPrice : 0;
  const storefrontSavingPercent = hasStorefrontDiscount
    ? Math.round((storefrontSaving / mrpValue) * 100)
    : 0;
  /** Amber, non-blocking: an MRP at/below the selling price never renders struck-through. */
  const showPriceOrderWarning = mrpValue > 0 && sellingPrice > 0 && mrpValue <= sellingPrice;

  // ---- Helpers -----------------------------------------------------------

  const generateAutoSku = () => {
    const namePrefix = name ? name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : 'BOX';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    setSku(`GB-${namePrefix || 'BOX'}-${randomDigits}`);
  };

  const applyImageUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setImageUrl('');
      return;
    }
    setImageUrl(normalizeImageUrl(trimmed) ?? trimmed);
  };

  // ---- Save --------------------------------------------------------------

  /**
   * Resolves the hidden Gift Boxes category. Their live database already has one, so this
   * almost always resolves by slug; it is created only when nothing matches. A duplicate-slug
   * 400 (another admin/tab got there first) is recovered by re-reading the category list.
   */
  const ensureGiftBoxCategory = async (): Promise<Category | undefined> => {
    const existing = findGiftBoxCategory(categories);
    if (existing) return existing;

    try {
      const created = await api.createCategory({ ...GIFT_BOX_CATEGORY_SEED });
      if (created?.id) {
        setCategories((prev) => [...prev, created]);
        return created;
      }
    } catch {
      // Falls through to the re-fetch below — the API answers a duplicate slug with a plain 400.
    }

    const refreshed = flattenCategories(await api.getCategories(true));
    setCategories(refreshed);
    return findGiftBoxCategory(refreshed);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Gift Box Name is required', 'warning');
      nameRef.current?.focus();
      return;
    }
    if (!sku.trim()) {
      showToast('SKU is required', 'warning');
      skuRef.current?.focus();
      return;
    }
    if (sellingPrice <= 0) {
      showToast('Selling Price must be greater than 0', 'warning');
      priceRef.current?.focus();
      return;
    }

    // The API persists images from `imageUrls: string[]` (first url = primary).
    const orderedImageUrls = imageUrl.trim() ? [imageUrl.trim()] : [];
    const base = stripReadOnlyProductFields(baseProduct || {});

    setIsSaving(true);

    // ---------------------------------------------------------------------
    // WHY THIS SCREEN HIDES FIELDS THE API STILL REQUIRES
    // ---------------------------------------------------------------------
    // A gift box has exactly five things: image, name, SKU, MRP, selling price. The owner asked
    // for nothing else on this form. The API, however, validates `categoryId`, `description` and
    // a positive `price` on every product write — so those three are resolved here instead of
    // being put back on screen (this mirrors ErpComboModule, which solves the same problem the
    // same way). Do NOT re-add category or description inputs to this form.
    let effectiveCategoryId: string;
    let effectiveCategoryName: string | undefined;
    try {
      const giftBoxCategory = await ensureGiftBoxCategory();
      if (!giftBoxCategory?.id) {
        showToast('Could not prepare the Gift Boxes category. Please try saving again.', 'error');
        setIsSaving(false);
        return;
      }
      effectiveCategoryId = giftBoxCategory.id;
      effectiveCategoryName = giftBoxCategory.name;
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Could not prepare the Gift Boxes category'), 'error');
      setIsSaving(false);
      return;
    }

    const payload: ProductWritePayload = {
      ...base,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      // Hidden field — the server's NotEmpty rule is met by one written from the name.
      description: base.description?.trim() || buildGiftBoxDescription(name),
      // Hidden field — every gift box is filed under the resolved Gift Boxes category.
      categoryId: effectiveCategoryId,
      categoryName: effectiveCategoryName,
      // Manual prices; the server never writes price / compareAtPrice itself.
      price: sellingPrice,
      compareAtPrice: mrpValue > 0 ? mrpValue : undefined,
      costPrice: Number(base.costPrice) || 0,
      taxRate: 0,
      stockQuantity: base.stockQuantity && base.stockQuantity > 0 ? base.stockQuantity : 9999,
      reorderLevel: base.reorderLevel ?? 10,
      unit: base.unit || 'Box',
      weightKg: base.weightKg ?? 0.5,
      isActive,
      isFeatured: base.isFeatured ?? false,
      productType: base.productType || 'Simple',
      primaryImageUrl: imageUrl.trim() || undefined,
      images: orderedImageUrls.map((url, i) => ({
        id: '',
        url,
        altText: name.trim(),
        sortOrder: i,
        isPrimary: i === 0
      })),
      // What the API actually reads (see comment above).
      imageUrls: orderedImageUrls,
      // The flag that makes this product a gift box.
      isGiftBox: true,
      // A gift box is a sealed SKU, never an assembled bundle. On create nothing is sent, so the
      // product simply has no contents and cannot be a combo; on update an explicit empty list
      // clears any contents it might have had, so it can never be flagged as a combo as well.
      ...(isEdit ? { comboItems: [] } : {})
    };

    try {
      if (isEdit && giftBoxId) {
        await productApi.updateProduct(giftBoxId, payload);
        showToast(`Gift box "${payload.name}" updated successfully!`, 'success');
      } else {
        await productApi.createProduct(payload);
        showToast(`Gift box "${payload.name}" created successfully!`, 'success');
      }
      navigate('/admin/gift-boxes');
    } catch (error) {
      showToast(
        getFirstValidationMessage(error) || getServerErrorMessage(error, 'Error saving this gift box'),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ErpLoadingState message="Loading gift box form..." height="h-96" />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/admin/gift-boxes')}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          title="Back to Gift Boxes"
          aria-label="Back to Gift Boxes"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight">
            {isEdit ? 'Edit Gift Box' : 'Create Gift Box'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEdit
              ? `Update ${name || 'this gift box'}${sku ? ` (${sku})` : ''}.`
              : 'A pre-packed box sold as one sealed SKU — image, name, SKU and price.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: identity & pricing */}
            <div className="lg:col-span-7 space-y-5 text-xs">
              {/* Gift Box Name */}
              <div>
                <label className="font-bold text-navy" htmlFor="gift-box-name">
                  Gift Box Name
                  <RequiredMark />
                </label>
                <input
                  id="gift-box-name"
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali Deluxe Gift Box"
                  className={inputCls}
                />
              </div>

              {/* SKU + auto generate */}
              <div>
                <label className="font-bold text-navy" htmlFor="gift-box-sku">
                  SKU
                  <RequiredMark />
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id="gift-box-sku"
                    ref={skuRef}
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. GB-DIW-101"
                    className={`${inputCls} font-mono uppercase flex-1`}
                  />
                  <button
                    type="button"
                    onClick={generateAutoSku}
                    className="mt-1 px-3 py-2.5 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/10 text-purple text-xs font-bold shrink-0 transition-colors flex items-center space-x-1.5"
                    title="Auto generate a unique gift box SKU"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto SKU</span>
                  </button>
                </div>
              </div>

              {/* ---- Pricing ---- */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-navy" htmlFor="gift-box-mrp">
                      MRP (₹)
                    </label>
                    <input
                      id="gift-box-mrp"
                      type="number"
                      min={0}
                      value={mrp === '' ? '' : mrp}
                      placeholder="e.g. 4000"
                      onChange={(e) => setMrp(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`${inputCls} bg-white`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      The struck-through amount customers compare against.
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-navy" htmlFor="gift-box-selling-price">
                      Selling Price (₹)
                      <RequiredMark />
                    </label>
                    <input
                      id="gift-box-selling-price"
                      ref={priceRef}
                      type="number"
                      min={0}
                      value={price === '' ? '' : price}
                      placeholder="e.g. 2999"
                      onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`${inputCls} font-bold text-navy bg-white`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      What the gift box actually sells for.
                    </p>
                  </div>
                </div>

                {/* Live storefront read-out: what the customer actually sees */}
                {hasStorefrontDiscount && (
                  <div className="p-2.5 rounded-xl bg-white border border-purple/20 text-[11px] font-medium text-navy flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span className="text-slate-500">Customers see</span>
                    <span className="font-black text-xs text-navy">₹{formatMoney(sellingPrice)}</span>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-500">MRP</span>
                    <span className="font-bold text-slate-400 line-through">₹{formatMoney(mrpValue)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold text-emerald-600">
                      Save ₹{formatMoney(storefrontSaving)} ({storefrontSavingPercent}% OFF)
                    </span>
                  </div>
                )}

                {/* Non-blocking warning: MRP at/below the selling price */}
                {showPriceOrderWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      The MRP (₹{formatMoney(mrpValue)}) is not above the selling price (₹
                      {formatMoney(sellingPrice)}) — the storefront will show no struck-through price
                      or discount. You can still save.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: image + status */}
            <div className="lg:col-span-5 space-y-5 text-xs">
              <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <h3 className="text-xs font-black text-navy flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple" />
                  <span>Product Image</span>
                </h3>

                {/* Preview */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden relative shadow-2xs">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Gift box preview"
                      className="w-full h-52 object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 min-h-48 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-2 shadow-2xs">
                        <PackageOpen className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-navy">No Gift Box Image Set</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                        Upload a photo below (or paste a link) to set the gift box image
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload to R2 (preferred) or paste an existing link */}
                <ImageUploadField
                  label="Set Product Image"
                  folder="products"
                  hidePreview
                  value={imageUrl}
                  onChange={applyImageUrl}
                  urlPlaceholder="…or paste a Google Drive / web link"
                />

                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                      showToast('Gift box image removed', 'info');
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <div className="font-bold text-navy">Catalog Visibility</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isActive
                      ? 'Gift box is active, visible, and purchasable by customers.'
                      : 'Gift box is hidden from the store catalog.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label="Toggle gift box visibility"
                  onClick={() => setIsActive((v) => !v)}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <span
                    className={`text-[10px] font-bold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${
                        isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={() => navigate('/admin/gift-boxes')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : isEdit ? 'Save Gift Box' : 'Create Gift Box'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ErpGiftBoxModule: React.FC<ErpGiftBoxModuleProps> = ({ mode = 'list', giftBoxId }) => {
  if (mode === 'form') {
    // Remount the form when the edited gift box changes so all local state resets.
    return <ErpGiftBoxFormView key={giftBoxId || 'new'} giftBoxId={giftBoxId} />;
  }
  return <ErpGiftBoxListView />;
};

export default ErpGiftBoxModule;
