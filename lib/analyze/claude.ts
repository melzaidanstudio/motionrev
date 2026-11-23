import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AnalysisSchema, type Analysis } from "./schema";
import { SYSTEM, closingInstruction, factsText, frameLabel, type AnalyzeInput } from "./prompt";
import { META_BASE_URL, OPENROUTER_BASE_URL, getApiKey, type AiSettings } from "../settings";

/**
 * Engine for every Anthropic Messages-compatible provider: Anthropic itself, OpenRouter's
 * Anthropic-compatible endpoint, Meta Model API (Muse), or another gateway the admin configures. Always the official SDK.
 */
export async function analyzeWithApi(input: AnalyzeInput, s: AiSettings): Promise<Analysis> {
  const key = getApiKey(s);
  if (!key) throw new Error("Admin belum mengisi kunci API penyedia. Buka Admin, lalu Penyedia AI.");

  const client = makeClient(s, key);
  const content = buildContent(input);
  const isAnthropic = s.provider === "anthropic";

  try {
    return await runStructured(client, s.model, content, isAnthropic);
  } catch (e) {
    // Gateways may not implement structured output. Ask for JSON in the prompt instead and validate it.
    if (!isAnthropic && e instanceof Anthropic.BadRequestError) {
      return await runJsonPrompt(client, s.model, content);
    }
    throw describe(e);
  }
}

function makeClient(s: AiSettings, key: string): Anthropic {
  const opts = { maxRetries: 2, timeout: 15 * 60 * 1000 };
  switch (s.provider) {
    case "anthropic":
      return new Anthropic({ ...opts, apiKey: key, authToken: null });
    case "openrouter":
      return new Anthropic({ ...opts, apiKey: null, authToken: key, baseURL: OPENROUTER_BASE_URL });
    case "meta":
      return new Anthropic({ ...opts, apiKey: null, authToken: key, baseURL: META_BASE_URL });
    case "custom":
      if (!s.baseUrl) throw new Error("Base URL endpoint belum diisi di pengaturan admin.");
      return s.authHeader === "bearer"
        ? new Anthropic({ ...opts, apiKey: null, authToken: key, baseURL: s.baseUrl })
        : new Anthropic({ ...opts, apiKey: key, authToken: null, baseURL: s.baseUrl });
    default:
      throw new Error(`Penyedia ${s.provider} bukan penyedia API.`);
  }
}

function buildContent(input: AnalyzeInput): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: factsText(input) }];
  if (input.sheet) {
    content.push({ type: "text", text: "Contact sheet seluruh video, dibaca kiri ke kanan, atas ke bawah:" });
    content.push(image(path.join(input.framesDir, input.sheet)));
  }
  for (const f of input.frames) {
    content.push({ type: "text", text: frameLabel(f) });
    content.push(image(path.join(input.framesDir, f.file)));
  }
  content.push({ type: "text", text: closingInstruction(input) });
  return content;
}

async function runStructured(
  client: Anthropic,
  model: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  isAnthropic: boolean,
): Promise<Analysis> {
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: "high", format: betaZodOutputFormat(AnalysisSchema) },
    // Server-side refusal fallback exists only on Anthropic's own API.
    ...(isAnthropic ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const msg = await stream.finalMessage();
  checkStop(msg.stop_reason);
  if (!msg.parsed_output) throw new Error("Jawaban model tidak bisa dibaca sebagai JSON terstruktur.");
  return msg.parsed_output;
}

async function runJsonPrompt(
  client: Anthropic,
  model: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
): Promise<Analysis> {
  const schema = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>;
  delete schema.$schema;
  const system =
    SYSTEM +
    "\n\nKeluaran: satu objek JSON valid yang cocok dengan JSON Schema berikut, tanpa teks lain, tanpa pagar kode.\n" +
    JSON.stringify(schema);

  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages
      .stream({ model, max_tokens: 16000, system, messages: [{ role: "user", content }] })
      .finalMessage();
  } catch (e) {
    throw describe(e);
  }
  checkStop(msg.stop_reason);
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = AnalysisSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new Error(`Jawaban model tidak cocok dengan skema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

function checkStop(stop: string | null) {
  if (stop === "refusal") throw new Error("Model menolak menganalisis video ini (stop_reason: refusal).");
  if (stop === "max_tokens") throw new Error("Jawaban model terpotong (max_tokens). Coba lagi dengan video yang lebih pendek.");
}

/** Take the outermost {...} from a reply, tolerating ```json fences or a stray sentence. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function describe(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error("Kunci API penyedia ditolak (401). Periksa kunci di pengaturan admin.");
  if (e instanceof Anthropic.PermissionDeniedError) return new Error("Kunci API tidak punya akses ke model ini (403).");
  if (e instanceof Anthropic.NotFoundError) return new Error("Model atau endpoint tidak ditemukan (404). Periksa nama model dan base URL.");
  if (e instanceof Anthropic.RateLimitError) return new Error("Batas laju atau saldo penyedia habis (429). Coba lagi nanti.");
  if (e instanceof Anthropic.APIConnectionError) return new Error(`Tidak bisa terhubung ke penyedia: ${e.message}`);
  if (e instanceof Anthropic.APIError) return new Error(`Penyedia menjawab ${e.status}: ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

function image(file: string): Anthropic.Beta.BetaImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(file).toString("base64") },
  };
}
