'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiSearch, FiArrowLeft, FiStar, FiClock, FiMapPin, FiShoppingBag } from 'react-icons/fi';
import MenuItemCard from '@/components/MenuItemCard';
import CartDrawer from '@/components/CartDrawer';
import FloatingCartBar from '@/components/FloatingCartBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://cafe-qr-backend.onrender.com/api';

// ─── MOCK DATA (used when backend returns no data / for offline dev) ─────────
const MOCK_RESTAURANT = {
  name: 'Hotel Paradise',
  tagline: 'Authentic Kerala & Arabian Cuisine',
  address: 'MG Road, Thrissur, Kerala',
  rating: 4.3,
  delivery_time: '15-20 min',
  min_order: 150,
};

const MOCK_MENU = [
  { id: 's1', category: 'Starters', name: 'Kerala Prawn Fry', description: 'Crispy prawns in Kerala masala', price: 280, is_veg: false, is_bestseller: true },
  { id: 's2', category: 'Starters', name: 'Chicken 65', description: 'Deep fried with curry leaves and coconut oil', price: 220, is_veg: false, is_bestseller: true },
  { id: 's3', category: 'Starters', name: 'Vegetable Cutlet', description: 'Mixed veggies with cashews', price: 120, is_veg: true, is_bestseller: false },
  { id: 'm1', category: 'Mains', name: 'Malabar Biryani', description: 'Fragrant rice with tender chicken and saffron', price: 320, is_veg: false, is_bestseller: true },
  { id: 'm2', category: 'Mains', name: 'Fish Molee', description: 'Tender fish in mild coconut milk curry', price: 290, is_veg: false, is_bestseller: false },
  { id: 'm3', category: 'Mains', name: 'Avial', description: 'Mixed vegetables in coconut-yoghurt gravy', price: 160, is_veg: true, is_bestseller: false },
  { id: 'm4', category: 'Mains', name: 'Palak Paneer', description: 'Cottage cheese in spiced spinach gravy', price: 200, is_veg: true, is_bestseller: false },
  { id: 'b1', category: 'Breads', name: 'Kerala Parotta', description: 'Flaky layered flatbread', price: 35, is_veg: true, is_bestseller: true },
  { id: 'b2', category: 'Breads', name: 'Appam', description: 'Soft fermented rice pancakes', price: 40, is_veg: true, is_bestseller: false },
  { id: 'v1', category: 'Beverages', name: 'Sulaimani', description: 'Spiced black tea with lemon', price: 60, is_veg: true, is_bestseller: false },
  { id: 'v2', category: 'Beverages', name: 'Tender Coconut', description: 'Fresh tender coconut water', price: 80, is_veg: true, is_bestseller: true },
];
// ─────────────────────────────────────────────────────────────────────────────

