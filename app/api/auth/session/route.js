// app/api/auth/session/route.js
// Lightweight session-check endpoint called by app/page.jsx on mount.
// Returns 200 + { email } if delivery_session cookie is valid.
// Returns 401 if cookie is missing or invalid.
//
// This allows the login page to skip the OTP flow entirely when the
// customer already has a live session (e.g. returning within 7 days).
//
// NOTE: Delivery Website customer auth ONLY.
//       Does NOT affect staff/POS auth in cafeTestQRFrontend.

import { NextResponse } from 'next/server';
import { getDeliverySession } from '@/lib/auth';

export async function GET(req) {
  const session = await getDeliverySession(req);

  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 });
  }

  return NextResponse.json({ email: session.email });
}
