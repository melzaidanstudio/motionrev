import fs from "node:fs";
import path from "node:path";
import { timecode } from "../format";
import type { SceneEvent } from "./scenes";
import { run } from "./run";

/**
 * cut: 0.2 s into a shot. end: 0.2 s before a cut (how the shot ends). change: a peak of change inside a shot
 * (a graphic appearing, a cutaway, a counter). speech: just after a sentence starts (its caption on screen).
 * sample: evenly spread filler.
 */
export type FrameKind = "cut" | "end" | "change" | "speech" | "sample";

export interface KeyFrame {
  idx: number;
  t: number;
  file: string;
  kind: FrameKind;
  /** The same frame with a %-of-height ruler, shown only to the model (and its auditor) so sizes are measured, not guessed. */
  ruler?: string;
}

/** A short burst of frames tiled into one image: a transition, or the caption band changing word by word. */
export interface MotionStrip {
  file: string;
  kind: "transition" | "caption";
  start: number;
  step: number;
  count: number;
  label: string;
}

/** One frame per ~1.5 s of video, at least 12 and at most 36. */
export function frameBudget(duration: number): number {
  return Math.min(36, Math.max(12, Math.round(duration / 1.5)));
}

/**
 * Which moments to look at. Every shot start first, then the moments the picture changes inside a shot, then
 * sentence starts (captions), then shot ends, and evenly spread samples to fill the largest gaps. Picks closer than
 * 0.35 s merge, keeping the more important one.
 */
export function pickTimes(
  duration: number,
  cuts: number[],
  changePeaks: number[] = [],
  speechStarts: number[] = [],
): { t: number; kind: FrameKind }[] {
  type Pick = { t: number; kind: FrameKind };
  const budget = frameBudget(duration);
  const end = Math.max(0, duration - 0.05);
  const clamp = (t: number) => Math.min(Math.max(t, 0), end);
  const tiers: Pick[][] = [
    [0, ...cuts].filter((t) => t < duration - 0.1).map((t) => ({ t: clamp(t + 0.2), kind: "cut" as const })),
    changePeaks.map((t) => ({ t: clamp(t + 0.15), kind: "change" as const })),
    speechStarts.map((t) => ({ t: clamp(t + 0.35), kind: "speech" as const })),
    [...cuts, duration].map((t) => ({ t: clamp(t - 0.2), kind: "end" as const })),
  ];

  const picks: Pick[] = [];
  const free = (t: number) => !picks.some((p) => Math.abs(p.t - t) < 0.35);
  for (const tier of tiers) {
    // Within a tier, spread the picks when they do not all fit: take every n-th.
    const room = budget - picks.length;
    if (room <= 0) break;
    const candidates = tier.filter((p) => free(p.t));
    const stride = candidates.length > room ? candidates.length / room : 1;
    for (let i = 0; i < candidates.length && picks.length < budget; i += stride) {
      const p = candidates[Math.floor(i)];
      if (free(p.t)) picks.push(p);
    }
  }

  // Fill the widest gaps with samples until the budget is used.
  while (picks.length < budget) {
    const times = [0, ...picks.map((p) => p.t).sort((a, b) => a - b), duration];
    let best = 0;
    for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > times[best + 1] - times[best]) best = i - 1;
    const gap = times[best + 1] - times[best];
    if (gap < 0.8) break;
    picks.push({ t: clamp(times[best] + gap / 2), kind: "sample" });
  }
  return picks.sort((a, b) => a.t - b.t);
}

/** Extract one JPEG per pick, long edge capped at 1024 px (enough for the model and the UI). */
export async function extractFrames(file: string, framesDir: string, picks: { t: number; kind: FrameKind }[]): Promise<KeyFrame[]> {
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
    const ruler = `r${String(i).padStart(2, "0")}.jpg`;
    const made = await rulerCopy(path.join(framesDir, name), path.join(framesDir, ruler));
    out.push({ idx: i, t: picks[i].t, file: name, kind: picks[i].kind, ...(made ? { ruler } : {}) });
  }
  return out;
}

/**
 * A copy of a frame with a 56 px ruler added on the left (outside the picture): a faint line across the picture every
 * 10% of its height with its label, and a tick every 5%. Positions and sizes as % of height can then be read off.
 */
