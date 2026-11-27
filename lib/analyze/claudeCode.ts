import { spawn } from "node:child_process";
import { z } from "zod";

/**
 * Engine "claude-code": the local `claude` CLI in headless mode (`-p`), which uses whatever login Claude Code already
 * has on this machine. Images are read by Claude with its Read tool, and the answer is forced into the schema with
 * `--json-schema`.
 *
 * This is for personal, local use. Serving other users from one Claude Code login is not what the subscription
 * allows; a hosted deployment should use the "api" engine with its own key.
 */
/** One headless `claude -p` call whose answer must match `schema`. */
export async function runClaudeCodeJson<T>(
  schema: z.ZodType<T>,
  o: { system: string; prompt: string; cwd: string; model?: string; what: string; tools?: string; effort?: "high" | "xhigh" | "max" },
): Promise<T> {
  // The CLI's validator rejects the draft-2020-12 `$schema` marker zod adds; the schema itself is fine.
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  const model = o.model || process.env.MOTIONREV_MODEL || "opus";

  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(json),
    "--system-prompt",
    o.system,
    "--tools",
    o.tools ?? "Read",
    "--permission-mode",
    "dontAsk",
    "--model",
    model,
    "--effort",
    o.effort ?? "high",
    o.prompt,
  ];

  // Strip the markers Claude Code sets in its own child processes, so the CLI accepts a nested run.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const raw = await new Promise<string>((resolve, reject) => {
    // stdin is closed up front: the CLI otherwise waits for piped input before starting.
    const child = spawn("claude", args, { cwd: o.cwd, env, stdio: ["ignore", "pipe", "pipe"] });
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
    throw new Error(`Claude Code tidak menyelesaikan ${o.what} (${result.subtype ?? "error"}): ${why}`);
  }

  const candidate =
    result.structured_output ??
    (typeof result.result === "string" ? safeJson(result.result) : undefined);
  const parsed = schema.safeParse(candidate);
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
