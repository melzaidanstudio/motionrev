"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TalkingHeadRow } from "@/lib/db";
import { FOLLOW_STYLE, fontById, paletteById, styleById } from "@/lib/talkingHead/options";
import type { JobTiming } from "@/lib/talkingHead/eta";
import { QueuedInfo, RenderProgress, aboutMinutes } from "./RenderProgress";

const STATUS: Record<TalkingHeadRow["status"], string> = {
  queued: "Antre",
  rendering: "Dirender",
  done: "Selesai",
  error: "Gagal",
};

/** Per finished job: the video to play (with a version so a new export is not served from cache) and editor access. */
export type JobResult = { videoVersion: string | null; canEdit: boolean; openNotes: number };

/** The user's Talking Head jobs, newest first, with a delete button for ones not rendering. */
export function TalkingHeadQueue({
  items,
  timings,
  results,
}: {
  items: TalkingHeadRow[];
  timings: Record<string, JobTiming>;
  results: Record<string, JobResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openEditor(id: string) {
    // Open the tab now, inside the click, so the browser does not block it as a pop-up; point it at the viewer once
    // the server has started it.
    const tab = window.open("about:blank", "_blank");
    setOpening(id);
    setError(null);
    const res = await fetch(`/api/talking-heads/${id}/editor`, { method: "POST" });
    const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setOpening(null);
    if (!res.ok || !j.url) {
      tab?.close();
      return setError(j.error ?? "Editor motlab gagal dibuka.");
    }
    if (tab) tab.location.href = j.url;
    else window.location.assign(j.url);
  }

  if (items.length === 0) {
    return (
      <div className="panel p-5 text-sm">
        <p className="font-medium">Belum ada video.</p>
        <p className="mt-1 text-muted">Ikuti enam langkah di atas, lalu tekan &ldquo;Generate video&rdquo;. Hasilnya muncul di sini.</p>
      </div>
    );
  }

  /** Queue a round of work on the motlab notes, or take a waiting round back out of the queue. */
  async function notes(id: string, cancel = false) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/talking-heads/${id}/notes`, { method: cancel ? "DELETE" : "POST" });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setError(j.error ?? "Gagal.");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/talking-heads/${id}`, { method: "DELETE" });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setError(j.error ?? "Gagal menghapus.");
    router.refresh();
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="panel divide-y divide-line">
        {items.map((t) => {
          const s = styleById(t.style);
          const p = paletteById(t.palette === FOLLOW_STYLE ? (s?.palette ?? "") : t.palette);
          const f = fontById(t.font === FOLLOW_STYLE ? (s?.font ?? "") : t.font);
          return (
            <li key={t.id} className="flex flex-wrap items-start gap-3 p-3">
              <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                {(p?.colors ?? []).map((c) => (
                  <span key={c} className="h-8 w-2.5 rounded-[2px] border border-white/15" style={{ background: c }} />
                ))}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{t.source}</span>
                  <span className={`shrink-0 text-xs ${t.status === "error" ? "text-danger" : t.status === "done" ? "text-fg" : "text-accent"}`}>
                    {t.pending_task === "notes" && t.status !== "done" ? `${STATUS[t.status]}: catatan` : STATUS[t.status]}
                  </span>
                </div>
                <p className="truncate text-sm text-muted">
                  {s?.name ?? t.style} · {p?.name ?? "warna bawaan"} · {f?.name ?? "font bawaan"} ·{" "}
                  {t.cut_fill ? "Cut & Fill" : "rekaman utuh"} · {t.mode === "editor" ? "Editor Mode" : "Generate"}
                </p>
                {(() => {
                  const tm = timings[t.id];
                  if (t.status === "error") return <p className="mt-0.5 text-xs text-danger">{t.error}</p>;
                  if (tm?.kind === "rendering")
                    return (
                      <RenderProgress
                        {...tm.progress}
                        step={t.step}
                        cutFill={!!t.cut_fill}
                        editor={t.mode === "editor"}
                        notes={t.pending_task === "notes"}
                      />
                    );
                  if (tm?.kind === "queued") return <QueuedInfo position={tm.position} startsIn={tm.startsIn} asOf={tm.asOf} />;
                  if (t.status === "done" && t.error) return <p className="mt-0.5 text-xs text-danger">{t.error}</p>;
                  if (tm?.kind === "done" && tm.tookSeconds) {
                    return <p className="mt-0.5 text-xs text-muted">Selesai dalam {aboutMinutes(tm.tookSeconds).replace("± ", "")}</p>;
                  }
                  if (t.status === "rendering") return <p className="mt-0.5 text-xs text-muted">{t.step}…</p>;
                  return null;
                })()}
                {t.status === "done" && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {results[t.id]?.videoVersion && (
                      <video
                        key={results[t.id].videoVersion}
                        src={`/api/talking-heads/${t.id}/video?v=${results[t.id].videoVersion}`}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-[9/16] w-40 border border-line bg-bg"
                      />
                    )}
                    <div className="flex flex-col gap-2">
                      {results[t.id]?.videoVersion && (
                        <a href={`/api/talking-heads/${t.id}/video?download=1&v=${results[t.id].videoVersion}`} className="btn btn-primary text-sm" download>
                          Unduh MP4
                        </a>
                      )}
                      {results[t.id]?.canEdit && (
                        <button type="button" className="btn text-sm" onClick={() => openEditor(t.id)} disabled={opening === t.id}>
                          {opening === t.id ? "Membuka editor…" : "Editor Mode"}
                        </button>
                      )}
                      {results[t.id]?.canEdit &&
                        (results[t.id].openNotes > 0 ? (
                          <button type="button" className="btn text-sm" onClick={() => notes(t.id)} disabled={busy === t.id}>
                            {busy === t.id ? "Memasukkan ke antrean…" : `Kerjakan catatan (${results[t.id].openNotes})`}
                          </button>
                        ) : (
                          <p className="max-w-64 text-xs text-muted">
                            Ada yang mau diubah? Buka Editor Mode, tandai bagiannya dan tulis catatan, lalu kembali ke sini untuk
                            &ldquo;Kerjakan catatan&rdquo;.
                          </p>
                        ))}
                      {t.mode === "editor" && !results[t.id]?.videoVersion && (
                        <p className="max-w-64 text-xs text-muted">
                          Proyeknya sudah siap di editor motlab. Tekan Export di sana dan pilih &ldquo;1&rdquo; pada Scene yang
                          dirender bersamaan (batas 4 thread); hasil MP4-nya otomatis muncul di sini.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {t.status === "done" && t.revision_summary && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted hover:text-fg">Perubahan dari catatan terakhir</summary>
                    <p className="mt-2 whitespace-pre-line rounded-[3px] border border-line bg-bg p-3 text-xs leading-relaxed">
                      {t.revision_summary}
                    </p>
                  </details>
                )}
              </div>
              {t.status === "queued" && t.pending_task === "notes" ? (
                <button type="button" className="btn min-h-11 text-sm" onClick={() => notes(t.id, true)} disabled={busy === t.id}>
                  {busy === t.id ? "Membatalkan…" : "Batalkan catatan"}
                </button>
              ) : t.status !== "rendering" && (
                <button
                  type="button"
                  className="btn btn-danger min-h-11 text-sm"
                  onClick={() => remove(t.id)}
                  disabled={busy === t.id}
                  aria-label={`Hapus ${t.source}`}
                >
                  {busy === t.id ? "Menghapus…" : "Hapus"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
