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

export function framePath(id: string, file: string): string | null {
  // Only plain file names are allowed; anything with a separator is rejected.
  if (!/^[a-z0-9_.-]+\.jpg$/i.test(file)) return null;
  return path.join(analysisDir(id), "frames", file);
}
