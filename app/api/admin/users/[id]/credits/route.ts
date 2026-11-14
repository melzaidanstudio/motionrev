import { z } from "zod";
import { addLedger, balanceOf, getUser } from "@/lib/db";
import { requireAdmin, sameOrigin } from "@/lib/auth";

const Input = z.object({
  delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Jumlah tidak boleh 0."),
  note: z.string().max(200).optional(),
});

/** Admin adds credits after a payment (positive) or corrects a balance (negative). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/users/[id]/credits">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (!getUser(id)) return Response.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const p = Input.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.issues[0]?.message ?? "Isian tidak valid." }, { status: 400 });
  if (p.data.delta < 0 && balanceOf(id) + p.data.delta < 0) {
    return Response.json({ error: "Koreksi membuat saldo negatif." }, { status: 400 });
  }
  addLedger({
    user_id: id,
    delta: p.data.delta,
    reason: p.data.delta > 0 ? "topup" : "adjust",
    analysis_id: null,
    note: p.data.note?.trim() || null,
    created_by: g.user.id,
  });
  return Response.json({ balance: balanceOf(id) });
}
