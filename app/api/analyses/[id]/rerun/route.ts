import { InsufficientCreditError, resetForRerunCharged } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { requireUser, sameOrigin } from "@/lib/auth";
import { loadForUser } from "@/lib/access";
import { priceFor } from "@/lib/settings";

/** Re-run the pipeline on the stored source; charged like a new analysis, refunded if it fails. */
export async function POST(req: Request, ctx: RouteContext<"/api/analyses/[id]/rerun">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  if (r.a.status !== "done" && r.a.status !== "error") {
    return Response.json({ error: "Proses masih berjalan." }, { status: 409 });
  }
  // The owner pays; an admin (own runs, or re-running someone else's for support) is not charged.
  const price = r.a.user_id === g.user.id ? priceFor(g.user) : 0;
  try {
    resetForRerunCharged(id, r.a.user_id ?? g.user.id, price);
  } catch (e) {
    if (e instanceof InsufficientCreditError) {
      return Response.json(
        { error: `Kredit tidak cukup. Saldo ${e.balance}, perlu ${e.price}.` },
        { status: 402 },
      );
    }
    throw e;
  }
  enqueue(id);
  return Response.json({ ok: true });
}
