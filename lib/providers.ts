/** Provider constants shared by server code and the admin form (no server imports here). */

export type ProviderKind = "anthropic" | "openrouter" | "custom" | "claude-code";

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  anthropic: "Anthropic (langsung)",
  openrouter: "OpenRouter",
  custom: "Endpoint lain (kompatibel Anthropic)",
  "claude-code": "Claude Code lokal (pribadi/dev saja)",
};

export const DEFAULT_MODEL: Record<ProviderKind, string> = {
  anthropic: "claude-opus-5-5",
  openrouter: "anthropic/claude-opus-5",
  custom: "claude-opus-5-5",
  "claude-code": "opus",
};

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
