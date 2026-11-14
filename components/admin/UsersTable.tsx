"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserSummary } from "@/lib/db";

export function UsersTable({ users, currentUserId }: { users: UserSummary[]; currentUserId: string }) {
  return (
    <section aria-labelledby="users-h">
      <h2 id="users-h" className="text-base font-semibold">
        Pengguna
      </h2>
      <p className="mb-3 text-sm text-muted">
        Tambah kredit setelah pembayaran diterima. Angka negatif mengoreksi saldo. Semua perubahan tercatat di riwayat
        pengguna.
      </p>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Peran</th>
              <th className="px-4 py-2 text-right font-medium">Analisis</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Ubah kredit</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Row key={u.id} u={u} isSelf={u.id === currentUserId} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ u, isSelf }: { u: UserSummary; isSelf: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState(u.balance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    const delta = Number(amount);
    if (!Number.isInteger(delta) || delta === 0) return setError("Isi bilangan bulat selain 0.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Gagal.");
    setBalance(j.balance);
    setAmount("");
    setNote("");
    if (isSelf) router.refresh(); // header balance
  }

  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-4 py-3">
        {u.email}
        {isSelf && <span className="ml-2 text-xs text-muted">(kamu)</span>}
      </td>
      <td className="px-4 py-3 text-muted">{u.role === "admin" ? "admin" : "pengguna"}</td>
      <td className="px-4 py-3 text-right font-mono">{u.analyses}</td>
      <td className="px-4 py-3 text-right font-mono text-fg">{balance}</td>
      <td className="px-4 py-2">
        <form onSubmit={apply} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`Jumlah kredit untuk ${u.email}`}
            type="number"
            className="field !w-24 font-mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="+10"
            disabled={busy}
          />
          <input
            aria-label={`Catatan untuk ${u.email}`}
            className="field !w-44"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan, mis. transfer 8 Nov"
            maxLength={200}
            disabled={busy}
          />
          <button type="submit" className="btn !min-h-10" disabled={busy || !amount}>
            {busy ? "…" : "Terapkan"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
