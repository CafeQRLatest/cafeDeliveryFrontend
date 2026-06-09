'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// The Delivery Website is restaurant-specific.
// URL format: https://delivery.cafeqr.in/?r=<restaurantId>&t=DELIVERY
// If ?r= param is present → redirect immediately to /order?r=...&t=...
// If no ?r= param (direct visit) → show branded fallback screen.

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const r = searchParams.get('r');
  const t = searchParams.get('t') || 'DELIVERY';

  useEffect(() => {
    if (r) {
      router.replace(`/order?r=${r}&t=${t}`);
    }
  }, [r, t, router]);

  if (r) {
    // Redirect in progress — show spinner
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No restaurant param — show a generic CafeQR Delivery branded screen
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
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
          <li className="flex gap-2"><span className="text-brand-orange font-bold">2.</span> Browse the menu and add items to your cart</li>
          <li className="flex gap-2"><span className="text-brand-orange font-bold">3.</span> Checkout and track your order live</li>
        </ul>
      </div>
      <p className="mt-10 text-xs text-stone-300">Powered by CafeQR &copy; {new Date().getFullYear()}</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}
