// Razorpay integration (ready for when you switch PAYMENT_MODE=razorpay).
// Uses Razorpay's REST API directly, so no extra package is needed.
// Docs: https://razorpay.com/docs/payments/server-integration/nodejs/
const crypto = require('crypto');

function isConfigured(cfg) {
  return Boolean(cfg.razorpayKeyId && cfg.razorpayKeySecret);
}

// Creates a Razorpay order. Amount is in rupees; Razorpay wants paise.
async function createOrder(cfg, { amount, receipt, notes }) {
  const auth = Buffer.from(`${cfg.razorpayKeyId}:${cfg.razorpayKeySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || 'Razorpay order creation failed');
  return data; // { id, amount, currency, ... }
}

// Verifies the signature Razorpay Checkout returns after a successful payment.
function verifySignature(cfg, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', cfg.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isConfigured, createOrder, verifySignature };
