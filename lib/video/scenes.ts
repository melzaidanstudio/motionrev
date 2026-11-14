import { run } from "./run";

/**
 * Cut times in seconds, from ffmpeg's scene-change score on a downscaled copy.
 * Threshold 0.3 catches hard cuts; dissolves and whip pans register lower and are
 * picked up only when they are strong, which is what we want for a cut list.
 */
export async function detectCuts(file: string, threshold = 0.3): Promise<number[]> {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    file,
    "-vf",
    `scale=320:-2,select='gt(scene,${threshold})',showinfo`,
    "-fps_mode",
    "vfr",
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const times: number[] = [];
  for (const m of stderr.matchAll(/pts_time:\s*([\d.]+)/g)) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && t > 0.05) times.push(t);
  }
  // Two detections within 150 ms are one cut (a flash frame or a fast dissolve).
  const merged: number[] = [];
  for (const t of times.sort((a, b) => a - b)) {
    if (!merged.length || t - merged[merged.length - 1] > 0.15) merged.push(t);
  }
  return merged;
}

export interface ShotStats {
  cutCount: number;
  shotCount: number;
  avgShot: number;
  medianShot: number;
  minShot: number;
  maxShot: number;
  cutsPerMinute: number;
  /** Seconds between consecutive boundaries, in order. */
  shotLengths: number[];
}

export function shotStats(duration: number, cuts: number[]): ShotStats {
  const bounds = [0, ...cuts.filter((c) => c < duration), duration];
  const lens: number[] = [];
  for (let i = 1; i < bounds.length; i++) lens.push(bounds[i] - bounds[i - 1]);
  const sorted = [...lens].sort((a, b) => a - b);
  const sum = lens.reduce((a, b) => a + b, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    cutCount: cuts.length,
    shotCount: lens.length,
    avgShot: r2(lens.length ? sum / lens.length : duration),
    medianShot: r2(sorted.length ? sorted[Math.floor(sorted.length / 2)] : duration),
    minShot: r2(sorted[0] ?? duration),
    maxShot: r2(sorted[sorted.length - 1] ?? duration),
    cutsPerMinute: r2(duration > 0 ? (cuts.length / duration) * 60 : 0),
    shotLengths: lens.map(r2),
  };
}
