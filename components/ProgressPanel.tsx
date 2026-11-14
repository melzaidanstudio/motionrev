/** The timeline scrubber: a ruler with an amber playhead at the real progress value. */
export function ProgressPanel({ progress, step }: { progress: number; step: string }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="panel mt-6 p-4" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-fg">{step}</span>
        <span className="font-mono text-xs text-muted">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Kemajuan analisis"
        className="relative mt-3 h-6 overflow-hidden rounded-ui border border-line bg-bg"
      >
        <div className="ruler absolute inset-x-0 bottom-0" aria-hidden="true" />
        <div className="absolute inset-y-0 left-0 bg-panel-2" style={{ width: `${pct}%` }} aria-hidden="true" />
        <div
          className="absolute inset-y-0 w-0.5 bg-accent transition-[left] duration-500"
          style={{ left: `calc(${pct}% - 1px)` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Halaman ini memperbarui diri setiap 3 detik. Boleh ditinggal; hasil tersimpan di pustaka.
      </p>
    </div>
  );
}
