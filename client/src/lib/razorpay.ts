import Razorpay from "razorpay";
import crypto from "crypto";

export const RAZORPAY_GATEWAY = "RAZORPAY";
export const QUARTERLY_AMOUNT_PAISE = 2499900;
export const DEFAULT_CURRENCY = "INR";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (instance) return instance;
  const key_id = process.env.PG_KEY_ID;
  const key_secret = process.env.PG_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("PG_KEY_ID and PG_KEY_SECRET must be set");
  }
  instance = new Razorpay({ key_id, key_secret });
  return instance;
}

export type CreateRazorpayOrderInput = {
  amount?: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
};

export async function createRazorpayOrder(input: CreateRazorpayOrderInput = {}) {
  const rzp = getRazorpay();
  const amount = input.amount ?? QUARTERLY_AMOUNT_PAISE;
  const currency = input.currency ?? DEFAULT_CURRENCY;
  const receipt = input.receipt ?? `rcpt_${Date.now()}`;

  const order = await rzp.orders.create({
    amount,
    currency,
    receipt,
    notes: input.notes,
  });

  return order;
}

export type VerifyRazorpaySignatureInput = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}: VerifyRazorpaySignatureInput): boolean {
  const secret = process.env.PG_KEY_SECRET;
  if (!secret) throw new Error("PG_KEY_SECRET must be set");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeEqual(expected, signature);
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret = process.env.PG_WEBHOOK_SECRET
): boolean {
  if (!webhookSecret) throw new Error("PG_WEBHOOK_SECRET must be set");
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function quarterWindow(from: Date = new Date()): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date(from);
  const endsAt = new Date(from);
  endsAt.setMonth(endsAt.getMonth() + 3);
  return { startsAt, endsAt };
}
