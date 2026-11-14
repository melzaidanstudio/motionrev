import fs from "node:fs";
import path from "node:path";
import { run } from "./run";

export interface DownloadResult {
  file: string;
  /** Title/description the platform reports. Untrusted text: shown to the model as data only. */
  info: { title?: string; description?: string; uploader?: string; duration?: number } | null;
  /** Plain-text transcript from the platform's subtitles, if any. */
  transcript: string | null;
}

export function isSupportedUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Fetch a video with yt-dlp into `dir`, plus its subtitles and metadata when available. */
export async function downloadVideo(url: string, dir: string): Promise<DownloadResult> {
  const out = path.join(dir, "source.%(ext)s");
  await run("yt-dlp", [
    "--no-playlist",
    "--no-warnings",
    "-f",
    "bv*[height<=1080]+ba/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "--write-info-json",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    "id,en",
    "--sub-format",
    "vtt/srt/best",
    "-o",
    out,
    url,
  ]);

  const files = fs.readdirSync(dir);
  const video = files.find((f) => /^source\.(mp4|mkv|webm|mov)$/i.test(f));
  if (!video) throw new Error("yt-dlp selesai tapi file video tidak ditemukan.");

  let info: DownloadResult["info"] = null;
  const infoFile = files.find((f) => f.endsWith(".info.json"));
  if (infoFile) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, infoFile), "utf8"));
      info = {
        title: typeof j.title === "string" ? j.title : undefined,
        description: typeof j.description === "string" ? j.description.slice(0, 2000) : undefined,
        uploader: typeof j.uploader === "string" ? j.uploader : undefined,
        duration: typeof j.duration === "number" ? j.duration : undefined,
      };
    } catch {
      info = null;
    }
  }

  // Prefer Indonesian subtitles, then English; manual before auto.
  const subs = files
    .filter((f) => /\.(vtt|srt)$/i.test(f))
    .sort((a, b) => score(b) - score(a));
  const transcript = subs.length ? parseSubs(fs.readFileSync(path.join(dir, subs[0]), "utf8")) : null;

  return { file: path.join(dir, video), info, transcript };
}

function score(f: string): number {
  let s = 0;
  if (/\.id\./.test(f)) s += 10;
  if (/\.en\./.test(f)) s += 5;
  if (/\.vtt$/.test(f)) s += 1;
  return s;
}

/** VTT/SRT to plain text. Auto subtitles repeat lines as they scroll, so consecutive duplicates are dropped. */
export function parseSubs(raw: string): string | null {
  const lines: string[] = [];
  let last = "";
  for (const l of raw.split(/\r?\n/)) {
    const t = l
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (!t) continue;
    if (/^WEBVTT/.test(t) || /^\d+$/.test(t) || /-->/.test(t) || /^(Kind|Language):/.test(t)) continue;
    if (t === last) continue;
    lines.push(t);
    last = t;
  }
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 6000) : null;
}
