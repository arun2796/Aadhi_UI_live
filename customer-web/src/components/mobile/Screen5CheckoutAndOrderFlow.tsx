import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  MapPin,
  Truck,
  ChevronRight,
  ChevronLeft,
  Clock,
  QrCode,
  Copy,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Pencil,
  Plus,
  Home,
  Briefcase,
  Banknote,
  Package,
  PackageCheck,
  Headphones,
  Gift,
  Search
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { triggerFireworksConfetti } from '../common/CommonComponents';
import { api } from '../../services/api';

/* ─────────────────────────────────────────────────────────────
   Shared helpers
   ───────────────────────────────────────────────────────────── */

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

interface CheckoutAddress {
  id?: string;
  label: string; // Home | Office | Other
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

interface DeliveryOption {
  code: string;
  name: string;
  charge: number;
  etaMinDays: number;
  etaMaxDays: number;
}

const fmtDayMonth = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtDayMonthYear = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** "03 Sep - 05 Sep 2026" from today + etaMin/etaMax days. */
const etaRange = (opt?: DeliveryOption | null): string => {
  if (!opt) return '';
  const from = new Date();
  from.setDate(from.getDate() + (opt.etaMinDays || 0));
  const to = new Date();
  to.setDate(to.getDate() + (opt.etaMaxDays || 0));
  return `${fmtDayMonth(from)} - ${fmtDayMonthYear(to)}`;
};

const addressOneLine = (a: CheckoutAddress): string =>
  [a.addressLine1, a.addressLine2, a.city ? `${a.city} - ${a.pincode}` : a.pincode]
    .filter(Boolean)
    .join(', ');

/* ─────────────────────────────────────────────────────────────
   Design 05-08: CHECKOUT — 4-step flow
   1 Address → 2 Delivery → 3 Payment → 4 Review
   ───────────────────────────────────────────────────────────── */

interface Screen5CheckoutProps {
  onNavigate: (page: string, params?: any) => void;
  onBack: () => void;
}

const STEP_LABELS = ['Address', 'Delivery', 'Payment', 'Review'];

const CheckoutStepper: React.FC<{ step: number; onStepClick: (s: number) => void }> = ({
  step,
  onStepClick
}) => (
  <div className="flex items-center px-2">
    {STEP_LABELS.map((label, i) => {
      const num = i + 1;
      const done = num < step;
      const active = num === step;
      return (
        <React.Fragment key={label}>
          {i > 0 && (
            <div className={`flex-1 h-0.5 self-start mt-[15px] ${done || active ? 'bg-purple' : 'bg-slate-200'}`} />
          )}
          <button
            type="button"
            onClick={() => { if (done) onStepClick(num); }}
            className="flex flex-col items-center px-1"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done
                  ? 'bg-purple text-white'
                  : active
                  ? 'bg-purple text-white shadow-glow-purple'
                  : 'bg-white border-2 border-slate-300 text-slate-400'
              }`}
            >
              {done ? <Check className="w-4 h-4 stroke-[3]" /> : num}
            </div>
            <span
              className={`text-[10px] mt-1 ${
                active ? 'font-bold text-purple' : done ? 'font-semibold text-navy' : 'font-medium text-slate-400'
              }`}
            >
              {label}
            </span>
          </button>
        </React.Fragment>
      );
    })}
  </div>
);

const LABEL_OPTIONS: Array<{ value: string; icon: React.ReactNode }> = [
  { value: 'Home', icon: <Home className="w-3.5 h-3.5" /> },
  { value: 'Office', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'Other', icon: <MapPin className="w-3.5 h-3.5" /> }
];

export const Screen5Checkout: React.FC<Screen5CheckoutProps> = ({ onNavigate, onBack }) => {
  const { user } = useAuth();
  const { items, subtotal, discount, couponCode, clearCart } = useCart();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ── STEP 1: Address state ── */
  const emptyForm = (): CheckoutAddress => ({
    label: 'Home',
    fullName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    phone: user?.phone || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: ''
  });

  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(Boolean(user));
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState<boolean>(!user);
  const [addressForm, setAddressForm] = useState<CheckoutAddress>(emptyForm);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoadingAddresses(false);
      setShowAddressForm(true);
      return;
    }
    let mounted = true;
    setLoadingAddresses(true);
    api.getAddresses()
      .then(list => {
        if (!mounted) return;
        const mapped: CheckoutAddress[] = (list || []).map((a: any) => ({
          id: String(a.id ?? a.addressId ?? `srv-${Math.random().toString(36).slice(2, 8)}`),
          label: a.label || 'Home',
          fullName: a.fullName || a.name || '',
          phone: a.phone || '',
          addressLine1: a.addressLine1 || '',
          addressLine2: a.addressLine2 || '',
          city: a.city || '',
          state: a.state || 'Tamil Nadu',
          pincode: a.pincode || a.postalCode || '',
          isDefault: Boolean(a.isDefault)
        }));
        setAddresses(mapped);
        if (mapped.length > 0) {
          const def = mapped.find(m => m.isDefault) || mapped[0];
          setSelectedAddressId(def.id || null);
          setShowAddressForm(false);
        } else {
          setShowAddressForm(true);
        }
      })
      .finally(() => { if (mounted) setLoadingAddresses(false); });
    return () => { mounted = false; };
  }, [user]);

  const selectedAddress = useMemo(
    () => addresses.find(a => a.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );

  const validateAddressForm = (): string | null => {
    if (!addressForm.fullName.trim()) return 'Please enter the full name.';
    if (!/^\d{10}$/.test(addressForm.phone.trim())) return 'Please enter a valid 10-digit mobile number.';
    if (!addressForm.addressLine1.trim()) return 'Please enter Address Line 1.';
    if (!addressForm.city.trim()) return 'Please enter the city.';
    if (!addressForm.state.trim()) return 'Please select a state.';
    if (!/^\d{6}$/.test(addressForm.pincode.trim())) return 'Please enter a valid 6-digit pincode.';
    return null;
  };

  const handleSaveAddress = async () => {
    const problem = validateAddressForm();
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setErrorMessage(null);
    setSavingAddress(true);

    const clean: CheckoutAddress = {
      ...addressForm,
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      addressLine1: addressForm.addressLine1.trim(),
      addressLine2: addressForm.addressLine2?.trim() || '',
      city: addressForm.city.trim(),
      pincode: addressForm.pincode.trim()
    };

    let saved: CheckoutAddress = { ...clean };
    if (user) {
      try {
        const dto = {
          label: clean.label,
          fullName: clean.fullName,
          phone: clean.phone,
          addressLine1: clean.addressLine1,
          addressLine2: clean.addressLine2 || undefined,
          city: clean.city,
          state: clean.state,
          pincode: clean.pincode
        };
        if (clean.id && !clean.id.startsWith('local-')) {
          const updated = await api.updateAddress(clean.id, dto);
          saved = { ...clean, ...(updated || {}), id: clean.id };
        } else {
          const created = await api.createAddress(dto);
          saved = { ...clean, id: String(created?.id ?? `local-${Date.now()}`) };
        }
      } catch {
        saved = { ...clean, id: clean.id || `local-${Date.now()}` };
        showToast('Address kept for this order (could not sync with server).', 'warning');
      }
    } else {
      saved = { ...clean, id: clean.id || `local-${Date.now()}` };
    }

    setAddresses(prev => {
      const exists = prev.some(a => a.id === saved.id);
      return exists ? prev.map(a => (a.id === saved.id ? saved : a)) : [...prev, saved];
    });
    setSelectedAddressId(saved.id || null);
    setShowAddressForm(false);
    setSavingAddress(false);
  };

  const handleEditAddress = (a: CheckoutAddress) => {
    setAddressForm({ ...a });
    setShowAddressForm(true);
    setErrorMessage(null);
  };

  /* ── STEP 2: Delivery state ── */
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryCode, setDeliveryCode] = useState<string>('standard');

  useEffect(() => {
    let mounted = true;
    api.getDeliveryOptions(subtotal).then(opts => {
      if (!mounted) return;
      const list = opts && opts.length > 0 ? opts : [];
      setDeliveryOptions(list);
      if (list.length > 0 && !list.some(o => o.code === deliveryCode)) {
        setDeliveryCode(list[0].code);
      }
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const selectedDelivery = useMemo(
    () => deliveryOptions.find(o => o.code === deliveryCode) || deliveryOptions[0] || null,
    [deliveryOptions, deliveryCode]
  );
  const deliveryCharge = selectedDelivery?.charge ?? 0;
  const expectedRange = etaRange(selectedDelivery);

  /* ── STEP 3: Payment state ── */
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'COD'>('UPI');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string>('');

  const officialUpiId = 'aadhicrackers@okaxis';

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(officialUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Screenshot size must be under 5MB');
        return;
      }
      setScreenshotFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  /* ── STEP 4: Totals & Place Order ── */
  const orderTotal = Math.max(0, subtotal - discount) + deliveryCharge;
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToStep = (target: number) => {
    setErrorMessage(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueFromAddress = () => {
    if (showAddressForm && addresses.length === 0) {
      setErrorMessage('Please save your delivery address to continue.');
      return;
    }
    if (!selectedAddress) {
      setErrorMessage('Please select or add a delivery address.');
      return;
    }
    goToStep(2);
  };

  const handleContinueFromPayment = () => {
    if (paymentMethod === 'UPI') {
      if (!utrNumber.trim()) {
        setErrorMessage('Please enter the 12-digit UPI UTR / Transaction Reference ID');
        return;
      }
      if (!screenshotPreview) {
        setErrorMessage('Please attach the Payment Screenshot from GPay / PhonePe / Paytm');
        return;
      }
    }
    goToStep(4);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setErrorMessage('Delivery address is missing.');
      goToStep(1);
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('Please agree to the Terms & Conditions to place the order.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const order = await api.createOrder({
        shippingAddress: {
          fullName: selectedAddress.fullName,
          phone: selectedAddress.phone,
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2,
          city: selectedAddress.city,
          state: selectedAddress.state,
          postalCode: selectedAddress.pincode,
          country: 'India'
        },
        items: items.map(i => ({
          product: {
            id: i.productId,
            name: i.name,
            sku: i.sku,
            price: i.unitPrice,
            categoryName: 'Fireworks',
            categoryId: 'cat-1',
            costPrice: i.unitPrice * 0.7,
            taxRate: 18,
            discountType: 'Percentage',
            discountValue: 0,
            stockQuantity: 100,
            availableQuantity: 100,
            reorderLevel: 10,
            unit: 'Box',
            weightKg: 0.5,
            isActive: true,
            isFeatured: false,
            isBestSeller: false,
            isNewArrival: false,
            slug: i.sku.toLowerCase()
          },
          quantity: i.quantity
        })),
        paymentMethod,
        couponCode: couponCode || undefined,
        deliveryMethod: (deliveryCode === 'express' ? 'express' : 'standard'),
        utrNumber: paymentMethod === 'UPI' ? utrNumber.trim() : undefined,
        paymentScreenshotBase64: paymentMethod === 'UPI' ? (screenshotPreview || undefined) : undefined,
        notes:
          paymentMethod === 'UPI'
            ? `UPI Payment Proof Uploaded. UTR: ${utrNumber.trim()}`
            : 'Cash on Delivery order.'
      });

      clearCart();
      onNavigate('order-placed', {
        orderNumber: order.orderNumber,
        grandTotal: orderTotal,
        paymentMethod,
        utrNumber: paymentMethod === 'UPI' ? utrNumber.trim() : undefined
      });
    } catch (err: any) {
      showToast(err?.message || 'Order could not be placed. Please try again.', 'error');
      onNavigate('payment-failed', { amount: orderTotal });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Empty cart guard ── */
  if (items.length === 0) {
    return (
      <div className="p-6 pt-14 text-center space-y-4 font-sans bg-[#fbfbfb] min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-purple-soft flex items-center justify-center mx-auto">
          <Package className="w-8 h-8 text-purple" />
        </div>
        <div>
          <h2 className="text-base font-black text-navy">Your cart is empty</h2>
          <p className="text-xs text-slate-500 mt-1">Add some crackers to your cart to checkout.</p>
        </div>
        <button
          onClick={() => onNavigate('home')}
          className="px-6 py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  const errorBanner = errorMessage && (
    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-center space-x-1.5">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{errorMessage}</span>
    </div>
  );

  const backButton = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="flex-1 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-navy font-bold text-xs flex items-center justify-center space-x-1 transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Back</span>
    </button>
  );

  return (
    <div className="space-y-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Purple numbered stepper: 1 Address → 2 Delivery → 3 Payment → 4 Review */}
      <div className="px-4 pt-4">
        <CheckoutStepper step={step} onStepClick={goToStep} />
      </div>

      {/* ═══════════ STEP 1: ADDRESS (design 05) ═══════════ */}
      {step === 1 && (
        <div className="px-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-navy">Delivery Address</h3>
            <button
              onClick={() => {
                setAddressForm(emptyForm());
                setShowAddressForm(v => !v);
                setErrorMessage(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-soft text-purple text-[11px] font-bold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddressForm ? 'Hide Form' : 'Add New Address'}</span>
            </button>
          </div>

          {loadingAddresses ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-slate-100 shadow-card">
              <Clock className="w-5 h-5 text-purple animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading saved addresses...</p>
            </div>
          ) : (
            addresses.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAddressId(a.id || null)}
                className={`w-full text-left p-4 rounded-2xl bg-white border transition-all shadow-xs ${
                  selectedAddressId === a.id ? 'border-purple ring-1 ring-purple/30' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Radio */}
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedAddressId === a.id ? 'border-purple' : 'border-slate-300'
                    }`}
                  >
                    {selectedAddressId === a.id && <div className="w-2 h-2 rounded-full bg-purple" />}
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-black text-navy text-[13px]">{a.label}</div>
                    <div className="font-semibold text-slate-700 mt-0.5">{a.fullName}</div>
                    <div className="text-slate-500 mt-0.5 leading-relaxed">{addressOneLine(a)}</div>
                    {a.phone && <div className="text-slate-500 mt-0.5">Ph: {a.phone}</div>}
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleEditAddress(a); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple hover:bg-purple-soft transition-colors cursor-pointer"
                    title="Edit address"
                  >
                    <Pencil className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))
          )}

          {/* Inline Add / Edit form */}
          {showAddressForm && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3 text-xs animate-fade-in">
              <div className="font-bold text-navy text-[13px]">
                {addressForm.id ? 'Edit Address' : 'Add New Address'}
              </div>

              {/* Label chips */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Save As</label>
                <div className="flex space-x-2">
                  {LABEL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, label: opt.value })}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center space-x-1 transition-colors ${
                        addressForm.label === opt.value
                          ? 'bg-purple text-white border-purple'
                          : 'bg-white text-slate-500 border-slate-300'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  placeholder="e.g. Arun Kumar"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone (10 Digits) *</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  placeholder="123, West Street, Sivanandapuram"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={addressForm.addressLine2 || ''}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                  placeholder="Landmark, Area (optional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City *</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="Coimbatore"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pincode *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, '') })}
                    placeholder="641012"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">State *</label>
                <select
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-purple"
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSaveAddress}
                disabled={savingAddress}
                className={`w-full py-3 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors ${
                  savingAddress ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {savingAddress ? 'Saving...' : addressForm.id ? 'Update Address' : 'Save Address'}
              </button>
            </div>
          )}

          {errorBanner}

          <div className="flex space-x-2 pt-1">
            {backButton(onBack)}
            <button
              onClick={handleContinueFromAddress}
              className="flex-[2] py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-1"
            >
              <span>Continue to Delivery</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 2: DELIVERY (design 06) ═══════════ */}
      {step === 2 && (
        <div className="px-4 space-y-3 animate-fade-in">
          <h3 className="font-black text-sm text-navy">Delivery Information</h3>

          {/* Deliver to summary */}
          {selectedAddress && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="text-slate-400 font-semibold text-[11px]">Deliver to</div>
                <div className="font-bold text-navy">{selectedAddress.fullName}</div>
                <div className="text-slate-500 leading-relaxed">{addressOneLine(selectedAddress)}</div>
                <div className="text-slate-500">Ph: {selectedAddress.phone}</div>
              </div>
              <button
                onClick={() => goToStep(1)}
                className="text-purple font-bold text-[11px] hover:underline flex-shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          )}

          {/* Delivery options */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="font-bold text-navy text-xs">Delivery Options</div>
            {deliveryOptions.length === 0 ? (
              <div className="text-xs text-slate-400 flex items-center space-x-2">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Loading delivery options...</span>
              </div>
            ) : (
              deliveryOptions.map(opt => (
                <button
                  key={opt.code}
                  onClick={() => setDeliveryCode(opt.code)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    deliveryCode === opt.code ? 'border-purple ring-1 ring-purple/30 bg-purple/[0.03]' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        deliveryCode === opt.code ? 'border-purple' : 'border-slate-300'
                      }`}
                    >
                      {deliveryCode === opt.code && <div className="w-2 h-2 rounded-full bg-purple" />}
                    </div>
                    <div className="text-xs font-semibold text-slate-700">{opt.name}</div>
                  </div>
                  <div
                    className={`text-xs font-black ${opt.charge === 0 ? 'text-emerald-600' : 'text-navy'}`}
                  >
                    {opt.charge === 0 ? 'FREE' : inr(opt.charge)}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Green expected delivery note */}
          {expectedRange && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs font-bold text-emerald-700">
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span>Expected delivery between {expectedRange}</span>
            </div>
          )}

          {errorBanner}

          <div className="flex space-x-2 pt-1">
            {backButton(() => goToStep(1))}
            <button
              onClick={() => goToStep(3)}
              className="flex-[2] py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-1"
            >
              <span>Continue to Payment</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 3: PAYMENT (design 07) ═══════════ */}
      {step === 3 && (
        <div className="px-4 space-y-3 animate-fade-in">
          <h3 className="font-black text-sm text-navy">Payment Methods</h3>

          {/* UPI / QR option */}
          <button
            onClick={() => setPaymentMethod('UPI')}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border text-left transition-all shadow-xs ${
              paymentMethod === 'UPI' ? 'border-purple ring-1 ring-purple/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  paymentMethod === 'UPI' ? 'border-purple' : 'border-slate-300'
                }`}
              >
                {paymentMethod === 'UPI' && <div className="w-2 h-2 rounded-full bg-purple" />}
              </div>
              <QrCode className="w-4 h-4 text-purple" />
              <div>
                <div className="text-xs font-bold text-navy">UPI / QR</div>
                <div className="text-[10px] text-slate-400">GPay • PhonePe • Paytm • BHIM</div>
              </div>
            </div>
          </button>

          {/* UPI details: QR + UTR + screenshot proof */}
          {paymentMethod === 'UPI' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card text-center space-y-3">
                <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-navy">
                  <QrCode className="w-4 h-4 text-purple" />
                  <span>Scan & Pay via any UPI App</span>
                </div>

                <div className="w-44 h-44 mx-auto bg-white p-3 rounded-2xl border-2 border-purple/30 shadow-inner flex flex-col items-center justify-center relative group">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${officialUpiId}%26pn=AADHI%20CRACKERS%26am=${orderTotal}%26cu=INR`}
                    alt="Aadhi Crackers UPI QR Code"
                    className="w-36 h-36 object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 bg-navy/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold p-2 text-center">
                    GPay • PhonePe • Paytm • BHIM
                  </div>
                </div>

                <div className="bg-purple/5 border border-purple/15 rounded-xl p-2.5 space-y-1 text-xs">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Amount to Transfer
                  </div>
                  <div className="text-lg font-black text-navy">{inr(orderTotal)}</div>
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <span className="font-mono text-purple font-bold text-xs">{officialUpiId}</span>
                    <button
                      onClick={handleCopyUpi}
                      className="p-1 rounded bg-purple text-white hover:bg-purple-light transition-colors text-[10px] flex items-center space-x-1"
                      title="Copy UPI ID"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
                <h4 className="text-xs font-bold text-navy flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Submit Payment Proof</span>
                </h4>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    12-Digit UPI UTR / Ref No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 423456789012"
                    maxLength={20}
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Upload Payment Screenshot <span className="text-rose-500">*</span>
                  </label>

                  {screenshotPreview ? (
                    <div className="relative rounded-xl border border-emerald-300 bg-emerald-50/50 p-2 flex items-center space-x-3">
                      <img
                        src={screenshotPreview}
                        alt="Payment Proof Preview"
                        className="w-14 h-14 rounded-lg object-cover border border-emerald-200"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-bold text-emerald-800 truncate">
                          {screenshotFileName || 'Payment_Proof.jpg'}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Screenshot attached</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setScreenshotPreview(null);
                          setScreenshotFileName('');
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-purple/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-purple/5 transition-colors text-center">
                      <Upload className="w-6 h-6 text-purple mb-1" />
                      <span className="text-xs font-bold text-purple">Click to Upload Payment Screenshot</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cash on Delivery option */}
          <button
            onClick={() => setPaymentMethod('COD')}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border text-left transition-all shadow-xs ${
              paymentMethod === 'COD' ? 'border-purple ring-1 ring-purple/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  paymentMethod === 'COD' ? 'border-purple' : 'border-slate-300'
                }`}
              >
                {paymentMethod === 'COD' && <div className="w-2 h-2 rounded-full bg-purple" />}
              </div>
              <Banknote className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-xs font-bold text-navy">Cash on Delivery</div>
                <div className="text-[10px] text-slate-400">Pay in cash when your order arrives</div>
              </div>
            </div>
          </button>

          {errorBanner}

          <div className="flex space-x-2 pt-1">
            {backButton(() => goToStep(2))}
            <button
              onClick={handleContinueFromPayment}
              className="flex-[2] py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow transition-all flex items-center justify-center space-x-1"
            >
              <span>Continue to Review</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 4: REVIEW (design 08) ═══════════ */}
      {step === 4 && (
        <div className="px-4 space-y-3 animate-fade-in">
          <h3 className="font-black text-sm text-navy">Review Your Order</h3>

          {/* Item rows */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs divide-y divide-slate-100">
            {items.map(item => (
              <div key={item.productId} className="flex items-center space-x-3 py-2.5 first:pt-0 last:pb-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-11 h-11 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-purple-soft flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-purple" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-navy truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-400">Qty: {item.quantity} × {inr(item.unitPrice)}</div>
                </div>
                <div className="text-xs font-black text-navy">{inr(item.lineTotal)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-slate-800">{inr(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount{couponCode ? ` (${couponCode})` : ''}</span>
                <span>-{inr(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Delivery Charges</span>
              <span className={`font-bold ${deliveryCharge === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                {deliveryCharge === 0 ? 'FREE' : inr(deliveryCharge)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-100">
              <span>Total</span>
              <span className="text-base">{inr(orderTotal)}</span>
            </div>
          </div>

          {/* Expected delivery */}
          {expectedRange && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-xs font-bold text-emerald-700">
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span>Expected delivery between {expectedRange}</span>
            </div>
          )}

          {/* Deliver To */}
          {selectedAddress && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-navy">Deliver To</div>
                <div className="font-semibold text-slate-700">{selectedAddress.fullName}</div>
                <div className="text-slate-500 leading-relaxed">{addressOneLine(selectedAddress)}</div>
                <div className="text-slate-500">Ph: {selectedAddress.phone}</div>
              </div>
              <button
                onClick={() => goToStep(1)}
                className="text-purple font-bold text-[11px] hover:underline flex-shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          )}

          {/* Payment method */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="font-bold text-navy">Payment Method</div>
              <div className="font-semibold text-purple">
                {paymentMethod === 'UPI' ? 'UPI / QR' : 'Cash on Delivery'}
              </div>
              {paymentMethod === 'UPI' && utrNumber && (
                <div className="text-slate-500 font-mono text-[10px]">UTR: {utrNumber}</div>
              )}
            </div>
            <button
              onClick={() => goToStep(3)}
              className="text-purple font-bold text-[11px] hover:underline flex-shrink-0 ml-2"
            >
              Change
            </button>
          </div>

          {/* Terms */}
          <label className="flex items-start space-x-2 text-[11px] text-slate-600 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-[#4F2ACB]"
            />
            <span>
              I agree to the <span className="text-purple font-bold">Terms & Conditions</span> and{' '}
              <span className="text-purple font-bold">Privacy Policy</span>
            </span>
          </label>

          {errorBanner}

          <div className="flex space-x-2 pt-1">
            {backButton(() => goToStep(3))}
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              className={`flex-[2] py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs uppercase tracking-wider shadow-glow-purple transition-all flex items-center justify-center space-x-2 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  <span>Place Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 09: ORDER SUCCESS — green check + confetti
   ───────────────────────────────────────────────────────────── */

interface Screen6OrderPlacedProps {
  onNavigate: (page: string, params?: any) => void;
  orderNumber?: string;
  utrNumber?: string;
  screenshotUrl?: string;
  grandTotal?: number;
  paymentMethod?: string;
}

export const Screen6OrderPlaced: React.FC<Screen6OrderPlacedProps> = ({
  onNavigate,
  orderNumber = '',
  utrNumber = '',
  grandTotal = 0,
  paymentMethod
}) => {
  const { user } = useAuth();
  const rewardPoints = Math.floor((grandTotal || 0) / 100);
  const isUpi = paymentMethod === 'UPI' || Boolean(utrNumber);
  const contact = user?.email || user?.phone || 'your registered contact';

  useEffect(() => {
    triggerFireworksConfetti();
  }, []);

  return (
    <div className="min-h-[80vh] flex flex-col items-center p-6 pt-10 text-center font-sans bg-[#fbfbfb]">
      <div className="w-full max-w-sm space-y-5">
        {/* Green check */}
        <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg animate-scale-up">
          <Check className="w-12 h-12 stroke-[3]" />
        </div>

        <div className="space-y-1.5 animate-fade-in">
          <h2 className="text-2xl font-black text-navy">Thank You!</h2>
          <p className="text-xs text-slate-500 font-medium">
            Your order has been placed successfully.
          </p>
        </div>

        {/* Big Order ID */}
        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Order ID</div>
          <div className="text-xl font-mono font-black text-navy">{orderNumber || '—'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-left space-y-2.5">
          <div className="flex items-start space-x-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>
              A confirmation has been sent to <strong className="text-navy">{contact}</strong>
            </span>
          </div>
          {rewardPoints > 0 && (
            <div className="flex items-start space-x-2 text-xs font-semibold text-gold-dark">
              <Gift className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <span>
                You will earn <strong>{rewardPoints}</strong> reward points once the order is delivered.
              </span>
            </div>
          )}
        </div>

        {/* UPI verification pending note */}
        {isUpi && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1.5">
            <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>UPI Payment Verification Pending</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              We have received your payment proof{utrNumber ? <span> (UTR: <strong>{utrNumber}</strong>)</span> : null}.
              Our team will confirm the payment shortly.
            </p>
            <button
              onClick={() => onNavigate('payment-pending', { orderNumber })}
              className="text-[11px] font-bold text-amber-800 underline"
            >
              Check payment status
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => onNavigate('track-order', { orderNumber })}
            className="w-full py-3.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs transition-colors shadow-glow-purple flex items-center justify-center space-x-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>Track Order</span>
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="w-full py-3.5 rounded-xl border border-purple text-purple hover:bg-purple-soft font-bold text-xs transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Design 10: ORDER TRACKING — vertical timeline
   ───────────────────────────────────────────────────────────── */

interface Screen7OrderTrackingProps {
  onNavigate: (page: string, params?: any) => void;
  orderNumber?: string;
}

interface TrackingStep {
  label: string;
  statuses: string[];
  icon: React.ReactNode;
}

const TRACKING_STEPS: TrackingStep[] = [
  { label: 'Order Placed', statuses: ['pending'], icon: <Package className="w-3.5 h-3.5" /> },
  { label: 'Confirmed', statuses: ['confirmed', 'processing', 'packed'], icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { label: 'Shipped', statuses: ['shipped'], icon: <PackageCheck className="w-3.5 h-3.5" /> },
  { label: 'Out for Delivery', statuses: ['outfordelivery', 'out for delivery'], icon: <Truck className="w-3.5 h-3.5" /> },
  { label: 'Delivered', statuses: ['delivered'], icon: <Home className="w-3.5 h-3.5" /> }
];

/** Map an order status string to the timeline progress index (last completed step). */
const statusToStepIndex = (status: string): number => {
  const s = (status || '').toLowerCase().replace(/\s+/g, '');
  if (s === 'delivered') return 4;
  if (s === 'outfordelivery') return 3;
  if (s === 'shipped') return 2;
  if (s === 'confirmed' || s === 'processing' || s === 'packed') return 1;
  return 0; // Pending / unknown → only "Order Placed"
};

const fmtOrderDate = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const Screen7OrderTracking: React.FC<Screen7OrderTrackingProps> = ({
  onNavigate,
  orderNumber = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [activeOrderNumber, setActiveOrderNumber] = useState<string>(orderNumber);
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(orderNumber));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveOrderNumber(orderNumber);
  }, [orderNumber]);

  useEffect(() => {
    if (!activeOrderNumber) {
      setLoading(false);
      setOrder(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    api.trackOrder(activeOrderNumber)
      .then(res => {
        if (!mounted) return;
        if (res) {
          setOrder(res);
        } else {
          setOrder(null);
          setError('Order not found. Please verify your order number.');
        }
      })
      .catch(() => {
        if (mounted) {
          setOrder(null);
          setError('Order not found. Please verify your order number.');
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [activeOrderNumber]);

  /* Normalized fields (tolerant to the phase-1 tracking DTO variants) */
  const status: string = order?.orderStatus ?? order?.status ?? 'Pending';
  const placedAt: string | undefined = order?.placedAtUtc ?? order?.placedAt ?? order?.createdAt;
  const historyEntries: any[] = Array.isArray(order?.timeline)
    ? order.timeline
    : Array.isArray(order?.statusHistories)
    ? order.statusHistories
    : [];
  const shippingAddress = order?.shippingAddress;
  const orderItems: any[] = Array.isArray(order?.items) ? order.items : [];
  const totalAmount = Number(order?.grandTotal ?? order?.totalAmount ?? order?.total) || 0;
  const isCancelled = ['cancelled', 'returned'].includes((status || '').toLowerCase());
  const progressIdx = statusToStepIndex(status);

  /** Find the date a given timeline step was reached, from the status history. */
  const dateForStep = (stepIdx: number): string => {
    const step = TRACKING_STEPS[stepIdx];
    for (const h of historyEntries) {
      const to = String(h?.toStatus ?? h?.status ?? '').toLowerCase().replace(/\s+/g, '');
      if (step.statuses.some(s => s.replace(/\s+/g, '') === to)) {
        const dt = fmtOrderDate(h?.changedAtUtc ?? h?.date ?? h?.changedAt);
        if (dt) return dt;
      }
    }
    if (stepIdx === 0) return fmtOrderDate(placedAt);
    return '';
  };

  const handleTrackSubmit = () => {
    const q = inputValue.trim();
    if (!q) return;
    setActiveOrderNumber(q);
  };

  return (
    <div className="space-y-4 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* No order number: input prompt */}
      {!activeOrderNumber && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-purple" />
            <h2 className="text-sm font-black text-navy">Track Your Order</h2>
          </div>
          <p className="text-xs text-slate-500">
            Enter your Order ID to see live delivery status.
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTrackSubmit(); }}
              placeholder="e.g. AADHI-2026-000123"
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
            />
            <button
              onClick={handleTrackSubmit}
              className="px-4 py-2.5 rounded-xl bg-purple hover:bg-purple-dark text-white font-bold text-xs flex items-center space-x-1 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track</span>
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-card">
          <Clock className="w-6 h-6 text-purple animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Fetching live tracking status...</p>
        </div>
      )}

      {!loading && activeOrderNumber && error && (
        <div className="p-6 text-center bg-white rounded-2xl border border-slate-100 shadow-card space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-xs text-slate-600 font-medium">{error}</p>
          <button
            onClick={() => { setOrder(null); setError(null); setActiveOrderNumber(''); setInputValue(activeOrderNumber); }}
            className="text-xs font-bold text-purple hover:underline"
          >
            Try another Order ID
          </button>
        </div>
      )}

      {!loading && order && (
        <>
          {/* Order header */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-navy">
                Order ID: <span className="font-mono">{order.orderNumber || activeOrderNumber}</span>
              </div>
              {isCancelled && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {status}
                </span>
              )}
            </div>
            {placedAt && (
              <div className="text-[11px] text-slate-500 font-medium">Placed on {fmtOrderDate(placedAt)}</div>
            )}
          </div>

          {isCancelled && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>This order was {status.toLowerCase()}.</span>
            </div>
          )}

          {/* Vertical timeline — only completed steps get the green check */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="space-y-0">
              {TRACKING_STEPS.map((stepDef, idx) => {
                const completed = !isCancelled && idx <= progressIdx;
                const isLast = idx === TRACKING_STEPS.length - 1;
                const nextCompleted = !isCancelled && idx + 1 <= progressIdx;
                const stepDate = dateForStep(idx);
                return (
                  <div key={stepDef.label} className="flex items-stretch space-x-3">
                    {/* Node + connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          completed
                            ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                            : 'bg-white border-2 border-slate-300 text-slate-300'
                        }`}
                      >
                        {completed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : stepDef.icon}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[26px] ${nextCompleted ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    {/* Labels */}
                    <div className={isLast ? '' : 'pb-5'}>
                      <div
                        className={`text-xs font-bold leading-7 ${
                          completed ? 'text-navy' : 'text-slate-400'
                        }`}
                      >
                        {stepDef.label}
                      </div>
                      {stepDate && completed && (
                        <div className="text-[10px] text-slate-400 -mt-1">{stepDate}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Address */}
          {shippingAddress && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1 text-xs">
              <div className="font-bold text-navy text-[13px] mb-1">Delivery Address</div>
              <div className="font-semibold text-slate-700">{shippingAddress.fullName}</div>
              <div className="text-slate-500 leading-relaxed">
                {[shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(', ')}
              </div>
              <div className="text-slate-500">
                {[shippingAddress.city, shippingAddress.postalCode || shippingAddress.pincode].filter(Boolean).join(' - ')}
              </div>
              {shippingAddress.phone && <div className="text-slate-500">Ph: {shippingAddress.phone}</div>}
            </div>
          )}

          {/* Items in this order */}
          {orderItems.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="font-bold text-navy text-[13px]">Items in this order</div>
              <div className="divide-y divide-slate-100">
                {orderItems.map((it: any, idx: number) => {
                  const qty = Number(it?.quantity) || 1;
                  const unit = Number(it?.unitPrice ?? it?.price) || 0;
                  const line = Number(it?.lineTotal) || unit * qty;
                  return (
                    <div key={it?.id ?? idx} className="flex items-center space-x-3 py-2 first:pt-0 last:pb-0">
                      {(it?.imageUrl || it?.primaryImageUrl) ? (
                        <img
                          src={it.imageUrl || it.primaryImageUrl}
                          alt={it?.productName || it?.name || 'Item'}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-purple-soft flex items-center justify-center flex-shrink-0">
                          <Gift className="w-4 h-4 text-purple" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-navy truncate">
                          {it?.productName || it?.name || 'Item'}
                        </div>
                        <div className="text-[10px] text-slate-400">Qty: {qty}</div>
                      </div>
                      <div className="text-xs font-black text-navy">{inr(line)}</div>
                    </div>
                  );
                })}
              </div>
              {totalAmount > 0 && (
                <div className="flex justify-between text-xs font-black text-navy pt-2 border-t border-slate-100">
                  <span>Total Amount</span>
                  <span>{inr(totalAmount)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Need Help footer */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
        <div className="font-bold text-navy text-[13px]">Need Help?</div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          For any assistance regarding your order, please contact our support team.
        </p>
        <button
          onClick={() => onNavigate('contact')}
          className="w-full py-2.5 rounded-xl border border-purple text-purple hover:bg-purple-soft font-bold text-xs transition-colors flex items-center justify-center space-x-1.5"
        >
          <Headphones className="w-4 h-4" />
          <span>Contact Support</span>
        </button>
      </div>
    </div>
  );
};
