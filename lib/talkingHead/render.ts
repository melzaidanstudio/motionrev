import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FOLLOW_STYLE, fontById, paletteById, styleById } from "./options";
import type { TalkingHeadRow } from "../db";
import { classifyTool, writeStatus, type RenderStatus } from "./progress";
import { MAX_THREADS, threadEnv } from "../threads";

/**
 * The Talking Head engine, built on motlab:
 *   1. buildProject: the local Claude Code CLI loads the motlab skill and builds a motlab project from the clip
 *      (cuts, captions, overlays as canvas scenes), in the job folder under th-<id>/.
 *   2a. renderProject: `motlab render` turns that project into out/final.mp4 ("Generate video").
 *   2b. openEditor: `motlab edit` opens it in the motlab viewer, where the user reviews, leaves notes and exports
 *       ("Editor Mode").
 *
 * Claude runs on the Claude Code login of this machine, so this is for personal or test use. It runs with
 * permissions bypassed inside the job folder; only feed it clips you trust.
 */

export const projectName = (id: string) => `th-${id}`;
export const projectDir = (dir: string, id: string) => path.join(dir, projectName(id));

/** Most CPU threads one render may use: the app-wide cap (lib/threads.ts), fixed at 4. */
export function renderThreads(): number {
  return MAX_THREADS;
}

/** motlab gives each scene it renders at once about 4 threads, so 4 threads means one scene at a time. */
const renderParallel = () => Math.max(1, Math.floor(renderThreads() / 4));

