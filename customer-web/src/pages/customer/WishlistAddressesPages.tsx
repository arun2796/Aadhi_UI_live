import React, { useEffect, useState } from 'react';
import { Heart, Loader2, MapPin, ShoppingCart, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

const inr = (n?: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

const isInStock = (p: Product): boolean => {
  const qty = typeof p.availableQuantity === 'number' ? p.availableQuantity : p.stockQuantity;
  return (qty ?? 0) > 0;
};

const FALLBACK_IMG =
  '/product-placeholder.svg';

/** Desktop design 16: My Wishlist (Move to Cart / Out of Stock rows, Clear Wishlist). */
export const WishlistPage: React.FC<NavProps> = ({ onNavigate }) => {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const openProduct = (p: Product) => {
    if (p.slug) onNavigate('product-detail', { slug: p.slug });
  };

  const handleMoveToCart = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    addToCart(p, 1);
    removeFromWishlist(p.id);
    showToast(`${p.name} moved to cart`, 'success');
  };

  const handleNotifyMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast("We'll notify you when it's back in stock", 'info');
  };

  const handleRemove = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    removeFromWishlist(p.id);
    showToast(`${p.name} removed from wishlist`, 'info');
  };

  const handleClear = () => {
    clearWishlist();
    setShowClearConfirm(false);
    showToast('Wishlist cleared', 'info');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in">
      <h1 className="text-2xl font-black text-navy mb-6">
        My Wishlist ({wishlist.length} {wishlist.length === 1 ? 'item' : 'items'})
      </h1>

      {wishlist.length === 0 ? (
        /* ── Empty state ── */
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-card space-y-4">
          <Heart className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <p className="text-base font-bold text-navy">Your wishlist is empty</p>
            <p className="text-sm text-slate-500 mt-1">
              Tap the heart on any product to save it here for later.
            </p>
          </div>
          <button
            onClick={() => onNavigate('shop')}
            className="px-8 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {/* Items */}
          <div className="divide-y divide-slate-100">
            {wishlist.map(p => {
              const inStock = isInStock(p);
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProduct(p)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') openProduct(p);
                  }}
                  className="flex items-center gap-5 p-5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  {/* Image */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    <img
                      src={p.primaryImageUrl || FALLBACK_IMG}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-navy leading-snug truncate">
                      {p.name}
                    </div>
                    <div className="text-lg font-black text-navy mt-1">{inr(p.price)}</div>
                    {inStock ? (
                      <div className="text-xs font-bold text-emerald-600 mt-1">In Stock</div>
                    ) : (
                      <div className="text-xs font-bold text-red-500 mt-1">Out of Stock</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {inStock ? (
                      <button
                        onClick={e => handleMoveToCart(e, p)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold shadow-glow-purple transition-colors"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Move to Cart</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleNotifyMe}
                        className="px-5 py-2.5 rounded-xl bg-navy hover:bg-navy-light text-white text-sm font-bold transition-colors"
                      >
                        Notify Me
                      </button>
                    )}
                    <button
                      onClick={e => handleRemove(e, p)}
                      aria-label={`Remove ${p.name} from wishlist`}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear wishlist footer */}
          <div className="p-5 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-navy hover:bg-slate-50 transition-colors"
            >
              Clear Wishlist
            </button>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 animate-scale-up shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-navy">Clear wishlist?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will remove all {wishlist.length}{' '}
                {wishlist.length === 1 ? 'item' : 'items'} from your wishlist. This cannot be
                undone.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Desktop design 17: MY ADDRESSES — cards + add/edit modal
   ═══════════════════════════════════════════════════════════════ */

type AddressLabel = 'Home' | 'Office' | 'Other';

/** AddressDto per docs/API_CONTRACTS_PHASE1.md §3 (kept in sync with components/mobile/ScreenAddresses.tsx). */
interface AddressDto {
  id: string;
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const LABELS: AddressLabel[] = ['Home', 'Office', 'Other'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands', 'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

const mapServerAddress = (a: any): AddressDto | null => {
  if (!a || !a.id) return null;
  const label: AddressLabel = LABELS.includes(a.label) ? a.label : 'Other';
  return {
    id: String(a.id),
    label,
    fullName: a.fullName ?? '',
    phone: String(a.phone ?? ''),
    addressLine1: a.addressLine1 ?? '',
    addressLine2: a.addressLine2 || undefined,
    city: a.city ?? '',
    state: a.state ?? '',
    pincode: String(a.pincode ?? ''),
    isDefault: !!a.isDefault
  };
};

/** "9876543210" -> "98765 43210" (design shows spaced phone numbers). */
const fmtPhone = (phone: string) =>
  /^\d{10}$/.test(phone) ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;

interface AddressForm {
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  label: 'Home',
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  isDefault: false
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-navy font-medium placeholder:text-slate-300 focus:outline-none focus:border-purple focus:ring-2 focus:ring-purple/15 transition-colors';

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children
}) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    {children}
  </div>
);

/** Desktop design 17: My Addresses (cards with (Default) badge, Edit/Delete, + Add New Address). */
export const AddressesPage: React.FC<NavProps> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AddressDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAddresses = () => {
    setLoading(true);
    api
      .getAddresses()
      .then(list => {
        const mapped = (Array.isArray(list) ? list : [])
          .map(mapServerAddress)
          .filter((a): a is AddressDto => a !== null);
        setAddresses(mapped);
      })
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadAddresses, []);

  const setField = <K extends keyof AddressForm>(key: K, value: AddressForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setModalOpen(true);
  };

  const openEdit = (a: AddressDto) => {
    setEditingId(a.id);
    setForm({
      label: a.label,
      fullName: a.fullName,
      phone: a.phone.replace(/\D/g, ''),
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 ?? '',
      city: a.city,
      state: a.state || 'Tamil Nadu',
      pincode: a.pincode,
      isDefault: a.isDefault
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
  };

  const validate = (): string | null => {
    if (!form.fullName.trim()) return 'Please enter the full name';
    if (!/^\d{10}$/.test(form.phone)) return 'Please enter a valid 10-digit phone number';
    if (!form.addressLine1.trim()) return 'Please enter the address (line 1)';
    if (!form.city.trim()) return 'Please enter the city';
    if (!form.state) return 'Please select a state';
    if (!/^\d{6}$/.test(form.pincode)) return 'Please enter a valid 6-digit pincode';
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) return showToast(error, 'error');

    const payload = {
      label: form.label,
      fullName: form.fullName.trim(),
      phone: form.phone,
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim(),
      state: form.state,
      pincode: form.pincode,
      isDefault: form.isDefault
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateAddress(editingId, payload);
        showToast('Address updated', 'success');
      } else {
        await api.createAddress(payload);
        showToast('Address saved', 'success');
      }
      setModalOpen(false);
      setEditingId(null);
      loadAddresses();
    } catch (err: any) {
      showToast(
        err?.response?.data?.message ||
          err?.message ||
          'Could not save the address. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteAddress(deleteTarget.id);
      setAddresses(prev => prev.filter(a => a.id !== deleteTarget.id));
      showToast('Address deleted', 'info');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(
        err?.response?.data?.message ||
          err?.message ||
          'Could not delete the address. Please try again.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (a: AddressDto) => {
    const previous = addresses;
    setAddresses(prev => prev.map(x => ({ ...x, isDefault: x.id === a.id })));
    try {
      await api.setDefaultAddress(a.id);
      showToast(`${a.label} is now your default address`, 'success');
    } catch {
      setAddresses(previous);
      showToast('Could not update the default address. Please try again.', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-navy">My Addresses</h1>
        <button
          onClick={openAdd}
          className="text-sm font-bold text-purple hover:text-purple-dark transition-colors"
        >
          + Add New Address
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-card">
          <Loader2 className="w-7 h-7 text-purple animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading your addresses...</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-card space-y-4">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <p className="text-base font-bold text-navy">No addresses saved yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Add a delivery address to speed up your checkout.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="px-8 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-sm font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
          >
            + Add New Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {addresses.map(a => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-200 shadow-card bg-white p-5 flex flex-col"
            >
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-navy">{a.label}</span>
                  {a.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark text-[11px] font-bold">
                      (Default)
                    </span>
                  )}
                </div>
                {!a.isDefault && (
                  <button
                    onClick={() => handleSetDefault(a)}
                    className="text-xs font-bold text-slate-500 hover:text-purple border border-slate-200 hover:border-purple/40 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    Set as Default
                  </button>
                )}
              </div>

              {/* Address lines */}
              <div className="mt-3 text-sm text-slate-600 leading-relaxed flex-1">
                <div className="font-semibold text-slate-700">{a.fullName}</div>
                <div>
                  {a.addressLine1}
                  {a.addressLine2 ? `, ${a.addressLine2}` : ''},
                </div>
                <div>
                  {a.city}
                  {a.state ? `, ${a.state}` : ''} - {a.pincode}
                </div>
              </div>

              {/* Phone + actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-600">Ph: {fmtPhone(a.phone)}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-sm font-bold text-purple hover:text-purple-dark transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-lg font-black text-navy">
                {editingId ? 'Edit Address' : 'Add New Address'}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Label chips */}
              <FormField label="Label" required>
                <div className="flex gap-2">
                  {LABELS.map(label => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setField('label', label)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        form.label === label
                          ? 'bg-purple border-purple text-white shadow-glow-purple'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-purple/40'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full Name" required>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => setField('fullName', e.target.value)}
                    placeholder="e.g. Arun Kumar"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Phone" required>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.phone}
                    onChange={e =>
                      setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="10-digit mobile number"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <FormField label="Address Line 1" required>
                <input
                  type="text"
                  value={form.addressLine1}
                  onChange={e => setField('addressLine1', e.target.value)}
                  placeholder="House / flat no., street"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Address Line 2">
                <input
                  type="text"
                  value={form.addressLine2}
                  onChange={e => setField('addressLine2', e.target.value)}
                  placeholder="Area, landmark (optional)"
                  className={inputClass}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="City" required>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setField('city', e.target.value)}
                    placeholder="e.g. Coimbatore"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Pincode" required>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChange={e =>
                      setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="6-digit pincode"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <FormField label="State" required>
                <select
                  value={form.state}
                  onChange={e => setField('state', e.target.value)}
                  className={inputClass}
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setField('isDefault', e.target.checked)}
                  className="w-4 h-4 rounded accent-purple"
                />
                <span className="text-sm font-semibold text-slate-600">
                  Set as default address
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-purple hover:bg-purple-dark disabled:opacity-60 text-white text-sm font-bold uppercase tracking-wider shadow-glow-purple transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 animate-scale-up shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-navy">Delete address?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will permanently remove your {deleteTarget.label} address
                {deleteTarget.isDefault ? ' (your current default)' : ''}.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
