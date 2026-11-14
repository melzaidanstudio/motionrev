import type { Analysis } from "./schema";
import type { AnalyzeInput } from "./prompt";
import { analyzeWithApi } from "./claude";
import { analyzeWithClaudeCode } from "./claudeCode";
import { PROVIDER_LABEL, getAiSettings } from "../settings";

/** Run the analysis on whichever provider the admin configured. */
export function analyzeVideo(input: AnalyzeInput): { label: string; run: Promise<Analysis> } {
  const s = getAiSettings();
  const label = PROVIDER_LABEL[s.provider];
  const run = s.provider === "claude-code" ? analyzeWithClaudeCode(input, s.model) : analyzeWithApi(input, s);
  return { label, run };
}
