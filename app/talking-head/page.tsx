import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { balanceOf, listTalkingHeads, type TalkingHeadRow } from "@/lib/db";
import { priceFor } from "@/lib/settings";
import { FONT_CLASS } from "@/lib/talkingHead/fonts";
import { TalkingHeadWizard } from "@/components/talking-head/TalkingHeadWizard";
import { TalkingHeadQueue } from "@/components/talking-head/TalkingHeadQueue";
import { AutoRefresh } from "@/components/AutoRefresh";
import { timingsFor } from "@/lib/talkingHead/eta";
import { getBrandKit } from "@/lib/brandKit";
import { canOpenEditor, latestVideo } from "@/lib/talkingHead/results";
import { openNotes } from "@/lib/talkingHead/notes";
import { talkingHeadDir } from "@/lib/paths";
import fs from "node:fs";
import path from "node:path";

export const metadata = { title: "Talking Head · motionrev" };

export default function TalkingHeadPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold">Talking Head</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Unggah rekaman ngomong ke kamera, pilih style, nuansa warna, dan font. motionrev mengeditnya jadi reel
          vertikal dengan caption dan motion graphic.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Membuka Talking Head…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const items = listTalkingHeads(user.id);
  // Keep refreshing while something runs, and while an Editor Mode project waits for its export from motlab.
  const busy = items.some((t) => t.status === "queued" || t.status === "rendering" || (t.status === "done" && canOpenEditor(t)));
  return (
    <>
      <AutoRefresh active={busy} everyMs={5000} />
      <TalkingHeadWizard fontClass={FONT_CLASS} price={priceFor(user)} balance={balanceOf(user.id)} brand={getBrandKit(user.id)} />
      <section aria-labelledby="th-queue-h">
        <h2 id="th-queue-h" className="text-base font-semibold">
          Video kamu
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Video dirender satu per satu. Perkiraan waktu dihitung dari panjang video dan kecepatan render sejauh
          ini. Halaman ini memperbarui statusnya sendiri, dan render yang gagal mengembalikan kreditnya.
        </p>
        <QueueSummary items={items} />
        <TalkingHeadQueue items={items} timings={timingsFor(items)} results={resultsFor(items)} />
      </section>
    </>
  );
}

/** The video to show and whether the editor can open, for each finished job. */
function resultsFor(items: TalkingHeadRow[]) {
  const out: Record<string, { videoVersion: string | null; canEdit: boolean; openNotes: number }> = {};
  for (const t of items) {
    if (t.status !== "done") continue;
    const rel = latestVideo(t);
    let version: string | null = null;
    if (rel) {
      try {
        version = String(Math.round(fs.statSync(path.join(talkingHeadDir(t.id), rel)).mtimeMs));
      } catch {}
    }
    const canEdit = canOpenEditor(t);
    out[t.id] = { videoVersion: version, canEdit, openNotes: canEdit ? openNotes(t) : 0 };
  }
  return out;
}

/** One line over the list: what is rendering now and how many tasks wait behind it. */
function QueueSummary({ items }: { items: TalkingHeadRow[] }) {
  const running = items.filter((t) => t.status === "rendering").length;
  const waiting = items.filter((t) => t.status === "queued").length;
  const done = items.filter((t) => t.status === "done").length;
  if (!running && !waiting) return null;
  return (
    <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite">
      <span>
        <span className="font-mono text-accent">{running}</span> sedang dikerjakan
      </span>
      <span>
        <span className="font-mono text-fg">{waiting}</span> antre
      </span>
      <span className="text-muted">{done} selesai</span>
    </p>
  );
}
