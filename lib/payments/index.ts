import "server-only";
import { randomBytes } from "node:crypto";
import {
  applyPaymentStatus,
  getPayment as getPaymentRow,
  insertPayment,
  markPaymentCreated,
  markPaymentFailed,
  type PaymentRow,
  type PaymentStatus,
} from "../db";
import { decryptSecret } from "../crypto";
import { getActivePackages, getPaymentSettings } from "../settings";
import { DoitError, createPayment, getPayment, type DoitPayment } from "./doit";

function apiKey(): string {
  const s = getPaymentSettings();
  if (s.provider !== "doit" || !s.apiKeyEnc) throw new Error("Pembayaran online belum diaktifkan admin.");
  return decryptSecret(s.apiKeyEnc);
}

/** Create a bill for a package and return where the buyer pays. */
export async function startCheckout(user: { id: string; email: string }, packageId: string, origin: string) {
  const pkg = getActivePackages().find((p) => p.id === packageId);
  if (!pkg) throw new Error("Paket tidak ditemukan atau pembayaran online sedang nonaktif.");
  const key = apiKey();

  const id = `mr_${randomBytes(8).toString("hex")}`;
  insertPayment({ id, user_id: user.id, package_id: pkg.id, package_name: pkg.name, credits: pkg.credits, amount: pkg.price, provider: "doit" });
  try {
    const p = await createPayment(key, {
      amount: pkg.price,
      reference: id,
      returnUrl: `${origin}/kredit?bayar=${id}`,
      customerName: user.email,
      metadata: { motionrev_payment: id, user_id: user.id },
    });
    if (!p.hosted_url) throw new DoitError(502, "no_hosted_url", "doit.id tidak mengembalikan halaman pembayaran.");
    markPaymentCreated(id, p.id, p.hosted_url);
    return { id, hostedUrl: p.hosted_url };
  } catch (e) {
    markPaymentFailed(id, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

/**
 * Read the payment from doit.id (the source of truth) and apply it. Used by the webhook and by the
 * buyer's "Cek status" button, so crediting works even when the webhook cannot reach this server.
 */
export async function syncPayment(id: string): Promise<PaymentRow | undefined> {
  const row = getPaymentRow(id);
  if (!row || !row.provider_id) return row;
  const remote = await getPayment(apiKey(), row.provider_id);
  return applyRemote(row, remote);
}

function applyRemote(row: PaymentRow, remote: DoitPayment): PaymentRow | undefined {
  // The bill must be ours and for the amount we asked; anything else is not credited.
  if (remote.reference !== row.id || remote.amount !== row.amount) {
    markPaymentFailed(row.id, `Data pembayaran tidak cocok (ref ${remote.reference}, jumlah ${remote.amount}).`);
    return getPaymentRow(row.id);
  }
  const status: PaymentStatus = remote.status;
  return applyPaymentStatus(row.id, status, remote.paid_at);
}
