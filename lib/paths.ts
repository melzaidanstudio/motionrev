import fs from "node:fs";
import path from "node:path";

/** Root folder for everything the app stores: sqlite, source videos, frames. */
export function dataDir(): string {
  const d = process.env.MOTIONREV_DATA_DIR
    ? path.resolve(process.env.MOTIONREV_DATA_DIR)
    : path.join(process.cwd(), "data");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function analysisDir(id: string): string {
  const d = path.join(dataDir(), "analyses", id);
  fs.mkdirSync(path.join(d, "frames"), { recursive: true });
  return d;
}

export function talkingHeadDir(id: string): string {
  const d = path.join(dataDir(), "talking-heads", id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** The stored source video in an analysis folder (uploaded, or downloaded from the link), or null. */
export function findSourceVideo(dir: string): string | null {
  const f = fs.readdirSync(dir).find((x) => /^source\.(mp4|mkv|webm|mov|m4v|avi)$/i.test(x));
  return f ? path.join(dir, f) : null;
}

export function framePath(id: string, file: string): string | null {
  // Only plain file names are allowed; anything with a separator is rejected.
  if (!/^[a-z0-9_.-]+\.jpg$/i.test(file)) return null;
  return path.join(analysisDir(id), "frames", file);
}
