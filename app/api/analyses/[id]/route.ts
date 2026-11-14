import fs from "node:fs";
import { deleteAnalysis, listFrames } from "@/lib/db";
import { analysisDir } from "@/lib/paths";
import { requireUser, sameOrigin } from "@/lib/auth";
import { loadForUser } from "@/lib/access";

export async function GET(_req: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  return Response.json({ item: r.a, frames: listFrames(id) });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  if (r.a.status !== "done" && r.a.status !== "error") {
    return Response.json({ error: "Tunggu sampai proses selesai sebelum menghapus." }, { status: 409 });
  }
  deleteAnalysis(id);
  fs.rmSync(analysisDir(id), { recursive: true, force: true });
  return Response.json({ ok: true });
}
