import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Home,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Upload,
  Wallet
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings, findDeliveryZone } from '../../context/SettingsContext';
import { api } from '../../services/api';
import { BankTransferDetailsCard, GuestCheckoutNotice } from '../../components/common/CommonComponents';
import { compressImageFile } from '../../utils/imageCompressor';
import { rememberOrderNumber } from '../../utils/guestOrders';
import {
  QUOTE_PROBLEM_MESSAGE,
  inrExact,
  upiAmount,
  useCheckoutQuote
} from '../../utils/checkoutQuote';

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

const fmtDayMonth = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtDayMonthYear = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const addressOneLine = (a: CheckoutAddress): string =>
  [a.addressLine1, a.addressLine2, a.city ? `${a.city} - ${a.pincode}` : a.pincode]
    .filter(Boolean)
    .join(', ');

/** The single delivery method returned by GET /orders/delivery-options.
 *  There is no charge field: the lorry freight is paid by the customer directly
 *  to the transport company on collection, so the store never quotes it. */
interface DeliveryOption {
  code: string;
  name: string;
  note?: string;
  etaMinDays?: number;
  etaMaxDays?: number;
}

/* Fallback copy used whenever the API does not supply a name / note of its own. */
const TRANSPORT_METHOD_CODE = 'transport';
const TRANSPORT_METHOD_NAME = 'Transport Delivery';
const TRANSPORT_METHOD_NOTE =
  'Your order is dispatched by lorry and typically arrives at the destination transport office in 1–2 weeks. Freight charges are paid directly to the transport company when you collect the parcel.';

/** "12 Sep - 26 Sep 2026" from the API's ETA window; null when the API sends none. */
const etaRangeLabel = (etaMinDays?: number, etaMaxDays?: number): string | null => {
  const min = Number(etaMinDays);
  const max = Number(etaMaxDays);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  const start = Number.isFinite(min) ? min : max;
  const end = Math.max(start, Number.isFinite(max) ? max : start);
  const from = new Date();
  from.setDate(from.getDate() + start);
  const to = new Date();
  to.setDate(to.getDate() + end);
  return `${fmtDayMonth(from)} - ${fmtDayMonthYear(to)}`;
};

const LABEL_OPTIONS: Array<{ value: string; icon: React.ReactNode }> = [
  { value: 'Home', icon: <Home className="w-3.5 h-3.5" /> },
  { value: 'Office', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'Other', icon: <MapPin className="w-3.5 h-3.5" /> }
];

/* ─────────────────────────────────────────────────────────────
   Desktop stepper: 1 Address · 2 Delivery · 3 Payment · 4 Review
   Purple active / completed circles joined by connectors.
   ───────────────────────────────────────────────────────────── */

const STEP_LABELS = ['Address', 'Review', 'Payment'];

