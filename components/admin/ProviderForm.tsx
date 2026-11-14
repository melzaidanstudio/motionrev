"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiSettingsPublic } from "@/lib/settings";
import type { ClaudeCodeAccount } from "@/lib/claudeCodeAccount";
import { DEFAULT_MODEL, PROVIDER_LABEL as LABEL, type ProviderKind } from "@/lib/providers";

const HELP: Record<ProviderKind, string> = {
  anthropic: "Kunci dari platform.claude.com (diawali sk-ant-). Biaya per token ditagih ke akun Anthropic-mu.",
  openrouter: "Kunci dari openrouter.ai (diawali sk-or-). Memakai endpoint OpenRouter yang kompatibel dengan format Anthropic.",
  custom: "Gateway lain yang menerima format Messages API Anthropic. Isi base URL tanpa /v1/messages.",
  "claude-code":
    "Memakai CLI claude dan login Claude Code di server ini. Hanya untuk pemakaian pribadi atau pengujian, bukan untuk melayani pengguna lain.",
};

export function ProviderForm({ initial, claudeCode }: { initial: AiSettingsPublic; claudeCode: ClaudeCodeAccount }) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderKind>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [authHeader, setAuthHeader] = useState(initial.authHeader);
  const [apiKey, setApiKey] = useState("");
  const [masked, setMasked] = useState(initial.apiKeyMasked);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = { p: useId(), m: useId(), u: useId(), h: useId(), k: useId() };
  const needsKey = provider !== "claude-code";

  function pick(p: ProviderKind) {
    setProvider(p);
    // Switching provider resets the model to that provider's naming unless the admin typed one.
    if (Object.values(DEFAULT_MODEL).includes(model) || !model) setModel(DEFAULT_MODEL[p]);
  }

  async function save(clearKey = false) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: { provider, model, baseUrl, authHeader, apiKey: apiKey || undefined, clearKey } }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Gagal menyimpan." });
    setApiKey("");
    setMasked(j.ai?.apiKeyMasked ?? null);
    setMsg({ ok: true, text: "Tersimpan. Analisis berikutnya memakai pengaturan ini." });
    router.refresh();
  }

  return (
    <section aria-labelledby="provider-h" className="panel p-5">
      <h2 id="provider-h" className="text-base font-semibold">
        Penyedia AI
      </h2>
      <p className="mt-1 text-sm text-muted">
        Semua analisis pengguna berjalan dengan kunci ini. Kunci disimpan terenkripsi dan tidak pernah dikirim ke browser.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={id.p} className="block text-sm font-medium">
            Penyedia
          </label>
          <select id={id.p} className="field mt-1" value={provider} onChange={(e) => pick(e.target.value as ProviderKind)} disabled={busy}>
            {(Object.keys(LABEL) as ProviderKind[]).map((p) => (
              <option key={p} value={p}>
                {LABEL[p]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{HELP[provider]}</p>
          {provider === "claude-code" &&
            (claudeCode.loggedIn ? (
              <p className="mt-2 text-sm">
                <span className="text-muted">Login sebagai </span>
                <span className="font-mono">{claudeCode.email ?? "(email tidak terbaca)"}</span>
              </p>
            ) : claudeCode.reason === "cli-missing" ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                CLI <code className="font-mono">claude</code> tidak ditemukan di server ini. Pasang Claude Code dulu.
              </p>
            ) : claudeCode.reason === "not-logged-in" ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                CLI <code className="font-mono">claude</code> di server ini belum login, jadi analisis akan gagal. Buka
                terminal, jalankan <code className="font-mono">claude</code>, lalu ketik{" "}
                <code className="font-mono">/login</code>.
              </p>
            ) : (
              <p role="alert" className="mt-2 text-sm text-danger">
                Status login Claude Code tidak bisa dibaca. Coba jalankan{" "}
                <code className="font-mono">claude auth status</code> di terminal server.
              </p>
            ))}
        </div>

        <div>
          <label htmlFor={id.m} className="block text-sm font-medium">
            Model
          </label>
          <input id={id.m} className="field mt-1 font-mono text-sm" value={model} onChange={(e) => setModel(e.target.value)} disabled={busy} />
          <p className="mt-1 text-xs text-muted">Nama model sesuai penyedia, misalnya {DEFAULT_MODEL[provider]}.</p>
        </div>

        {provider === "custom" && (
          <>
            <div>
              <label htmlFor={id.u} className="block text-sm font-medium">
                Base URL
              </label>
              <input
                id={id.u}
                className="field mt-1 font-mono text-sm"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://gateway.contoh.com/api"
                inputMode="url"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={id.h} className="block text-sm font-medium">
                Header kunci
              </label>
              <select
                id={id.h}
                className="field mt-1"
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value as "x-api-key" | "bearer")}
                disabled={busy}
              >
                <option value="x-api-key">x-api-key</option>
                <option value="bearer">Authorization: Bearer</option>
              </select>
            </div>
          </>
        )}

        {needsKey && (
          <div className="md:col-span-2">
            <label htmlFor={id.k} className="block text-sm font-medium">
              Kunci API
            </label>
            <input
              id={id.k}
              type="password"
              className="field mt-1 font-mono text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={masked ? `Tersimpan: ${masked}. Kosongkan untuk tetap memakai.` : "Tempel kunci API"}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        )}
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-4 text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => save()} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan penyedia"}
        </button>
        {needsKey && masked && (
          <button type="button" className="btn btn-danger" onClick={() => save(true)} disabled={busy}>
            Hapus kunci tersimpan
          </button>
        )}
      </div>
    </section>
  );
}
