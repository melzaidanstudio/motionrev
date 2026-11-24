import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { InsufficientCreditError, deleteTalkingHead, insertTalkingHeadCharged, listTalkingHeads, setTalkingHeadError } from "@/lib/db";
import { talkingHeadDir } from "@/lib/paths";
import { requireUser, sameOrigin } from "@/lib/auth";
import { priceFor } from "@/lib/settings";
import { enqueueTalkingHead } from "@/lib/talkingHead/queue";
import { clipDuration } from "@/lib/talkingHead/progress";
import {
  FOLLOW_STYLE,
  MAX_TALKING_HEAD_BYTES,
  TALKING_HEAD_VIDEO_EXT,
  fontById,
  paletteById,
  styleById,
} from "@/lib/talkingHead/options";

export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  return Response.json({ items: listTalkingHeads(g.user.id) });
}

/**
 * Store the clip and the chosen look, charge for it, and queue the render. A failed render (or a failed
 * save here) refunds the charge.
 */
export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Kiriman tidak terbaca sebagai form multipart.");
  }

  const file = form.get("file");
  const style = String(form.get("style") ?? "");
  const palette = String(form.get("palette") ?? FOLLOW_STYLE);
  const font = String(form.get("font") ?? FOLLOW_STYLE);
  const cutFill = form.get("cutFill") === "1" ? 1 : 0; // off unless the user ticked it
  const mode = form.get("mode") === "editor" ? "editor" : "render";

  if (!(file instanceof File) || file.size === 0) return err("Unggah video talking head dulu.");
  if (!TALKING_HEAD_VIDEO_EXT.test(file.name)) return err("Format video harus mp4, mov, mkv, webm, atau m4v.");
  if (file.size > MAX_TALKING_HEAD_BYTES) return err("Video lebih dari 500 MB. Kecilkan dulu.");
  if (!styleById(style)) return err("Pilih style dulu.");
  if (palette !== FOLLOW_STYLE && !paletteById(palette)) return err("Nuansa warna tidak dikenal.");
  if (font !== FOLLOW_STYLE && !fontById(font)) return err("Font tidak dikenal.");

  const id = randomBytes(6).toString("hex");
  try {
    insertTalkingHeadCharged(
      { id, user_id: g.user.id, source: file.name.slice(0, 200), size_bytes: file.size, style, palette, font, cut_fill: cutFill, mode },
      priceFor(g.user),
    );
  } catch (e) {
    if (e instanceof InsufficientCreditError) {
      return err(`Kredit tidak cukup. Saldo ${e.balance}, satu video butuh ${e.price}. Beli kredit di halaman Kredit.`, 402);
    }
    throw e;
  }
  const dir = talkingHeadDir(id);
  try {
    await pipeline(
      Readable.fromWeb(file.stream() as unknown as import("node:stream/web").ReadableStream),
      fs.createWriteStream(path.join(dir, `source${path.extname(file.name).toLowerCase()}`)),
    );
  } catch (e) {
    setTalkingHeadError(id, "Gagal menyimpan video."); // refunds the charge
    deleteTalkingHead(id);
    fs.rmSync(dir, { recursive: true, force: true });
    return err(`Gagal menyimpan video: ${e instanceof Error ? e.message : String(e)}. Kredit dikembalikan.`, 500);
  }
  clipDuration(dir); // probe once now, so the queue can show an estimate right away
  enqueueTalkingHead(id);
  return Response.json({ id }, { status: 201 });
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
