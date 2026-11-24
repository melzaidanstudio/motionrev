import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Progress of a Talking Head render, for the status bar. The agent does not report a percentage, so it
 * is estimated from which phase it has reached (read from the tools it runs) and how long the clip is.
 */

export const PHASES = [
  { key: "style", label: "Mempelajari style", from: 3, to: 10 },
  { key: "cut", label: "Transkrip & potong jeda", from: 10, to: 35 },
  { key: "compose", label: "Menyusun motion graphic", from: 35, to: 60 },
  { key: "check", label: "Cek kualitas", from: 60, to: 72 },
  { key: "render", label: "Render video", from: 72, to: 95 },
  { key: "finish", label: "Finishing", from: 95, to: 99 },
] as const;

export type PhaseIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** Which phase a tool call belongs to, or null when it says nothing about progress. */
export function classifyTool(name: string | undefined, input: Record<string, unknown>): PhaseIndex | null {
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  if (name === "Skill") return 0;
  if (name === "Write" || name === "Edit") {
    // Writing the composition (HTML/CSS/config) is the build phase; helper scripts are not.
    return /\.(html|css|json)$/i.test(str("file_path")) ? 2 : null;
  }
  if (name !== "Bash") return null;

  // Only commands that run something count. Reading a script (`cat post.py`) says nothing about progress.
  const cmd = str("command").toLowerCase();
  const runs = cmd
    .split(/&&|\|\||;|\n/)
    .map((c) => c.trim().replace(/^cd \S+\s*/, "").trim())
    .filter((c) => c && !/^(cat|ls|wc|head|tail|grep|rg|sed -n|find|echo|which|file|stat|du|pwd)\b/.test(c))
    .join("\n");
  if (!runs) return null;
  if (/post\.py|cp .*out\/final\.mp4|-o\s+\S*out\/final\.mp4|ffmpeg .*out\/final\.mp4/.test(runs)) return 5;
  if (/(hyperframes(@[\d.]+)?|motlab) render|\.py full\b/.test(runs)) return 4;
  if (/hyperframes(@[\d.]+)? (check|snapshot)|motlab stills|contact_sheet|\bstills\b|snapshot/.test(runs)) return 3;
  if (/hyperframes(@[\d.]+)? (init|add)|motlab events|mix\.py|\.py (plan|config)/.test(runs)) return 2;
  if (/transcri|whisper|cut_pauses|cuts?\.py|trycut|aroll|verify\.py|silencedetect|grade\.py|remove-background/.test(runs)) return 1;
  return null;
}

/** What the worker writes next to the job while it renders. */
export interface RenderStatus {
  startedAt: string;
  phase: PhaseIndex;
  phaseAt: string;
}

export function statusFile(dir: string) {
  return path.join(dir, "status.json");
}

export function writeStatus(dir: string, s: RenderStatus) {
  try {
    fs.writeFileSync(statusFile(dir), JSON.stringify(s));
  } catch {}
}

/** Status of a render: from status.json, or reconstructed from render.log for renders started before it. */
export function readStatus(dir: string): RenderStatus | null {
  try {
    return JSON.parse(fs.readFileSync(statusFile(dir), "utf8")) as RenderStatus;
  } catch {}
  let log: string;
  try {
    log = fs.readFileSync(path.join(dir, "render.log"), "utf8");
  } catch {
    return null;
  }
  const starts = [...log.matchAll(/^=== (\S+) style=/gm)];
  if (!starts.length) return null;
  const last = starts[starts.length - 1];
  let phase: PhaseIndex = 0;
  for (const line of log.slice(last.index).split("\n")) {
    if (!line.startsWith('{"type":"assistant"')) continue;
    try {
      const ev = JSON.parse(line) as { message?: { content?: { type: string; name?: string; input?: Record<string, unknown> }[] } };
      for (const b of ev.message?.content ?? []) {
        if (b.type !== "tool_use") continue;
        const p = classifyTool(b.name, b.input ?? {});
        if (p !== null && p > phase) phase = p;
      }
    } catch {}
  }
  return { startedAt: last[1], phase, phaseAt: last[1] };
}

/** Clip length in seconds, probed once and cached in meta.json. */
export function clipDuration(dir: string): number | null {
  const meta = path.join(dir, "meta.json");
  try {
    const m = JSON.parse(fs.readFileSync(meta, "utf8")) as { duration?: number };
    if (m.duration) return m.duration;
  } catch {}
  const src = fs.readdirSync(dir).find((f) => /^source\./i.test(f));
  if (!src) return null;
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dir, src)], {
      timeout: 15_000,
    })
      .toString()
      .trim();
    const duration = Number(out);
    if (!duration) return null;
    fs.writeFileSync(meta, JSON.stringify({ duration }));
    return duration;
  } catch {
    return null;
  }
}

/** Expected wall time of a whole render for a clip of this length: setup plus roughly 20 s per second. */
export function expectedSeconds(duration: number | null): number {
  return Math.round(300 + 20 * (duration ?? 60));
}

export interface ProgressView {
  pct: number;
  phase: PhaseIndex;
  startedAt: string;
  /** Best guess of seconds still to go, as of `asOf`. */
  remaining: number;
  asOf: string;
}

/** Percentage and time left for a running render. */
export function progressOf(s: RenderStatus, duration: number | null, now = Date.now()): ProgressView {
  const expected = expectedSeconds(duration);
  const elapsed = Math.max(0, (now - Date.parse(s.startedAt)) / 1000);
  const ph = PHASES[s.phase];
  // Within a phase, creep toward its end over its share of the expected time, never reaching it.
  const share = ((ph.to - ph.from) / 100) * expected;
  const inPhase = Math.max(0, (now - Date.parse(s.phaseAt)) / 1000);
  const pct = Math.min(ph.to - 1, ph.from + (ph.to - ph.from) * Math.min(0.9, inPhase / Math.max(60, share)));
  // Early on trust the length-based guess; once there is real progress, the observed pace.
  const paced = pct >= 15 ? elapsed / (pct / 100) : expected;
  const total = pct < 50 ? (expected + paced) / 2 : paced;
  return {
    pct: Math.round(pct),
    phase: s.phase,
    startedAt: s.startedAt,
    remaining: Math.max(60, Math.round(total - elapsed)),
    asOf: new Date(now).toISOString(),
  };
}
