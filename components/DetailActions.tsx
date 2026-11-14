"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Status } from "@/lib/db";
import { isRunning } from "@/lib/status";

export function DetailActions({
  id,
  status,
  hasSkill,
  sourceDeleted,
}: {
  id: string;
  status: Status;
  hasSkill: boolean;
  /** The uploaded video is gone from the server, so there is nothing to re-run on. */
  sourceDeleted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"rerun" | "delete" | null>(null);
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
