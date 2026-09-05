import React, { useEffect, useState } from 'react';
import { ChevronLeft, Clock, Loader2, MapPin, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface NavProps {
  onNavigate: (page: string, params?: any) => void;
}

type AddressLabel = 'Home' | 'Office' | 'Other';

/** AddressDto per docs/API_CONTRACTS_PHASE1.md §3. */
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

/** "9876543210" -> "98765 43210" (design 14 shows spaced phone numbers). */
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

/** Design 14: My Addresses — Home (Default) / Office / Other cards with Edit + Delete, "+ Add New".
 *  `selectMode` — when opened from checkout, tapping an address returns it via onSelect. */
export const ScreenAddresses: React.FC<NavProps & { selectMode?: boolean; onSelect?: (address: any) => void }> = ({
  onNavigate,
  selectMode,
  onSelect
}) => {
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit sheet
  const [sheetOpen, setSheetOpen] = useState(false);
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
      .then((list) => {
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
    setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setSheetOpen(true);
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
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
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
      setSheetOpen(false);
      setEditingId(null);
      loadAddresses();
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || err?.message || 'Could not save the address. Please try again.',
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
      setAddresses((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      showToast('Address deleted', 'info');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || err?.message || 'Could not delete the address. Please try again.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (a: AddressDto) => {
    const previous = addresses;
    setAddresses((prev) => prev.map((x) => ({ ...x, isDefault: x.id === a.id })));
    try {
      await api.setDefaultAddress(a.id);
      showToast(`${a.label} is now your default address`, 'success');
    } catch {
      setAddresses(previous);
      showToast('Could not update the default address. Please try again.', 'error');
    }
  };

  const handleCardTap = (a: AddressDto) => {
    if (selectMode && onSelect) onSelect(a);
  };

  return (
    <div className="p-4 pb-8 font-sans bg-[#fbfbfb] min-h-full animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-navy">My Addresses</h2>
          <button onClick={openAdd} className="text-sm font-bold text-purple hover:text-purple-dark transition-colors">
            + Add New
          </button>
        </div>
        {selectMode && (
          <p className="text-[11px] text-slate-500 mt-1">Tap an address to deliver to it.</p>
        )}

        {/* Body */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="p-10 text-center">
              <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading your addresses...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-bold text-navy">No addresses saved yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add a delivery address to speed up your checkout.
                </p>
              </div>
              <button
                onClick={openAdd}
                className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold uppercase tracking-wider shadow-glow-purple transition-colors"
              >
                + Add New Address
              </button>
            </div>
          ) : (
            addresses.map((a) => (
              <div
                key={a.id}
                onClick={() => handleCardTap(a)}
                className={`rounded-xl border border-slate-100 shadow-card p-4 bg-white ${
                  selectMode ? 'cursor-pointer active:bg-purple-soft/40 transition-colors' : ''
                }`}
              >
                {/* Label row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-navy">{a.label}</span>
                    {a.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark text-[10px] font-bold">
                        (Default)
                      </span>
                    )}
                  </div>
                  {!a.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(a);
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-purple border border-slate-200 hover:border-purple/40 rounded-lg px-2 py-1 transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                </div>

                {/* Address lines */}
                <div className="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-700">{a.fullName}</div>
                  <div>
                    {a.addressLine1}
                    {a.addressLine2 ? `, ${a.addressLine2}` : ''},
                  </div>
                  <div>
                    {a.city} - {a.pincode}
                  </div>
                </div>

                {/* Phone + actions */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[13px] text-slate-600">Ph: {fmtPhone(a.phone)}</span>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(a);
                      }}
                      className="text-sm font-bold text-purple hover:text-purple-dark transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(a);
                      }}
                      className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Add / Edit full-screen sheet ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 bg-[#fbfbfb] overflow-y-auto animate-fade-in">
          {/* Sheet header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center space-x-2">
            <button onClick={closeSheet} aria-label="Back" className="p-1 -ml-1 text-slate-700">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-black text-navy">
              {editingId ? 'Edit Address' : 'Add New Address'}
            </h2>
          </div>

          <div className="p-4 pb-10 space-y-4 max-w-md mx-auto">
            {/* Label chips */}
            <FormField label="Label" required>
              <div className="flex space-x-2">
                {LABELS.map((label) => (
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

            <FormField label="Full Name" required>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
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
                onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className={inputClass}
              />
            </FormField>

            <FormField label="Address Line 1" required>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setField('addressLine1', e.target.value)}
                placeholder="House / flat no., street"
                className={inputClass}
              />
            </FormField>

            <FormField label="Address Line 2">
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => setField('addressLine2', e.target.value)}
                placeholder="Area, landmark (optional)"
                className={inputClass}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" required>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
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
                  onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField label="State" required>
              <select
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                className={inputClass}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="flex items-center space-x-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setField('isDefault', e.target.checked)}
                className="w-4 h-4 rounded accent-purple"
              />
              <span className="text-sm font-semibold text-slate-600">Set as default address</span>
            </label>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark disabled:opacity-60 text-white text-sm font-bold uppercase tracking-wider shadow-glow-purple transition-colors flex items-center justify-center space-x-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-4 animate-scale-up shadow-2xl text-center">
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
            <div className="flex space-x-3 pt-1">
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
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-bold shadow-md transition-colors flex items-center justify-center space-x-2"
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
