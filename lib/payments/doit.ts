import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * doit.id Payments API (https://doit.id/docs/). Base URL is the same for sandbox and live; the key
 * prefix (pb_test_ / pb_live_) picks the environment. MOTIONREV_DOIT_BASE_URL overrides it for tests.
 */
const BASE = () => (process.env.MOTIONREV_DOIT_BASE_URL || "https://pay.doit.id").replace(/\/+$/, "");

export type DoitStatus = "pending" | "paid" | "refunded" | "expired" | "failed";

export interface DoitPayment {
  id: string;
  status: DoitStatus;
  amount: number;
  reference: string;
  hosted_url: string | null;
  total_amount?: number;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
}

export class DoitError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(key: string, method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new DoitError(0, "network", `Tidak bisa menghubungi doit.id: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new DoitError(res.status, err?.code ?? "http_error", err?.message ?? `doit.id menjawab ${res.status}`);
  }
  return json as T;
}

export function createPayment(
  key: string,
  p: { amount: number; reference: string; returnUrl: string; customerName: string; metadata: Record<string, string> },
): Promise<DoitPayment> {
  return call<DoitPayment>(
    key,
    "POST",
    "/v1/payments",
    {
      amount: p.amount,
      rail: "any", // the buyer picks QRIS, VA, or transfer on doit.id's hosted page
      reference: p.reference,
      customer: { name: p.customerName.slice(0, 60) },
      return_url: p.returnUrl,
      metadata: p.metadata,
    },
    p.reference, // one reference, one bill: a retried request returns the same payment
  );
}

export function getPayment(key: string, providerId: string): Promise<DoitPayment> {
  return call<DoitPayment>(key, "GET", `/v1/payments/${encodeURIComponent(providerId)}`);
}

/**
 * Check `PayBridge-Signature: t=<ts>,v1=<hex>` where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`).
 * The docs set no timestamp tolerance; replays are harmless here because crediting re-reads the
 * payment from the API and happens at most once.
 */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((s) => {
      const i = s.indexOf("=");
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  const calc = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(v1.toLowerCase());
  const b = Buffer.from(calc);
  return a.length === b.length && timingSafeEqual(a, b);
}
