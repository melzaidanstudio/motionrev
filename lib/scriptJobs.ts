import fs from "node:fs";
import path from "node:path";
import { db, getAnalysis, setScriptDone, setScriptState } from "./db";
import { analysisDir, findSourceVideo } from "./paths";
import { getStorageSettings } from "./settings";
import { downloadVideo } from "./video/download";
import type { ProbeInfo } from "./video/probe";
import { readTranscript, saveTranscript, transcribe, platformTranscript, type Transcript } from "./video/transcribe";
import { analyzeScript, auditScript, composeScriptSkillMd, type ScriptAnalysis } from "./analyze/script";
import type { QaReport } from "./analyze/qa";
import type { Analysis } from "./analyze/schema";

export const SCRIPT_FILE = "SKILL-naskah.md";

/**
 * The script skill runs apart from the visual analysis, one at a time: right after an analysis finishes, or when the
 * user asks for it on an older analysis. Its state lives in analyses.script_status so the page can follow it.
 */
interface Queue {
  pending: string[];
  running: string | null;
}

const g = globalThis as unknown as { __motionrevScriptQueue?: Queue };
const queue: Queue = g.__motionrevScriptQueue ?? (g.__motionrevScriptQueue = { pending: [], running: null });

/**
 * Called once from instrumentation when the server starts: a script run left mid-flight by the previous process can
 * never finish. Not done on module load, because pages may load this module in another context while a run is going.
 */
export function bootScriptJobs() {
  db.prepare(
    "UPDATE analyses SET script_status = 'error', script_error = 'Proses terputus saat server dimulai ulang. Coba lagi.' WHERE script_status IN ('queued', 'running')",
  ).run();
}

export function enqueueScript(id: string) {
  if (queue.running === id || queue.pending.includes(id)) return;
  setScriptState(id, "queued");
  queue.pending.push(id);
  void pump();
}

async function pump() {
  if (queue.running) return;
  const id = queue.pending.shift();
  if (!id) return;
  queue.running = id;
  try {
    setScriptState(id, "running");
    await buildScriptSkill(id);
  } catch (e) {
    setScriptState(id, "error", e instanceof Error ? e.message : String(e));
  } finally {
    queue.running = null;
    void pump();
  }
}

/**
 * Analyses made before the script skill existed don't get one (the owner's choice): only rows that already went
 * through the script step, which every new analysis does at the end of its pipeline.
 */
export function scriptEligible(a: { script_md: string | null; script_status: string | null }): boolean {
  return Boolean(a.script_md || a.script_status);
}

/** Why a script skill can't be made for this analysis, or null when it can. */
export function scriptBlocker(id: string): string | null {
  const a = getAnalysis(id);
  if (!a) return "Analisis tidak ditemukan.";
  if (!scriptEligible(a)) return "SKILL naskah hanya dibuat untuk analisis baru.";
  const dir = analysisDir(id);
  if (readTranscript(dir) || findSourceVideo(dir) || a.source_type === "url") return null;
  return "Video unggahannya sudah dihapus dan belum ada transkripnya. Unggah ulang videonya sebagai analisis baru.";
}

/** The transcript of an analysis: saved one, else whisper on the stored video, else download the link again. */
export async function ensureTranscript(id: string): Promise<Transcript | null> {
  const a = getAnalysis(id);
  if (!a) throw new Error("Analisis tidak ditemukan.");
  const dir = analysisDir(id);
  const saved = readTranscript(dir);
  if (saved) return saved;

  let file = findSourceVideo(dir);
  let downloaded = false;
  let platform: string | null = null;
  if (!file && a.source_type === "url") {
    const d = await downloadVideo(a.source, dir);
    file = d.file;
    platform = d.transcript;
    downloaded = true;
  }
  if (!file) throw new Error(scriptBlocker(id) ?? "Video sumber tidak ada.");

  try {
    const t = (await transcribe(file)) ?? (platform ? platformTranscript(platform) : null);
    if (t) saveTranscript(dir, t);
    return t;
  } finally {
    // A video fetched only to transcribe it goes away again when the owner keeps no source videos.
    if (downloaded && getStorageSettings().deleteSourceAfterDone) fs.rmSync(file, { force: true });
  }
}

async function buildScriptSkill(id: string) {
  const a = getAnalysis(id);
  if (!a) return;
  const dir = analysisDir(id);
  const transcript = await ensureTranscript(id);
  if (!transcript) throw new Error("Video ini tidak punya narasi atau ucapan yang bisa ditranskrip, jadi tidak ada naskah untuk dibedah.");

  const stats = a.stats_json ? (JSON.parse(a.stats_json) as { probe?: ProbeInfo }) : null;
  const probe = stats?.probe ?? null;
  const visual = a.analysis_json ? (JSON.parse(a.analysis_json) as Analysis) : null;
  const metaFile = path.join(dir, "meta.json");
  const info = fs.existsSync(metaFile) ? (JSON.parse(fs.readFileSync(metaFile, "utf8")) as { title?: string; description?: string }) : null;

  const input = { name: a.name, dir, transcript, probe, visual, info };
  const job = analyzeScript(input);
  const draft = await job.run;
  const compose = (analysis: ScriptAnalysis, qa?: QaReport) =>
    composeScriptSkillMd({
      analysis,
      stats: job.stats,
      transcript,
      duration: probe?.duration ?? null,
      name: a.name,
      source: a.source,
      sourceType: a.source_type,
      createdAt: new Date(),
      qa,
    });
  // Test, audit against the transcript, and revise until it scores 9.5/10 or the rounds run out.
  const { analysis, report } = await auditScript({ input, prompt: job.prompt, analysis: draft, compose: (x) => compose(x) });
  const md = compose(analysis, report);
  fs.writeFileSync(path.join(dir, SCRIPT_FILE), md);
  setScriptDone(id, md, JSON.stringify(report));
}
