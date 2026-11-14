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
  const frames = listFrames(id).filter((f) => f.kind !== "sheet");
  const sheet = listFrames(id).find((f) => f.kind === "sheet");
  const running = isRunning(a.status);
  const stats = a.stats_json ? (JSON.parse(a.stats_json) as Parameters<typeof FactsTable>[0]["stats"]) : null;

  return (
    <article>
      <AutoRefresh active={running} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">
            {a.source_type === "url" ? a.source : `file · ${a.source}`} · {relativeDate(a.created_at)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">
            {a.name} <StatusText status={a.status} />
          </h1>
          {a.description && <p className="mt-2 max-w-3xl text-muted">{a.description}</p>}
        </div>
        <DetailActions id={a.id} status={a.status} hasSkill={Boolean(a.skill_md)} />
      </header>

      {running && <ProgressPanel progress={a.progress} step={a.step} />}

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
          {sheet && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted hover:text-fg">Contact sheet seluruh video</summary>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/analyses/${a.id}/frames/${sheet.file}`}
                alt="Contact sheet: satu frame per detik, dibaca kiri ke kanan"
                className="mt-2 w-full rounded-ui border border-line"
              />
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
    </article>
  );
}
