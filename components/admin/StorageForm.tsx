"use client";

import { useId, useState } from "react";
import type { StorageSettings } from "@/lib/settings";

export function StorageForm({ initial }: { initial: StorageSettings }) {
  const [deleteSource, setDeleteSource] = useState(initial.deleteSourceAfterDone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = { d: useId(), help: useId() };

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage: { deleteSourceAfterDone: deleteSource } }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Tersimpan. Berlaku untuk analisis yang selesai setelah ini." } : { ok: false, text: j.error ?? "Gagal menyimpan." });
  }

  return (
    <section aria-labelledby="storage-h" className="panel p-5">
      <h2 id="storage-h" className="text-base font-semibold">
        Penyimpanan
      </h2>
      <p className="mt-1 text-sm text-muted">Apa yang disimpan di server setelah analisis selesai.</p>

      <div className="mt-5 flex items-start gap-3">
        <input
          id={id.d}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
          checked={deleteSource}
          onChange={(e) => setDeleteSource(e.target.checked)}
          aria-describedby={id.help}
          disabled={busy}
        />
        <div>
          <label htmlFor={id.d} className="block text-sm font-medium">
            Hapus video referensi begitu SKILL.md jadi
          </label>
          <p id={id.help} className="mt-1 text-xs text-muted">
            Berlaku untuk video yang diunggah maupun yang diunduh dari link. Frame dan SKILL.md tetap disimpan, jadi
            zip skill masih bisa diunduh. Analisis dari file unggahan tidak bisa dijalankan ulang setelah videonya
            terhapus; analisis dari link akan mengunduh videonya lagi.
          </p>
        </div>
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-4 text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
      <button type="button" className="btn btn-primary mt-5" onClick={save} disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan penyimpanan"}
      </button>
    </section>
  );
}
