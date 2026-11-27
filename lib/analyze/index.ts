import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { AnalysisSchema, type Analysis } from "./schema";
import { SYSTEM, analysisRequest, evidenceList, type AnalyzeInput } from "./prompt";
import { runApiJson } from "./claude";
import { runClaudeCodeJson } from "./claudeCode";
import { PROVIDER_LABEL, getAiSettings } from "../settings";

/** An image the model must look at: a file in the frames folder and what it shows. */
export interface Evidence {
  file: string;
  label: string;
}

/**
 * One structured call with images, on whichever provider the admin configured. Claude Code reads the files with its
 * Read tool from the analysis folder; API providers get them inline.
 */
export async function runWithEvidence<T>(
  schema: z.ZodType<T>,
  o: {
    system: string;
    before: string;
    evidence: Evidence[];
    after: string;
    dir: string;
    framesDir: string;
    what: string;
    /** Claude Code only: thinking effort. The first draft gets the most, so it passes the audit on the first round. */
    effort?: "high" | "xhigh" | "max";
  },
): Promise<T> {
  const s = getAiSettings();
  if (s.provider === "claude-code") {
    const prompt = [
      o.before,
      "",
      "FILE GAMBAR (baca SEMUA dengan tool Read, satu per satu, sebelum menjawab; path relatif terhadap folder kerja):",
      ...o.evidence.map((e) => `- frames/${e.file}  ${e.label}`),
      "",
      o.after,
      "Jawab hanya dengan JSON sesuai skema yang diminta.",
    ].join("\n");
    return runClaudeCodeJson(schema, { system: o.system, prompt, cwd: o.dir, model: s.model, what: o.what, effort: o.effort });
  }
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: o.before }];
  for (const e of o.evidence) {
    content.push({ type: "text", text: e.label });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(path.join(o.framesDir, e.file)).toString("base64") },
    });
  }
  content.push({ type: "text", text: o.after });
  return runApiJson(s, schema, o.system, content);
}

/** Run the visual analysis on whichever provider the admin configured. */
export function analyzeVideo(input: AnalyzeInput): { label: string; run: Promise<Analysis> } {
  const label = PROVIDER_LABEL[getAiSettings().provider];
  const req = analysisRequest(input);
  const run = runWithEvidence(AnalysisSchema, {
    system: SYSTEM,
    before: req.before,
    evidence: evidenceList(input),
    after: req.after,
    dir: input.dir,
    framesDir: input.framesDir,
    what: "analisis",
    effort: "max",
  });
  return { label, run };
}