async function rulerCopy(src: string, dest: string): Promise<boolean> {
  const font = FONTS.find((f) => fs.existsSync(f));
  if (!font) return false;
  const parts = ["pad=iw+56:ih:56:0:color=0x1a1a1a"];
  for (let k = 1; k < 20; k++) {
    const y = `ih*${k}/20`;
    if (k % 2 === 0) {
      parts.push(`drawbox=x=56:y=${y}:w=iw:h=1:color=yellow@0.45:t=fill`);
      parts.push(`drawbox=x=30:y=${y}:w=26:h=2:color=yellow:t=fill`);
      parts.push(`drawtext=fontfile='${font}':expansion=none:text='${k * 5}%':x=2:y=h*${k}/20-7:fontsize=13:fontcolor=yellow`);
    } else {
      parts.push(`drawbox=x=44:y=${y}:w=12:h=1:color=yellow@0.8:t=fill`);
    }
  }
  try {
    await run("ffmpeg", ["-hide_banner", "-nostats", "-y", "-i", src, "-vf", parts.join(","), "-q:v", "3", dest]);
    return true;
  } catch {
    return false;
  }
}

const FONTS = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
];

/** A timecode label burned into the top-left of each tile, when a font is available. */
function stamp(offset: number, size: number): string {
  const font = FONTS.find((f) => fs.existsSync(f));
  if (!font) return "";
  return `,drawtext=fontfile='${font}':text='%{pts\\:hms\\:${offset.toFixed(3)}}':x=4:y=4:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=3`;
}

/**
 * The whole film as pages of 4×4 timecoded tiles, 240 px wide: two tiles a second up to 40 s, one a second up to
 * 96 s, then spread to at most 6 pages. The model reads the rhythm and every on-screen change from these.
 */
export async function contactSheets(file: string, framesDir: string, duration: number): Promise<{ file: string; start: number; end: number; fps: number }[]> {
  const fps = duration <= 40 ? 2 : duration <= 96 ? 1 : 96 / duration;
  const perPage = 16;
  const pageSeconds = perPage / fps;
  const pages = Math.min(6, Math.ceil(duration / pageSeconds));
  const out: { file: string; start: number; end: number; fps: number }[] = [];
  for (let i = 0; i < pages; i++) {
    const start = i * pageSeconds;
    const name = `sheet${i + 1}.jpg`;
    await run("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-y",
      "-ss",
      start.toFixed(3),
      "-i",
      file,
      "-t",
      pageSeconds.toFixed(3),
      "-vf",
      `fps=${fps.toFixed(4)},scale=240:-2${stamp(start, 18)},tile=4x4:padding=3:color=0x141518`,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      path.join(framesDir, name),
    ]);
    out.push({ file: name, start, end: Math.min(duration, start + pageSeconds), fps });
  }
  return out;
}

/**
 * Bursts that show motion a still can't: 6 frames 0.1 s apart around each transition (cut, flash, whip), and the
 * caption band (45-82% of the height) changing word by word at a few moments of speech.
 */
export async function motionStrips(
  file: string,
  framesDir: string,
  duration: number,
  events: SceneEvent[],
  captionTimes: number[],
): Promise<MotionStrip[]> {
  const out: MotionStrip[] = [];
  const transitions = events
    .filter((e) => e.kind !== "motion")
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .sort((a, b) => a.t - b.t);
  for (const [i, e] of transitions.entries()) {
    const start = Math.max(0, e.t - 0.3);
    const name = `strip-t${i + 1}.jpg`;
    await run("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-ss", start.toFixed(3), "-i", file, "-t", "0.6",
      "-vf", `fps=10,scale=200:-2${stamp(start, 14)},tile=6x1:padding=2:color=0x141518`,
      "-frames:v", "1", "-q:v", "4", path.join(framesDir, name),
    ]);
    out.push({ file: name, kind: "transition", start, step: 0.1, count: 6, label: `${e.kind} terdeteksi pada ${timecode(e.t)}` });
  }
  for (const [i, t] of captionTimes.slice(0, 3).entries()) {
    const start = Math.min(Math.max(0, t), Math.max(0, duration - 0.6));
    const name = `strip-c${i + 1}.jpg`;
    await run("ffmpeg", [
      "-hide_banner", "-nostats", "-y", "-ss", start.toFixed(3), "-i", file, "-t", "0.6",
      "-vf", `fps=10,crop=iw:ih*0.37:0:ih*0.45,scale=480:-2${stamp(start, 16)},tile=2x3:padding=2:color=0x141518`,
      "-frames:v", "1", "-q:v", "3", path.join(framesDir, name),
    ]);
    out.push({ file: name, kind: "caption", start, step: 0.1, count: 6, label: `pita caption (45–82% tinggi) dari ${timecode(start)}, 6 frame berjarak 0,1 s` });
  }
  return out;
}

export function frameKindLabel(kind: FrameKind): string {
  return { cut: "awal shot", end: "akhir shot", change: "perubahan dalam shot", speech: "awal kalimat", sample: "sampel" }[kind];
}
