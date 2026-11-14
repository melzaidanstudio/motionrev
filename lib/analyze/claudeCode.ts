import { spawn } from "node:child_process";
import { z } from "zod";
import { AnalysisSchema, type Analysis } from "./schema";
import { SYSTEM, closingInstruction, factsText, frameLabel, type AnalyzeInput } from "./prompt";

/**
 * Engine "claude-code": the local `claude` CLI in headless mode (`-p`), which uses whatever login
 * Claude Code already has on this machine. Frames are read by Claude with its Read tool, and the
 * answer is forced into our schema with `--json-schema`.
 *
 * This is for personal, local use. Serving other users from one Claude Code login is not what the
 * subscription allows; a hosted deployment should use the "api" engine with its own key.
 */
export async function analyzeWithClaudeCode(input: AnalyzeInput, modelSetting?: string): Promise<Analysis> {
  // The CLI's validator rejects the draft-2020-12 `$schema` marker zod adds; the schema itself is fine.
  const schema = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>;
  delete schema.$schema;
  const model = modelSetting || process.env.MOTIONREV_MODEL || "opus";

  const files = [
    ...(input.sheet ? [`- frames/${input.sheet}  (contact sheet seluruh video, dibaca kiri ke kanan, atas ke bawah)`] : []),
    ...input.frames.map((f) => `- frames/${f.file}  ${frameLabel(f)}`),
  ];
  const prompt = [
    factsText(input),
    "",
    "FILE GAMBAR (baca SEMUA dengan tool Read, satu per satu, sebelum menjawab; path relatif terhadap folder kerja):",
    ...files,
    "",
    closingInstruction(input),
    "Jawab hanya dengan JSON sesuai skema yang diminta.",
  ].join("\n");

  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--system-prompt",
    SYSTEM,
    "--tools",
    "Read",
    "--permission-mode",
    "dontAsk",
    "--model",
    model,
    "--effort",
    "high",
    prompt,
  ];

  // Strip the markers Claude Code sets in its own child processes, so the CLI accepts a nested run.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const raw = await new Promise<string>((resolve, reject) => {
    // stdin is closed up front: the CLI otherwise waits for piped input before starting.
    const child = spawn("claude", args, { cwd: input.dir, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude -p melewati batas 20 menit."));
    }, 20 * 60 * 1000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (e.code === "ENOENT") {
        reject(new Error("CLI `claude` tidak ditemukan di PATH. Pasang Claude Code atau pakai mesin API."));
      } else {
        reject(new Error(`claude -p gagal dijalankan: ${e.message}`));
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const tail = stripAnsi(err || out).trim().split("\n").slice(-5).join("\n");
        reject(new Error(`claude -p keluar dengan kode ${code}: ${tail}`));
        return;
      }
      resolve(out);
    });
  });

  let result: {
    type?: string;
    subtype?: string;
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
    api_error_status?: number | null;
  };
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`Keluaran claude -p bukan JSON: ${raw.slice(0, 300)}`);
  }
  if (result.is_error || result.subtype !== "success") {
    const why = typeof result.result === "string" ? result.result.slice(0, 400) : result.subtype;
    throw new Error(`Claude Code tidak menyelesaikan analisis (${result.subtype ?? "error"}): ${why}`);
  }

  const candidate =
    result.structured_output ??
    (typeof result.result === "string" ? safeJson(result.result) : undefined);
  const parsed = AnalysisSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Jawaban Claude Code tidak cocok dengan skema: ${parsed.error.issues[0]?.message ?? "?"}`);
  }
  return parsed.data;
}

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
