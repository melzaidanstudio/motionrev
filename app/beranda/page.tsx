import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { balanceOf, listAnalyses, listTalkingHeads } from "@/lib/db";
import { priceFor } from "@/lib/settings";
import { isRunning, STATUS_LABEL } from "@/lib/status";
import { relativeDate } from "@/lib/format";
import { styleById } from "@/lib/talkingHead/options";
import { timingsFor } from "@/lib/talkingHead/eta";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RenderProgress } from "@/components/talking-head/RenderProgress";

export const metadata = { title: "Beranda · motionrev" };

export default function HomeDashboard() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Membuka beranda…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");

  const heads = listTalkingHeads(user.id);
  const analyses = listAnalyses(user.id);
  const balance = balanceOf(user.id);
  const price = priceFor(user);
  const rendering = heads.filter((t) => t.status === "rendering" || t.status === "queued");
  const runningAnalyses = analyses.filter((a) => isRunning(a.status));
  const timings = timingsFor(rendering);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const doneThisMonth =
    heads.filter((t) => t.status === "done" && t.updated_at >= monthStart).length +
    analyses.filter((a) => a.status === "done" && a.updated_at >= monthStart).length;

  const recent = [
    ...heads.map((t) => ({
      key: `th-${t.id}`,
      href: "/talking-head",
      kind: "Talking Head",
      title: t.source,
      detail: styleById(t.style)?.name ?? t.style,
      status: t.status === "queued" ? "Antre" : t.status === "rendering" ? "Dirender" : t.status === "done" ? "Selesai" : "Gagal",
      failed: t.status === "error",
      at: t.created_at,
    })),
    ...analyses.map((a) => ({
      key: `an-${a.id}`,
      href: `/a/${a.id}`,
      kind: "Bedah Video",
      title: a.name,
      detail: a.source_type === "url" ? "dari link" : a.source,
      status: STATUS_LABEL[a.status],
      failed: a.status === "error",
      at: a.created_at,
    })),
  ]
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, 6);

  const name = user.email.split("@")[0];

  return (
    <div className="space-y-8">
      <AutoRefresh active={rendering.length > 0 || runningAnalyses.length > 0} everyMs={5000} />
      <header>
        <h1 className="text-xl font-semibold">Halo, {name}</h1>
        <p className="mt-1 text-sm text-muted">Mau bikin apa hari ini?</p>
      </header>

      <section aria-label="Mulai" className="grid gap-3 md:grid-cols-2">
        <Link href="/talking-head" className="panel group block p-5 no-underline hover:border-line-2">
          <p className="text-xs text-muted">Edit otomatis</p>
          <p className="mt-1 text-lg font-semibold text-fg">Talking Head baru</p>
          <p className="mt-1 text-sm text-muted">Unggah rekaman ngomong ke kamera, pilih style, warna, dan font. Jadi reel siap posting.</p>
          <span className="btn btn-primary mt-4">Buat video</span>
        </Link>
        <Link href="/#bedah-baru" className="panel group block p-5 no-underline hover:border-line-2">
          <p className="text-xs text-muted">Pelajari gaya</p>
          <p className="mt-1 text-lg font-semibold text-fg">Bedah video jadi</p>
          <p className="mt-1 text-sm text-muted">Tempel link reel yang kamu suka. motionrev menulis resep gayanya jadi SKILL.md.</p>
          <span className="btn mt-4">Bedah video</span>
        </Link>
      </section>

      <section aria-label="Ringkasan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Saldo kredit" value={String(balance)} hint={price > 0 ? `${price} kredit per video` : "Admin: gratis"} href="/kredit" cta="Beli kredit" />
        <Stat label="Sedang diproses" value={String(rendering.length + runningAnalyses.length)} hint="Talking Head dan bedah video" />
        <Stat label="Selesai bulan ini" value={String(doneThisMonth)} hint="Semua jenis video" />
      </section>

      {rendering.length > 0 && (
        <section aria-labelledby="proses-h">
          <h2 id="proses-h" className="text-base font-semibold">
            Sedang diproses
          </h2>
          <ul className="panel mt-3 divide-y divide-line">
            {rendering.map((t) => {
              const tm = timings[t.id];
              return (
                <li key={t.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{t.source}</span>
                    <span className="shrink-0 text-xs text-muted">{styleById(t.style)?.name}</span>
                  </div>
                  {tm?.kind === "rendering" ? (
                    <RenderProgress {...tm.progress} step={t.step} cutFill={!!t.cut_fill} editor={t.mode === "editor"} />
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      {tm?.kind === "queued" ? `Antrean ke-${tm.position}` : t.step}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="terbaru-h">
        <h2 id="terbaru-h" className="text-base font-semibold">
          Terbaru
        </h2>
        {recent.length === 0 ? (
          <div className="panel mt-3 p-5 text-sm">
            <p className="font-medium">Belum ada video.</p>
            <p className="mt-1 text-muted">Mulai dari salah satu kartu di atas. Semua hasilmu akan terkumpul di sini.</p>
          </div>
        ) : (
          <ul className="panel mt-3 divide-y divide-line">
            {recent.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="flex items-center gap-3 p-3 no-underline hover:bg-panel-2">
                  <span className="w-28 shrink-0 text-xs text-muted">{r.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{r.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.detail} · {relativeDate(r.at)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${r.failed ? "text-danger" : "text-muted"}`}>{r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, href, cta }: { label: string; value: string; hint: string; href?: string; cta?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl text-fg">{value}</p>
      <p className="mt-1 text-xs text-muted">
        {hint}
        {href && cta && (
          <>
            {" · "}
            <Link href={href} className="text-fg">
              {cta}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
