import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { balanceOf, listLedger, type LedgerRow } from "@/lib/db";
import { getActivePackages, getBillingSettings } from "@/lib/settings";
import { relativeDate } from "@/lib/format";
import { BuyPackages } from "@/components/BuyPackages";
import { PaymentStatus } from "@/components/PaymentStatus";

export const metadata = { title: "Kredit · motionrev" };

const REASON: Record<LedgerRow["reason"], string> = {
  analysis: "Analisis",
  talking_head: "Talking Head",
  refund: "Pengembalian",
  topup: "Top-up admin",
  adjust: "Koreksi admin",
  signup: "Bonus pendaftaran",
  purchase: "Pembelian",
  purchase_refund: "Pembelian dikembalikan",
};

export default function CreditsPage({ searchParams }: PageProps<"/kredit">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Membuka saldo…</p>}>
      <Credits searchParams={searchParams} />
    </Suspense>
  );
}

async function Credits({ searchParams }: Pick<PageProps<"/kredit">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const sp = await searchParams;
  const bayar = typeof sp.bayar === "string" && /^mr_[0-9a-f]{16}$/.test(sp.bayar) ? sp.bayar : null;
  const balance = balanceOf(user.id);
  const billing = getBillingSettings();
  const packages = getActivePackages();
  const ledger = listLedger(user.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        {bayar && <PaymentStatus id={bayar} />}

        <section aria-labelledby="saldo-h" className="panel p-5">
          <h1 id="saldo-h" className="text-base font-semibold">
            Saldo kredit
          </h1>
          <p className="mt-2 font-mono text-4xl text-fg">{balance}</p>
          <p className="mt-1 text-sm text-muted">
            Satu analisis memakai {billing.pricePerAnalysis} kredit. Analisis yang gagal dikembalikan otomatis.
          </p>

          <h2 className="mt-6 mb-2 text-sm font-semibold">Beli kredit</h2>
          {packages.length > 0 && <BuyPackages packages={packages} />}
          {billing.buyInstructions.trim() ? (
            <p className={`whitespace-pre-line text-sm ${packages.length ? "mt-4 text-muted" : ""}`}>{billing.buyInstructions}</p>
          ) : (
            packages.length === 0 && (
              <p className="text-sm text-muted">
                Pembelian online belum dibuka. Hubungi admin layanan ini untuk menambah kredit.
              </p>
            )
          )}
        </section>
      </div>

      <section aria-labelledby="riwayat-h" className="min-w-0">
        <h2 id="riwayat-h" className="text-base font-semibold">
          Riwayat
        </h2>
        <p className="mb-3 text-sm text-muted">50 transaksi terakhir.</p>
        {ledger.length === 0 ? (
          <div className="panel p-5 text-sm text-muted">Belum ada transaksi.</div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-2 font-medium">Waktu</th>
                  <th className="px-4 py-2 font-medium">Jenis</th>
                  <th className="px-4 py-2 font-medium">Catatan</th>
                  <th className="px-4 py-2 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted">{relativeDate(l.created_at)}</td>
                    <td className="px-4 py-2">{REASON[l.reason]}</td>
                    <td className="px-4 py-2 text-muted">{l.note ?? (l.analysis_id ? `analisis ${l.analysis_id}` : "")}</td>
                    <td className={`px-4 py-2 text-right font-mono ${l.delta < 0 ? "text-muted" : "text-fg"}`}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
