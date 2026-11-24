"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { email: useId(), pw: useId(), err: useId() };
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || `Server menjawab ${res.status}.`);
      router.push("/beranda");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mx-auto max-w-sm p-5" aria-describedby={error ? ids.err : undefined}>
      <h1 className="text-lg font-semibold">{isLogin ? "Masuk" : "Buat akun"}</h1>
      <p className="mt-1 text-sm text-muted">
        {isLogin ? "Masuk untuk membuka pustaka dan saldo kreditmu." : "Akun menyimpan hasil bedah dan saldo kreditmu."}
      </p>

      <label htmlFor={ids.email} className="mt-5 block text-sm font-medium">
        Email
      </label>
      <input
        id={ids.email}
        type="email"
        className="field mt-1"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        disabled={busy}
      />

      <label htmlFor={ids.pw} className="mt-4 block text-sm font-medium">
        Kata sandi
      </label>
      <input
        id={ids.pw}
        type="password"
        className="field mt-1"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={isLogin ? "current-password" : "new-password"}
        minLength={isLogin ? undefined : 8}
        required
        disabled={busy}
      />
      {!isLogin && <p className="mt-1 text-xs text-muted">Minimal 8 karakter.</p>}

      {error && (
        <p id={ids.err} role="alert" className="mt-4 rounded-ui border border-danger-line px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-5 w-full justify-center" disabled={busy}>
        {busy ? "Memproses…" : isLogin ? "Masuk" : "Buat akun"}
      </button>

      <p className="mt-4 text-sm text-muted">
        {isLogin ? (
          <>
            Belum punya akun?{" "}
            <Link href="/daftar" className="text-fg underline">
              Daftar
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link href="/masuk" className="text-fg underline">
              Masuk
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
