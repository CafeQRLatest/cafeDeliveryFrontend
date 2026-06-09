// Shared OTP store — exported so verify-otp can reference the same Map.
// Replace with Redis for multi-instance production deployments.
export const otpStore = new Map();
