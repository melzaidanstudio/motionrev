import "server-only";
import { getTalkingHead, listTalkingHeadBacklog, type TalkingHeadRow } from "../db";
import { talkingHeadDir } from "../paths";
import { clipDuration, expectedSeconds, progressOf, readStatus, type ProgressView } from "./progress";

/** What the queue list shows under one job, computed on the server at each refresh. */
export type JobTiming =
  | { kind: "rendering"; progress: ProgressView }
  | { kind: "queued"; position: number; startsIn: number; duration: number | null; asOf: string }
  | { kind: "done"; tookSeconds: number | null }
  | { kind: "none" };

export function timingsFor(items: TalkingHeadRow[]): Record<string, JobTiming> {
  const now = Date.now();
  const out: Record<string, JobTiming> = {};

  // Walk the global backlog in worker order, adding up how long everything ahead will take.
  let ahead = 0;
  let position = 0;
  const backlog = items.some((t) => t.status === "queued" || t.status === "rendering") ? listTalkingHeadBacklog() : [];
  const mine = new Set(items.map((t) => t.id));
  for (const b of backlog) {
    const dir = talkingHeadDir(b.id);
    const duration = clipDuration(dir);
    if (b.status === "rendering") {
      const s = readStatus(dir);
      const p = s ? progressOf(s, duration, now) : null;
      if (p && mine.has(b.id)) out[b.id] = { kind: "rendering", progress: p };
      ahead += p ? p.remaining : expectedSeconds(duration);
    } else {
      position += 1;
      if (mine.has(b.id)) {
        out[b.id] = { kind: "queued", position, startsIn: ahead, duration, asOf: new Date(now).toISOString() };
      }
      ahead += expectedSeconds(duration);
    }
  }

  for (const t of items) {
    if (out[t.id]) continue;
    if (t.status === "done") {
      const s = readStatus(talkingHeadDir(t.id));
      const took = s ? Math.round((Date.parse(t.updated_at) - Date.parse(s.startedAt)) / 1000) : null;
      out[t.id] = { kind: "done", tookSeconds: took && took > 0 ? took : null };
    } else {
      out[t.id] = { kind: "none" };
    }
  }
  return out;
}

export { getTalkingHead };
