import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Edit2,
  Gift,
  ImageIcon,
  Link as LinkIcon,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import { Category, ComboItem, ComboItemInput, Product } from '../../types';
import { api, getApiErrorDetails } from '../../services/api';
import { productApi, ProductWritePayload } from '../../services/productApi';
import { flattenCategories } from '../../services/categoryApi';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ErpLoadingState } from '../../components/common/ErpLoadingState';
import { Pagination } from '../../components/common/Pagination';
import { ErpConfirmDialog } from './ErpConfirmDialog';

export type ErpComboModuleMode = 'list' | 'form';

interface ErpComboModuleProps {
  /** 'list' renders the combo table, 'form' the create/edit screen. */
  mode?: ErpComboModuleMode;
  /** Product id of the combo being edited (absent = create). */
  comboId?: string;
}

/** One editable line of the combo builder (line total is always derived live). */
interface ComboRow {
  componentProductId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
}

/** How many picker matches to render at once (keeps the list snappy). */
const PICKER_VISIBLE_LIMIT = 40;
const COMBOS_PAGE_SIZE = 10;

const formatMoney = (value: number) =>
  Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '0';

/** Server-computed / read-only fields that must never be echoed back on write. */
const stripReadOnlyComboFields = (product: Partial<Product>): Partial<Product> => {
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

/** A combo is a product with contents — tolerate list DTOs that only send the count. */
const isComboProduct = (p: Product) => Boolean(p.isCombo) || (p.comboItemCount ?? 0) > 0;

/** Slugs that already mean "the combo bucket", most preferred first. */
const COMBO_CATEGORY_SLUGS = ['combos', 'combo-offers', 'gift-boxes'];
/** Last-resort match on the category name when none of the known slugs exist. */
const COMBO_CATEGORY_NAME_PATTERN = /gift\s*box|combo|hamper/i;
/** Payload used the first time a combo is saved on a store that has no combo category yet. */
const COMBO_CATEGORY_SEED = {
  name: 'Combos',
  slug: 'combos',
  description: 'Combo packs and gift boxes bundled from catalogue products.',
  displayOrder: 1,
  isActive: true
};
/** How many product names the auto-written description spells out before "and N more". */
const DESCRIPTION_ITEM_LIMIT = 3;

/**
 * Picks the category every combo is silently filed under: an exact `combos` slug, then the other
 * known combo slugs, then anything whose name reads like a gift box / combo / hamper.
 */
const findComboCategory = (list: Category[]): Category | undefined => {
  for (const slug of COMBO_CATEGORY_SLUGS) {
    const bySlug = list.find((c) => (c.slug || '').trim().toLowerCase() === slug);
    if (bySlug) return bySlug;
  }
  return list.find((c) => COMBO_CATEGORY_NAME_PATTERN.test(c.name || ''));
};

/**
 * Description is optional on this screen, but the API's validator is NotEmpty — so when the admin
 * leaves it blank we write one from the contents, e.g.
 * "Combo pack containing Sparkler 10cm ×2, Flower Pot ×1 and 2 more."
 */
const buildComboDescription = (comboName: string, rows: ComboRow[]): string => {
  if (rows.length === 0) return `Combo pack: ${comboName.trim() || 'gift box'}.`;
  const listed = rows
    .slice(0, DESCRIPTION_ITEM_LIMIT)
    .map((r) => `${r.productName} ×${Math.max(1, Math.round(Number(r.quantity) || 1))}`);
  const remaining = rows.length - listed.length;
  const parts = remaining > 0 ? [...listed, `${remaining} more`] : listed;
  const sentence =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Combo pack containing ${sentence}.`;
};

// ===========================================================================
// LIST VIEW
// ===========================================================================

const ErpComboListView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [combos, setCombos] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCombos = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await productApi.getAllProducts();
      setCombos(all.filter(isComboProduct));
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Failed to load combos'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter(
      (c) => (c.name || '').toLowerCase().includes(q) || (c.sku || '').toLowerCase().includes(q)
    );
  }, [combos, search]);

  // Keep the pager inside its bounds when the filter shrinks the result set.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / COMBOS_PAGE_SIZE));
    setPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [filtered.length]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * COMBOS_PAGE_SIZE, page * COMBOS_PAGE_SIZE),
    [filtered, page]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteProduct(deleteTarget.id);
      showToast(`Combo "${deleteTarget.name}" deleted. The products inside it are untouched.`, 'success');
      setCombos((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Failed to delete this combo'), 'error');
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
            <Gift className="w-5 h-5 text-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy tracking-tight">Combos &amp; Gift Boxes</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Bundle several products together and sell them at your own price.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/admin/combos/new')}
          className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-purple/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Combo</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-80 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search combo name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search combos by name or SKU"
            className="w-full bg-transparent outline-none text-navy placeholder-slate-400"
          />
        </div>
        <div className="text-xs font-bold text-slate-500">
          Total Combos: <span className="text-navy">{combos.length}</span>
        </div>
      </div>

      {isLoading ? (
        <ErpLoadingState message="Loading combos & gift boxes..." height="h-64" />
      ) : combos.length === 0 ? (
        /* Friendly first-run empty state */
        <div className="p-10 rounded-3xl bg-white border border-slate-200 shadow-2xs text-center space-y-4 max-w-md mx-auto my-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-purple/10 border border-purple/20 text-purple flex items-center justify-center mx-auto">
            <Gift className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-navy">No combos yet</h3>
            <p className="text-xs text-slate-500 font-medium">
              A combo packs several catalogue products into one gift box. Their combined value becomes
              the struck-through price, and you type the actual selling price by hand.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/admin/combos/new')}
              className="px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all"
            >
              Create your first combo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Combo</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Contents</th>
                  <th className="py-3 px-3">Selling Price</th>
                  <th className="py-3 px-3">Struck Price</th>
                  <th className="py-3 px-3">Customer Saves</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No combos match "{search}".
                    </td>
                  </tr>
                )}
                {paged.map((c) => {
                  const sellingPrice = Number(c.price) || 0;
                  const struckPrice = Number(c.compareAtPrice) || 0;
                  const hasDiscount = struckPrice > 0 && sellingPrice > 0 && struckPrice > sellingPrice;
                  const saving = hasDiscount ? struckPrice - sellingPrice : 0;
                  const savingPercent = hasDiscount ? Math.round((saving / struckPrice) * 100) : 0;
                  const thumb = normalizeImageUrl(c.primaryImageUrl);
                  const itemCount = c.comboItemCount ?? c.comboItems?.length ?? 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={c.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple/5 border border-purple/15 flex items-center justify-center shrink-0">
                              <Gift className="w-4 h-4 text-purple/60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-navy text-xs truncate">{c.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {c.categoryName || 'Uncategorised'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-purple">{c.sku}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[10px] font-bold border border-purple/20 whitespace-nowrap">
                          <Gift className="w-2.5 h-2.5" />
                          {itemCount} item{itemCount === 1 ? '' : 's'} inside
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-navy text-xs">₹{formatMoney(sellingPrice)}</div>
                      </td>
                      <td className="py-3 px-3">
                        {struckPrice > 0 ? (
                          <div
                            className={
                              hasDiscount
                                ? 'text-slate-400 line-through font-bold'
                                : 'text-slate-500 font-bold'
                            }
                          >
                            ₹{formatMoney(struckPrice)}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {hasDiscount ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
                            Save ₹{formatMoney(saving)} ({savingPercent}% OFF)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            No struck price set
                          </span>
                        )}
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
                            onClick={() => navigate(`/admin/combos/${c.id}`)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title={`Edit ${c.name}`}
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            title={`Delete ${c.name}`}
                            aria-label={`Delete ${c.name}`}
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
              pageSize={COMBOS_PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ErpConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this combo?"
        message={
          <>
            <span className="font-bold text-navy">{deleteTarget?.name}</span> ({deleteTarget?.sku}) will be
            removed from the catalogue. Only the bundle itself is deleted — every product inside it stays
            in your catalogue and on sale as usual. This cannot be undone.
          </>
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Combo'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};


const ErpComboFormView: React.FC<{ comboId?: string }> = ({ comboId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = Boolean(comboId);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  /** The loaded product, so fields this focused form doesn't expose survive a save. */
  const [baseProduct, setBaseProduct] = useState<Partial<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // ---- Form fields -------------------------------------------------------
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [price, setPrice] = useState<number | ''>('');
  const [compareAtPrice, setCompareAtPrice] = useState<number | ''>('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // ---- Combo contents ----------------------------------------------------
  const [comboRows, setComboRows] = useState<ComboRow[]>([]);
  const [pickerProducts, setPickerProducts] = useState<Product[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(true);
  const [isPickerUnavailable, setIsPickerUnavailable] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerHighlight, setPickerHighlight] = useState(0);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const pickerListRef = useRef<HTMLUListElement>(null);
  const pickerListboxId = 'combo-module-picker-listbox';

  // ---- Data loading ------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [catsRes, product] = await Promise.all([
          api.getCategories(true),
          comboId ? productApi.getProductById(comboId) : Promise.resolve(undefined)
        ]);
        if (!isMounted) return;

        const flat = flattenCategories(catsRes);
        setCategories(flat);

        if (comboId) {
          if (!product) {
            showToast('That combo could not be found.', 'error');
            navigate('/admin/combos');
            return;
          }

          setBaseProduct(product);
          setName(product.name || '');
          setSku(product.sku || '');
          setDescription(product.description || '');
          setIsActive(product.isActive ?? true);
          setPrice(Number(product.price) || '');
          setCompareAtPrice(Number(product.compareAtPrice) || '');

          const primary =
            (product.images || []).find((img) => img.isPrimary)?.url ||
            (product.images || [])[0]?.url ||
            product.primaryImageUrl;
          setImageUrl(primary ? normalizeImageUrl(primary) ?? primary : '');

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
        }
      } catch (error) {
        showToast(getServerErrorMessage(error, 'Failed to load the combo form'), 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFormData();
    return () => {
      isMounted = false;
    };
  }, [comboId]);

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
            : 'Could not load the product list. Try reloading before building this combo.',
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

  // ---- Derived pricing ---------------------------------------------------

  const comboTotal = useMemo(
    () => comboRows.reduce((sum, r) => sum + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 0), 0),
    [comboRows]
  );
  const comboUnitCount = useMemo(
    () => comboRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
    [comboRows]
  );

  const sellingPrice = Number(price) || 0;
  const struckPrice = Number(compareAtPrice) || 0;
  const hasStorefrontDiscount = struckPrice > 0 && sellingPrice > 0 && struckPrice > sellingPrice;
  const storefrontSaving = hasStorefrontDiscount ? struckPrice - sellingPrice : 0;
  const storefrontSavingPercent = hasStorefrontDiscount
    ? Math.round((storefrontSaving / struckPrice) * 100)
    : 0;
  /** Amber, non-blocking: a struck price at/below the selling price never renders struck-through. */
  const showPriceOrderWarning = struckPrice > 0 && sellingPrice > 0 && struckPrice <= sellingPrice;
  /** Amber, non-blocking: a combo with nothing inside it. */
  const showEmptyComboWarning = comboRows.length === 0;

  /** Candidates: everything except this combo itself and other combos (no nesting). */
  const comboCandidates = useMemo(
    () => pickerProducts.filter((p) => p.id !== comboId && !isComboProduct(p)),
    [pickerProducts, comboId]
  );

  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const matched = q
      ? comboCandidates.filter(
          (p) => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
        )
      : comboCandidates;
    return matched.slice(0, PICKER_VISIBLE_LIMIT);
  }, [comboCandidates, pickerQuery]);

  // Keep the highlighted row inside its bounds and scrolled into view.
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

  // ---- Helpers -----------------------------------------------------------

  const generateAutoSku = () => {
    const namePrefix = name ? name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : 'GFT';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    setSku(`CMB-${namePrefix || 'GFT'}-${randomDigits}`);
  };

  const applyImageUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    setImageUrl(normalizeImageUrl(trimmed) ?? trimmed);
    setImageUrlInput('');
    showToast('Combo image updated!', 'success');
  };

  // ---- Save --------------------------------------------------------------

  /**
   * Resolves the hidden combo category, creating it once if the store has none. A duplicate-slug
   * 400 (another admin/tab got there first) is recovered by re-reading the category list.
   */
  const ensureComboCategory = async (): Promise<Category | undefined> => {
    const existing = findComboCategory(categories);
    if (existing) return existing;

    try {
      const created = await api.createCategory({ ...COMBO_CATEGORY_SEED });
      if (created?.id) {
        setCategories((prev) => [...prev, created]);
        return created;
      }
    } catch {
      // Falls through to the re-fetch below — the API answers a duplicate slug with a plain 400.
    }

    const refreshed = flattenCategories(await api.getCategories(true));
    setCategories(refreshed);
    return findComboCategory(refreshed);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Combo Name is required', 'warning');
      nameRef.current?.focus();
      return;
    }
    if (!sku.trim()) {
      showToast('SKU is required', 'warning');
      skuRef.current?.focus();
      return;
    }
    if (comboRows.length === 0) {
      showToast(
        'Add at least one product to this combo — a combo with no contents cannot be saved here.',
        'error'
      );
      return;
    }
    if (sellingPrice <= 0) {
      showToast('Selling Price must be greater than 0', 'warning');
      priceRef.current?.focus();
      return;
    }

    // The API persists images from `imageUrls: string[]` (first url = primary).
    const orderedImageUrls = imageUrl.trim() ? [imageUrl.trim()] : [];

    const comboItemsPayload: ComboItemInput[] = comboRows.map((r) => ({
      componentProductId: r.componentProductId,
      quantity: Math.max(1, Math.round(Number(r.quantity) || 1))
    }));

    const base = stripReadOnlyComboFields(baseProduct || {});

    setIsSaving(true);


    let effectiveCategoryId: string;
    let effectiveCategoryName: string | undefined;
    try {
      const comboCategory = await ensureComboCategory();
      if (!comboCategory?.id) {
        showToast('Could not prepare the Combos category. Please try saving again.', 'error');
        setIsSaving(false);
        return;
      }
      effectiveCategoryId = comboCategory.id;
      effectiveCategoryName = comboCategory.name;
    } catch (error) {
      showToast(getServerErrorMessage(error, 'Could not prepare the Combos category'), 'error');
      setIsSaving(false);
      return;
    }

    const payload: ProductWritePayload = {
      ...base,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      // Blank is allowed on this screen; the server's NotEmpty rule is met by an auto-written one.
      description: description.trim() || buildComboDescription(name, comboRows),
      categoryId: effectiveCategoryId,
      categoryName: effectiveCategoryName,
      // Manual selling price; the server never writes price / compareAtPrice itself.
      price: sellingPrice,
      compareAtPrice: struckPrice > 0 ? struckPrice : undefined,
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
      comboItems: comboItemsPayload
    };

    try {
      if (isEdit && comboId) {
        await productApi.updateProduct(comboId, payload);
        showToast(`Combo "${payload.name}" updated successfully!`, 'success');
      } else {
        await productApi.createProduct(payload);
        showToast(`Combo "${payload.name}" created successfully!`, 'success');
      }
      navigate('/admin/combos');
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 404 && !isEdit) {
        showToast(
          'This server build does not support combo contents yet. Ask your developer to update the API.',
          'warning'
        );
        return;
      }
      showToast(
        getFirstValidationMessage(error) || getServerErrorMessage(error, 'Error saving this combo'),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };


  const handleConvertToNormalProduct = async () => {
    if (!comboId || !baseProduct) return;

    setIsConverting(true);
    try {
      const base = stripReadOnlyComboFields(baseProduct);
      const existingImageUrls = Array.from(
        new Set(
          [
            (baseProduct.images || []).find((img) => img.isPrimary)?.url,
            ...(baseProduct.images || []).map((img) => img.url),
            baseProduct.primaryImageUrl
          ]
            .map((u) => (u || '').trim())
            .filter(Boolean)
        )
      );

      await productApi.updateProduct(comboId, {
        ...base,
        imageUrls: existingImageUrls,
        // Explicit empty array = clear. Never omit this key here.
        comboItems: []
      });

      showToast(
        `"${baseProduct.name}" is a normal product again — the bundle contents were removed.`,
        'success'
      );
      setShowConvertConfirm(false);
      navigate('/admin/combos');
    } catch (error) {
      showToast(
        getFirstValidationMessage(error) ||
          getServerErrorMessage(error, 'Could not convert this combo back to a normal product'),
        'error'
      );
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading) {
    return <ErpLoadingState message="Loading combo form..." height="h-96" />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/admin/combos')}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          title="Back to Combos"
          aria-label="Back to Combos"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight">
            {isEdit ? 'Edit Combo' : 'Create Combo'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEdit
              ? `Update ${name || 'this combo'}${sku ? ` (${sku})` : ''} and what's inside it.`
              : 'Bundle several products together and sell them at your own price.'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Combo details, contents & pricing */}
            <div className="lg:col-span-7 space-y-5 text-xs">
              {/* Combo Name */}
              <div>
                <label className="font-bold text-navy" htmlFor="combo-name">
                  Combo Name
                  <RequiredMark />
                </label>
                <input
                  id="combo-name"
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali Family Gift Box"
                  className={inputCls}
                />
              </div>

              {/* SKU + auto generate */}
              <div>
                <label className="font-bold text-navy" htmlFor="combo-sku">
                  SKU
                  <RequiredMark />
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id="combo-sku"
                    ref={skuRef}
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. CMB-DIW-101"
                    className={`${inputCls} font-mono uppercase flex-1`}
                  />
                  <button
                    type="button"
                    onClick={generateAutoSku}
                    className="mt-1 px-3 py-2.5 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/10 text-purple text-xs font-bold shrink-0 transition-colors flex items-center space-x-1.5"
                    title="Auto generate a unique combo SKU"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto SKU</span>
                  </button>
                </div>
              </div>

              {/* Description (optional — written from the contents when left blank) */}
              <div>
                <label
                  className="font-bold text-navy flex items-center justify-between"
                  htmlFor="combo-description"
                >
                  <span>Description</span>
                  <span className="text-[10px] font-semibold text-slate-400">Optional</span>
                </label>
                <textarea
                  id="combo-description"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what's inside this gift box, who it's for and any safety guidelines..."
                  className={inputCls}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Leave this blank and we'll write one from the combo contents for you.
                </p>
              </div>

              {/* ---- Combo Contents ---- */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-navy flex items-center space-x-1.5">
                    <Gift className="w-3.5 h-3.5 text-purple" />
                    <span>Combo Contents</span>
                  </h3>
                  <span className="text-[10px] font-bold text-purple bg-purple/10 px-2.5 py-0.5 rounded-full">
                    {comboRows.length} product{comboRows.length === 1 ? '' : 's'}
                    {comboUnitCount !== comboRows.length ? ` · ${comboUnitCount} units` : ''}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 -mt-1">
                  Type a product name or SKU to add it. Combos cannot contain other combos.
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
                            ? `combo-module-option-${pickerMatches[pickerHighlight].id}`
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
                            id={`combo-module-option-${p.id}`}
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
                    <p className="text-[11px] font-bold text-navy">Nothing inside this combo yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Search above and add at least one product before saving.
                    </p>
                  </div>
                )}

                {/* Non-blocking warning: an empty combo can't be saved */}
                {showEmptyComboWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      This combo has no products inside it. Add at least one product — an empty combo
                      can't be saved from this screen.
                    </span>
                  </div>
                )}
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

                {/* Live contents total + "Use as struck price" */}
                <div className="p-3 rounded-xl bg-white border border-purple/20 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-navy">
                      Combo Contents Total:{' '}
                      <span className="text-sm font-black">₹{formatMoney(comboTotal)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {comboRows.length} product{comboRows.length === 1 ? '' : 's'} · {comboUnitCount} item
                      {comboUnitCount === 1 ? '' : 's'} inside
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={comboTotal <= 0}
                    onClick={() => {
                      setCompareAtPrice(Math.round(comboTotal));
                      showToast(
                        `Struck price set to ₹${formatMoney(comboTotal)} — now type the actual selling price.`,
                        'success'
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-[11px] font-bold shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Use as struck price
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-navy" htmlFor="combo-struck-price">
                      MRP / Struck Price (₹)
                    </label>
                    <input
                      id="combo-struck-price"
                      type="number"
                      min={0}
                      value={compareAtPrice === '' ? '' : compareAtPrice}
                      placeholder="e.g. 10000"
                      onChange={(e) =>
                        setCompareAtPrice(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className={`${inputCls} bg-white`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      The struck-through amount customers compare against.
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-navy" htmlFor="combo-selling-price">
                      Selling Price (₹)
                      <RequiredMark />
                    </label>
                    <input
                      id="combo-selling-price"
                      ref={priceRef}
                      type="number"
                      min={0}
                      value={price === '' ? '' : price}
                      placeholder="e.g. 6500"
                      onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`${inputCls} font-bold text-navy bg-white`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Never calculated — you type what the combo actually sells for.
                    </p>
                  </div>
                </div>

                {/* Storefront read-out: what the customer actually sees */}
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

                {/* Non-blocking warning: struck price at/below the selling price */}
                {showPriceOrderWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      The struck price (₹{formatMoney(struckPrice)}) is not above the selling price
                      (₹{formatMoney(sellingPrice)}) — the storefront will show no struck-through price or
                      discount. You can still save.
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
                  <span>Combo Image</span>
                </h3>

                {/* Preview */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden relative shadow-2xs">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Combo preview"
                      className="w-full h-52 object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 min-h-48 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-2 shadow-2xs">
                        <Gift className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-navy">No Combo Image Set</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                        Paste a Google Drive image link below to set the combo image
                      </p>
                    </div>
                  )}
                </div>

                {/* Google Drive link input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy flex items-center justify-between">
                    <span>Product Image</span>
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
                        aria-label="Google Drive image link"
                        className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyImageUrl(imageUrlInput);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => applyImageUrl(imageUrlInput)}
                      className="px-3.5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold transition-all flex-shrink-0 shadow-xs"
                    >
                      Set Image
                    </button>
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        showToast('Combo image removed', 'info');
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <div className="font-bold text-navy">Catalog Visibility</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isActive
                      ? 'Combo is active, visible, and purchasable by customers.'
                      : 'Combo is hidden from the store catalog.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label="Toggle combo visibility"
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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          {/* Escape hatch for a product that was never meant to be a combo. Edit mode only. */}
          {isEdit ? (
            <button
              type="button"
              onClick={() => setShowConvertConfirm(true)}
              disabled={isSaving || isConverting}
              className="text-xs font-bold text-slate-500 hover:text-navy underline underline-offset-4 decoration-slate-300 hover:decoration-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConverting ? 'Converting...' : 'Convert to normal product'}
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center space-x-3 ml-auto">
            <button
              onClick={() => navigate('/admin/combos')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isConverting}
              className="px-6 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 transition-all disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : isEdit ? 'Save Combo' : 'Create Combo'}
            </button>
          </div>
        </div>
      </div>

      <ErpConfirmDialog
        open={showConvertConfirm}
        title="Convert this back to a normal product?"
        message={
          <>
            The bundle contents of <span className="font-bold text-navy">{name || 'this combo'}</span>
            {sku ? ` (${sku})` : ''} will be removed, so it stops being a combo. The product itself is
            not deleted — it stays in your catalogue and on sale at its own price, and every product
            that was inside the bundle is untouched. You can rebuild it as a combo later from Catalog
            → Combo.
          </>
        }
        confirmLabel={isConverting ? 'Converting...' : 'Convert to normal product'}
        onConfirm={handleConvertToNormalProduct}
        onCancel={() => setShowConvertConfirm(false)}
      />
    </div>
  );
};
export const ErpComboModule: React.FC<ErpComboModuleProps> = ({ mode = 'list', comboId }) => {
  if (mode === 'form') {
    // Remount the form when the edited combo changes so all local state resets.
    return <ErpComboFormView key={comboId || 'new'} comboId={comboId} />;
  }
  return <ErpComboListView />;
};

export default ErpComboModule;
