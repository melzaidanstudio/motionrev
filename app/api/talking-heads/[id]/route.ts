import fs from "node:fs";
import { deleteTalkingHead, getTalkingHead, setTalkingHeadError } from "@/lib/db";
import { talkingHeadDir } from "@/lib/paths";
import { requireUser, sameOrigin } from "@/lib/auth";

/** Remove a job and its stored clip. Owners only (admins too, for support); not while it renders. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/talking-heads/[id]">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const t = getTalkingHead(id);
  if (!t || (t.user_id !== g.user.id && g.user.role !== "admin")) {
    return Response.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }
  if (t.status === "rendering") {
    return Response.json({ error: "Video sedang dirender. Tunggu sampai selesai." }, { status: 409 });
  }
  if (t.pending_task === "notes") {
    return Response.json({ error: "Batalkan dulu antrean catatannya, baru video bisa dihapus." }, { status: 409 });
  }
  if (t.charge_open) setTalkingHeadError(id, "Dihapus sebelum dirender."); // refunds the open charge
  deleteTalkingHead(id);
  fs.rmSync(talkingHeadDir(id), { recursive: true, force: true });
  return Response.json({ ok: true });
}
