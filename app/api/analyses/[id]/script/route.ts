import { requireUser, sameOrigin } from "@/lib/auth";
import { loadForUser } from "@/lib/access";
import { slugify } from "@/lib/format";
import { enqueueScript, scriptBlocker } from "@/lib/scriptJobs";

/** GET /api/analyses/:id/script -> the script skill (SKILL naskah) as a markdown download. */
export async function GET(_req: Request, ctx: RouteContext<"/api/analyses/[id]/script">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  if (!r.a.script_md) return Response.json({ error: "SKILL naskah belum ada untuk analisis ini." }, { status: 404 });
  const file = `${slugify(r.a.name)}-naskah-SKILL.md`;
  return new Response(r.a.script_md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="SKILL.md"; filename*=UTF-8''${encodeURIComponent(file)}`,
    },
  });
}

/** POST /api/analyses/:id/script -> (re)build the script skill from the transcript, in the background. */
export async function POST(req: Request, ctx: RouteContext<"/api/analyses/[id]/script">) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  if (r.a.status !== "done") return Response.json({ error: "Tunggu analisis visualnya selesai dulu." }, { status: 409 });
  if (r.a.script_status === "queued" || r.a.script_status === "running") {
    return Response.json({ error: "SKILL naskah sedang disusun." }, { status: 409 });
  }
  const blocked = scriptBlocker(id);
  if (blocked) return Response.json({ error: blocked }, { status: 409 });
  enqueueScript(id);
  return Response.json({ ok: true });
}
