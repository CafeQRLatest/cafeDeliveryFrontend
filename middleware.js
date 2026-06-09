// middleware.js  (Next.js App Router — runs at the Edge before every matched request)
//
// PURPOSE:
//   Protect delivery-customer routes. Any request to /order, /checkout, or /track
//   that does NOT carry a valid delivery_session cookie is redirected to the login
//   page (/) with the restaurant context (?r= and ?t= params) preserved.
//
// SCOPE (matcher below):
//   /order        /order?r=...&t=...
//   /checkout     /checkout?r=...
//   /track        /track?id=...&r=...
//
// WHAT THIS DOES NOT TOUCH:
//   - /                 (login page itself — always public)
//   - /api/**           (API routes handle their own auth via getDeliverySession)
//   - /_next/**         (Next.js internals)
//   - /public/**        (static assets)
//   - cafeTestQRFrontend (separate repo — completely unrelated)

import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';

export function middleware(req) {
  const session = getSessionFromCookies(req.cookies);

  if (!session) {
    // Build redirect URL: preserve ?r= and ?t= so the login page knows
    // which restaurant the customer came from.
    const { searchParams } = req.nextUrl;
    const r = searchParams.get('r') || '';
    const t = searchParams.get('t') || 'DELIVERY';

    const loginUrl = new URL('/', req.url);
    if (r) loginUrl.searchParams.set('r', r);
    loginUrl.searchParams.set('t', t);

    return NextResponse.redirect(loginUrl);
  }

  // Session valid — allow request through
  return NextResponse.next();
}

// Matcher: ONLY run middleware on these three delivery-customer routes.
// All other paths (/, /api/**, _next, static files) are excluded.
export const config = {
  matcher: ['/order', '/checkout', '/track'],
};
