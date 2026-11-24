import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getTalkingHead } from "@/lib/db";
import { talkingHeadDir } from "@/lib/paths";
import { requireUser } from "@/lib/auth";
import { latestVideo } from "@/lib/talkingHead/results";

/**
 * The finished MP4. Supports Range requests so the browser can seek in the player; `?download=1`
 * sends it as an attachment named after the original clip.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/talking-heads/[id]/video">) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const t = getTalkingHead(id);
  const rel = t && t.status === "done" ? latestVideo(t) : null;
  if (!t || (t.user_id !== g.user.id && g.user.role !== "admin") || !rel) {
    return Response.json({ error: "Video belum ada." }, { status: 404 });
  }
  const file = path.join(talkingHeadDir(id), rel);
  if (!file.startsWith(talkingHeadDir(id)) || !fs.existsSync(file)) {
    return Response.json({ error: "File hasil tidak ditemukan di server." }, { status: 404 });
  }

  const size = fs.statSync(file).size;
  const headers: Record<string, string> = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  if (new URL(req.url).searchParams.get("download")) {
    const base = t.source.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 60) || "video";
    headers["Content-Disposition"] = `attachment; filename="${base}_${t.style}.mp4"`;
  }

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const body = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}
