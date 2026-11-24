"use client";

import { useId, useState } from "react";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = { c: useId(), n: useId(), a: useId(), h: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "Kata sandi baru minimal 8 karakter." });
    if (next !== again) return setMsg({ ok: false, text: "Ulangan kata sandi baru tidak sama." });
    setBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Gagal mengganti kata sandi." });
    setCurrent("");
    setNext("");
    setAgain("");
    setMsg({ ok: true, text: "Kata sandi diganti. Perangkat lain yang masih masuk sudah dikeluarkan." });
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
      <div>
        <label htmlFor={id.c} className="block text-sm font-medium">
          Kata sandi sekarang
        </label>
        <input id={id.c} type="password" autoComplete="current-password" className="field mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} required />
      </div>
      <div>
        <label htmlFor={id.n} className="block text-sm font-medium">
          Kata sandi baru
        </label>
        <input
          id={id.n}
          type="password"
          autoComplete="new-password"
          className="field mt-1"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby={id.h}
          disabled={busy}
          required
        />
        <p id={id.h} className="mt-1 text-xs text-muted">
          Minimal 8 karakter.
        </p>
      </div>
      <div>
        <label htmlFor={id.a} className="block text-sm font-medium">
          Ulangi kata sandi baru
        </label>
        <input id={id.a} type="password" autoComplete="new-password" className="field mt-1" value={again} onChange={(e) => setAgain(e.target.value)} disabled={busy} required />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Ganti kata sandi"}
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
