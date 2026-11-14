"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditPackage, PaymentSettingsPublic } from "@/lib/settings";
import { rupiah } from "@/lib/format";

type Row = { id: string; name: string; credits: string; price: string };

const toRows = (p: CreditPackage[]): Row[] =>
  p.map((x) => ({ id: x.id, name: x.name, credits: String(x.credits), price: String(x.price) }));

export function PaymentForm({ initial, webhookUrl }: { initial: PaymentSettingsPublic; webhookUrl: string }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.provider === "doit");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [rows, setRows] = useState<Row[]>(
    initial.packages.length ? toRows(initial.packages) : [{ id: "p10", name: "10 kredit", credits: "10", price: "" }],
  );
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const id = { en: useId(), key: useId(), sec: useId(), hook: useId() };

  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save() {
    setBusy(true);
    setMsg(null);
    const packages = rows
      .filter((r) => r.name.trim() || r.price.trim())
      .map((r) => ({ id: r.id.trim(), name: r.name.trim(), credits: Number(r.credits), price: Number(r.price) }));
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payments: { provider: enabled ? "doit" : "none", apiKey: apiKey || undefined, webhookSecret: secret || undefined, packages },
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Gagal menyimpan." });
    setApiKey("");
    setSecret("");
    setState(j.payments);
    setMsg({ ok: true, text: "Tersimpan." });
    router.refresh();
  }

  const warnings: string[] = [];
  if (enabled && !state.apiKeyMasked && !apiKey) warnings.push("Kunci API doit.id belum diisi; paket tidak akan tampil ke pembeli.");
  if (enabled && !state.webhookSecretSet && !secret)
    warnings.push("Signing secret belum diisi; webhook akan ditolak dan kredit hanya masuk saat pembeli menekan Cek status.");

  return (
    <section aria-labelledby="pay-h" className="panel p-5">
      <h2 id="pay-h" className="text-base font-semibold">
        Pembayaran online (doit.id)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Pembeli memilih paket di halaman Kredit, membayar di halaman doit.id (QRIS, VA, atau transfer), lalu kredit masuk
        otomatis setelah status lunas dicek ke API doit.id.
      </p>

      <label htmlFor={id.en} className="mt-5 flex min-h-11 items-center gap-3 text-sm font-medium">
        <input id={id.en} type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={busy} />
        Aktifkan pembelian kredit lewat doit.id
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={id.key} className="block text-sm font-medium">
            Kunci API{" "}
            {state.mode && <span className={`font-mono text-xs ${state.mode === "live" ? "text-accent" : "text-muted"}`}>({state.mode === "live" ? "LIVE" : "sandbox"})</span>}
          </label>
          <input
            id={id.key}
            type="password"
            className="field mt-1 font-mono text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={state.apiKeyMasked ? `Tersimpan: ${state.apiKeyMasked}` : "pb_test_… atau pb_live_…"}
            autoComplete="off"
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor={id.sec} className="block text-sm font-medium">
            Signing secret webhook
          </label>
          <input
            id={id.sec}
            type="password"
            className="field mt-1 font-mono text-sm"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={state.webhookSecretSet ? "Tersimpan. Kosongkan untuk tetap memakai." : "Dari menu Developer di portal doit.id"}
            autoComplete="off"
            disabled={busy}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={id.hook} className="block text-sm font-medium">
            URL webhook (tempel di portal doit.id, menu Developer)
          </label>
          <div className="mt-1 flex gap-2">
            <input id={id.hook} className="field font-mono text-sm" value={webhookUrl} readOnly />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(webhookUrl).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Harus bisa diakses dari internet (HTTPS). Di localhost, webhook tidak sampai; pakai tombol Cek status.</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Paket kredit</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-2 font-medium">ID</th>
              <th className="py-1 pr-2 font-medium">Nama</th>
              <th className="py-1 pr-2 font-medium">Kredit</th>
              <th className="py-1 pr-2 font-medium">Harga (Rp)</th>
              <th className="py-1 font-medium">
                <span className="sr-only">Hapus</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input aria-label={`ID paket ${i + 1}`} className="field !w-24 font-mono" value={r.id} onChange={(e) => set(i, "id", e.target.value)} disabled={busy} />
                </td>
                <td className="py-1 pr-2">
                  <input aria-label={`Nama paket ${i + 1}`} className="field !min-w-36" value={r.name} onChange={(e) => set(i, "name", e.target.value)} disabled={busy} />
                </td>
                <td className="py-1 pr-2">
                  <input aria-label={`Kredit paket ${i + 1}`} type="number" min={1} className="field !w-24 font-mono" value={r.credits} onChange={(e) => set(i, "credits", e.target.value)} disabled={busy} />
                </td>
                <td className="py-1 pr-2">
                  <input aria-label={`Harga paket ${i + 1}`} type="number" min={1000} step={1000} className="field !w-32 font-mono" value={r.price} onChange={(e) => set(i, "price", e.target.value)} placeholder="50000" disabled={busy} />
                </td>
                <td className="py-1">
                  <button type="button" className="btn btn-danger !min-h-10" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={busy} aria-label={`Hapus paket ${i + 1}`}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length < 8 && (
        <button
          type="button"
          className="btn mt-2"
          onClick={() => setRows((x) => [...x, { id: `p${x.length + 1}`, name: "", credits: "", price: "" }])}
          disabled={busy}
        >
          Tambah paket
        </button>
      )}
      {rows.some((r) => Number(r.price) >= 1000 && Number(r.credits) > 0) && (
        <p className="mt-2 text-xs text-muted">
          {rows
            .filter((r) => Number(r.price) >= 1000 && Number(r.credits) > 0)
            .map((r) => `${r.name || r.id}: ${rupiah(Math.round(Number(r.price) / Number(r.credits)))}/kredit`)
            .join(" · ")}
        </p>
      )}

      {warnings.map((w) => (
        <p key={w} className="mt-3 text-sm text-danger">
          {w}
        </p>
      ))}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
      <button type="button" className="btn btn-primary mt-4" onClick={save} disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan pembayaran"}
      </button>
    </section>
  );
}
