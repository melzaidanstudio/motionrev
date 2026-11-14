import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { InsufficientCreditError, insertAnalysisCharged, listAnalyses } from "@/lib/db";
import { analysisDir } from "@/lib/paths";
import { enqueue } from "@/lib/jobs";
import { isSupportedUrl } from "@/lib/video/download";
import { requireUser, sameOrigin } from "@/lib/auth";
import { priceFor } from "@/lib/settings";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi)$/i;

export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  return Response.json({ items: listAnalyses(g.user.id) });
}

export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const user = g.user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Kiriman tidak terbaca sebagai form multipart.");
  }

  const name = String(form.get("name") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");

  if (!name) return err("Nama wajib diisi.");
  if (name.length > 80) return err("Nama maksimal 80 karakter.");

  const hasFile = file instanceof File && file.size > 0;
  if (!url && !hasFile) return err("Tempel link video atau pilih file.");
  if (url && hasFile) return err("Pilih salah satu: link atau file.");

  const id = randomBytes(6).toString("hex");
  const price = priceFor(user);

  if (url) {
    if (!isSupportedUrl(url)) return err("Link harus diawali http:// atau https://.");
    try {
      insertAnalysisCharged({ id, user_id: user.id, name, source_type: "url", source: url }, price);
    } catch (e) {
      return creditError(e);
    }
    analysisDir(id);
  } else {
    const f = file as File;
    if (!VIDEO_EXT.test(f.name)) return err("Format file harus mp4, mov, mkv, webm, m4v, atau avi.");
    if (f.size > MAX_UPLOAD_BYTES) return err("File lebih dari 500 MB. Kecilkan dulu.");
    // Charge first so an unpaid upload never touches the disk; a failed save is refunded below.
    try {
      insertAnalysisCharged({ id, user_id: user.id, name, source_type: "file", source: f.name }, price);
    } catch (e) {
      return creditError(e);
    }
    const dir = analysisDir(id);
    try {
      await pipeline(
        Readable.fromWeb(f.stream() as unknown as import("node:stream/web").ReadableStream),
        fs.createWriteStream(path.join(dir, `source${path.extname(f.name).toLowerCase()}`)),
      );
    } catch (e) {
      const { setError } = await import("@/lib/db");
      setError(id, `Gagal menyimpan file: ${e instanceof Error ? e.message : String(e)}`);
      return err("Gagal menyimpan file. Kredit dikembalikan.", 500);
    }
  }

  enqueue(id);
  return Response.json({ id }, { status: 201 });
}

function creditError(e: unknown) {
  if (e instanceof InsufficientCreditError) {
    return Response.json(
      { error: `Kredit tidak cukup. Saldo ${e.balance}, satu analisis butuh ${e.price}. Beli kredit di halaman Kredit.` },
      { status: 402 },
    );
  }
  throw e;
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
