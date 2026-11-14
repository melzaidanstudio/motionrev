import { requireUser, sameOrigin } from "@/lib/auth";
import { startCheckout } from "@/lib/payments";
import { DoitError } from "@/lib/payments/doit";
import { publicOrigin } from "@/lib/format";

/** Start buying a credit package: returns doit.id's hosted payment page. */
export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as { packageId?: string };
  if (!body.packageId) return Response.json({ error: "Pilih paket dulu." }, { status: 400 });

  try {
    const r = await startCheckout(g.user, String(body.packageId), publicOrigin(req));
    return Response.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof DoitError) {
      return Response.json({ error: `Gagal membuat tagihan: ${e.message}` }, { status: 502 });
    }
    return Response.json({ error: e instanceof Error ? e.message : "Gagal membuat tagihan." }, { status: 400 });
  }
}
