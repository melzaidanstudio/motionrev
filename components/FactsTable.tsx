import { timecode } from "@/lib/format";
import type { ProbeInfo } from "@/lib/video/probe";
import type { ShotStats } from "@/lib/video/scenes";

export interface StoredStats {
  probe: ProbeInfo;
  stats: ShotStats;
  cuts: number[];
}

export function FactsTable({ stats }: { stats: StoredStats }) {
  const { probe: p, stats: s } = stats;
  const rows: [string, string][] = [
    ["Durasi", `${timecode(p.duration)} (${p.duration.toFixed(1)} s)`],
    ["Resolusi", `${p.width}×${p.height} · ${p.aspect} · ${p.fps} fps`],
    ["Cut terdeteksi", `${s.cutCount} cut · ${s.shotCount} shot`],
    ["Panjang shot", `rata-rata ${s.avgShot} s · median ${s.medianShot} s · ${s.minShot}–${s.maxShot} s`],
    ["Tempo", `${s.cutsPerMinute} cut per menit`],
    ["Audio", p.hasAudio ? "ada (tidak dianalisis langsung)" : "tidak ada"],
  ];
  return (
    <dl className="panel grid grid-cols-1 divide-y divide-line text-sm sm:grid-cols-2 sm:divide-y-0">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 px-4 py-2.5 sm:border-b sm:border-line">
          <dt className="w-32 shrink-0 text-muted">{k}</dt>
          <dd className="font-mono text-[13px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
