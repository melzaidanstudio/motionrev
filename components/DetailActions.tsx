"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScriptStatus, Status } from "@/lib/db";
import { isRunning } from "@/lib/status";

export function DetailActions({
  id,
  status,
  hasSkill,
  sourceDeleted,
  hasScript,
  scriptEligible,
  scriptStatus,
  scriptBlocked,
}: {
  id: string;
  status: Status;
  hasSkill: boolean;
  /** The uploaded video is gone from the server, so there is nothing to re-run on. */
  sourceDeleted: boolean;
  hasScript: boolean;
  /** Only analyses from the script skill onwards get the button; older ones were left without on purpose. */
  scriptEligible: boolean;
  scriptStatus: ScriptStatus | null;
  /** Why no script skill can be made (no transcript and no video left), or null. */
  scriptBlocked: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"rerun" | "delete" | "script" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = isRunning(status);

  async function rerun() {
    setBusy("rerun");
    setError(null);
    const res = await fetch(`/api/analyses/${id}/rerun`, { method: "POST" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Gagal menjalankan ulang.");
    setBusy(null);
    router.refresh();
  }

  async function buildScript() {
    setBusy("script");
    setError(null);
    const res = await fetch(`/api/analyses/${id}/script`, { method: "POST" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Gagal menyusun SKILL naskah.");
    setBusy(null);
    router.refresh();
  }

  const scriptWorking = scriptStatus === "queued" || scriptStatus === "running";

  async function remove() {
    if (!window.confirm("Hapus analisis ini beserta video dan frame-nya? Tidak bisa dibatalkan.")) return;
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Gagal menghapus.");
      setBusy(null);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {hasSkill && (
          <>
            <a href={`/api/analyses/${id}/skill`} className="btn btn-primary" download>
              Unduh SKILL.md
            </a>
            <a href={`/api/analyses/${id}/skill?zip=1`} className="btn" download>
              Unduh zip + frame
            </a>
          </>
        )}
        {status === "done" &&
          scriptEligible &&
          (hasScript && !scriptWorking ? (
            <a
              href={`/api/analyses/${id}/script`}
              className="btn"
              download
              title="Pola dan nada naskah video ini, dibedah dari transkripnya, untuk menulis naskah baru yang terdengar sama"
            >
              Unduh SKILL naskah
            </a>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={buildScript}
              disabled={scriptWorking || busy !== null || Boolean(scriptBlocked)}
              title={scriptBlocked ?? "Transkrip audio lalu bedah pola dan nada naskahnya"}
            >
              {scriptWorking || busy === "script" ? "Menyusun SKILL naskah…" : "Buat SKILL naskah"}
            </button>
          ))}
        <button
          type="button"
          className="btn"
          onClick={rerun}
          disabled={running || busy !== null || sourceDeleted}
          title={sourceDeleted ? "Video unggahan sudah dihapus dari server" : undefined}
        >
          {busy === "rerun" ? "Mengantre…" : "Jalankan ulang"}
        </button>
        <button type="button" className="btn btn-danger" onClick={remove} disabled={running || busy !== null}>
          {busy === "delete" ? "Menghapus…" : "Hapus"}
        </button>
      </div>
      {sourceDeleted && !error && <p className="text-xs text-muted">Video unggahan sudah dihapus dari server.</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