/** Environment for every child: no nested-Claude markers, and thread caps for numeric libraries. */
function childEnv(): NodeJS.ProcessEnv {
  const env = threadEnv();
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

export function newStatus(dir: string): RenderStatus {
  const s: RenderStatus = { startedAt: new Date().toISOString(), phase: 0, phaseAt: new Date().toISOString() };
  writeStatus(dir, s);
  return s;
}

export function setPhase(dir: string, s: RenderStatus, phase: RenderStatus["phase"]) {
  if (phase <= s.phase) return;
  s.phase = phase;
  s.phaseAt = new Date().toISOString();
  writeStatus(dir, s);
}

/** Step 1: Claude Code builds the motlab project. Returns the project folder. */
export async function buildProject(
  t: TalkingHeadRow,
  dir: string,
  source: string,
  status: RenderStatus,
  onStep: (step: string) => void,
): Promise<string> {
  const style = styleById(t.style);
  if (!style) throw new Error(`Style ${t.style} tidak dikenal.`);
  const palette = paletteById(t.palette === FOLLOW_STYLE ? style.palette : t.palette);
  const font = fontById(t.font === FOLLOW_STYLE ? style.font : t.font);

  // The project folder holds its own footage: the viewer and the renderer only serve files inside it.
  const proj = projectDir(dir, t.id);
  const footage = path.join(proj, "footage", `talk${path.extname(source).toLowerCase()}`);
  fs.mkdirSync(path.dirname(footage), { recursive: true });
  if (!fs.existsSync(footage)) {
    try {
      fs.linkSync(source, footage); // same disk: no second copy
    } catch {
      fs.copyFileSync(source, footage);
    }
  }
  const rel = (p: string) => path.relative(dir, p);

  const prompt = [
    `Buat video talking head vertikal 9:16 dengan skill "motlab".`,
    "",
    "Langkah pertama: panggil tool Skill dengan nama motlab, lalu ikuti alurnya (untuk talking head: references/footage.md, scripts/cut_pauses.py, captions dari transkrip).",
    "",
    "Brief (sudah lengkap, jangan tanya lagi):",
    `- Proyek motlab: folder ${rel(proj)}/ (sudah ada). Footage: ${rel(footage)}. Halaman portrait 1080x1920.`,
    "- Untuk Reels/TikTok. Suara asli rekaman adalah audionya: tanpa voiceover baru dan tanpa musik berbayar.",
    `- Arah gaya: "${style.name}": ${style.blurb}`,
    `  Untuk bahasa visualnya (warna, tipografi, elemen, ritme) boleh baca ${path.join(os.homedir(), ".claude", "skills", style.id, "SKILL.md")}, tapi semuanya dibangun sebagai scene motlab, bukan HyperFrames.`,
    `- Nuansa warna: ${palette ? `${palette.name}, latar ${palette.colors[0]}, utama ${palette.colors[1]}, aksen ${palette.colors[2]}` : "bawaan style"}${
      t.palette === FOLLOW_STYLE ? " (bawaan style)" : " (pilihan pengguna: pakai ini menggantikan warna bawaan)"
    }`,
    `- Font caption utama: ${font?.name ?? "bawaan style"} (Google Font)${t.font === FOLLOW_STYLE ? " (bawaan style)" : " (pilihan pengguna)"}`,
    t.cut_fill
      ? "- Cut & Fill: AKTIF. Potong jeda/diam, kata pengisi (eee, mmm, hmm, ehm) dan kalimat yang diulang dengan cut_pauses.py, lalu rapikan sambungannya."
      : "- Cut & Fill: NONAKTIF. JANGAN memotong apa pun: tidak ada jeda, diam, kata pengisi (eee, mmm, hmm) atau kalimat ulang yang dibuang. Pakai rekaman utuh dengan durasi dan urutan aslinya (jangan jalankan cut_pauses.py). Punch-in/zoom boleh, selama tidak ada waktu yang dibuang.",
    "- CTA kata kunci hanya kalau memang diucapkan di video.",
    "",
    "Ini proses otomatis dari aplikasi, tidak ada orang yang bisa menjawab:",
    "- Jangan bertanya dan jangan menunggu persetujuan.",
    "- JANGAN jalankan `motlab render`, `motlab video` atau `motlab edit`: aplikasi yang merender dan membuka viewer sesudah kamu selesai. `motlab stills` untuk mengecek frame boleh dan wajib.",
    "- project.json harus lengkap (semua scene dan audio suara asli), sehingga `motlab render` langsung jalan.",
    `- Batas CPU: maksimal ${renderThreads()} thread untuk alat yang kamu jalankan (whisper, ffmpeg -threads ${renderThreads()}).`,
    "- Kerjakan semuanya di dalam folder kerja ini. Jangan ubah footage.",
    "- Isi `description` setiap perintah Bash dengan kalimat pendek berbahasa Indonesia; teks itu tampil ke pengguna sebagai status.",
    "",
    "Selesai dengan satu kalimat ringkas tentang isi videonya.",
  ].join("\n");

  const result = await runClaude(
    prompt,
    dir,
    status,
    onStep,
    `style=${style.id} palette=${palette?.id} font=${font?.id} cutFill=${t.cut_fill} mode=${t.mode} engine=motlab`,
  );

  if (!result.ok) throw new Error(`Claude Code tidak selesai menyusun video: ${result.text.slice(0, 300)}`);
  if (!fs.existsSync(path.join(proj, "project.json"))) {
    throw new Error(`Proyek motlab tidak lengkap (project.json tidak ada). Catatan Claude: ${result.text.slice(0, 300)}`);
  }
  return proj;
}

/** Run Claude Code headless in the job folder, streaming tool calls into the status line and phase. */
async function runClaude(
  prompt: string,
  dir: string,
  status: RenderStatus,
  onStep: (step: string) => void,
  logTag: string,
): Promise<{ ok: boolean; text: string }> {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--add-dir",
    path.join(os.homedir(), ".claude", "skills"),
    "--model",
    process.env.MOTIONREV_RENDER_MODEL || "opus",
    prompt,
  ];

  const log = fs.createWriteStream(path.join(dir, "render.log"), { flags: "a" });
  log.write(`\n=== ${status.startedAt} ${logTag}\n`);

  return new Promise<{ ok: boolean; text: string }>((resolve, reject) => {
    const child = spawn("claude", args, { cwd: dir, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let final: { ok: boolean; text: string } | null = null;
    let lastStepAt = 0;
    const step = (s: string) => {
      const n = Date.now();
      if (n - lastStepAt < 1500) return;
      lastStepAt = n;
      onStep(s.slice(0, 160));
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude Code melewati batas 2 jam dan dihentikan."));
    }, 2 * 60 * 60 * 1000);

    child.stdout.on("data", (d: Buffer) => {
      log.write(d);
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: StreamEvent;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === "assistant") {
          for (const b of ev.message?.content ?? []) {
            if (b.type !== "tool_use") continue;
            step(describeTool(b.name, b.input ?? {}));
            const p = classifyTool(b.name, b.input ?? {});
            // The render itself is ours (step 2), so the build tops out at the quality check.
            if (p !== null) setPhase(dir, status, Math.min(p, 3) as RenderStatus["phase"]);
          }
        } else if (ev.type === "result") {
          final = { ok: ev.subtype === "success" && !ev.is_error, text: String(ev.result ?? ev.subtype ?? "") };
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => log.write(d));
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(e.code === "ENOENT" ? "CLI `claude` tidak ditemukan di server ini." : `claude gagal dijalankan: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      log.end();
      if (final) return resolve(final);
      reject(new Error(`claude berhenti (kode ${code}) tanpa hasil. Lihat render.log di folder job.`));
    });
  });
}

/**
 * A round of notes: Claude Code reads the notes the user left in the motlab viewer (selection.json) and changes
 * the scenes, the way the motlab skill's revision rounds work. Returns Claude's per-note summary.
 */
export async function workNotes(t: TalkingHeadRow, dir: string, status: RenderStatus, onStep: (step: string) => void): Promise<string> {
  const proj = projectDir(dir, t.id);
  const rel = path.relative(dir, proj);
  const prompt = [
    `Proyek motlab ${rel}/ sudah jadi. Pengguna meninggalkan catatan untuknya di viewer motlab.`,
    "",
    "Langkah pertama: panggil tool Skill dengan nama motlab, lalu kerjakan putaran revisi persis seperti alur skill itu (langkah 8, \"Revision rounds\"):",
    `- Baca ${rel}/selection.json dan lihat ${rel}/selection/<n>.png untuk setiap catatan yang belum \"done\" (hanya yang project-nya project.json).`,
    `- Sebelum mengubah, salin scenes/ ke backup/<n>/, lalu jalankan \`motlab working ${rel} --note <nomor> "<apa yang dikerjakan>"\`; sesudahnya \`motlab working ${rel} --done\`.`,
    "- Kerjakan SEMUA catatan yang terbuka, cek stills di sekitar perubahan, lalu tandai \"done\": true pada catatan itu di selection.json (jangan ubah yang lain di file itu).",
    "- Catatan tanpa teks: titik/kotaknya sendiri adalah catatannya; tafsirkan dari gambar selection/<n>.png dan sebutkan tafsiranmu.",
    "- Kalau catatan butuh file yang tidak ada (logo, lambang, foto produk), jangan menggambarnya dari ingatan atau membuatnya dengan AI: lewati catatan itu, biarkan tidak done, dan jelaskan file apa yang perlu diunggah.",
    "",
    "Ini proses otomatis dari aplikasi, tidak ada orang yang bisa menjawab:",
    "- Jangan bertanya dan jangan menunggu persetujuan.",
    "- JANGAN jalankan `motlab render`, `motlab video` atau `motlab edit`: aplikasi yang merender sesudahnya. `motlab stills` boleh dan wajib.",
    `- Batas CPU: maksimal ${renderThreads()} thread.`,
    "- Isi `description` setiap perintah Bash dengan kalimat pendek berbahasa Indonesia; teks itu tampil ke pengguna sebagai status.",
    "",
    "Akhiri dengan ringkasan per nomor catatan, satu baris per catatan, format: `#<n> <apa yang diubah, atau kenapa dilewati>`.",
  ].join("\n");
  const result = await runClaude(prompt, dir, status, onStep, `notes mode=${t.mode}`);
  if (!result.ok) throw new Error(result.text.slice(0, 300) || "Claude Code tidak selesai mengerjakan catatan.");
  return result.text.trim();
}

/** Step 2a: `motlab render` the project to `out`, at 1080x1920 (the page size, scale 1). */
export async function renderProject(proj: string, out: string, logFile: string): Promise<void> {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { code, tail } = await run("motlab", ["render", proj, out, "--scale", "1", "--parallel", String(renderParallel())], logFile, 90 * 60 * 1000);
  if (code !== 0) throw new Error(`motlab render gagal (kode ${code}): ${tail}`);
  if (!fs.existsSync(out) || fs.statSync(out).size < 10_000) throw new Error("motlab render selesai tapi file MP4 tidak ada.");
}

/** Step 2b: open (or re-open) the project in the motlab viewer and return its address. */
export async function openEditor(proj: string, logFile: string): Promise<string> {
  const { code, out, tail } = await run("motlab", ["edit", proj], logFile, 60 * 1000);
  const url = out.match(/https?:\/\/\S+\/p\/\S+/)?.[0];
  if (code !== 0 || !url) throw new Error(`motlab edit gagal: ${tail || "alamat viewer tidak terbaca"}`);
  return url.replace(/[.,]$/, "");
}

/** Run a command, appending its output to the job log; resolves with the exit code and output. */
function run(cmd: string, args: string[], logFile: string, timeoutMs: number): Promise<{ code: number; out: string; tail: string }> {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(logFile, { flags: "a" });
    log.write(`\n$ ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const take = (d: Buffer) => {
      log.write(d);
      out += d.toString();
      if (out.length > 200_000) out = out.slice(-100_000);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      log.end();
      reject(new Error(e.code === "ENOENT" ? `Perintah ${cmd} tidak ditemukan. Pasang motlab dulu.` : e.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      log.end();
      const clean = out.replace(/\u001b\[[0-9;]*m/g, "");
      resolve({ code: code ?? 1, out: clean, tail: clean.trim().split("\n").slice(-4).join(" ").slice(0, 300) });
    });
  });
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  message?: { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
}

/** A short, human line for the status under the job, from the tool the agent is about to run. */
function describeTool(name: string | undefined, input: Record<string, unknown>): string {
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  switch (name) {
    case "Skill":
      return `Membaca skill ${str("skill") || str("name")}`;
    case "Bash": {
      const d = str("description");
      if (d) return d;
      const c = str("command");
      if (/motlab stills/.test(c)) return "Mengecek frame";
      if (/whisper|transcri/.test(c)) return "Membuat transkrip";
      if (/cut_pauses/.test(c)) return "Memotong jeda";
      return `Menjalankan ${c.split("\n")[0].slice(0, 80)}`;
    }
    case "Write":
    case "Edit":
      return `Menulis ${path.basename(str("file_path"))}`;
    case "Read":
      return `Membaca ${path.basename(str("file_path"))}`;
    default:
      return name ? `Memakai ${name}` : "Bekerja";
  }
}
