import fs from "node:fs";
import { framePath } from "@/lib/paths";
import { requireUser } from "@/lib/auth";
import { loadForUser } from "@/lib/access";

export async function GET(_req: Request, ctx: RouteContext<"/api/analyses/[id]/frames/[file]">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id, file } = await ctx.params;
  if (loadForUser(g.user, id).error) return new Response("Tidak ditemukan", { status: 404 });
  const p = framePath(id, file);
  if (!p || !fs.existsSync(p)) return new Response("Tidak ditemukan", { status: 404 });
  const buf = fs.readFileSync(p);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
