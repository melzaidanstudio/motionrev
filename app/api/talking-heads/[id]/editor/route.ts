import path from "node:path";
import { getTalkingHead } from "@/lib/db";
import { talkingHeadDir } from "@/lib/paths";
import { requireUser, sameOrigin } from "@/lib/auth";
import { openEditor, projectDir } from "@/lib/talkingHead/render";
import { canOpenEditor } from "@/lib/talkingHead/results";

/**
 * Open the job's motlab project in the motlab viewer (starting the viewer if it is not running) and return its
 * address. The viewer listens on this machine only (127.0.0.1), so this works for someone using the app here.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/talking-heads/[id]/editor">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const t = getTalkingHead(id);
  if (!t || (t.user_id !== g.user.id && g.user.role !== "admin")) {
    return Response.json({ error: "Video tidak ditemukan." }, { status: 404 });
  }
  if (!canOpenEditor(t)) {
    return Response.json({ error: "Proyek motlab untuk video ini belum siap atau footage-nya sudah dihapus." }, { status: 409 });
  }
  const dir = talkingHeadDir(id);
  try {
    const url = await openEditor(projectDir(dir, id), path.join(dir, "render.log"));
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Editor motlab gagal dibuka." }, { status: 500 });
  }
}
