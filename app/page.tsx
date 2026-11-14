import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { balanceOf, listAnalyses } from "@/lib/db";
import { priceFor } from "@/lib/settings";
import { isRunning } from "@/lib/status";
import { AnalysisList } from "@/components/AnalysisList";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NewAnalysisForm } from "@/components/NewAnalysisForm";

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Membuka pustaka…</p>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getCurrentUser();
  if (!user) return <SignedOut />;

  const items = listAnalyses(user.id);
  const running = items.some((a) => isRunning(a.status));
  const price = priceFor(user);
  const balance = balanceOf(user.id);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
      <AutoRefresh active={running} />
      <section aria-labelledby="pustaka-h" className="order-2 min-w-0 md:order-1">
        <h1 id="pustaka-h" className="text-xl font-semibold">
          Pustaka
        </h1>
        <p className="mt-1 mb-4 text-sm text-muted">Semua video yang pernah kamu bedah, terbaru di atas.</p>
        <AnalysisList items={items} />
      </section>
      <aside id="bedah-baru" className="order-1 min-w-0 md:order-2 md:sticky md:top-6">
        <NewAnalysisForm price={price} balance={balance} />
      </aside>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold leading-tight">Bedah video jadi menjadi SKILL.md</h1>
      <p className="mt-3 text-muted">
        Tempel link atau unggah video. motionrev mengukur durasi dan cut, mengambil frame kunci, lalu Claude
        menulis spesifikasi gayanya: palet, tipografi, komposisi, cut, transisi, caption, brief, dan langkah
        produksi. Hasilnya SKILL.md yang bisa diunduh dan dipakai Claude Code untuk meniru gaya itu.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/daftar" className="btn btn-primary">
          Buat akun
        </Link>
        <Link href="/masuk" className="btn">
          Masuk
        </Link>
      </div>
    </div>
  );
}
