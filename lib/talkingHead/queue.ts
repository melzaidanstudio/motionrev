import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  db,
  getTalkingHead,
  setTalkingHeadDone,
  setTalkingHeadError,
  setTalkingHeadNotesDone,
  setTalkingHeadNotesFailed,
  setTalkingHeadStep,
  type TalkingHeadRow,
} from "../db";
import { talkingHeadDir } from "../paths";
import { getStorageSettings } from "../settings";
import { buildProject, newStatus, openEditor, projectDir, renderProject, setPhase, workNotes } from "./render";

interface Queue {
  pending: string[];
  running: string | null;
}

// One render at a time per process; survives dev-mode module reloads.
const g = globalThis as unknown as { __thQueue?: Queue; __thBooted?: boolean };
const queue: Queue = g.__thQueue ?? (g.__thQueue = { pending: [], running: null });

/** Fail renders a previous process left mid-way (refunding them), and pick up jobs still waiting. */
export function bootTalkingHeads() {
  if (g.__thBooted) return;
  g.__thBooted = true;
  const processStart = new Date(Date.now() - process.uptime() * 1000).toISOString();
  const stuck = db
    .prepare("SELECT id, pending_task FROM talking_heads WHERE status = 'rendering' AND updated_at < ?")
    .all(processStart) as { id: string; pending_task: string | null }[];
  for (const r of stuck) {
    // A cut-off notes round leaves the finished video as it was; a cut-off first render fails the task.
    if (r.pending_task === "notes") setTalkingHeadNotesFailed(r.id, "terputus karena server dimulai ulang. Tekan Kerjakan catatan lagi.");
    else setTalkingHeadError(r.id, "Render terputus karena server dimulai ulang. Generate ulang videonya.");
  }
  const waiting = db.prepare("SELECT id FROM talking_heads WHERE status = 'queued' ORDER BY created_at").all() as { id: string }[];
  for (const r of waiting) enqueueTalkingHead(r.id);
}

export function enqueueTalkingHead(id: string) {
  if (!queue.pending.includes(id) && queue.running !== id) queue.pending.push(id);
  void pump();
}

async function pump() {
  if (queue.running) return;
  const id = queue.pending.shift();
  if (!id) return;
  queue.running = id;
  try {
    await run(id);
  } catch (e) {
    setTalkingHeadError(id, e instanceof Error ? e.message : String(e));
  } finally {
    queue.running = null;
    void pump();
  }
}

async function run(id: string) {
  const t = getTalkingHead(id);
  if (!t || t.status !== "queued") return; // deleted or already handled
  if (t.pending_task === "notes") return runNotes(t);
  const dir = talkingHeadDir(id);
  const src = fs.readdirSync(dir).find((f) => /^source\.(mp4|mov|mkv|webm|m4v)$/i.test(f));
  if (!src) throw new Error("Video sumber tidak ada lagi di server. Unggah ulang.");
  const source = path.join(dir, src);

  setTalkingHeadStep(id, "rendering", "Menyiapkan Claude Code dan motlab");
  const status = newStatus(dir);
  const logFile = path.join(dir, "render.log");
  const proj = await buildProject(t, dir, source, status, (step) => setTalkingHeadStep(id, "rendering", step));

  if (t.mode === "editor") {
    // Editor Mode: the project opens in the motlab viewer; the user exports from there.
    setPhase(dir, status, 5);
    setTalkingHeadStep(id, "rendering", "Membuka proyek di editor motlab");
    await openEditor(proj, logFile);
    setTalkingHeadDone(id, null);
  } else {
    setPhase(dir, status, 4);
    setTalkingHeadStep(id, "rendering", "Merender video dengan motlab");
    const outRel = path.join("out", "final.mp4");
    await renderProject(proj, path.join(dir, outRel), logFile);
    setPhase(dir, status, 5);
    setTalkingHeadDone(id, outRel);
  }

  if (getStorageSettings().deleteSourceAfterDone) {
    // The upload goes; the project's own footage stays only while the editor may still need it.
    try {
      fs.rmSync(source, { force: true });
      if (t.mode !== "editor") fs.rmSync(path.join(proj, "footage"), { recursive: true, force: true });
    } catch (e) {
      console.warn(`[motionrev] could not delete talking head source ${id}:`, e);
    }
  }
}

/**
 * A round of notes on a finished video: Claude works the notes left in the motlab viewer; a Generate video is then
 * rendered again so its MP4 shows the changes. Errors keep the video finished (never fail the whole task).
 */
async function runNotes(t: TalkingHeadRow) {
  const dir = talkingHeadDir(t.id);
  try {
    setTalkingHeadStep(t.id, "rendering", "Membaca catatan dari motlab");
    const status = newStatus(dir);
    setPhase(dir, status, 2);
    const summary = await workNotes(t, dir, status, (step) => setTalkingHeadStep(t.id, "rendering", step));
    if (t.mode === "editor") {
      setPhase(dir, status, 5);
      setTalkingHeadNotesDone(t.id, summary);
      return;
    }
    setPhase(dir, status, 4);
    setTalkingHeadStep(t.id, "rendering", "Merender ulang video dengan motlab");
    const outRel = path.join("out", "final.mp4");
    await renderProject(projectDir(dir, t.id), path.join(dir, outRel), path.join(dir, "render.log"));
    setPhase(dir, status, 5);
    setTalkingHeadNotesDone(t.id, summary, outRel);
  } catch (e) {
    setTalkingHeadNotesFailed(t.id, e instanceof Error ? e.message : String(e));
  }
}
