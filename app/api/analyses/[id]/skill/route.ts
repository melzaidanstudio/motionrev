import fs from "node:fs";
import path from "node:path";
import { listFrames } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadForUser } from "@/lib/access";
import { analysisDir } from "@/lib/paths";
import { slugify } from "@/lib/format";
import { buildZip } from "@/lib/zip";

/**
 * GET /api/analyses/:id/skill          -> SKILL.md
 * GET /api/analyses/:id/skill?zip=1    -> <slug>.zip with SKILL.md + frames/
 */
export async function GET(req: Request, ctx: RouteContext<"/api/analyses/[id]/skill">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const r = loadForUser(g.user, id);
  if (r.error) return r.error;
  const row = r.a;
  if (!row.skill_md) {
    return Response.json({ error: "SKILL.md belum ada untuk analisis ini." }, { status: 404 });
  }
  const slug = slugify(row.name);
  const wantZip = new URL(req.url).searchParams.get("zip") === "1";

  if (!wantZip) {
    return new Response(row.skill_md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="SKILL.md"; filename*=UTF-8''${encodeURIComponent(slug + "-SKILL.md")}`,
      },
    });
  }

  const framesDir = path.join(analysisDir(id), "frames");
  const entries = [{ name: `${slug}/SKILL.md`, data: Buffer.from(row.skill_md, "utf8") }];
  for (const f of listFrames(id)) {
    const p = path.join(framesDir, f.file);
    if (fs.existsSync(p)) entries.push({ name: `${slug}/frames/${f.file}`, data: fs.readFileSync(p) });
  }
  const zip = buildZip(entries);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
      "Content-Length": String(zip.length),
    },
  });
}
