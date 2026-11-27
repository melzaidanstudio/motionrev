import { run, runBuffer } from "./run";

/**
 * What changes in the picture, and where. ffmpeg's scene score alone mixes up three different things: real cuts,
 * flashes inside a shot, and fast camera moves (whip pans, zooms). A fixed threshold both misses soft cuts between
 * similar-looking shots and counts a white flash as a cut. So every frame gets a score, every peak above a low bar is
 * a candidate, and each candidate is classified from the pixels around it.
 */
export type ChangeKind = "cut" | "flash" | "whip" | "motion";

export interface SceneEvent {
  t: number;
  /** ffmpeg scene score of the frame, 0-1. */
  score: number;
  kind: ChangeKind;
}

export interface SceneAnalysis {
  /** Hard cuts only: the shot boundaries. */
  cuts: number[];
  /** Every classified change, cuts included, in time order. */
  events: SceneEvent[];
  /** Moments of strong change inside a shot (score peaks, at least 0.8 s apart): good places to look at a frame. */
  changePeaks: number[];
}

const CANDIDATE = 0.12; // scene score that makes a frame worth classifying
const PEAK = 0.08; // in-shot change worth a key frame

export async function analyzeScenes(file: string, size: { width: number; height: number; fps: number }): Promise<SceneAnalysis> {
  const scores = await sceneScores(file);
  const candidates = localPeaks(scores, CANDIDATE, 0.15);
  const fps = size.fps > 0 ? size.fps : 30;
  const events: SceneEvent[] = [];
  for (const c of candidates) events.push({ ...c, kind: await classify(file, c.t, fps, size) });
  const cuts = events.filter((e) => e.kind === "cut").map((e) => e.t);
  const changePeaks = localPeaks(scores, PEAK, 0.8)
    .filter((p) => !cuts.some((c) => Math.abs(c - p.t) < 0.4))
    .map((p) => p.t);
  return { cuts, events, changePeaks };
}

/** Scene score of every frame, from a 160 px wide copy. */
async function sceneScores(file: string): Promise<{ t: number; s: number }[]> {
  const { stdout } = await run(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-vf", "scale=160:-2,select='gte(scene\\,0)',metadata=print:file=-", "-an", "-f", "null", "-"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  const out: { t: number; s: number }[] = [];
  let t = NaN;
  for (const line of stdout.split("\n")) {
    const m = line.match(/pts_time:([\d.]+)/);
    if (m) {
      t = Number(m[1]);
      continue;
    }
    const s = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (s && Number.isFinite(t)) out.push({ t, s: Number(s[1]) });
  }
  return out;
}

/** Frames whose score is above `min` and is the highest within `gap` seconds either side. */
function localPeaks(scores: { t: number; s: number }[], min: number, gap: number): { t: number; score: number }[] {
  const above = scores.filter((x) => x.s > min && x.t > 0.05).sort((a, b) => b.s - a.s);
  const kept: { t: number; score: number }[] = [];
  for (const x of above) if (!kept.some((k) => Math.abs(k.t - x.t) < gap)) kept.push({ t: x.t, score: x.s });
  return kept.sort((a, b) => a.t - b.t);
}

const W = 64;

/**
 * Look at small grey frames around a candidate. A cut changes the picture's structure (edges of the upper picture
 * area no longer line up) and then holds still. A flash brightens the frame but keeps its structure. A whip pan or a
 * fast zoom keeps moving after the change.
 */
async function classify(file: string, t: number, fps: number, size: { width: number; height: number }): Promise<ChangeKind> {
  const H = Math.max(2, Math.round((W * size.height) / Math.max(size.width, 1) / 2) * 2);
  const start = Math.max(0, t - 0.35);
  const buf = await runBuffer("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    start.toFixed(3),
    "-i",
    file,
    "-t",
    "0.8",
    "-vf",
    `scale=${W}:${H},format=gray`,
    "-an",
    "-f",
    "rawvideo",
    "-",
  ]);
  const n = Math.floor(buf.length / (W * H));
  if (n < 4) return "motion";
  const frame = (i: number) => buf.subarray(Math.min(Math.max(i, 0), n - 1) * W * H, (Math.min(Math.max(i, 0), n - 1) + 1) * W * H);
  const k = Math.round((t - start) * fps);

  const structure = corr(edges(frame(k - 3), H), edges(frame(k + 3), H));
  const settle = mad(frame(k + 3), frame(k + 9));
  const before = mean(frame(k - 3));
  const peak = Math.max(mean(frame(k)), mean(frame(k + 1)), mean(frame(k + 2)));
  // Structure ~0.45 s later against before: a flash leaves the picture as it was, a cut or whip replaces it.
  const back = corr(edges(frame(k - 3), H), edges(frame(n - 1), H));
  const flare = peak > 1.5 * Math.max(before, 1);
  // How much bigger the change into this frame is than any frame-to-frame change around it: a cut happens in one
  // frame, a camera move (even a stepped 12 fps animation) changes by similar amounts frame after frame.
  // The seek can land a frame or two off, so the change is looked for within ±3 frames of the candidate.
  const diff = (i: number) => (i - 1 >= 0 && i < n ? mad(frame(i - 1), frame(i)) : 0);
  let j = k;
  for (let i = k - 3; i <= k + 3; i++) if (diff(i) > diff(j)) j = i;
  const jump = diff(j);
  let around = 0;
  for (let i = j - 6; i <= j + 6; i++) if (Math.abs(i - j) > 1) around = Math.max(around, diff(i));
  const abrupt = jump / Math.max(around, 0.5);

  // Tuned on three references checked frame by frame. takjubstories: cuts 6.00/14.07/20.50/30.97 (abrupt ≥14),
  // flashes 15.40/25.93, whip 27.00 (abrupt 2.8). Monyet 3D: cuts abrupt ≥5.5, long stepped camera moves ≤1.1.
  // Kita Bongkar: one continuous shot.
  if (flare && back > 0.45) return "flash";
  // A new picture: a cut when it arrives in one frame, otherwise a whip, zoom or camera move carried it there.
  if (structure < 0.35) return abrupt >= 4 ? "cut" : "whip";
  // Same picture: a flash when it brightens, a fast move when it keeps changing, else motion inside the shot.
  if (flare) return "flash";
  if (settle > 20) return "whip";
  return "motion";
}

/** Gradient magnitude over the upper 55% of the frame, where the picture is (captions sit lower). */
function edges(f: Uint8Array, H: number): Float64Array {
  const rows = Math.floor(H * 0.55);
  const out = new Float64Array((rows - 1) * (W - 1));
  let i = 0;
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const p = f[y * W + x];
      out[i++] = Math.abs(f[y * W + x + 1] - p) + Math.abs(f[(y + 1) * W + x] - p);
    }
  }
  return out;
}

function corr(a: Float64Array, b: Float64Array): number {
  const n = Math.min(a.length, b.length);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

function mad(a: Uint8Array, b: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

function mean(a: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
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
