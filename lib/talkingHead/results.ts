import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TalkingHeadRow } from "../db";
import { talkingHeadDir } from "../paths";
import { projectDir } from "./render";

/** Whether the job's motlab project can still be opened in the editor (project file and footage present). */
export function canOpenEditor(t: TalkingHeadRow): boolean {
  if (t.status !== "done") return false;
  const proj = projectDir(talkingHeadDir(t.id), t.id);
  return fs.existsSync(path.join(proj, "project.json")) && fs.existsSync(path.join(proj, "footage"));
}

/**
 * The MP4 to show for a job: the newest export made in the motlab viewer (project out/), or the app's own
 * render (out/final.mp4). Returns a path relative to the job folder, or null when there is none yet.
 */
export function latestVideo(t: TalkingHeadRow): string | null {
  const dir = talkingHeadDir(t.id);
  const candidates: { rel: string; at: number }[] = [];
  const exports = path.join(projectDir(dir, t.id), "out");
  try {
    for (const f of fs.readdirSync(exports)) {
      if (!/\.mp4$/i.test(f)) continue;
      const st = fs.statSync(path.join(exports, f));
      if (st.size > 10_000) candidates.push({ rel: path.relative(dir, path.join(exports, f)), at: st.mtimeMs });
    }
  } catch {}
  if (t.output) {
    try {
      candidates.push({ rel: t.output, at: fs.statSync(path.join(dir, t.output)).mtimeMs });
    } catch {}
  }
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0]?.rel ?? null;
}
