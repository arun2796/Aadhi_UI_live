import React, { useState } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Truck,
  CreditCard,
  QrCode,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  MapPin,
  ChevronRight,
  Copy,
  Upload,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { Address, Order } from '../../types';
import { triggerFireworksConfetti } from '../../components/common/CommonComponents';
import { useToast } from '../../context/ToastContext';

interface CheckoutPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const { items, subtotal, discount, couponCode, shippingCharge, grandTotal, clearCart } = useCart();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Address form
  const [address, setAddress] = useState<Address>({
    fullName: 'Arun Kumar',
    phone: '+91 98765 43210',
    addressLine1: '123, West Cross Street, Sivanandapuram',
    addressLine2: 'Near Saravanampatti Junction',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641012',
    country: 'India'
  });

  // UPI Payment Proof States
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  if (items.length === 0 && !createdOrder) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center text-orange mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-navy">Your cart is empty</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Add items to your cart before proceeding to the checkout portal.
        </p>
        <button
          onClick={() => onNavigate('shop')}
          className="px-6 py-3 rounded-xl bg-orange text-white font-bold text-xs shadow-glow"
        >
          Explore Fireworks Catalog
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!utrNumber.trim()) {
      setErrorMessage('Please enter your 12-digit UPI UTR / Transaction Reference number');
      showToast('12-digit UPI UTR number is required', 'error');
      return;
    }
    if (!screenshotPreview) {
      setErrorMessage('Please attach the Payment Screenshot from your UPI App');
      showToast('Payment screenshot is required', 'error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadItems = items.map((i) => ({
        product: {
          id: i.productId,
          sku: i.sku,
          name: i.name,
          slug: i.name.toLowerCase().replace(/\s+/g, '-'),
          categoryId: 'cat-1',
          categoryName: 'Fireworks',
          price: i.unitPrice,
          compareAtPrice: i.compareAtPrice,
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
      }));

      const order = await api.createOrder({
        shippingAddress: address,
        paymentMethod: 'UPI',
        items: payloadItems,
        couponCode,
        utrNumber: utrNumber.trim(),
        paymentScreenshotBase64: screenshotPreview,
        notes: `UPI Payment Proof Uploaded. UTR: ${utrNumber.trim()}`
      });

      setCreatedOrder(order);
      setStep(4);
      clearCart();
      triggerFireworksConfetti();
      showToast(`Order ${order.orderNumber} placed! Payment submitted for verification.`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Checkout Progress Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {[
            { num: 1, label: 'Delivery Address' },
            { num: 2, label: 'UPI QR Payment & Proof' },
            { num: 3, label: 'Review & Submit' },
            { num: 4, label: 'Confirmation' }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > s.num
                    ? 'bg-emerald-600 text-white'
                    : step === s.num
                    ? 'bg-orange text-white ring-4 ring-orange/20 shadow-md'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs font-bold hidden sm:inline ${step >= s.num ? 'text-navy' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {idx < 3 && <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:inline" />}
            </div>
          ))}
        </div>
      </div>

      {step === 4 && createdOrder ? (
        /* Order Confirmation Success Card */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-2xl space-y-6 animate-scale-up">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-orange uppercase tracking-wider">Order Submitted Successfully!</div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy">
              Thank You for Celebrating with Aadhi!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Your order number is <strong className="text-navy">{createdOrder.orderNumber}</strong>.
            </p>
          </div>

          {/* Pending Verification Notice */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-800 font-bold">
              <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Admin Payment Verification in Progress</span>
            </div>
            <p className="text-amber-700 leading-relaxed text-[11px]">
              We have attached your payment proof (UTR: <strong>{utrNumber}</strong>). Our admin operations team is verifying the transaction and will move your order to the packing station shortly.
            </p>
          </div>

          {/* Snapshot Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Delivery To:</span>
              <span className="text-navy font-bold">{createdOrder.shippingAddress.fullName}</span>
            </div>
            <div className="text-slate-500">
              {createdOrder.shippingAddress.addressLine1}, {createdOrder.shippingAddress.city}, {createdOrder.shippingAddress.state} - {createdOrder.shippingAddress.postalCode}
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-slate-200">
              <span>Payment Mode:</span>
              <span className="text-navy font-bold">UPI (QR Code Transfer)</span>
            </div>
            <div className="flex justify-between font-black text-sm pt-1">
              <span>Grand Total:</span>
              <span className="text-orange font-black">₹{createdOrder.grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => onNavigate('track-order', { orderNumber: createdOrder.orderNumber })}
              className="px-6 py-3 rounded-xl bg-navy hover:bg-navy-light text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5"
            >
              <Truck className="w-4 h-4 text-gold" />
              <span>Track Live Order Status</span>
            </button>
            <button
              onClick={() => onNavigate('shop')}
              className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs shadow-glow transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      ) : (
        /* Multi-step Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Form (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            {/* Step 1: Address */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-orange" />
                  <h3 className="text-lg font-black text-navy">Enter Delivery Address</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={address.fullName}
                      onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                    <input
                      type="text"
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">Address Line 1 *</label>
                    <input
                      type="text"
                      value={address.addressLine1}
                      onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })}
                      placeholder="Door No, Street Name, Landmark"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">City *</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">State *</label>
                    <input
                      type="text"
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">PIN Code *</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={address.postalCode}
                      onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-orange focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Country</label>
                    <input
                      type="text"
                      disabled
                      value={address.country}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow"
                  >
                    <span>Continue to UPI Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: UPI QR Payment & Proof Upload */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <QrCode className="w-5 h-5 text-orange" />
                  <h3 className="text-lg font-black text-navy">Scan UPI QR Code & Upload Payment Proof</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left: QR Code Display */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="text-xs font-bold text-navy">
                      Official Aadhi Crackers Merchant QR
                    </div>

                    <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl border-2 border-purple/30 shadow-inner flex flex-col items-center justify-center relative">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${officialUpiId}%26pn=AADHI%20CRACKERS%26am=${grandTotal}%26cu=INR`}
                        alt="Aadhi Crackers UPI QR Code"
                        className="w-40 h-40 object-contain rounded-lg"
                      />
                    </div>

                    <div className="bg-white border border-purple/20 rounded-xl p-2.5 space-y-1">
                      <div className="text-[10px] text-slate-500 font-medium">Exact Amount Payable</div>
                      <div className="text-xl font-black text-navy">₹{grandTotal.toLocaleString('en-IN')}</div>
                      <div className="flex items-center justify-center space-x-2 pt-1">
                        <span className="font-mono text-purple font-bold text-xs">{officialUpiId}</span>
                        <button
                          onClick={handleCopyUpi}
                          className="px-2 py-0.5 rounded bg-purple text-white hover:bg-purple-light transition-colors text-[10px] flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: UTR & Screenshot Upload */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-purple/5 border border-purple/15 text-xs text-slate-600 leading-relaxed">
                      <strong className="text-purple block mb-1">How to Complete Payment:</strong>
                      1. Scan the QR code using GPay, PhonePe, or Paytm.<br />
                      2. Transfer exact amount <strong>₹{grandTotal.toLocaleString('en-IN')}</strong>.<br />
                      3. Enter the 12-digit UTR/Ref No. and upload the screenshot below.
                    </div>

                    {/* UTR Input */}
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

                    {/* Screenshot Upload */}
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

                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-center space-x-1.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-navy"
                  >
                    ← Back to Address
                  </button>
                  <button
                    onClick={() => {
                      if (!utrNumber.trim()) {
                        setErrorMessage('Please enter the 12-digit UPI UTR number');
                        return;
                      }
                      if (!screenshotPreview) {
                        setErrorMessage('Please upload your payment screenshot');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(3);
                    }}
                    className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow"
                  >
                    <span>Review Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-black text-navy">Review & Place Your Order</h3>

                {/* Proof & Address Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-navy flex items-center space-x-1">
                      <MapPin className="w-4 h-4 text-orange" />
                      <span>Shipping Address</span>
                    </div>
                    <div className="text-slate-600">{address.fullName}</div>
                    <div className="text-slate-500">{address.addressLine1}, {address.city} - {address.postalCode}</div>
                    <div className="text-slate-500">{address.phone}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-navy flex items-center space-x-1">
                      <QrCode className="w-4 h-4 text-purple" />
                      <span>UPI Payment Proof</span>
                    </div>
                    <div className="text-slate-600 font-mono">UTR: <strong>{utrNumber}</strong></div>
                    <div className="text-emerald-600 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Screenshot Attached</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Order Items</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {items.map((i) => (
                      <div key={i.productId} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <img
                            src={i.imageUrl || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=100'}
                            alt={i.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-bold text-navy">{i.name}</div>
                            <div className="text-[10px] text-slate-400">Qty: {i.quantity} × ₹{i.unitPrice}</div>
                          </div>
                        </div>
                        <div className="font-bold text-navy">₹{(i.unitPrice * i.quantity).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-navy"
                  >
                    ← Edit Payment Proof
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className={`px-8 py-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-glow ${
                      isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Order...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Proof & Place Order (₹{grandTotal.toLocaleString('en-IN')})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Order Summary (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-black text-navy">Order Summary</h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Festival Coupon</span>
                  <span>-₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>GST Tax (18%)</span>
                <span>Included</span>
              </div>

              <div className="flex justify-between">
                <span>Sivakasi Transport</span>
                <span className="font-bold text-emerald-600">
                  {shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}
                </span>
              </div>

              <div className="flex justify-between text-sm font-black text-navy pt-3 border-t border-slate-100">
                <span>Grand Total</span>
                <span className="text-base text-navy font-black">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple/5 border border-purple/15 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-purple flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Genuine Sivakasi Goods</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Direct dispatch from Sivakasi factory with strict explosive packaging standards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
