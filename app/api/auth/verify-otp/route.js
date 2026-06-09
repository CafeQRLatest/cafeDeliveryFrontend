// app/api/auth/verify-otp/route.js
// Verifies the 6-digit OTP submitted by the customer.

import { NextResponse } from 'next/server';

// Must reference the same Map instance as send-otp.
// In Next.js App Router, server-side module state is shared within the same
// serverless function instance. For multi-instance deployments, use Redis.
import { otpStore } from '../send-otp/store';

export async function POST(req) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP required' }, { status: 400 });
    }

    const record = otpStore.get(email);

    if (!record) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 404 });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 410 });
    }

    if (record.otp !== String(otp)) {
      return NextResponse.json({ error: 'Incorrect OTP.' }, { status: 401 });
    }

    // Success — clear OTP
    otpStore.delete(email);
    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
