import type { QaReport } from "@/lib/analyze/qa";
import { PASS_SCORE, formatScore } from "@/lib/analyze/qa";

/** "SKILL.md · audit 9,6/10 · lulus": the score every Bedah Video download must reach before it counts as done. */
export function AuditBadge({ label, report }: { label: string; report: QaReport }) {
  const c = report.counts;
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-ui border px-2 py-1 font-mono text-xs ${
        report.passed ? "border-accent/50 text-accent" : "border-danger-line text-danger"
      }`}
      title={`${report.rounds} putaran audit (${report.history.map(formatScore).join(" → ")}). Klaim benar ${c.benar}, sebagian ${c.sebagian}, salah ${c.salah}; terlewat penting ${c.terlewat_penting}; uji gagal ${c.uji_gagal}. Ambang ${formatScore(PASS_SCORE)}.`}
    >
      <span>{label}</span>
      <span aria-hidden="true">·</span>
      <span>audit {formatScore(report.score)}</span>
      <span aria-hidden="true">·</span>
      <span>{report.passed ? "lulus" : "belum lulus"}</span>
    </p>
  );
}
