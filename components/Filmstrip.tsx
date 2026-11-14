import type { FrameRow } from "@/lib/db";
import { timecode } from "@/lib/format";

export function Filmstrip({
  id,
  frames,
  cover,
  duration,
  width,
  height,
}: {
  id: string;
  frames: FrameRow[];
  cover: string | null;
  duration: number;
  width: number;
  height: number;
}) {
  // Tiles keep the video's own aspect: tall tiles for portrait, wide tiles for landscape.
  const landscape = width > height;
  // Shot numbers count only shot-start frames; uniform samples sit between them.
  let shotNo = 0;
  const labels = frames.map((f) => (f.kind === "cut" ? `shot ${++shotNo}` : "sampel"));
  return (
    <div className="panel overflow-x-auto">
      <ol className="flex gap-2 p-3">
        {frames.map((f, i) => {
          const isCover = f.file === cover;
          return (
            <li key={f.id} className={`shrink-0 ${landscape ? "w-56" : "w-36"}`}>
              <a
                href={`/api/analyses/${id}/frames/${f.file}`}
                target="_blank"
                rel="noopener"
                className={`block overflow-hidden rounded-ui border ${isCover ? "border-accent" : "border-line"}`}
                aria-label={`Frame ${f.idx} pada ${timecode(f.t)}, buka ukuran penuh`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/analyses/${id}/frames/${f.file}`}
                  alt=""
                  className="w-full bg-bg object-contain"
                  style={{ aspectRatio: `${width} / ${height}` }}
                  loading="lazy"
                />
              </a>
              <div className="mt-1 flex items-baseline justify-between font-mono text-[11px] text-muted">
                <span className={isCover ? "text-accent" : undefined}>{timecode(f.t)}</span>
                <span>{labels[i]}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {duration > 0 && (
        <div className="relative mx-3 mb-3 h-3" aria-hidden="true">
          <div className="ruler absolute inset-x-0 bottom-0" />
          {frames.map((f) => (
            <span
              key={f.id}
              className={`absolute bottom-0 h-3 w-px ${f.file === cover ? "bg-accent" : "bg-muted"}`}
              style={{ left: `${(f.t / duration) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
