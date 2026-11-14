import "server-only";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type ClaudeCodeAccount =
  | { loggedIn: true; email: string | null }
  | { loggedIn: false; reason: "not-logged-in" | "cli-missing" | "unknown" };

/**
 * Which Claude Code login `claude -p` runs with on this server. Asks the CLI itself
 * (`claude auth status`), with the same environment the analysis run uses, so the admin page says
 * "not logged in" exactly when an analysis would fail with "Not logged in · Please run /login".
 * The email comes from the status, or from the CLI's config file when the status leaves it out.
 */
export async function getClaudeCodeAccount(): Promise<ClaudeCodeAccount> {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  let status: { loggedIn?: unknown; email?: unknown };
  try {
    const out = await new Promise<string>((resolve, reject) => {
      execFile("claude", ["auth", "status", "--json"], { env, timeout: 10_000 }, (err, stdout) => {
        // A logged-out CLI may exit non-zero but still print its JSON status.
        if (stdout.trim()) resolve(stdout);
        else reject(err ?? new Error("empty output"));
      });
    });
    status = JSON.parse(out);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return { loggedIn: false, reason: code === "ENOENT" ? "cli-missing" : "unknown" };
  }

  if (status.loggedIn !== true) return { loggedIn: false, reason: "not-logged-in" };
  if (typeof status.email === "string" && status.email) return { loggedIn: true, email: status.email };
  return { loggedIn: true, email: await emailFromConfig() };
}

async function emailFromConfig(): Promise<string | null> {
  const dir = process.env.CLAUDE_CONFIG_DIR;
  const file = dir ? path.join(dir, ".claude.json") : path.join(homedir(), ".claude.json");
  try {
    const config = JSON.parse(await readFile(file, "utf8")) as { oauthAccount?: { emailAddress?: unknown } };
    const email = config.oauthAccount?.emailAddress;
    return typeof email === "string" && email ? email : null;
  } catch {
    return null;
  }
}
