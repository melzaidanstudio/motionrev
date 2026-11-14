import fs from "node:fs";
import path from "node:path";
import {
  db,
  getAnalysis,
  replaceFrames,
  setError,
  setProgress,
  setResult,
  setStats,
} from "./db";
import { analysisDir } from "./paths";
import { downloadVideo } from "./video/download";
import { probe } from "./video/probe";
import { detectCuts, shotStats } from "./video/scenes";
import { contactSheet, extractFrames, pickTimes } from "./video/frames";
import { analyzeVideo } from "./analyze";
import { composeSkillMd } from "./analyze/skill";

interface Queue {
  pending: string[];
  running: string | null;
}

// Survives dev-mode module reloads; one worker per process.
const g = globalThis as unknown as { __motionrevQueue?: Queue; __motionrevBooted?: boolean };
const queue: Queue = g.__motionrevQueue ?? (g.__motionrevQueue = { pending: [], running: null });

if (!g.__motionrevBooted) {
  g.__motionrevBooted = true;
  // Rows left mid-flight by a previous process can never finish; fail them (which refunds their credit).
  // Only rows last touched before this process started: in dev, this module can be evaluated again in a
  // fresh module context without the globalThis flag, and must not fail the run this process is doing.
  const processStart = new Date(Date.now() - process.uptime() * 1000).toISOString();
  const stuck = db
    .prepare("SELECT id FROM analyses WHERE status NOT IN ('done', 'error') AND updated_at < ?")
    .all(processStart) as { id: string }[];
  for (const r of stuck) setError(r.id, "Proses terputus saat server dimulai ulang. Jalankan ulang analisis.");
}

export function enqueue(id: string) {
  if (!queue.pending.includes(id) && queue.running !== id) queue.pending.push(id);
  void pump();
}

async function pump() {
  if (queue.running) return;
  const id = queue.pending.shift();
  if (!id) return;
  queue.running = id;
  try {
    await runPipeline(id);
  } catch (e) {
    setError(id, e instanceof Error ? e.message : String(e));
  } finally {
    queue.running = null;
    void pump();
  }
}

async function runPipeline(id: string) {
  const row = getAnalysis(id);
  if (!row) return;
  const dir = analysisDir(id);
  const framesDir = path.join(dir, "frames");

  // 1. Source file
  let file: string;
  let transcript: string | null = null;
  let info: Awaited<ReturnType<typeof downloadVideo>>["info"] = null;
  if (row.source_type === "url") {
    const existing = findSource(dir);
    if (existing) {
      file = existing;
      const t = path.join(dir, "transcript.txt");
      transcript = fs.existsSync(t) ? fs.readFileSync(t, "utf8") : null;
      const m = path.join(dir, "meta.json");
      info = fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, "utf8")) : null;
    } else {
      setProgress(id, "downloading", 5, "Mengunduh video dengan yt-dlp");
      const d = await downloadVideo(row.source, dir);
      file = d.file;
      transcript = d.transcript;
      info = d.info;
      if (transcript) fs.writeFileSync(path.join(dir, "transcript.txt"), transcript);
      if (info) fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(info));
    }
  } else {
    const existing = findSource(dir);
    if (!existing) throw new Error("File sumber tidak ditemukan di penyimpanan.");
    file = existing;
  }

  // 2. Measure
  setProgress(id, "extracting", 25, "Membaca durasi dan resolusi (ffprobe)");
  const p = await probe(file);
  if (p.duration > 15 * 60) {
    throw new Error(`Video ${Math.round(p.duration / 60)} menit terlalu panjang. Batas saat ini 15 menit.`);
  }

  setProgress(id, "extracting", 35, "Mendeteksi cut (ffmpeg scene detect)");
  const cuts = await detectCuts(file);
  const stats = shotStats(p.duration, cuts);
  setStats(id, { probe: p, stats, cuts });

  // 3. Frames
  setProgress(id, "extracting", 45, "Mengekstrak frame kunci");
  for (const f of fs.readdirSync(framesDir)) fs.rmSync(path.join(framesDir, f), { force: true });
  const picks = pickTimes(p.duration, cuts);
  const frames = await extractFrames(file, framesDir, picks);
  setProgress(id, "extracting", 55, "Menyusun contact sheet");
  const sheet = await contactSheet(file, framesDir, p.duration);
  replaceFrames(id, [
    ...frames.map((f) => ({ idx: f.idx, t: f.t, file: f.file, kind: f.kind })),
    { idx: 999, t: 0, file: sheet, kind: "sheet" as const },
  ]);

  // 4. Claude, on the provider the admin configured
  const job = analyzeVideo({ name: row.name, dir, framesDir, frames, sheet, probe: p, stats, cuts, transcript, info });
  setProgress(id, "analyzing", 65, `${job.label} membaca ${frames.length} frame dan menulis analisis`);
  const analysis = await job.run;

  // 5. Compose
  setProgress(id, "analyzing", 92, "Menyusun SKILL.md");
  const skillMd = composeSkillMd({
    name: row.name,
    source: row.source,
    sourceType: row.source_type,
    analysis,
    probe: p,
    stats,
    cuts,
    frames,
    createdAt: new Date(),
  });
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  const cover = frames[analysis.cover_frame_index]?.file ?? frames[0]?.file ?? null;
  setResult(id, {
    description: analysis.deskripsi,
    skill_md: skillMd,
    analysis_json: JSON.stringify(analysis),
    cover_frame: cover,
    name: analysis.nama?.trim() || undefined,
  });
}

function findSource(dir: string): string | null {
  const f = fs.readdirSync(dir).find((x) => /^source\.(mp4|mkv|webm|mov|m4v|avi)$/i.test(x));
  return f ? path.join(dir, f) : null;
}
