import { forgetWebhookEvent, getPayment, getPaymentByProviderId, recordWebhookEvent } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getPaymentSettings } from "@/lib/settings";
import { syncPayment } from "@/lib/payments";
import { verifySignature } from "@/lib/payments/doit";

/**
 * doit.id webhook. Set this URL in the doit.id portal (Developer menu):
 *   https://<your-domain>/api/payments/doit/webhook
 * The event only tells us which payment changed; its status is re-read from the API before any
 * credit is added, and each event id is processed once.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const s = getPaymentSettings();
  if (!s.webhookSecretEnc) return Response.json({ error: "webhook secret not configured" }, { status: 503 });
  if (!verifySignature(raw, req.headers.get("paybridge-signature"), decryptSecret(s.webhookSecretEnc))) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let evt: { id?: string; type?: string; data?: { id?: string; reference?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!evt.id || !evt.type) return Response.json({ error: "missing event id or type" }, { status: 400 });
  if (evt.type === "webhook.test") return Response.json({ ok: true });
  if (!recordWebhookEvent(evt.id, "doit", evt.type)) return Response.json({ ok: true, duplicate: true });

  // Find our payment: by our reference first, then by doit.id's payment id.
  const ref = evt.data?.reference;
  const row = (ref ? getPayment(ref) : undefined) ?? (evt.data?.id ? getPaymentByProviderId("doit", evt.data.id) : undefined);
  if (!row) return Response.json({ ok: true, ignored: "unknown payment" });

  try {
    await syncPayment(row.id);
  } catch (e) {
    // Let doit.id retry: forget the event so the retry is processed, and answer non-2xx.
    forgetWebhookEvent(evt.id);
    return Response.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
