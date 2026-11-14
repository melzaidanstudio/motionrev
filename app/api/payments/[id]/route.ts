import { getPayment } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { syncPayment } from "@/lib/payments";

/** The buyer's view of one payment; a pending one is re-checked with doit.id first. */
export async function GET(_req: Request, ctx: RouteContext<"/api/payments/[id]">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  let p = getPayment(id);
  if (!p || (p.user_id !== g.user.id && g.user.role !== "admin")) {
    return Response.json({ error: "Pembayaran tidak ditemukan." }, { status: 404 });
  }
  let syncError: string | null = null;
  if (p.status === "pending") {
    try {
      p = (await syncPayment(id)) ?? p;
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
    }
  }
  return Response.json({
    payment: { id: p.id, status: p.status, credits: p.credits, amount: p.amount, package: p.package_name, hostedUrl: p.hosted_url, credited: Boolean(p.credited) },
    syncError,
  });
}