function OrderPageInner() {
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const restaurantId    = searchParams.get('r');
  const orderType       = searchParams.get('t') || 'DELIVERY';

  const [restaurant, setRestaurant]         = useState(null);
  const [menu, setMenu]                     = useState([]);
  const [categories, setCategories]         = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart]                     = useState([]);  // [{ id, name, price, qty }]
  const [cartOpen, setCartOpen]             = useState(false);
  const [search, setSearch]                 = useState('');
  const [vegOnly, setVegOnly]               = useState(false);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const categoryRefs                        = useRef({});

  // ── Persist cart to sessionStorage so it survives page refresh ──
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`cart_${restaurantId}`);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, [restaurantId]);

  useEffect(() => {
    try { sessionStorage.setItem(`cart_${restaurantId}`, JSON.stringify(cart)); } catch {}
  }, [cart, restaurantId]);

  // ── Fetch restaurant + menu ──────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) {
      router.replace('/');
      return;
    }
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Try real backend first
        const [rRes, mRes] = await Promise.all([
          fetch(`${API_BASE}/restaurants/${restaurantId}`, { signal: AbortSignal.timeout(6000) }),
          fetch(`${API_BASE}/restaurants/${restaurantId}/menu?type=${orderType}`, { signal: AbortSignal.timeout(6000) }),
        ]);

        if (!rRes.ok || !mRes.ok) throw new Error('Backend error');

        const rData = await rRes.json();
        const mData = await mRes.json();

        const items  = Array.isArray(mData) ? mData : (mData.items || mData.products || []);
        const cats   = [...new Set(items.map(i => i.category || i.categoryName || 'Other'))];

        setRestaurant(rData);
        setMenu(items);
        setCategories(cats);
        setActiveCategory(cats[0] || null);
      } catch {
        // Fall back to mock data gracefully
        console.warn('[CafeQR] Backend unreachable — using mock data');
        const cats = [...new Set(MOCK_MENU.map(i => i.category))];
        setRestaurant(MOCK_RESTAURANT);
        setMenu(MOCK_MENU);
        setCategories(cats);
        setActiveCategory(cats[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId, orderType, router]);

  // ── Cart helpers ─────────────────────────────────────────────────
  const addItem = (item) => setCart(prev => {
    const existing = prev.find(i => i.id === item.id);
    if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
    return [...prev, { id: item.id, name: item.name, price: Number(item.price), qty: 1 }];
  });

  const removeItem = (id) => setCart(prev => {
    const existing = prev.find(i => i.id === id);
    if (!existing || existing.qty === 1) return prev.filter(i => i.id !== id);
    return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
  });

  const getQty = (id) => cart.find(i => i.id === id)?.qty || 0;

  const scrollToCategory = (cat) => {
    setActiveCategory(cat);
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Filtering ────────────────────────────────────────────────────
  const filtered = menu.filter(i => {
    const matchSearch = !search ||
      (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(search.toLowerCase());
    const matchVeg = !vegOnly || i.is_veg;
    return matchSearch && matchVeg;
  });

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = filtered.filter(i => (i.category || i.categoryName || 'Other') === cat);
    return acc;
  }, {});

  // ── Loading state ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-stone-50">
      {/* Skeleton header */}
      <div className="bg-white">
        <div className="h-40 bg-stone-200 animate-pulse" />
        <div className="px-4 py-4 space-y-2">
          <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          <div className="h-4 w-56 bg-stone-100 rounded animate-pulse" />
          <div className="h-3 w-48 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="px-4 mt-4 space-y-3">
        {[1,2,3,4].map(n => (
          <div key={n} className="bg-white rounded-xl p-4 flex gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-stone-200 rounded animate-pulse" />
              <div className="h-3 w-full bg-stone-100 rounded animate-pulse" />
              <div className="h-4 w-1/4 bg-stone-200 rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 bg-stone-200 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">😕</span>
      <h2 className="font-bold text-stone-800 text-lg">Could not load menu</h2>
      <p className="text-stone-400 text-sm">{error}</p>
      <button onClick={() => window.location.reload()} className="bg-brand-orange text-white px-6 py-3 rounded-xl font-semibold text-sm">
        Try Again
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Restaurant Hero */}
      <div className="bg-white">
        <div className="h-40 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="text-8xl">🍽️</span>
          </div>
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 bg-white/20 backdrop-blur text-white p-2 rounded-full"
          >
            <FiArrowLeft size={18} />
          </button>
          <div className="absolute top-4 right-4">
            <span className="bg-white/20 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full">
              {orderType === 'DELIVERY' ? '🚴 Delivery' : '🛖 Takeaway'}
            </span>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-stone-900">{restaurant?.name}</h1>
              <p className="text-stone-500 text-sm mt-0.5">{restaurant?.tagline || restaurant?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-stone-500">
            <span className="flex items-center gap-1">
              <FiStar size={13} className="text-amber-400 fill-amber-400" />
              <span className="font-semibold text-stone-700">{restaurant?.rating}</span>
            </span>
            <span className="text-stone-300">|</span>
            <span className="flex items-center gap-1">
              <FiClock size={13} />
              {restaurant?.delivery_time || restaurant?.deliveryTime || '20-35 min'}
            </span>
            <span className="text-stone-300">|</span>
            <span className="flex items-center gap-1 truncate">
              <FiMapPin size={13} />
              {(restaurant?.address || '').split(',')[0]}
            </span>
          </div>
          {restaurant?.min_order && (
            <p className="text-xs text-stone-400 mt-1.5">Min. order ₹{restaurant.min_order}</p>
          )}
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-stone-100">
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-2">
          <div className="flex items-center gap-2 bg-stone-100 rounded-xl px-3.5 py-2.5 flex-1">
            <FiSearch size={15} className="text-stone-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent flex-1 text-sm text-stone-700 outline-none placeholder-stone-400 min-w-0"
            />
          </div>
          <button
            onClick={() => setVegOnly(v => !v)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-2.5 rounded-xl border-2 transition-colors ${
              vegOnly ? 'bg-green-500 text-white border-green-500' : 'border-stone-200 text-stone-500 bg-white'
            }`}
          >
            🥦 Veg
          </button>
        </div>

        {/* Category pills (hidden during search) */}
        {!search && (
          <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => { setActiveCategory(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
                !activeCategory ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-stone-600 border-stone-200'
              }`}
            >All</button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
                  activeCategory === cat
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-brand-orange hover:text-brand-orange'
                }`}
              >{cat}</button>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="pb-28">
        {search || vegOnly ? (
          <div className="bg-white mx-4 mt-3 rounded-xl px-4">
            <p className="text-xs text-stone-400 pt-3 pb-1">{filtered.length} items</p>
            {filtered.map(item => (
              <MenuItemCard key={item.id} item={item} qty={getQty(item.id)} onAdd={addItem} onRemove={removeItem} />
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-stone-400 text-sm">No items found</p>
              </div>
            )}
          </div>
        ) : (
          categories.map(cat => (
            grouped[cat]?.length > 0 && (
              <div key={cat} ref={el => { if (el) categoryRefs.current[cat] = el; }}>
                <div className="px-4 pt-4 pb-1.5">
                  <h2 className="font-bold text-stone-700 text-base">{cat}</h2>
                  <p className="text-xs text-stone-400">{grouped[cat].length} items</p>
                </div>
                <div className="bg-white mx-4 rounded-xl px-4">
                  {grouped[cat].map(item => (
                    <MenuItemCard key={item.id} item={item} qty={getQty(item.id)} onAdd={addItem} onRemove={removeItem} />
                  ))}
                </div>
              </div>
            )
          ))
        )}
      </div>

      {/* Floating cart + drawer */}
      <FloatingCartBar cart={cart} onClick={() => setCartOpen(true)} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onAdd={addItem}
        onRemove={removeItem}
        restaurantName={restaurant?.name}
        minOrder={restaurant?.min_order}
        onCheckout={() => {
          setCartOpen(false);
          // Pass cart via sessionStorage so checkout page can read it
          try { sessionStorage.setItem(`cart_${restaurantId}`, JSON.stringify(cart)); } catch {}
          router.push(`/checkout?r=${restaurantId}&t=${orderType}`);
        }}
      />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrderPageInner />
    </Suspense>
  );
}
