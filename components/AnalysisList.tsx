import Link from "next/link";
import type { AnalysisRow } from "@/lib/db";
import { relativeDate } from "@/lib/format";
import { STATUS_LABEL, isRunning } from "@/lib/status";

export function AnalysisList({ items }: { items: AnalysisRow[] }) {
  if (items.length === 0) {
    return (
      <div className="panel p-6 text-sm">
        <p className="font-medium">Pustaka masih kosong.</p>
        <p className="mt-1 text-muted">
          Belum ada video yang dibedah. Isi form di samping dengan link atau file video, lalu tekan
          &ldquo;Mulai bedah&rdquo;. Hasilnya muncul di sini dan tersimpan.
        </p>
      </div>
    );
  }

  return (
    <ul className="panel divide-y divide-line">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href={`/a/${a.id}`}
            className="flex items-center gap-4 p-3 no-underline hover:bg-panel-2 focus-visible:bg-panel-2"
          >
            <Thumb a={a} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-medium text-fg">{a.name}</span>
                <StatusText status={a.status} />
              </div>
              <p className="truncate text-sm text-muted">
                {a.description ?? (a.status === "error" ? a.error : a.step)}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {a.source_type === "url" ? hostOf(a.source) : a.source} · {relativeDate(a.created_at)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thumb({ a }: { a: AnalysisRow }) {
  if (a.cover_frame) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/analyses/${a.id}/frames/${a.cover_frame}`}
        alt=""
        width={72}
        height={72}
        className="h-18 w-18 shrink-0 rounded-ui border border-line object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`h-18 w-18 shrink-0 rounded-ui border border-line ${
        isRunning(a.status) ? "ruler" : "bg-bg"
      }`}
    />
  );
}

export function StatusText({ status }: { status: AnalysisRow["status"] }) {
  const cls =
    status === "error" ? "text-danger" : isRunning(status) ? "text-accent" : "text-muted";
  return <span className={`shrink-0 text-xs ${cls}`}>{STATUS_LABEL[status]}</span>;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
