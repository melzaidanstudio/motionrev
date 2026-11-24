import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TalkingHeadRow } from "../db";
import { talkingHeadDir } from "../paths";
import { projectDir } from "./render";

/** motlab notes left in the viewer for this job's project that are not marked done yet. */
export function openNotes(t: TalkingHeadRow): number {
  try {
    const sel = JSON.parse(fs.readFileSync(path.join(projectDir(talkingHeadDir(t.id), t.id), "selection.json"), "utf8")) as {
      marks?: { done?: boolean; project?: string }[];
    };
    return (sel.marks ?? []).filter((m) => !m.done && (!m.project || m.project === "project.json")).length;
  } catch {
    return 0;
  }
}
