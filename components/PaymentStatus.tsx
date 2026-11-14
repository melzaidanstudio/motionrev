"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

interface P {
  id: string;
  status: "creating" | "pending" | "paid" | "expired" | "failed" | "refunded";
  credits: number;
  amount: number;
  package: string;
  hostedUrl: string | null;
  credited: boolean;
}

const LABEL: Record<P["status"], string> = {
  creating: "Membuat tagihan",
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  expired: "Kedaluwarsa",
  failed: "Gagal",
  refunded: "Dikembalikan",
};

/** Shown when doit.id sends the buyer back. Checks the payment with doit.id, then every 5 s while pending. */
export function PaymentStatus({ id }: { id: string }) {
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // No state is set before the first await, so effects can call this without a synchronous render.
  const check = useCallback(async () => {
    const res = await fetch(`/api/payments/${id}`);
    const j = (await res.json().catch(() => ({}))) as { payment?: P; error?: string; syncError?: string | null };
    if (!res.ok || !j.payment) return setError(j.error ?? "Pembayaran tidak ditemukan.");
    setError(j.syncError ? `Belum bisa mengecek ke doit.id: ${j.syncError}` : null);
    setP((prev) => {
      if (j.payment!.credited && !prev?.credited) router.refresh(); // update the balance shown on the page
      return j.payment!;
    });
  }, [id, router]);

  // First check right away, then every 5 s while the bill is pending. Each result is a new `p`,
  // which schedules the next check; a settled bill stops the loop.
  useEffect(() => {
    if (p && p.status !== "pending") return;
    const t = setTimeout(() => void check(), p ? 5000 : 0);
    return () => clearTimeout(t);
  }, [p, check]);

  if (error && !p) {
    return (
      <p role="alert" className="panel p-4 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (!p) return <p className="panel p-4 text-sm text-muted">Mengecek pembayaran…</p>;

  const tone = p.status === "paid" ? "text-accent" : p.status === "pending" ? "text-fg" : "text-danger";
  return (
    <div className="panel p-4 text-sm" aria-live="polite">
      <p>
        <span className={`font-medium ${tone}`}>{LABEL[p.status]}</span>
        <span className="text-muted">
          {" "}
          · {p.package} · {rupiah(p.amount)}
        </span>
      </p>
      {p.status === "paid" && <p className="mt-1">{p.credits} kredit sudah masuk ke saldomu.</p>}
      {p.status === "pending" && (
        <p className="mt-1 text-muted">
          Kalau sudah membayar, kredit masuk otomatis dalam beberapa detik setelah doit.id mengonfirmasi.
        </p>
      )}
      {error && <p className="mt-1 text-danger">{error}</p>}
      {p.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.hostedUrl && (
            <a href={p.hostedUrl} className="btn btn-primary">
              Lanjutkan pembayaran
            </a>
          )}
          <button
            type="button"
            className="btn"
            onClick={async () => {
              setChecking(true);
              await check();
              setChecking(false);
            }}
            disabled={checking}
          >
            {checking ? "Mengecek…" : "Cek status"}
          </button>
        </div>
      )}
    </div>
  );
}
