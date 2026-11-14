import path from "node:path";
import { run } from "./run";

export interface KeyFrame {
  idx: number;
  t: number;
  file: string;
  kind: "cut" | "sample";
}

export const MAX_FRAMES = 20;
export const MIN_FRAMES = 8;

/**
 * Which moments to look at: the first frame plus the start of every shot, thinned to
 * MAX_FRAMES evenly across the shot list, or topped up with uniform samples when the
 * video has few cuts. Times are 0.2 s into a shot so the cut itself has settled.
 */
export function pickTimes(duration: number, cuts: number[]): { t: number; kind: "cut" | "sample" }[] {
  type Pick = { t: number; kind: "cut" | "sample" };
  const starts = [0, ...cuts].filter((t) => t < duration - 0.1);
  let picks: Pick[] = starts.map((t) => ({ t: Math.min(t + 0.2, Math.max(0, duration - 0.05)), kind: "cut" }));

  if (picks.length > MAX_FRAMES) {
    const out: typeof picks = [];
    for (let i = 0; i < MAX_FRAMES; i++) {
      out.push(picks[Math.round((i * (picks.length - 1)) / (MAX_FRAMES - 1))]);
    }
    picks = out;
  }

  if (picks.length < MIN_FRAMES) {
    const want = MIN_FRAMES - picks.length;
    for (let i = 0; i < want; i++) {
      const t = ((i + 1) * duration) / (want + 1);
      // Skip samples that land within 0.5 s of an existing pick.
      if (picks.some((p) => Math.abs(p.t - t) < 0.5)) continue;
      picks.push({ t, kind: "sample" });
    }
  }
  return picks.sort((a, b) => a.t - b.t);
}

/** Extract one JPEG per pick, long edge capped at 1024 px (enough for the model and the UI). */
export async function extractFrames(
  file: string,
  framesDir: string,
  picks: { t: number; kind: "cut" | "sample" }[],
): Promise<KeyFrame[]> {
  const out: KeyFrame[] = [];
  for (let i = 0; i < picks.length; i++) {
    const name = `f${String(i).padStart(2, "0")}.jpg`;
    await run("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-ss",
      picks[i].t.toFixed(3),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=1024:1024:force_original_aspect_ratio=decrease",
      "-q:v",
      "3",
      path.join(framesDir, name),
    ]);
    out.push({ idx: i, t: picks[i].t, file: name, kind: picks[i].kind });
  }
  return out;
}

/** A tiled overview of the whole film (at most ~80 tiles) so the model sees rhythm, not just moments. */
export async function contactSheet(file: string, framesDir: string, duration: number): Promise<string> {
  const name = "sheet.jpg";
  const cols = 8;
  const fps = Math.min(1, 80 / Math.max(duration, 1));
  const tiles = Math.max(1, Math.ceil(duration * fps));
  const rows = Math.max(1, Math.ceil(tiles / cols));
  await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-y",
    "-i",
    file,
    "-vf",
    `fps=${fps.toFixed(4)},scale=180:-2,tile=${cols}x${rows}:padding=2:color=0x141518`,
    "-frames:v",
    "1",
    "-q:v",
    "4",
    path.join(framesDir, name),
  ]);
  return name;
}
