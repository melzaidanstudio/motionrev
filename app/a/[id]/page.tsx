import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getAnalysis, listFrames } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { relativeDate } from "@/lib/format";
import { isRunning } from "@/lib/status";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusText } from "@/components/AnalysisList";
import { ProgressPanel } from "@/components/ProgressPanel";
import { Filmstrip } from "@/components/Filmstrip";
import { FactsTable } from "@/components/FactsTable";
import { SkillView } from "@/components/SkillView";
import { DetailActions } from "@/components/DetailActions";
import { AuditBadge } from "@/components/AuditBadge";
import type { QaReport } from "@/lib/analyze/qa";
import { analysisDir, findSourceVideo } from "@/lib/paths";
import { scriptBlocker, scriptEligible } from "@/lib/scriptJobs";
import { readTranscript, transcriptText } from "@/lib/video/transcribe";

export default function AnalysisPage({ params }: PageProps<"/a/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Membuka analisis…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/a/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const a = getAnalysis(id);
  if (!a || !canView(user, a)) notFound();
  const all = listFrames(id);
  const frames = all.filter((f) => f.kind !== "sheet" && f.kind !== "strip");
  const sheets = all.filter((f) => f.kind === "sheet");
  const strips = all.filter((f) => f.kind === "strip");
  const running = isRunning(a.status);
  const stats = a.stats_json ? (JSON.parse(a.stats_json) as Parameters<typeof FactsTable>[0]["stats"]) : null;
  const scriptWorking = a.script_status === "queued" || a.script_status === "running";
  const audit = a.audit_json && a.skill_md ? (JSON.parse(a.audit_json) as QaReport) : null;
  const scriptAudit = a.script_audit_json && a.script_md ? (JSON.parse(a.script_audit_json) as QaReport) : null;
  const transcript = a.status === "done" && scriptEligible(a) ? readTranscript(analysisDir(a.id)) : null;

  return (
    <article>
      <AutoRefresh active={running || scriptWorking} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">
            {a.source_type === "url" ? a.source : `file · ${a.source}`} · {relativeDate(a.created_at)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">
            {a.name} <StatusText status={a.status} />
          </h1>
          {a.description && <p className="mt-2 max-w-3xl text-muted">{a.description}</p>}
          {(audit || scriptAudit) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {audit && <AuditBadge label="SKILL.md" report={audit} />}
              {scriptAudit && <AuditBadge label="SKILL naskah" report={scriptAudit} />}
            </div>
          )}
        </div>
        <DetailActions
          id={a.id}
          status={a.status}
          hasSkill={Boolean(a.skill_md)}
          sourceDeleted={a.source_type === "file" && !isRunning(a.status) && !findSourceVideo(analysisDir(a.id))}
          hasScript={Boolean(a.script_md)}
          scriptEligible={scriptEligible(a)}
          scriptStatus={a.script_status}
          scriptBlocked={a.status === "done" && !a.script_md && scriptEligible(a) ? scriptBlocker(a.id) : null}
        />
      </header>

      {running && <ProgressPanel progress={a.progress} step={a.step} />}

      {scriptWorking && (
        <p role="status" className="panel mt-6 p-4 text-sm">
          {a.script_status === "queued" ? "SKILL naskah menunggu giliran." : "Menyusun SKILL naskah"}: mentranskrip audio
          bila belum ada, lalu membedah pola kalimat, hook, dan nadanya. Biasanya 2 sampai 5 menit.
        </p>
      )}
      {a.script_status === "error" && a.script_error && (
        <p role="alert" className="panel mt-6 p-4 text-sm">
          <span className="font-medium text-danger">SKILL naskah belum bisa dibuat.</span> {a.script_error}
        </p>
      )}

      {a.status === "error" && (
        <div role="alert" className="panel mt-6 border-danger-line p-4 text-sm">
          <p className="font-medium text-danger">Analisis gagal.</p>
          <p className="mt-1 text-fg">{a.error}</p>
          <p className="mt-2 text-muted">
            Perbaiki penyebabnya (link, file, kunci API, atau alat), lalu tekan &ldquo;Jalankan ulang&rdquo;.
          </p>
        </div>
      )}

      {frames.length > 0 && (
        <section className="mt-8" aria-labelledby="frames-h">
          <h2 id="frames-h" className="text-base font-semibold">
            Frame kunci
          </h2>
          <p className="mb-3 text-sm text-muted">
            Satu frame per awal shot (atau sampel merata). Playhead menandai frame sampul.
          </p>
          <Filmstrip
            id={a.id}
            frames={frames}
            cover={a.cover_frame}
            duration={stats?.probe.duration ?? 0}
            width={stats?.probe.width ?? 9}
            height={stats?.probe.height ?? 16}
          />
          {sheets.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted hover:text-fg">
                Contact sheet seluruh video{sheets.length > 1 ? ` (${sheets.length} halaman)` : ""}
              </summary>
              {sheets.map((sh, n) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={sh.id}
                  src={`/api/analyses/${a.id}/frames/${sh.file}`}
                  alt={`Contact sheet halaman ${n + 1}, timecode di pojok tiap ubin`}
                  className="mt-2 w-full max-w-3xl rounded-ui border border-line"
                />
              ))}
            </details>
          )}
          {strips.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted hover:text-fg">Potongan gerak (transisi dan caption)</summary>
              {strips.map((st) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={st.id}
                  src={`/api/analyses/${a.id}/frames/${st.file}`}
                  alt="Enam frame berjarak 0,1 detik"
                  className="mt-2 w-full max-w-3xl rounded-ui border border-line"
                />
              ))}
            </details>
          )}
        </section>
      )}

      {stats && (
        <section className="mt-8" aria-labelledby="facts-h">
          <h2 id="facts-h" className="text-base font-semibold">
            Fakta terukur
          </h2>
          <p className="mb-3 text-sm text-muted">Diukur dari file dengan ffprobe dan ffmpeg.</p>
          <FactsTable stats={stats} />
        </section>
      )}

      {a.skill_md && (
        <section className="mt-8" aria-labelledby="skill-h">
          <h2 id="skill-h" className="text-base font-semibold">
            SKILL.md
          </h2>
          <p className="mb-3 text-sm text-muted">
            Taruh file ini di <code className="font-mono">~/.claude/skills/&lt;nama&gt;/SKILL.md</code> supaya Claude
            Code bisa meniru gayanya.
          </p>
          <SkillView md={a.skill_md} />
        </section>
      )}

      {a.script_md && (
        <section className="mt-8" aria-labelledby="script-h">
          <h2 id="script-h" className="text-base font-semibold">
            SKILL naskah
          </h2>
          <p className="mb-3 text-sm text-muted">
            Pola, hook, dan nada naskah video ini, dibedah dari transkripnya. Pasang sebagai skill terpisah supaya Claude
            bisa menulis naskah baru yang terdengar sama di topik lain.
          </p>
          <SkillView md={a.script_md} />
        </section>
      )}

      {transcript && (
        <section className="mt-8" aria-labelledby="transcript-h">
          <h2 id="transcript-h" className="text-base font-semibold">
            Transkrip
          </h2>
          <p className="mb-3 text-sm text-muted">
            {transcript.source === "whisper" ? "Didengar dari audio dengan whisper." : "Dari subtitle platform."}
          </p>
          <pre className="panel overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {transcriptText(transcript)}
          </pre>
        </section>
      )}
    </article>
  );
}
