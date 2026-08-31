import React, { useState } from 'react';
import {
  Check,
  MapPin,
  Truck,
  PackageCheck,
  ChevronRight,
  Clock,
  Sparkles,
  QrCode,
  Copy,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { triggerFireworksConfetti } from '../common/CommonComponents';
import { api } from '../../services/api';

interface Screen5CheckoutProps {
  onNavigate: (page: string, params?: any) => void;
  onBack: () => void;
}

export const Screen5Checkout: React.FC<Screen5CheckoutProps> = ({ onNavigate, onBack }) => {
  const { items, subtotal, discount, grandTotal, clearCart } = useCart();

  const [step, setStep] = useState<number>(1); // 1: Address, 2: UPI QR Payment & Screenshot
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [shippingAddress, setShippingAddress] = useState({
    fullName: 'Arun Kumar',
    phone: '+91 98765 43210',
    addressLine1: '123, West Car Street, Sivakasi Main Road',
    city: 'Sivakasi / Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '626123',
    country: 'India'
  });

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

  const handlePlaceOrder = async () => {
    if (!utrNumber.trim()) {
      setErrorMessage('Please enter the 12-digit UPI UTR / Transaction Reference ID');
      return;
    }
    if (!screenshotPreview) {
      setErrorMessage('Please attach the Payment Screenshot from GPay / PhonePe / Paytm');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const order = await api.createOrder({
        shippingAddress,
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
        paymentMethod: 'UPI',
        utrNumber: utrNumber.trim(),
        paymentScreenshotBase64: screenshotPreview,
        notes: `UPI Payment Proof Uploaded. UTR: ${utrNumber.trim()}`
      });

      clearCart();
      triggerFireworksConfetti();
      onNavigate('order-placed', {
        orderNumber: order.orderNumber,
        utrNumber: utrNumber.trim(),
        screenshotUrl: screenshotPreview,
        grandTotal
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-6 font-sans bg-[#fbfbfb]">
      {/* 1. Step Progress Indicator */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between max-w-xs mx-auto py-2">
          {[
            { num: 1, label: 'Address', active: step === 1, done: step > 1 },
            { num: 2, label: 'UPI Payment', active: step === 2, done: false },
            { num: 3, label: 'Verification', active: false, done: false }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center space-x-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  s.done
                    ? 'bg-emerald-500 text-white'
                    : s.active
                    ? 'bg-purple text-white shadow-xs'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s.done ? '✓' : s.num}
              </div>
              <span className={`text-[10px] ${s.active ? 'font-bold text-navy' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {idx < 2 && <div className="w-4 h-0.5 bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {step === 1 ? (
        /* STEP 1: Delivery Address & Summary */
        <div className="space-y-4">
          <div className="px-4 space-y-2">
            <h3 className="font-bold text-xs text-navy uppercase tracking-wider">
              Delivery Address
            </h3>

            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy text-sm">{shippingAddress.fullName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Primary
                </span>
              </div>

              <div className="text-slate-600 leading-relaxed">
                {shippingAddress.addressLine1} <br />
                {shippingAddress.city} - {shippingAddress.postalCode} <br />
                <span className="text-slate-800 font-semibold">{shippingAddress.phone}</span>
              </div>
            </div>
          </div>

          <div className="px-4 space-y-2">
            <h3 className="font-bold text-xs text-navy uppercase tracking-wider">
              Order Summary
            </h3>

            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Total ({items.length} items)</span>
                <span className="font-bold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Festival Discount</span>
                  <span>-₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Express Sivakasi Transport</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>

              <div className="flex justify-between text-sm font-black text-navy pt-2 border-t border-slate-100">
                <span>Grand Total</span>
                <span className="text-base text-navy font-black">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="px-4 pt-2">
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-98 transition-all flex items-center justify-center space-x-1"
            >
              <span>Proceed to UPI Payment</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: UPI QR Code, UTR & Payment Screenshot */
        <div className="space-y-4">
          {/* UPI Payment Instructions Card */}
          <div className="px-4 space-y-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card text-center space-y-3">
              <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-navy">
                <QrCode className="w-4 h-4 text-purple" />
                <span>Scan & Pay via any UPI App</span>
              </div>

              {/* Dynamic QR Code Canvas Simulation */}
              <div className="w-44 h-44 mx-auto bg-white p-3 rounded-2xl border-2 border-purple/30 shadow-inner flex flex-col items-center justify-center relative group">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${officialUpiId}%26pn=AADHI%20CRACKERS%26am=${grandTotal}%26cu=INR`}
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
                <div className="text-lg font-black text-navy">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </div>
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

            {/* Step 2: UTR Reference & Screenshot Upload */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
              <h4 className="text-xs font-bold text-navy flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Submit Payment Proof</span>
              </h4>

              {/* 12-digit UTR input */}
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

              {/* Payment Screenshot Upload */}
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
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider shadow-glow active:scale-98 transition-all flex items-center justify-center space-x-2 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Payment Proof...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Proof & Place Order</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setStep(1)}
                className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-navy"
              >
                ← Back to Delivery Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface Screen6OrderPlacedProps {
  onNavigate: (page: string, params?: any) => void;
  orderNumber?: string;
  utrNumber?: string;
  screenshotUrl?: string;
  grandTotal?: number;
}

export const Screen6OrderPlaced: React.FC<Screen6OrderPlacedProps> = ({
  onNavigate,
  orderNumber = 'ORD-2026-000124',
  utrNumber = '423456789012',
  screenshotUrl,
  grandTotal = 3450
}) => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-between p-6 text-center font-sans bg-white">
      <div className="w-full space-y-5 pt-4">
        {/* Large Green Check Circle */}
        <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg animate-scale-up">
          <Check className="w-12 h-12 stroke-[3]" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-black text-navy">Order Placed & Payment Submitted!</h2>
          <div className="text-xs text-slate-500 font-medium">Order Number</div>
          <div className="text-base font-mono font-black text-purple">{orderNumber}</div>
        </div>

        {/* Verification Status Card */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2 max-w-xs mx-auto">
          <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
            <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Admin Payment Verification Pending</span>
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            We have received your payment proof (UTR: <strong>{utrNumber}</strong>). Our admin team will verify the payment and move your order to the packing station.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-2 max-w-xs mx-auto">
          <button
            onClick={() => onNavigate('track-order', { orderNumber })}
            className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-dark text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center space-x-1.5"
          >
            <Truck className="w-4 h-4 text-gold" />
            <span>Track Order Status</span>
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="text-xs font-bold text-purple hover:underline"
          >
            Continue Shopping
          </button>
        </div>
      </div>

      {/* Bottom Delivery Truck Illustration */}
      <div className="w-full max-w-xs pt-6 pb-2 relative flex flex-col items-center">
        <div className="w-44 h-24 rounded-2xl bg-gradient-to-tr from-purple via-navy to-purple-dark flex items-center justify-center text-white shadow-xl relative border border-gold/30">
          <div className="flex flex-col items-center">
            <Truck className="w-10 h-10 text-gold mb-1" />
            <span className="text-[10px] font-black tracking-widest text-white">AADHI SIVAKASI EXPRESS</span>
          </div>
          <div className="absolute -top-3 -right-2 text-xl">✨</div>
          <div className="absolute -bottom-2 -left-2 text-lg">🎆</div>
        </div>
      </div>
    </div>
  );
};

interface Screen7OrderTrackingProps {
  onNavigate: (page: string, params?: any) => void;
  orderNumber?: string;
}

export const Screen7OrderTracking: React.FC<Screen7OrderTrackingProps> = ({
  onNavigate,
  orderNumber = 'ORD-2026-000124'
}) => {
  const steps = [
    { title: 'Order Placed & UPI Proof Attached', time: 'Today, 10:30 AM', active: true, done: true },
    { title: 'Admin Payment Verification', time: 'In Progress (Admin Verifying UTR)', active: true, done: false, badge: '🟡 Pending Verification' },
    { title: 'Packing Station', time: 'Estimated: Today, 04:00 PM', active: false, done: false },
    { title: 'Handed to Express Courier', time: 'Estimated: Tomorrow, 11:00 AM', active: false, done: false },
    { title: 'Out for Delivery', time: 'Estimated: In 2 Days', active: false, done: false },
    { title: 'Delivered', time: 'Sivakasi Original Certified', active: false, done: false }
  ];

  return (
    <div className="space-y-5 p-4 pb-8 font-sans bg-[#fbfbfb]">
      {/* Header Info */}
      <div className="space-y-1">
        <h2 className="text-base font-black text-navy">Live Order Tracking</h2>
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-500 font-medium">Order: <strong className="text-navy">{orderNumber}</strong></span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Payment Verification
          </span>
        </div>
      </div>

      {/* Live Timeline */}
      <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-card">
        <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 ml-2">
          {steps.map((s, idx) => (
            <div key={idx} className="relative">
              <div
                className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white ${
                  s.done
                    ? 'bg-emerald-500 ring-4 ring-emerald-100'
                    : s.active
                    ? 'bg-amber-500 ring-4 ring-amber-100 animate-pulse'
                    : 'bg-slate-300'
                }`}
              >
                {s.done ? '✓' : ''}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h4 className={`text-xs font-bold ${s.active || s.done ? 'text-navy' : 'text-slate-400'}`}>
                    {s.title}
                  </h4>
                  {s.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {s.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Support note */}
      <div className="p-3.5 rounded-2xl bg-purple/5 border border-purple/15 text-xs text-slate-600 space-y-1">
        <div className="font-bold text-navy text-[11px] flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-purple" />
          <span>Sivakasi Safe Dispatch Guarantee</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          All orders are packed in fire-proof insulated cartons and dispatched with explosive compliance documentation.
        </p>
      </div>

      {/* CTA Button */}
      <div className="pt-2">
        <button
          onClick={() => onNavigate('account')}
          className="w-full py-3.5 rounded-xl border border-navy text-navy hover:bg-navy hover:text-white font-bold text-xs transition-colors shadow-xs"
        >
          View Order History
        </button>
      </div>
    </div>
  );
};
