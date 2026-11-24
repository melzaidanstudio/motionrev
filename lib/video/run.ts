import { execFile } from "node:child_process";
import { FFMPEG_THREAD_ARGS, threadEnv } from "../threads";

export interface RunResult {
  stdout: string;
  stderr: string;
}

/** Run a binary with arguments (never a shell), capturing both streams. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number; maxBuffer?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      // ffmpeg is held to the app-wide thread cap; the options go before its first input.
      cmd === "ffmpeg" ? [...FFMPEG_THREAD_ARGS, ...args] : args,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs ?? 10 * 60 * 1000,
        maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
        env: { ...threadEnv(), PYTHONIOENCODING: "utf-8" },
      },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException;
          const head = String(stderr || stdout || e.message).trim().split("\n").slice(-6).join("\n");
          if (e.code === "ENOENT") {
            reject(new Error(`${cmd} tidak ditemukan di PATH. Pasang dulu, lalu jalankan ulang.`));
          } else {
            reject(new Error(`${cmd} gagal: ${head}`));
          }
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}
