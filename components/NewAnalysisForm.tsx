"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "url" | "file";

export function NewAnalysisForm({ price, balance }: { price: number; balance: number }) {
  const router = useRouter();
  const enough = balance >= price;
  const [mode, setMode] = useState<Mode>("url");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), url: useId(), file: useId(), err: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Beri nama dulu, misalnya nama kreator atau seri videonya.");
    if (mode === "url" && !/^https?:\/\//i.test(url.trim())) return setError("Link harus diawali http:// atau https://.");
    if (mode === "file" && !file) return setError("Pilih file video dulu.");

    const fd = new FormData();
    fd.set("name", name.trim());
    if (mode === "url") fd.set("url", url.trim());
    else if (file) fd.set("file", file);

    setBusy(true);
    try {
      const res = await fetch("/api/analyses", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !j.id) throw new Error(j.error || `Server menjawab ${res.status}.`);
      router.push(`/a/${j.id}`);
      router.refresh(); // header balance
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim.");
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`min-h-11 px-3 text-sm border-b-2 -mb-px ${
        mode === m ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="panel p-4 md:p-5" aria-describedby={error ? ids.err : undefined}>
      <h2 className="text-base font-semibold">Bedah video baru</h2>
      <p className="mt-1 text-sm text-muted">
        Hasilnya: nama, deskripsi, frame kunci, dan SKILL.md yang bisa diunduh.
      </p>

      <label htmlFor={ids.name} className="mt-5 block text-sm font-medium">
        Nama
      </label>
      <input
        id={ids.name}
        className="field mt-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama gaya atau kreatornya"
        maxLength={80}
        disabled={busy}
        autoComplete="off"
      />

      <div role="tablist" aria-label="Sumber video" className="mt-5 flex gap-2 border-b border-line">
        {tab("url", "Link video")}
        {tab("file", "Unggah file")}
      </div>

      {/* Distinct keys: both panels share the same element shape, so without them React would
          reuse the controlled URL <input> as the file input and warn about controlled→uncontrolled. */}
      {mode === "url" ? (
        <div key="url" role="tabpanel" className="mt-3">
          <label htmlFor={ids.url} className="block text-sm font-medium">
            Link
          </label>
          <input
            id={ids.url}
            className="field mt-1 font-mono text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            inputMode="url"
            disabled={busy}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted">YouTube, TikTok, Instagram, dan situs lain yang didukung yt-dlp.</p>
        </div>
      ) : (
        <div key="file" role="tabpanel" className="mt-3">
          <label htmlFor={ids.file} className="block text-sm font-medium">
            File video
          </label>
          <input
            id={ids.file}
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm,.m4v"
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-ui file:border file:border-line-2 file:bg-panel-2 file:px-3 file:text-fg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <p className="mt-1 text-xs text-muted">
            {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "mp4, mov, mkv, webm. Maksimal 500 MB, 15 menit."}
          </p>
        </div>
      )}

      {error && (
        <p id={ids.err} role="alert" className="mt-4 rounded-ui border border-danger-line px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!enough && (
        <p className="mt-4 rounded-ui border border-line-2 px-3 py-2 text-sm">
          Saldo {balance} kredit, satu analisis butuh {price}.{" "}
          <Link href="/kredit" className="text-accent underline">
            Beli kredit
          </Link>
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy || !enough}>
          {busy ? (mode === "file" ? "Mengunggah…" : "Mengirim…") : "Mulai bedah"}
        </button>
        <span className="text-xs text-muted">
          {price > 0 ? `${price} kredit · ` : ""}1–5 menit tergantung durasi.
        </span>
      </div>
    </form>
  );
}
