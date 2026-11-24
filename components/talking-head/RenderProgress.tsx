"use client";

import { useEffect, useState } from "react";

export const PHASE_LABELS = [
  "Mempelajari style",
  "Transkrip & potong jeda",
  "Menyusun scene motlab",
  "Cek kualitas",
  "Render video",
  "Finishing",
] as const;

/**
 * Ticks once a second so elapsed and remaining time move between server refreshes. It starts from the
 * server's clock (`asOf`) so the first render matches the HTML the server sent.
 */
function useNow(asOf: string) {
  const [now, setNow] = useState(() => Date.parse(asOf));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function aboutMinutes(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `± ${Math.floor(m / 60)} jam ${m % 60} menit` : `± ${m} menit`;
}

function finishAt(now: number, sec: number): string {
  return new Date(now + sec * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** A running render: phase steps, a bar, how long it has run and when it should be done. */
export function RenderProgress({
  pct,
  phase,
  startedAt,
  remaining,
  asOf,
  step,
  cutFill,
  editor = false,
  notes = false,
}: {
  pct: number;
  phase: number;
  startedAt: string;
  remaining: number;
  asOf: string;
  step: string;
  cutFill: boolean;
  editor?: boolean;
  notes?: boolean;
}) {
  // Without Cut & Fill nothing is cut in step 2, it only transcribes.
  // Editor Mode stops before the render: the last step opens the motlab viewer instead.
  // A notes round starts at step 3, where the scenes are changed.
  const labels = PHASE_LABELS.map((l, i) =>
    notes && i === 2
      ? "Mengerjakan catatan"
      : i === 1 && !cutFill
        ? "Transkrip"
        : editor && i === 4
          ? "Siapkan editor"
          : editor && i === 5
            ? (notes ? "Selesai" : "Buka editor motlab")
            : l,
  );
  const now = useNow(asOf);
  const elapsed = (now - Date.parse(startedAt)) / 1000;
  const left = Math.max(30, remaining - (now - Date.parse(asOf)) / 1000);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-medium">{labels[phase]}</span>
          <span className="text-muted"> · langkah {phase + 1} dari {PHASE_LABELS.length}</span>
        </span>
        <span className="font-mono text-fg">{pct}%</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-bg"
        role="progressbar"
        aria-label="Kemajuan render"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct}%, ${labels[phase]}`}
      >
        <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-2 grid grid-cols-6 gap-1" aria-hidden="true">
        {labels.map((l, i) => (
          <li key={l} title={l} className={`h-1 rounded-[1px] ${i < phase ? "bg-accent/60" : i === phase ? "bg-accent" : "bg-line"}`} />
        ))}
      </ol>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted">Sudah berjalan</dt>
          <dd className="font-mono text-sm text-fg">{clock(elapsed)}</dd>
        </div>
        <div>
          <dt className="text-muted">Perkiraan sisa</dt>
          <dd className="text-sm text-fg">{aboutMinutes(left)}</dd>
        </div>
        <div>
          <dt className="text-muted">Perkiraan selesai</dt>
          <dd className="text-sm text-fg" suppressHydrationWarning>
            sekitar pukul {finishAt(now, left)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 truncate text-xs text-muted" title={step}>
        Sedang: {step}
      </p>
    </div>
  );
}

/** A waiting job: its place in line and when it should start. */
export function QueuedInfo({ position, startsIn, asOf }: { position: number; startsIn: number; asOf: string }) {
  const now = useNow(asOf);
  const left = Math.max(0, startsIn - (now - Date.parse(asOf)) / 1000);
  return (
    <p className="mt-1 text-xs text-muted" suppressHydrationWarning>
      {position === 1 && left < 60
        ? "Berikutnya, segera mulai."
        : `Antrean ke-${position} · mulai ${aboutMinutes(left)} lagi (sekitar pukul ${finishAt(now, left)})`}
    </p>
  );
}
