import { getSetting, setSetting } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

import { DEFAULT_MODEL, type ProviderKind } from "./providers";
export { DEFAULT_MODEL, OPENROUTER_BASE_URL, PROVIDER_LABEL, type ProviderKind } from "./providers";

/**
 * Where analyses run, chosen by the admin.
 *   anthropic   Anthropic API directly (x-api-key)
 *   openrouter  OpenRouter's Anthropic-compatible endpoint (Bearer key)
 *   custom      any other Anthropic Messages-compatible endpoint
 *   claude-code the local `claude` CLI and its own login: personal or development use only
 */
export interface AiSettings {
  provider: ProviderKind;
  model: string;
  baseUrl: string; // used by "custom"; ignored by presets
  authHeader: "x-api-key" | "bearer"; // used by "custom"
  apiKeyEnc: string | null; // AES-GCM blob; never sent to the browser
}

export interface BillingSettings {
  pricePerAnalysis: number; // credits charged per run
  signupBonus: number; // credits given to a new account
  buyInstructions: string; // shown on the credits page: how to buy from the admin
}

const AI_KEY = "ai";
const BILLING_KEY = "billing";

/** Stored settings, or a default derived from the environment for a fresh install. */
export function getAiSettings(): AiSettings {
  const s = getSetting<AiSettings>(AI_KEY);
  if (s) return s;
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    return { provider: "anthropic", model: DEFAULT_MODEL.anthropic, baseUrl: "", authHeader: "x-api-key", apiKeyEnc: encryptSecret(envKey) };
  }
  return { provider: "claude-code", model: DEFAULT_MODEL["claude-code"], baseUrl: "", authHeader: "bearer", apiKeyEnc: null };
}

export function getApiKey(s: AiSettings): string | null {
  return s.apiKeyEnc ? decryptSecret(s.apiKeyEnc) : null;
}

export interface AiSettingsPublic extends Omit<AiSettings, "apiKeyEnc"> {
  apiKeyMasked: string | null;
  configured: boolean;
}

/** What the admin page may show: the key is masked. */
export function getAiSettingsPublic(): AiSettingsPublic {
  const s = getAiSettings();
  const key = getApiKey(s);
  const { apiKeyEnc: _omit, ...rest } = s;
  void _omit;
  return { ...rest, apiKeyMasked: key ? maskSecret(key) : null, configured: getSetting(AI_KEY) !== undefined };
}

export function saveAiSettings(input: {
  provider: ProviderKind;
  model: string;
  baseUrl: string;
  authHeader: "x-api-key" | "bearer";
  apiKey?: string; // empty or missing keeps the stored key
  clearKey?: boolean;
}) {
  const prev = getAiSettings();
  let apiKeyEnc = prev.apiKeyEnc;
  if (input.clearKey) apiKeyEnc = null;
  else if (input.apiKey && input.apiKey.trim()) apiKeyEnc = encryptSecret(input.apiKey.trim());
  setSetting(AI_KEY, {
    provider: input.provider,
    model: input.model.trim() || DEFAULT_MODEL[input.provider],
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
    authHeader: input.authHeader,
    apiKeyEnc,
  } satisfies AiSettings);
}

export function getBillingSettings(): BillingSettings {
  return (
    getSetting<BillingSettings>(BILLING_KEY) ?? {
      pricePerAnalysis: 1,
      signupBonus: 0,
      buyInstructions: "",
    }
  );
}

/** What one run costs this user. The admin runs analyses on their own key without spending credits. */
export function priceFor(user: { role: "admin" | "user" }): number {
  return user.role === "admin" ? 0 : getBillingSettings().pricePerAnalysis;
}

export function saveBillingSettings(b: BillingSettings) {
  setSetting(BILLING_KEY, b);
}

/* ---------------- payments ---------------- */

export interface CreditPackage {
  id: string; // stable key, e.g. "p10"
  name: string; // shown to buyers, e.g. "10 kredit"
  credits: number;
  price: number; // rupiah, whole number
}

export interface PaymentSettings {
  provider: "none" | "doit";
  apiKeyEnc: string | null; // pb_test_… or pb_live_…
  webhookSecretEnc: string | null; // signing secret from the doit.id Developer menu
  packages: CreditPackage[];
}

const PAYMENTS_KEY = "payments";

export function getPaymentSettings(): PaymentSettings {
  return getSetting<PaymentSettings>(PAYMENTS_KEY) ?? { provider: "none", apiKeyEnc: null, webhookSecretEnc: null, packages: [] };
}

export interface PaymentSettingsPublic {
  provider: "none" | "doit";
  apiKeyMasked: string | null;
  mode: "test" | "live" | null; // from the key prefix
  webhookSecretSet: boolean;
  packages: CreditPackage[];
}

export function getPaymentSettingsPublic(): PaymentSettingsPublic {
  const s = getPaymentSettings();
  const key = s.apiKeyEnc ? decryptSecret(s.apiKeyEnc) : null;
  return {
    provider: s.provider,
    apiKeyMasked: key ? maskSecret(key) : null,
    mode: key ? (key.startsWith("pb_live_") ? "live" : "test") : null,
    webhookSecretSet: Boolean(s.webhookSecretEnc),
    packages: s.packages,
  };
}

export function savePaymentSettings(input: {
  provider: "none" | "doit";
  apiKey?: string;
  webhookSecret?: string;
  packages: CreditPackage[];
}) {
  const prev = getPaymentSettings();
  setSetting(PAYMENTS_KEY, {
    provider: input.provider,
    apiKeyEnc: input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : prev.apiKeyEnc,
    webhookSecretEnc: input.webhookSecret?.trim() ? encryptSecret(input.webhookSecret.trim()) : prev.webhookSecretEnc,
    packages: input.packages,
  } satisfies PaymentSettings);
}

/** Packages buyers can pick, or none when online payment is off or not fully configured. */
export function getActivePackages(): CreditPackage[] {
  const s = getPaymentSettings();
  if (s.provider !== "doit" || !s.apiKeyEnc) return [];
  return s.packages.filter((p) => p.credits > 0 && p.price >= 1000);
}
