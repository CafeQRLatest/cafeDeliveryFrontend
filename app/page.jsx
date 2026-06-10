'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiMail, FiCheck, FiArrowRight } from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// app/page.jsx — Delivery Website Login Entry Point
//
// BEHAVIOUR:
//   1. No ?r= param          → branded "use your restaurant link" fallback
//   2. ?r= present, session  → skip login, go straight to /order
//   3. ?r= present, no sess  → show email OTP login UI
//
// After successful OTP verify the browser receives the delivery_session cookie
// (set by verify-otp/route.js) and is redirected to /order?r=&t=
//
// NOTE: Does NOT touch staff/POS auth in cafeTestQRFrontend.
// ─────────────────────────────────────────────────────────────────────────────

function HomeInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const r = searchParams.get('r');
  const t = searchParams.get('t') || 'DELIVERY';
  const orgId = searchParams.get('orgId') || searchParams.get('branchId') || '';

  // ── Session check ──────────────────────────────────────────────────────────
  // On mount, ping a lightweight session-check endpoint.
  // If a valid delivery_session cookie already exists, skip login entirely.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!r) { setSessionChecked(true); return; }
    fetch('/api/auth/session')
      .then(res => {
        if (res.ok) {
          // Already logged in — go straight to menu
          router.replace(`/order?r=${r}&t=${t}${orgId ? `&orgId=${orgId}` : ''}`);
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => setSessionChecked(true));
  }, [r, t, orgId, router]);

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [email,       setEmail]       = useState('');
  const [otpSent,     setOtpSent]     = useState(false);
  const [otp,         setOtp]         = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || 'Could not send OTP'); return; }
      setOtpSent(true);
      setResendTimer(60); // 60-second cooldown
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Incorrect OTP. Please try again.'); return; }
      // Cookie is now set by the server — redirect to menu
      setOtpVerified(true);
      setTimeout(() => router.replace(`/order?r=${r}&t=${t}${orgId ? `&orgId=${orgId}` : ''}`), 600);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setOtpSent(false);
    setOtp('');
    setError('');
    setResendTimer(0);
  };

  // ── Loading / session check spinner ────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── No restaurant param — branded fallback ─────────────────────────────────
  if (!r) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-label="CafeQR Delivery">
            <rect width="56" height="56" rx="16" fill="#EA580C"/>
            <path d="M14 20h28M14 28h20M14 36h24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="42" cy="34" r="8" fill="white"/>
            <path d="M39 34l2 2 4-4" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900">CafeQR Delivery</h1>
        <p className="text-stone-400 mt-2 text-sm max-w-xs">
          This link is unique to each restaurant. Please use the link provided by your restaurant to place an order.
        </p>
        <div className="mt-8 bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 max-w-xs w-full">
          <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-1">How it works</p>
          <ul className="text-sm text-stone-600 space-y-2 text-left mt-2">
            <li className="flex gap-2"><span className="text-brand-orange font-bold">1.</span> Scan the QR code at your table or use the link shared by the restaurant</li>
            <li className="flex gap-2"><span className="text-brand-orange font-bold">2.</span> Sign in with your email to verify your order</li>
            <li className="flex gap-2"><span className="text-brand-orange font-bold">3.</span> Browse the menu, checkout, and track your order live</li>
          </ul>
        </div>
        <p className="mt-10 text-xs text-stone-300">Powered by CafeQR &copy; {new Date().getFullYear()}</p>
      </div>
    );
  }

  // ── Login UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">

        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-orange rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none" aria-hidden>
              <path d="M14 20h28M14 28h20M14 36h24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="42" cy="34" r="8" fill="white"/>
              <path d="M39 34l2 2 4-4" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Sign in to order</h1>
          <p className="text-stone-400 text-sm mt-1 text-center">
            {t === 'TAKEAWAY' ? 'Takeaway order' : 'Delivery order'} &mdash; enter your email to continue
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-5">

          {/* Success state */}
          {otpVerified ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <FiCheck size={28} className="text-green-600" />
              </div>
              <p className="font-semibold text-stone-800">Verified! Taking you to the menu…</p>
            </div>
          ) : (
            <>
              {/* Email row */}
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Email address</label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input
                      type="email"
                      className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl text-sm outline-none focus:border-brand-orange transition-colors disabled:bg-stone-50 disabled:text-stone-400"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => handleEmailChange(e.target.value)}
                      disabled={otpSent}
                      autoFocus
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                  {!otpSent ? (
                    <button
                      onClick={sendOtp}
                      disabled={loading}
                      className="flex-shrink-0 bg-brand-orange hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : 'Send OTP'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEmailChange(email)}
                      className="flex-shrink-0 text-xs text-stone-400 hover:text-stone-600 px-3 underline"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* OTP input — shown after send */}
              {otpSent && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">6-digit OTP</label>
                    <button
                      onClick={sendOtp}
                      disabled={resendTimer > 0 || loading}
                      className="text-xs text-brand-orange disabled:text-stone-300 font-medium"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                  <p className="text-xs text-stone-400 mb-3">OTP sent to <span className="font-medium text-stone-600">{email}</span></p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.4em] outline-none focus:border-brand-orange transition-colors"
                      placeholder="······"
                      value={otp}
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    />
                    <button
                      onClick={verifyOtp}
                      disabled={loading || otp.length < 6}
                      className="flex-shrink-0 bg-stone-900 hover:bg-stone-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center gap-1.5"
                    >
                      {loading
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <><span>Verify</span><FiArrowRight size={14} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-stone-300 mt-6">
          Powered by CafeQR &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}
