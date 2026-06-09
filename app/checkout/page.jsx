'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiMapPin, FiUser, FiPhone, FiCreditCard, FiCheck, FiMail, FiLoader } from 'react-icons/fi';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://cafe-qr-backend.onrender.com/api';

function CheckoutPageInner() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const restaurantId  = searchParams.get('r');
  const orderType     = searchParams.get('t') || 'DELIVERY';

  // Steps: 1=contact+OTP, 2=address, 3=payment+confirm
  const [step, setStep]       = useState(1);
  const [cart, setCart]       = useState([]);
  const [restaurant, setRestaurant] = useState(null);

  // Step 1 — contact
  const [email, setEmail]         = useState('');
  const [otpSent, setOtpSent]     = useState(false);
  const [otp, setOtp]             = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpError, setOtpError]       = useState('');
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');

  // Step 2 — address
  const [address, setAddress] = useState({ line1: '', area: '', city: 'Thrissur', pincode: '' });

  // Step 3 — payment
  const [payment, setPayment] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors]   = useState({});

  // Load cart from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`cart_${restaurantId}`);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    // Try to load restaurant name for display
    try {
      const r = sessionStorage.getItem(`restaurant_${restaurantId}`);
      if (r) setRestaurant(JSON.parse(r));
    } catch {}
  }, [restaurantId]);

  const cartTotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount    = cart.reduce((s, i) => s + i.qty, 0);
  const deliveryFee  = orderType === 'TAKEAWAY' ? 0 : (cartTotal >= 500 ? 0 : 40);
  const grandTotal   = cartTotal + deliveryFee;

  // ── OTP via Gmail API (server route) ────────────────────────────
  const sendOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError('Enter a valid email address');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to send OTP');
      setOtpSent(true);
    } catch (e) {
      setOtpError(e.message || 'Could not send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 4) { setOtpError('Enter the 6-digit OTP'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) { setOtpError('Incorrect OTP. Please try again.'); return; }
      setOtpVerified(true);
    } catch {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const validateStep1 = () => {
    const e = {};
    if (!name.trim())  e.name  = 'Name is required';
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (!otpVerified) e.otp = 'Please verify your email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    if (orderType === 'TAKEAWAY') return true;
    const e = {};
    if (!address.line1.trim())   e.line1   = 'House / flat is required';
    if (!address.area.trim())    e.area    = 'Area / locality is required';
    if (!address.pincode.trim()) e.pincode = 'Pincode is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const payload = {
        restaurantId,
        orderType,
        customer: { name, phone, email },
        address: orderType === 'DELIVERY' ? address : null,
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        payment,
        total: grandTotal,
      };

      let orderId;
      try {
        const res = await fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          orderId = data.orderId || data.id || data.order_id;
        } else {
          throw new Error('Backend error');
        }
      } catch {
        // Fallback: generate client-side order ID
        orderId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      }

      // Clear cart
      try { sessionStorage.removeItem(`cart_${restaurantId}`); } catch {}

      router.push(`/track?id=${orderId}&r=${restaurantId}`);
    } finally {
      setPlacing(false);
    }
  };

  const STEPS = [
    { num: 1, label: 'Contact' },
    { num: 2, label: orderType === 'TAKEAWAY' ? 'Confirm' : 'Address' },
    { num: 3, label: 'Payment' },
  ];

  if (cart.length === 0 && step < 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">🛒</span>
        <h2 className="font-bold text-stone-800 text-lg">Your cart is empty</h2>
        <button onClick={() => router.back()} className="bg-brand-orange text-white px-6 py-3 rounded-xl font-semibold text-sm">← Back to Menu</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-stone-100">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => step === 1 ? router.back() : setStep(s => s - 1)} className="p-1.5 -ml-1 rounded-lg hover:bg-stone-100 text-stone-500">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-stone-900 text-lg">Checkout</h1>
        </div>
        {/* Step indicator */}
        <div className="flex px-4 pb-3 gap-0">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step > s.num  ? 'bg-green-500 border-green-500 text-white' :
                  step === s.num ? 'bg-brand-orange border-brand-orange text-white' :
                                   'bg-white border-stone-200 text-stone-400'
                }`}>
                  {step > s.num ? <FiCheck size={12} /> : s.num}
                </div>
                <span className={`text-xs mt-0.5 ${
                  step >= s.num ? 'text-stone-600 font-medium' : 'text-stone-300'
                }`}>{s.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-3 mx-1 ${
                  step > s.num ? 'bg-brand-orange' : 'bg-stone-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 pb-36">

        {/* Cart summary (always visible at top) */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <button onClick={() => router.back()} className="text-xs text-brand-orange font-medium">Edit</button>
          </div>
          {cart.map(i => (
            <div key={i.id} className="flex justify-between text-sm py-1">
              <span className="text-stone-700">{i.name} × {i.qty}</span>
              <span className="font-medium text-stone-800">₹{(i.price * i.qty).toFixed(0)}</span>
            </div>
          ))}
          <div className="border-t border-stone-100 mt-2 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Subtotal</span><span>₹{cartTotal.toFixed(0)}</span>
            </div>
            {orderType === 'DELIVERY' && (
              <div className="flex justify-between text-sm text-stone-500">
                <span>Delivery fee</span>
                <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-stone-900 pt-1">
              <span>Total</span><span>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ── Step 1: Contact + Email OTP ─────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FiUser size={18} className="text-brand-orange" />
              <h2 className="font-semibold text-stone-800">Your Details</h2>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Full Name</label>
              <input
                className={`w-full mt-1.5 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                  errors.name ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-brand-orange'
                }`}
                placeholder="Enter your full name"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Mobile Number</label>
              <div className="flex gap-2 mt-1.5">
                <div className="border border-stone-200 rounded-xl px-3 py-3 text-sm text-stone-400 bg-stone-50">+91</div>
                <input
                  className={`flex-1 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                    errors.phone ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-brand-orange'
                  }`}
                  placeholder="10-digit number"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: '' })); }}
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>

            {/* Email OTP */}
            <div>
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email (for order confirmation)</label>
              <div className="flex gap-2 mt-1.5">
                <input
                  className={`flex-1 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                    otpVerified ? 'border-green-400 bg-green-50' : 'border-stone-200 focus:border-brand-orange'
                  }`}
                  placeholder="you@example.com"
                  value={email}
                  type="email"
                  onChange={e => { setEmail(e.target.value); setOtpSent(false); setOtpVerified(false); setOtpError(''); }}
                  disabled={otpVerified}
                />
                {!otpVerified && (
                  <button
                    onClick={sendOtp}
                    disabled={otpLoading || otpSent}
                    className="flex-shrink-0 bg-brand-orange text-white px-4 py-3 rounded-xl text-xs font-semibold disabled:opacity-60 transition-opacity"
                  >
                    {otpLoading ? '…' : otpSent ? 'Sent ✓' : 'Send OTP'}
                  </button>
                )}
                {otpVerified && (
                  <div className="flex-shrink-0 bg-green-500 text-white px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-1">
                    <FiCheck size={13} /> Verified
                  </div>
                )}
              </div>
              {otpSent && !otpVerified && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-orange tracking-[0.3em] font-mono"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                  />
                  <button
                    onClick={verifyOtp}
                    disabled={otpLoading || otp.length < 6}
                    className="flex-shrink-0 bg-stone-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    {otpLoading ? '…' : 'Verify'}
                  </button>
                </div>
              )}
              {otpError && <p className="text-xs text-red-500 mt-1">{otpError}</p>}
              {errors.otp && !otpVerified && <p className="text-xs text-red-500 mt-1">{errors.otp}</p>}
            </div>
          </div>
        )}

        {/* ── Step 2: Address / Takeaway confirm ──────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FiMapPin size={18} className="text-brand-orange" />
              <h2 className="font-semibold text-stone-800">
                {orderType === 'TAKEAWAY' ? 'Pickup Confirmation' : 'Delivery Address'}
              </h2>
            </div>
            {orderType === 'TAKEAWAY' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800">🛖 Takeaway Order</p>
                <p className="text-xs text-amber-600">Your order will be ready for pickup. We'll send a confirmation to {email}.</p>
                <div className="border-t border-amber-200 pt-2 mt-2">
                  <p className="text-xs text-amber-700 font-medium">{name}</p>
                  <p className="text-xs text-amber-700">+91 {phone}</p>
                  <p className="text-xs text-amber-700">{email}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">House / Flat / Building</label>
                  <input
                    className={`w-full mt-1.5 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                      errors.line1 ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-brand-orange'
                    }`}
                    placeholder="Flat 4B, Rose Apartments"
                    value={address.line1}
                    onChange={e => { setAddress(p => ({...p, line1: e.target.value})); setErrors(p => ({...p, line1: ''})); }}
                  />
                  {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Area / Locality</label>
                  <input
                    className={`w-full mt-1.5 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                      errors.area ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-brand-orange'
                    }`}
                    placeholder="Swaraj Round, Punkunnam"
                    value={address.area}
                    onChange={e => { setAddress(p => ({...p, area: e.target.value})); setErrors(p => ({...p, area: ''})); }}
                  />
                  {errors.area && <p className="text-xs text-red-500 mt-1">{errors.area}</p>}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">City</label>
                    <input className="w-full mt-1.5 border border-stone-200 rounded-xl px-4 py-3 text-sm bg-stone-50 text-stone-400" value={address.city} readOnly />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Pincode</label>
                    <input
                      className={`w-full mt-1.5 border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                        errors.pincode ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-brand-orange'
                      }`}
                      placeholder="680001"
                      value={address.pincode}
                      onChange={e => { setAddress(p => ({...p, pincode: e.target.value})); setErrors(p => ({...p, pincode: ''})); }}
                      maxLength={6}
                      inputMode="numeric"
                    />
                    {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Payment ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FiCreditCard size={18} className="text-brand-orange" />
              <h2 className="font-semibold text-stone-800">Payment Method</h2>
            </div>
            <div className="space-y-2">
              {[
                { val: 'COD',  label: 'Cash on Delivery', desc: 'Pay when order arrives', icon: '💵' },
                { val: 'UPI',  label: 'UPI',              desc: 'PhonePe, GPay, Paytm',  icon: '📱' },
                { val: 'CARD', label: 'Card',             desc: 'Visa, Mastercard, RuPay', icon: '💳' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setPayment(opt.val)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    payment === opt.val ? 'border-brand-orange bg-orange-50' : 'border-stone-100 hover:border-stone-200'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${payment === opt.val ? 'text-orange-700' : 'text-stone-800'}`}>{opt.label}</p>
                    <p className="text-xs text-stone-400">{opt.desc}</p>
                  </div>
                  <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    payment === opt.val ? 'border-brand-orange bg-brand-orange' : 'border-stone-300'
                  }`}>
                    {payment === opt.val && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 px-4 py-4">
        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 1 && !validateStep1()) return;
              if (step === 2 && !validateStep2()) return;
              setStep(s => s + 1);
            }}
            className="w-full bg-brand-orange hover:bg-orange-600 text-white font-semibold py-4 rounded-xl transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={placeOrder}
            disabled={placing}
            className="w-full bg-brand-orange hover:bg-orange-600 disabled:opacity-70 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {placing
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Placing Order…</>
              : `Place Order · ₹${grandTotal}`
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutPageInner />
    </Suspense>
  );
}
