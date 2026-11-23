/** Provider constants shared by server code and the admin form (no server imports here). */

export type ProviderKind = "anthropic" | "openrouter" | "meta" | "custom" | "claude-code";

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  anthropic: "Anthropic (langsung)",
  openrouter: "OpenRouter",
  meta: "Meta Muse (Meta Model API)",
  custom: "Endpoint lain (kompatibel Anthropic)",
  "claude-code": "Claude Code lokal (pribadi/dev saja)",
};

export const DEFAULT_MODEL: Record<ProviderKind, string> = {
  anthropic: "claude-opus-5-5",
  openrouter: "anthropic/claude-opus-5",
  meta: "muse-spark-1.3",
  custom: "claude-opus-5-5",
  "claude-code": "opus",
};

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
/** Meta Model API serves the Anthropic Messages format at /v1/messages; the SDK adds that path. */
export const META_BASE_URL = "https://api.meta.ai";
