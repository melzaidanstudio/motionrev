"use client";

import { useId, useState } from "react";
import type { BillingSettings } from "@/lib/settings";

export function BillingForm({ initial }: { initial: BillingSettings }) {
  const [price, setPrice] = useState(String(initial.pricePerAnalysis));
  const [bonus, setBonus] = useState(String(initial.signupBonus));
  const [instr, setInstr] = useState(initial.buyInstructions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = { p: useId(), b: useId(), i: useId() };

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billing: { pricePerAnalysis: Number(price), signupBonus: Number(bonus), buyInstructions: instr },
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Tersimpan." } : { ok: false, text: j.error ?? "Gagal menyimpan." });
  }

  return (
    <section aria-labelledby="billing-h" className="panel p-5">
      <h2 id="billing-h" className="text-base font-semibold">
        Kredit
      </h2>
      <p className="mt-1 text-sm text-muted">
        Harga analisis dan bonus akun baru. Untuk pembayaran di luar doit.id, tambahkan kredit manual
        di tabel pengguna di bawah.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id.p} className="block text-sm font-medium">
            Kredit per analisis
          </label>
          <input id={id.p} type="number" min={0} max={1000} className="field mt-1 font-mono" value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label htmlFor={id.b} className="block text-sm font-medium">
            Bonus kredit akun baru
          </label>
          <input id={id.b} type="number" min={0} max={1000} className="field mt-1 font-mono" value={bonus} onChange={(e) => setBonus(e.target.value)} disabled={busy} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id.i} className="block text-sm font-medium">
            Catatan pembelian (tampil di halaman Kredit, mis. cara bayar manual)
          </label>
          <textarea
            id={id.i}
            rows={4}
            className="field mt-1"
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="Harga paket, rekening atau e-wallet tujuan, dan kontak konfirmasi"
            disabled={busy}
          />
        </div>
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-4 text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
      <button type="button" className="btn btn-primary mt-5" onClick={save} disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan kredit"}
      </button>
    </section>
  );
}
