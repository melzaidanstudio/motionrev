"use client";

import { useState } from "react";
import type { CreditPackage } from "@/lib/settings";
import { rupiah } from "@/lib/format";

export function BuyPackages({ packages }: { packages: CreditPackage[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: id }),
      });
      const j = (await res.json().catch(() => ({}))) as { hostedUrl?: string; error?: string };
      if (!res.ok || !j.hostedUrl) throw new Error(j.error || `Server menjawab ${res.status}.`);
      window.location.assign(j.hostedUrl); // doit.id's hosted page; it returns here when done
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat tagihan.");
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="grid gap-2">
        {packages.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-ui border border-line-2 px-3 py-2">
            <div className="min-w-0">
              <p className="font-medium">{p.name}</p>
              <p className="font-mono text-xs text-muted">
                {p.credits} kredit · {rupiah(Math.round(p.price / p.credits))}/kredit
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => buy(p.id)} disabled={busy !== null}>
              {busy === p.id ? "Membuka…" : `Bayar ${rupiah(p.price)}`}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Pembayaran lewat doit.id: QRIS, virtual account, atau transfer bank. Biaya metode bisa ditambahkan di halaman
        pembayaran.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
