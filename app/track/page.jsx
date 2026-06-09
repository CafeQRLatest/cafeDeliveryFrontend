'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiCheck, FiClock, FiPackage, FiTruck, FiHome } from 'react-icons/fi';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://cafe-qr-backend.onrender.com/api';

const ORDER_STEPS = [
  { key: 'PLACED',    label: 'Order Placed',     icon: FiCheck,   desc: 'Your order has been received' },
  { key: 'CONFIRMED', label: 'Order Confirmed',  icon: FiPackage, desc: 'Restaurant is preparing your food' },
  { key: 'READY',     label: 'Food Ready',       icon: FiClock,   desc: 'Your order is ready' },
  { key: 'OUT',       label: 'Out for Delivery', icon: FiTruck,   desc: 'On the way to you' },
  { key: 'DELIVERED', label: 'Delivered',        icon: FiHome,    desc: 'Enjoy your meal!' },
];

const TAKEAWAY_STEPS = [
  { key: 'PLACED',    label: 'Order Placed',    icon: FiCheck,   desc: 'Your order has been received' },
  { key: 'CONFIRMED', label: 'Confirmed',       icon: FiPackage, desc: 'Restaurant is preparing your order' },
  { key: 'READY',     label: 'Ready for Pickup', icon: FiClock,  desc: 'Your order is ready! Head over to pick up.' },
];

const STATUS_INDEX = { PLACED: 0, CONFIRMED: 1, READY: 2, OUT: 3, DELIVERED: 4 };

function TrackPageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const orderId      = searchParams.get('id');
  const restaurantId = searchParams.get('r');

  const [order, setOrder]       = useState(null);
  const [status, setStatus]     = useState('PLACED');
  const [loading, setLoading]   = useState(true);
  const [eta, setEta]           = useState('25-35 min');

  useEffect(() => {
    if (!orderId) { router.replace('/'); return; }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/orders/${orderId}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          setStatus(data.status || 'PLACED');
          if (data.eta) setEta(data.eta);
        } else {
          throw new Error();
        }
      } catch {
        // Demo mode — simulate order progression
        setOrder({ id: orderId, status: 'PLACED', type: 'DELIVERY' });
        setStatus('PLACED');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Poll every 15 seconds
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [orderId, router]);

  const orderType = order?.type || order?.orderType || 'DELIVERY';
  const steps     = orderType === 'TAKEAWAY' ? TAKEAWAY_STEPS : ORDER_STEPS;
  const stepIdx   = STATUS_INDEX[status] ?? 0;
  const isDelivered = status === 'DELIVERED' || (orderType === 'TAKEAWAY' && status === 'READY');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-400 text-sm">Tracking your order…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-stone-900 text-lg">Order Tracking</h1>
            <p className="text-xs text-stone-400 mt-0.5">#{orderId}</p>
          </div>
          {!isDelivered && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-brand-orange rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-orange-700">{eta}</span>
            </div>
          )}
        </div>
      </div>

      {/* Celebration banner */}
      {isDelivered && (
        <div className="bg-green-500 text-white px-4 py-5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-bold text-lg">{orderType === 'TAKEAWAY' ? 'Order Ready!' : 'Order Delivered!'}</p>
          <p className="text-sm opacity-80 mt-0.5">Enjoy your meal! Thank you for ordering.</p>
        </div>
      )}

      {/* Progress stepper */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-stone-600 mb-4">Order Status</h2>
        <div className="space-y-0">
          {steps.map((step, idx) => {
            const done    = idx < stepIdx;
            const current = idx === stepIdx;
            const Icon    = step.icon;
            return (
              <div key={step.key} className="flex gap-4">
                {/* Line + circle */}
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                    done    ? 'bg-green-500 border-green-500 text-white' :
                    current ? 'bg-brand-orange border-brand-orange text-white' :
                              'bg-white border-stone-200 text-stone-300'
                  }`}>
                    <Icon size={16} />
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-[24px] ${
                      done ? 'bg-green-400' : 'bg-stone-200'
                    }`} />
                  )}
                </div>
                {/* Label */}
                <div className={`pb-5 ${ idx === steps.length - 1 ? 'pb-0' : '' }`}>
                  <p className={`text-sm font-semibold ${
                    current ? 'text-brand-orange' : done ? 'text-green-600' : 'text-stone-300'
                  }`}>{step.label}</p>
                  {current && (
                    <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-brand-orange rounded-full animate-pulse" />
                      {step.desc}
                    </p>
                  )}
                  {done && <p className="text-xs text-stone-300 mt-0.5">{step.desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order summary */}
      {order?.items && (
        <div className="bg-white mx-4 mt-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-stone-600 mb-3">Your Order</h2>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-stone-700">{item.name} × {item.qty}</span>
              <span className="font-medium text-stone-800">₹{(item.price * item.qty).toFixed(0)}</span>
            </div>
          ))}
          {order.total && (
            <div className="border-t border-stone-100 mt-2 pt-2 flex justify-between font-bold text-stone-900">
              <span>Total</span><span>₹{order.total}</span>
            </div>
          )}
        </div>
      )}

      {/* Reorder / home */}
      <div className="px-4 mt-4 pb-8 space-y-2">
        {restaurantId && (
          <button
            onClick={() => router.push(`/order?r=${restaurantId}&t=${orderType}`)}
            className="w-full bg-brand-orange text-white font-semibold py-4 rounded-xl"
          >
            Order Again
          </button>
        )}
        <button
          onClick={() => router.push('/')}
          className="w-full border border-stone-200 text-stone-600 font-medium py-3.5 rounded-xl text-sm"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TrackPageInner />
    </Suspense>
  );
}
