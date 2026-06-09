// app/api/auth/send-otp/route.js
// Generates a 6-digit OTP, stores it in a server-side Map (TTL 10 min),
// and sends it to the customer's email via Gmail OAuth2 API.

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// In-memory OTP store: email → { otp, expiresAt }
// For production scale, replace with Redis or a DB table.
const otpStore = new Map();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getTransporter() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_SENDER_ADDRESS,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
  return transporter;
}

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Rate-limit: don't resend if OTP is still fresh (< 1 min old)
    const existing = otpStore.get(email);
    if (existing && existing.expiresAt - Date.now() > OTP_TTL_MS - 60000) {
      return NextResponse.json({ message: 'OTP already sent. Please wait a moment.' }, { status: 429 });
    }

    const otp = generateOtp();
    otpStore.set(email, { otp, expiresAt: Date.now() + OTP_TTL_MS });

    // Send email
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: `"CafeQR Delivery" <${process.env.GMAIL_SENDER_ADDRESS}>`,
      to: email,
      subject: 'Your CafeQR Order Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #EA580C; color: white; font-weight: bold; font-size: 18px; padding: 12px 20px; border-radius: 12px;">CafeQR Delivery</div>
          </div>
          <h2 style="font-size: 20px; color: #1c1917; margin-bottom: 8px;">Your verification code</h2>
          <p style="color: #78716c; font-size: 14px; margin-bottom: 24px;">Enter this code to confirm your order. It expires in 10 minutes.</p>
          <div style="background: #fff7ed; border: 2px dashed #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #ea580c;">${otp}</span>
          </div>
          <p style="color: #a8a29e; font-size: 12px; text-align: center;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
