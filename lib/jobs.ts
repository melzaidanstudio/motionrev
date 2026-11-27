import fs from "node:fs";
import path from "node:path";
import {
  db,
  getAnalysis,
  replaceFrames,
  setError,
  setProgress,
  setResult,
  setScriptState,
  setStats,
} from "./db";
import { analysisDir, findSourceVideo } from "./paths";
import { getStorageSettings } from "./settings";
import { downloadVideo } from "./video/download";
import { probe } from "./video/probe";
import { analyzeScenes, shotStats } from "./video/scenes";
import { contactSheets, extractFrames, motionStrips, pickTimes } from "./video/frames";
import { analyzeVideo } from "./analyze";
import { composeSkillMd } from "./analyze/skill";
import type { AnalyzeInput } from "./analyze/prompt";
import type { Analysis } from "./analyze/schema";
import type { QaReport } from "./analyze/qa";
import { auditVisual } from "./analyze/visualQa";
import { platformTranscript, saveTranscript, transcribe, transcriptText, TRANSCRIPT_FILE, type Transcript } from "./video/transcribe";
import { enqueueScript } from "./scriptJobs";

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
    const existing = findSourceVideo(dir);
    if (existing) {
      file = existing;
      const t = path.join(dir, "subtitles.txt");
      transcript = fs.existsSync(t) ? fs.readFileSync(t, "utf8") : null;
      const m = path.join(dir, "meta.json");
      info = fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, "utf8")) : null;
    } else {
      setProgress(id, "downloading", 5, "Mengunduh video dengan yt-dlp");
      const d = await downloadVideo(row.source, dir);
      file = d.file;
      transcript = d.transcript;
      info = d.info;
      if (transcript) fs.writeFileSync(path.join(dir, "subtitles.txt"), transcript);
      if (info) fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(info));
    }
  } else {
    const existing = findSourceVideo(dir);
    if (!existing) throw new Error("Video unggahan tidak ada lagi di server (mungkin sudah dihapus setelah selesai). Unggah ulang videonya sebagai analisis baru.");
    file = existing;
  }

  // 2. Measure
  setProgress(id, "extracting", 25, "Membaca durasi dan resolusi (ffprobe)");
  const p = await probe(file);
  if (p.duration > 15 * 60) {
    throw new Error(`Video ${Math.round(p.duration / 60)} menit terlalu panjang. Batas saat ini 15 menit.`);
  }

  setProgress(id, "extracting", 32, "Mendeteksi cut, kilatan, dan gerak kamera");
  const scenes = await analyzeScenes(file, p);
  const cuts = scenes.cuts;
  const stats = shotStats(p.duration, cuts);
  setStats(id, { probe: p, stats, cuts, events: scenes.events });

  // 3. What is said: whisper on the audio (with times), else the platform's subtitles. Kept for the script skill,
  //    and used to pick frames while captions are on screen.
  let spoken: Transcript | null = null;
  if (p.hasAudio) {
    setProgress(id, "extracting", 38, "Mentranskrip audio (whisper)");
    try {
      spoken = await transcribe(file);
    } catch (e) {
      console.warn(`[motionrev] whisper failed for ${id}:`, e);
    }
  }
  if (!spoken && transcript) spoken = platformTranscript(transcript);
  if (spoken) saveTranscript(dir, spoken);
  else fs.rmSync(path.join(dir, TRANSCRIPT_FILE), { force: true });

  // 4. Evidence: key frames, timecoded contact sheets, and motion strips
  setProgress(id, "extracting", 48, "Mengekstrak frame kunci");
  for (const f of fs.readdirSync(framesDir)) fs.rmSync(path.join(framesDir, f), { force: true });
  const speechStarts = spoken?.segments.map((x) => x.start) ?? [];
  const picks = pickTimes(p.duration, cuts, scenes.changePeaks, speechStarts);
  const frames = await extractFrames(file, framesDir, picks);
  setProgress(id, "extracting", 54, "Menyusun contact sheet bertimecode dan potongan gerak");
  const sheets = await contactSheets(file, framesDir, p.duration);
  const segs = spoken?.segments ?? [];
  const captionTimes = segs.length
    ? [segs[0], segs[Math.floor(segs.length / 2)], segs[segs.length - 1]].map((x) => x.start + 0.2)
    : [0.25, 0.5, 0.75].map((f) => f * p.duration);
  const strips = await motionStrips(file, framesDir, p.duration, scenes.events, captionTimes);
  replaceFrames(id, [
    ...frames.map((f) => ({ idx: f.idx, t: f.t, file: f.file, kind: f.kind })),
    ...sheets.map((sh, n) => ({ idx: 900 + n, t: sh.start, file: sh.file, kind: "sheet" as const })),
    ...strips.map((st, n) => ({ idx: 950 + n, t: st.start, file: st.file, kind: "strip" as const })),
  ]);

  // 5. Claude, on the provider the admin configured
  const input: AnalyzeInput = {
    name: row.name,
    dir,
    framesDir,
    frames,
    sheets,
    strips,
    probe: p,
    stats,
    cuts,
    events: scenes.events,
    transcript: spoken ? transcriptText(spoken) : null,
    transcriptSource: spoken?.source ?? null,
    spoken,
    info,
  };
  const job = analyzeVideo(input);
  setProgress(id, "analyzing", 60, `${job.label} membaca ${frames.length} frame, ${sheets.length} contact sheet, dan ${strips.length} potongan gerak`);
  const draft = await job.run;

  // 6. Audit and test until the score reaches 9.5/10 (or the rounds run out), then compose
  const compose = (analysis: Analysis, qa?: QaReport) =>
    composeSkillMd({
      name: row.name,
      source: row.source,
      sourceType: row.source_type,
      analysis,
      probe: p,
      stats,
      cuts,
      frames,
      sheets,
      strips,
      qa,
      transcriptSource: spoken?.source ?? null,
      createdAt: new Date(),
    });
  const { analysis, report } = await auditVisual({
    input,
    analysis: draft,
    compose: (a) => compose(a),
    onPhase: (round, phase) =>
      setProgress(
        id,
        "analyzing",
        Math.min(94, 68 + (round - 1) * 9 + (phase === "revisi" ? 5 : 0)),
        phase === "audit" ? `Audit dan uji putaran ${round}: memeriksa setiap klaim terhadap frame` : `Revisi putaran ${round}: memperbaiki klaim yang belum tepat`,
      ),
  });

  setProgress(id, "analyzing", 96, "Menyusun SKILL.md");
  const skillMd = compose(analysis, report);
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  const cover = frames[analysis.cover_frame_index]?.file ?? frames[0]?.file ?? null;
  setResult(id, {
    description: analysis.deskripsi,
    skill_md: skillMd,
    analysis_json: JSON.stringify(analysis),
    audit_json: JSON.stringify(report),
    cover_frame: cover,
    name: analysis.nama?.trim() || undefined,
  });

  // 7. The script skill works from the saved transcript, so it runs on its own after the analysis is done.
  if (spoken) enqueueScript(id);
  else setScriptState(id, "error", "Video ini tidak punya narasi atau ucapan yang bisa ditranskrip, jadi tidak ada naskah untuk dibedah.");

  // 8. Optionally drop the source video: SKILL.md and the frames (all the zip needs) are already saved.
  if (getStorageSettings().deleteSourceAfterDone) {
    try {
      fs.rmSync(file, { force: true });
    } catch (e) {
      console.warn(`[motionrev] could not delete source video of ${id}:`, e);
    }
  }
}