const CheckoutStepper: React.FC<{ step: number; onStepClick: (s: number) => void }> = ({
  step,
  onStepClick
}) => (
  <div className="flex items-start max-w-2xl mx-auto">
    {STEP_LABELS.map((label, i) => {
      const num = i + 1;
      const done = num < step;
      const active = num === step;
      return (
        <React.Fragment key={label}>
          {i > 0 && (
            <div
              className={`flex-1 h-0.5 mt-[19px] rounded ${done || active ? 'bg-purple' : 'bg-slate-200'}`}
            />
          )}
          <button
            type="button"
            onClick={() => { if (done) onStepClick(num); }}
            className={`flex flex-col items-center px-2 ${done ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done
                  ? 'bg-purple text-white'
                  : active
                  ? 'bg-purple text-white ring-4 ring-purple/20 shadow-glow-purple'
                  : 'bg-white border-2 border-slate-300 text-slate-400'
              }`}
            >
              {done ? <Check className="w-5 h-5 stroke-[3]" /> : num}
            </div>
            <span
              className={`text-[11px] mt-1.5 ${
                active ? 'font-black text-purple' : done ? 'font-bold text-navy' : 'font-semibold text-slate-400'
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

/* ─────────────────────────────────────────────────────────────
   Desktop designs 5-8: CHECKOUT — 4-step flow
   ───────────────────────────────────────────────────────────── */

interface CheckoutPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { items, subtotal, couponCode, clearCart } = useCart();
  const { showToast } = useToast();
  const { deliveryZones, packingChargePercent: settingsPackingPercent } = useSettings();

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

  /* ── THE PAYABLE AMOUNT ──
     Never computed here. POST /cart/calculate runs the same arithmetic the order
     will, and everything on this screen that states a price reads its result:
     the summary rows, "Total Payable Online", the PLACE ORDER label and the UPI
     QR's am= parameter. It re-quotes whenever the cart, the coupon or the chosen
     address changes, and while it has no verified answer the screen says so
     instead of inventing one. */
  const { quote, status: quoteStatus, problem: quoteProblem, canPay, retry: retryQuote } =
    useCheckoutQuote({
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      couponCode,
      addressKey: selectedAddress
        ? `${selectedAddress.id || ''}|${selectedAddress.state}|${selectedAddress.pincode}`
        : ''
    });

  /* Label only — the billed amount is always quote.packingCharges. */
  const packingLabelPercent =
    quote && quote.packingChargePercent > 0 ? quote.packingChargePercent : settingsPackingPercent;

  const appliedCouponCode = quote?.couponCode || couponCode || '';

  /* ── DELIVERY ZONES (storefront-controlled, keyed by the address state) ── */
  const zone = useMemo(
    () => findDeliveryZone(deliveryZones, selectedAddress?.state),
    [deliveryZones, selectedAddress]
  );
  const minOrderShortfall = Boolean(zone && zone.minOrder > 0 && subtotal < zone.minOrder);
  const cityWarning = useMemo(() => {
    if (!zone || zone.allCities || zone.cities.length === 0) return null;
    const typedCity = (selectedAddress?.city || '').trim();
    if (!typedCity) return null;
    const known = zone.cities.some(c => c.trim().toLowerCase() === typedCity.toLowerCase());
    return known ? null : `Delivery to ${typedCity} may not be available — we'll confirm by phone.`;
  }, [zone, selectedAddress]);

  const minOrderNotice = minOrderShortfall && zone && selectedAddress && (
    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center space-x-1.5">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>Minimum order for {selectedAddress.state} is {inr(zone.minOrder)}</span>
    </div>
  );

  const cityWarningNotice = cityWarning && (
    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium flex items-center space-x-1.5">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{cityWarning}</span>
    </div>
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

  const goToStep = (target: number) => {
    setErrorMessage(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Save the inline form (syncing with the server when logged in), select it, and advance. */
  const handleSaveAddressAndContinue = async () => {
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
          await api.updateAddress(clean.id, dto);
          saved = { ...clean };
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

    // Delivery-zone minimum order gate for the just-saved address.
    const savedZone = findDeliveryZone(deliveryZones, saved.state);
    if (savedZone && savedZone.minOrder > 0 && subtotal < savedZone.minOrder) {
      setErrorMessage(`Minimum order for ${saved.state} is ${inr(savedZone.minOrder)}`);
      return;
    }
    goToStep(2);
  };

  const handleEditAddress = (a: CheckoutAddress) => {
    setAddressForm({ ...a });
    setShowAddressForm(true);
    setErrorMessage(null);
  };

  const handleContinueFromAddress = () => {
    if (showAddressForm) {
      handleSaveAddressAndContinue();
      return;
    }
    if (!selectedAddress) {
      setErrorMessage('Please select or add a delivery address.');
      return;
    }
    if (minOrderShortfall && zone) {
      setErrorMessage(`Minimum order for ${selectedAddress.state} is ${inr(zone.minOrder)}`);
      return;
    }
    goToStep(2);
  };

  /* ── Delivery method ──
     There is exactly one method (lorry to the destination transport office), so the
     API's single option only supplies the wording; nothing here is selectable and
     no freight is ever added to the order total. */
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);

  useEffect(() => {
    let mounted = true;
    api.getDeliveryOptions(subtotal)
      .then(list => {
        if (!mounted || !Array.isArray(list)) return;
        setDeliveryOptions(list);
      })
      .catch(() => { /* keep the fallback transport copy when the endpoint is unavailable */ });
    return () => { mounted = false; };
    // Fetched once per checkout — nothing about it tracks the subtotal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deliveryOption = deliveryOptions[0] || null;
  const deliveryMethodCode = deliveryOption?.code?.trim() || TRANSPORT_METHOD_CODE;
  const deliveryMethodName = deliveryOption?.name?.trim() || TRANSPORT_METHOD_NAME;
  const deliveryMethodNote = deliveryOption?.note?.trim() || TRANSPORT_METHOD_NOTE;

  const deliveryEta = useMemo(
    () => etaRangeLabel(deliveryOption?.etaMinDays, deliveryOption?.etaMaxDays),
    [deliveryOption]
  );

  /* ── Payment state ── */
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage('Screenshot size must be under 15MB');
        return;
      }
      setScreenshotFileName(file.name);
      try {
        const result = await compressImageFile(file);
        setScreenshotPreview(result.base64);
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage('Failed to process image. Please try another photo.');
      }
    }
  };

  /* ── Place Order ──
     `quote.grandTotal` is the ONLY payable figure; there is no client-side sum to
     fall back to, by design. When there is no verified quote the pay action is
     disabled rather than showing an amount the order would not match. */
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!quote || !canPay) {
      setErrorMessage(
        quoteProblem
          ? QUOTE_PROBLEM_MESSAGE[quoteProblem]
          : 'Confirming the payable amount with the store — please wait a moment.'
      );
      return;
    }
    if (!selectedAddress) {
      setErrorMessage('Delivery address is missing.');
      goToStep(1);
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }
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
    if (minOrderShortfall && zone) {
      setErrorMessage(`Minimum order for ${selectedAddress.state} is ${inr(zone.minOrder)}`);
      goToStep(1);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Every money figure on this screen came from the server's quote, and the
    // created order runs the identical arithmetic — nothing here is estimated.
    const transportNote = ` Delivery: ${deliveryMethodName} (lorry freight paid by the customer to the transport company on collection).`;

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
            slug: i.name.toLowerCase().replace(/\s+/g, '-'),
            price: i.unitPrice,
            compareAtPrice: i.compareAtPrice,
            categoryName: 'Fireworks',
            categoryId: 'cat-1',
            costPrice: Math.round(i.unitPrice * 0.6),
            taxRate: 18,
            discountType: 'Percentage',
            discountValue: 0,
            stockQuantity: i.maxStock,
            availableQuantity: i.maxStock,
            reorderLevel: 10,
            unit: 'Box',
            weightKg: 1,
            isActive: true,
            isFeatured: false,
            isBestSeller: false,
            isNewArrival: false,
            primaryImageUrl: i.imageUrl
          },
          quantity: i.quantity
        })),
        paymentMethod,
        couponCode: couponCode || undefined,
        deliveryMethod: deliveryMethodCode,
        utrNumber: paymentMethod === 'UPI' ? utrNumber.trim() : undefined,
        paymentScreenshotBase64: paymentMethod === 'UPI' ? (screenshotPreview || undefined) : undefined,
        notes:
          (paymentMethod === 'UPI'
            ? `UPI Payment Proof Uploaded. UTR: ${utrNumber.trim()}`
            : 'Cash on Delivery order.') + transportNote
      });

      // The created order's own grandTotal is definitive; the verified quote is
      // the only fallback, and a disagreement between the two is surfaced below.
      const serverPacking = Number(order?.packingCharges);
      const serverPackingPercent = Number(order?.packingChargePercent);
      const finalTotal = Number(order?.grandTotal) > 0 ? Number(order.grandTotal) : quote.grandTotal;

      // The quote and the order run the same arithmetic, so a mismatch means the
      // customer was shown (and may already have paid) a different figure. Say so.
      if (Math.abs(finalTotal - quote.grandTotal) > 1) {
        showToast(
          `The confirmed order total is ${inrExact(finalTotal)} — please contact us before paying any different amount.`,
          'warning'
        );
      }

      // Flag for the success screen (desktop design 9) rendered by TrackOrderPage.
      try {
        sessionStorage.setItem(
          'aadhi_just_placed',
          JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            grandTotal: finalTotal,
            packingCharges: Number.isFinite(serverPacking) && serverPacking > 0 ? serverPacking : undefined,
            packingChargePercent:
              Number.isFinite(serverPackingPercent) && serverPackingPercent > 0
                ? serverPackingPercent
                : undefined,
            paymentMethod,
            utrNumber: paymentMethod === 'UPI' ? utrNumber.trim() : undefined,
            isGuest: !user
          })
        );
      } catch {
        // Ignore storage failures — tracking view still works.
      }

      // A guest has no My Orders, so the order number is their only handle on
      // this order. Remembering it on this device is a convenience for finding
      // it again later — never something the app trusts (see utils/guestOrders).
      // Signed-in customers already have My Orders, so nothing is stored for them.
      if (!user) rememberOrderNumber(order.orderNumber);

      clearCart();
      onNavigate('order-placed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        grandTotal: finalTotal,
        paymentMethod,
        utrNumber: paymentMethod === 'UPI' ? utrNumber.trim() : undefined
      });
    } catch (err: any) {
      showToast(err?.message || 'Order could not be placed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Empty cart guard ── */
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-soft flex items-center justify-center text-orange mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-navy">Your cart is empty</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Add items to your cart before proceeding to checkout.
        </p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs shadow-glow"
        >
          Start Shopping
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

  const backButton = (target: number) => (
    <button
      onClick={() => goToStep(target)}
      className="px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-navy hover:border-navy font-bold text-xs flex items-center space-x-1.5 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>Back</span>
    </button>
  );

  const saveContinueButton = (onClick: () => void, label = 'Save & Continue', busy = false) => (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-8 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow transition-colors ${
        busy ? 'opacity-70 cursor-not-allowed' : ''
      }`}
    >
      <span>{busy ? 'Saving...' : label}</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  /** "Deliver to" summary card with purple Change link (steps 2 & 4). */
  const deliverToCard = selectedAddress && (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deliver to</div>
          <div className="font-black text-navy text-[13px]">
            {selectedAddress.label} <span className="font-bold text-slate-700">· {selectedAddress.fullName}</span>
          </div>
          <div className="text-slate-500 mt-0.5 leading-relaxed">{addressOneLine(selectedAddress)}</div>
          <div className="text-slate-500 mt-0.5">Ph: {selectedAddress.phone}</div>
        </div>
        <button
          onClick={() => goToStep(1)}
          className="text-xs font-bold text-purple hover:text-purple-dark flex-shrink-0"
        >
          Change
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Purple numbered stepper: 1 Address → 2 Delivery → 3 Payment → 4 Review */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <CheckoutStepper step={step} onStepClick={goToStep} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Main step panel ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* Guests continue with no account — signing in is offered, never required.
              Shown on the first step only so it never interrupts a checkout in progress. */}
          {!user && step === 1 && (
            <GuestCheckoutNotice
              onLogin={() =>
                onNavigate('auth', {
                  initialTab: 'login',
                  redirectTo: 'checkout',
                  redirectParams: {}
                })
              }
            />
          )}

          {/* ═══════════ STEP 1: ADDRESS (design 5) ═══════════ */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-navy">Delivery Address</h3>
                {user && (
                  <button
                    onClick={() => {
                      setAddressForm(emptyForm());
                      setShowAddressForm(v => !v);
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-soft text-purple text-xs font-bold flex items-center space-x-1 hover:bg-purple/15 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddressForm ? 'Hide Form' : 'Add New Address'}</span>
                  </button>
                )}
              </div>

              {minOrderNotice}
              {cityWarningNotice}
              {errorBanner}

              {loadingAddresses ? (
                <div className="p-8 text-center rounded-2xl border border-slate-100">
                  <Clock className="w-5 h-5 text-purple animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading saved addresses...</p>
                </div>
              ) : (
                !showAddressForm && (
                  <div className="space-y-3">
                    {addresses.map(a => (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAddressId(a.id || null)}
                        className={`w-full text-left p-4 rounded-2xl bg-white border transition-all cursor-pointer ${
                          selectedAddressId === a.id
                            ? 'border-purple ring-1 ring-purple/30 bg-purple-soft/30'
                            : 'border-slate-200 hover:border-slate-300'
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
                            <div className="font-black text-navy text-[13px]">
                              {a.label}
                              {a.isDefault && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-gold-soft text-gold-dark text-[10px] font-bold">Default</span>
                              )}
                            </div>
                            <div className="font-semibold text-slate-700 mt-0.5">{a.fullName}</div>
                            <div className="text-slate-500 mt-0.5 leading-relaxed">{addressOneLine(a)}</div>
                            {a.phone && <div className="text-slate-500 mt-0.5">Ph: {a.phone}</div>}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditAddress(a); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple hover:bg-purple-soft transition-colors"
                            title="Edit address"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Inline add/edit form (guests see this directly) */}
              {showAddressForm && !loadingAddresses && (
                <div className="space-y-4 pt-1">
                  {/* Label chips */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Address Label</label>
                    <div className="flex items-center space-x-2">
                      {LABEL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAddressForm({ ...addressForm, label: opt.value })}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                            addressForm.label === opt.value
                              ? 'bg-purple text-white border-purple'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-purple/40'
                          }`}
                        >
                          {opt.icon}
                          <span>{opt.value}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Address Line 1 *</label>
                      <input
                        type="text"
                        placeholder="Door No, Street Name"
                        value={addressForm.addressLine1}
                        onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Address Line 2</label>
                      <input
                        type="text"
                        placeholder="Area, Landmark (optional)"
                        value={addressForm.addressLine2}
                        onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">City *</label>
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">State *</label>
                      <select
                        value={addressForm.state}
                        onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      >
                        <option value="">Select State</option>
                        {INDIAN_STATES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Pincode *</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit pincode"
                        value={addressForm.pincode}
                        onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                {saveContinueButton(handleContinueFromAddress, 'Continue to Review', savingAddress)}
              </div>
            </div>
          )}

          {/* ═══════════ STEP 2: REVIEW ═══════════ */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              {deliverToCard}

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-lg font-black text-navy">Review Your Order</h3>

                {errorBanner}

                {/* Single delivery method — informational only, nothing to choose */}
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-xs">
                  <div className="flex items-start space-x-3">
                    <Truck className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm text-amber-950">{deliveryMethodName}</h4>
                      {deliveryEta && (
                        <p className="text-xs text-amber-800 font-semibold mt-1">
                          Expected to reach the transport office between <strong>{deliveryEta}</strong>
                        </p>
                      )}
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">{deliveryMethodNote}</p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Order Items ({items.length})</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {items.map(i => (
                      <div key={i.productId} className="p-3.5 bg-white flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <img
                            src={i.imageUrl || '/product-placeholder.svg'}
                            alt={i.name}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-100"
                          />
                          <div>
                            <div className="font-bold text-navy text-sm">{i.name}</div>
                            <div className="text-slate-400 mt-0.5">Qty: {i.quantity} × {inr(i.unitPrice)}</div>
                          </div>
                        </div>
                        <div className="font-bold text-navy text-sm">{inr(i.unitPrice * i.quantity)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex justify-between">
                  {backButton(1)}
                  {saveContinueButton(() => goToStep(3), 'Proceed to Payment')}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ STEP 3: PAYMENT & PLACE ORDER ═══════════ */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-navy">Payment Methods</h3>
                <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  {deliveryMethodName}
                </span>
              </div>

              {errorBanner}

              <div className="space-y-3">
                {/* UPI / QR — functional */}
                <div
                  className={`rounded-2xl border transition-all ${
                    paymentMethod === 'UPI' ? 'border-purple ring-1 ring-purple/30' : 'border-slate-200'
                  }`}
                >
                  <button
                    onClick={() => setPaymentMethod('UPI')}
                    className="w-full text-left p-4 flex items-center space-x-3"
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        paymentMethod === 'UPI' ? 'border-purple' : 'border-slate-300'
                      }`}
                    >
                      {paymentMethod === 'UPI' && <div className="w-2 h-2 rounded-full bg-purple" />}
                    </div>
                    <QrCode className="w-5 h-5 text-purple flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <div className="font-black text-navy text-[13px]">UPI / QR Payment</div>
                      <div className="text-slate-500 mt-0.5">Scan &amp; pay via GPay, PhonePe, Paytm — upload proof</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      Recommended
                    </span>
                  </button>

                  {paymentMethod === 'UPI' && (
                    <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-4 text-xs animate-fade-in">
                      {/* QR Box — the encoded am= is the server's grandTotal, never a
                          client sum. With no verified quote NO QR is rendered: a QR
                          carrying the wrong amount is the worst form of this bug. */}
                      {quote ? (
                        <div className="p-4 rounded-xl bg-purple/5 border border-purple/15 flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-36 h-36 bg-white p-2 rounded-xl border border-purple/20 flex-shrink-0 flex items-center justify-center">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi://pay?pa=${officialUpiId}%26pn=AADHI%20CRACKERS%26am=${upiAmount(quote.grandTotal)}%26cu=INR`}
                              alt="Aadhi Crackers UPI QR Code"
                              className="w-full h-full object-contain rounded"
                            />
                          </div>
                          <div className="space-y-2 text-center sm:text-left flex-1">
                            <div className="font-bold text-navy">Scan with GPay, PhonePe, Paytm or BHIM</div>
                            <div className="text-slate-500 text-[11px]">
                              Pay exact amount:{' '}
                              <strong className="text-navy text-sm">{inrExact(quote.grandTotal)}</strong>
                            </div>
                            <div className="flex items-center justify-center sm:justify-start space-x-2 pt-1">
                              <span className="font-mono font-bold text-purple text-xs">{officialUpiId}</span>
                              <button
                                onClick={handleCopyUpi}
                                className="px-2 py-1 rounded bg-purple text-white hover:bg-purple-dark text-[10px] font-bold flex items-center space-x-1"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : quoteStatus === 'loading' ? (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                          <Clock className="w-5 h-5 text-purple animate-spin mx-auto" />
                          <div className="text-[11px] font-semibold text-slate-500">
                            Confirming the exact amount with the store before showing the QR code...
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                          <div className="flex items-start space-x-2 text-amber-800">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="text-[11px] font-semibold leading-relaxed">
                              {quoteProblem
                                ? QUOTE_PROBLEM_MESSAGE[quoteProblem]
                                : 'The payable amount is not available yet.'}{' '}
                              No QR code is shown until the amount is confirmed, so that you never pay
                              the wrong figure.
                            </span>
                          </div>
                          <button
                            onClick={retryQuote}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Bank transfer alternative to the QR (hidden until the store configures it) */}
                      <BankTransferDetailsCard />

                      {/* UTR + Proof upload */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">
                            12-Digit UPI UTR / Reference ID <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 423456789012"
                            maxLength={20}
                            value={utrNumber}
                            onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-purple/20 focus:border-purple outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">
                            Payment Screenshot <span className="text-rose-500">*</span>
                          </label>

                          {screenshotPreview ? (
                            <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-3 flex items-center space-x-3">
                              <img
                                src={screenshotPreview}
                                alt="Screenshot Preview"
                                className="w-14 h-14 rounded-lg object-cover border border-emerald-200"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-emerald-800 truncate">
                                  {screenshotFileName || 'Payment_Proof.jpg'}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-medium flex items-center space-x-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Screenshot Attached</span>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setScreenshotPreview(null);
                                  setScreenshotFileName('');
                                }}
                                className="text-xs font-bold text-slate-400 hover:text-rose-600"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <label className="border-2 border-dashed border-purple/30 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-purple/5 transition-colors text-center">
                              <Upload className="w-6 h-6 text-purple mb-1" />
                              <span className="text-xs font-bold text-purple">Click to Upload Payment Screenshot</span>
                              <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual-only rails: Card / Net Banking / Wallets */}
                {[
                  { name: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay', icon: <CreditCard className="w-5 h-5 text-slate-400" /> },
                  { name: 'Net Banking', desc: 'All major Indian banks', icon: <Landmark className="w-5 h-5 text-slate-400" /> },
                  { name: 'Wallets', desc: 'Paytm, PhonePe, Amazon Pay', icon: <Wallet className="w-5 h-5 text-slate-400" /> }
                ].map(rail => (
                  <button
                    key={rail.name}
                    onClick={() => showToast('Payment method coming soon', 'info')}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 flex items-center space-x-3 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    {rail.icon}
                    <div className="flex-1 text-xs">
                      <div className="font-black text-slate-500 text-[13px]">{rail.name}</div>
                      <div className="text-slate-400 mt-0.5">{rail.desc}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                      Coming Soon
                    </span>
                  </button>
                ))}

                {/* Cash on Delivery — functional */}
                <button
                  onClick={() => setPaymentMethod('COD')}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center space-x-3 ${
                    paymentMethod === 'COD' ? 'border-purple ring-1 ring-purple/30 bg-purple-soft/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === 'COD' ? 'border-purple' : 'border-slate-300'
                    }`}
                  >
                    {paymentMethod === 'COD' && <div className="w-2 h-2 rounded-full bg-purple" />}
                  </div>
                  <Banknote className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 text-xs">
                    <div className="font-black text-navy text-[13px]">Cash on Delivery</div>
                    <div className="text-slate-500 mt-0.5">Pay in cash when your order arrives</div>
                  </div>
                </button>
              </div>

              <div className="pt-4 flex justify-between">
                {backButton(2)}
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting || !canPay}
                  title={!canPay && quoteProblem ? QUOTE_PROBLEM_MESSAGE[quoteProblem] : undefined}
                  className={`px-8 py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow transition-colors ${
                    isSubmitting || !canPay ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : quote ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Place Order ({inrExact(quote.grandTotal)})</span>
                    </>
                  ) : quoteStatus === 'loading' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming total...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Total unavailable</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Order Summary sidebar ── */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-black text-navy">Order Summary</h3>

          {/* Every figure below is a component of the server's quote; the total is
              the server's own grandTotal, not a sum taken on this page. */}
          {quote ? (
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({quote.totalItems} {quote.totalItems === 1 ? 'item' : 'items'})</span>
                <span className="font-bold text-slate-800">{inrExact(quote.itemsSubtotal)}</span>
              </div>

              {quote.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount{appliedCouponCode ? ` (${appliedCouponCode})` : ''}</span>
                  <span>-{inrExact(quote.discount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>GST</span>
                <span className="font-bold text-slate-800">{inrExact(quote.tax)}</span>
              </div>

              <div className="flex justify-between">
                <span>
                  Packing Charges
                  {packingLabelPercent > 0 ? ` (${packingLabelPercent}%)` : ''}
                </span>
                <span className="font-bold text-slate-800">{inrExact(quote.packingCharges)}</span>
              </div>

              <div className="flex justify-between">
                <span>Delivery</span>
                <span className="font-bold text-slate-800">{inrExact(quote.shippingCharge)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-black text-navy pt-3 border-t border-slate-100">
                <span>Total Payable Online</span>
                <span className="text-base text-purple">{inrExact(quote.grandTotal)}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                * Lorry freight is paid directly to the transport company when you collect the parcel.
              </div>
            </div>
          ) : quoteStatus === 'loading' ? (
            <div className="space-y-2.5 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple animate-spin" />
                <span className="font-semibold">Confirming your total with the store...</span>
              </div>
              <div className="h-2 rounded bg-slate-100 animate-pulse" />
              <div className="h-2 rounded bg-slate-100 animate-pulse w-2/3" />
              <div className="h-2 rounded bg-slate-100 animate-pulse w-1/2" />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold leading-relaxed flex items-start space-x-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {quoteProblem
                    ? QUOTE_PROBLEM_MESSAGE[quoteProblem]
                    : 'The payable amount is not available yet.'}
                </span>
              </div>
              <button
                onClick={retryQuote}
                className="w-full py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
              >
                Retry
              </button>
              <div className="text-[10px] text-slate-400">
                We would rather show you nothing than a total your order would not match.
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-purple/5 border border-purple/15 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-purple flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Genuine Sivakasi Goods</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Direct dispatch from the Sivakasi factory with strict safety packaging standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
