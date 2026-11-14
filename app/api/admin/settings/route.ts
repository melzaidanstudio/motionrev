import { z } from "zod";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import {
  getAiSettingsPublic,
  getBillingSettings,
  getPaymentSettingsPublic,
  getStorageSettings,
  saveAiSettings,
  saveBillingSettings,
  savePaymentSettings,
  saveStorageSettings,
} from "@/lib/settings";

export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  return Response.json({
    ai: getAiSettingsPublic(),
    billing: getBillingSettings(),
    storage: getStorageSettings(),
    payments: getPaymentSettingsPublic(),
  });
}

const PaymentsInput = z.object({
  provider: z.enum(["none", "doit"]),
  apiKey: z
    .string()
    .max(300)
    .optional()
    .refine((k) => !k || /^pb_(test|live)_/.test(k.trim()), "Kunci doit.id diawali pb_test_ atau pb_live_."),
  webhookSecret: z.string().max(300).optional(),
  packages: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_-]{1,32}$/, "ID paket: huruf kecil, angka, - atau _."),
        name: z.string().min(1).max(60),
        credits: z.number().int().min(1).max(100000),
        price: z.number().int().min(1000, "Harga minimal Rp1.000.").max(100_000_000),
      }),
    )
    .max(8),
});

const AiInput = z.object({
  provider: z.enum(["anthropic", "openrouter", "custom", "claude-code"]),
  model: z.string().max(120),
  baseUrl: z.string().max(300),
  authHeader: z.enum(["x-api-key", "bearer"]),
  apiKey: z.string().max(500).optional(),
  clearKey: z.boolean().optional(),
});

const StorageInput = z.object({
  deleteSourceAfterDone: z.boolean(),
});

const BillingInput = z.object({
  pricePerAnalysis: z.number().int().min(0).max(1000),
  signupBonus: z.number().int().min(0).max(1000),
  buyInstructions: z.string().max(2000),
});

export async function PUT(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireAdmin();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => null)) as { ai?: unknown; billing?: unknown; payments?: unknown; storage?: unknown } | null;
  if (!body) return Response.json({ error: "Isi permintaan bukan JSON." }, { status: 400 });

  if (body.ai !== undefined) {
    const p = AiInput.safeParse(body.ai);
    if (!p.success) return Response.json({ error: `Pengaturan AI tidak valid: ${p.error.issues[0]?.message}` }, { status: 400 });
    if (p.data.provider === "custom" && !/^https?:\/\//.test(p.data.baseUrl.trim())) {
      return Response.json({ error: "Base URL endpoint harus diawali http:// atau https://." }, { status: 400 });
    }
    saveAiSettings(p.data);
  }
  if (body.billing !== undefined) {
    const p = BillingInput.safeParse(body.billing);
    if (!p.success) return Response.json({ error: `Pengaturan kredit tidak valid: ${p.error.issues[0]?.message}` }, { status: 400 });
    saveBillingSettings(p.data);
  }
  if (body.storage !== undefined) {
    const p = StorageInput.safeParse(body.storage);
    if (!p.success) return Response.json({ error: "Pengaturan penyimpanan tidak valid." }, { status: 400 });
    saveStorageSettings(p.data);
  }
  if (body.payments !== undefined) {
    const p = PaymentsInput.safeParse(body.payments);
    if (!p.success) return Response.json({ error: `Pengaturan pembayaran tidak valid: ${p.error.issues[0]?.message}` }, { status: 400 });
    const ids = new Set(p.data.packages.map((x) => x.id));
    if (ids.size !== p.data.packages.length) return Response.json({ error: "ID paket tidak boleh kembar." }, { status: 400 });
    savePaymentSettings(p.data);
  }
  return Response.json({
    ai: getAiSettingsPublic(),
    billing: getBillingSettings(),
    storage: getStorageSettings(),
    payments: getPaymentSettingsPublic(),
  });
}
