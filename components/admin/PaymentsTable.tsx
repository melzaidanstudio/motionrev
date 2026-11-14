import type { PaymentRow } from "@/lib/db";
import { relativeDate, rupiah } from "@/lib/format";

const LABEL: Record<PaymentRow["status"], string> = {
  creating: "dibuat",
  pending: "menunggu",
  paid: "lunas",
  expired: "kedaluwarsa",
  failed: "gagal",
  refunded: "dikembalikan",
};

export function PaymentsTable({ payments }: { payments: (PaymentRow & { email: string })[] }) {
  return (
    <section aria-labelledby="payments-h">
      <h2 id="payments-h" className="text-base font-semibold">
        Tagihan terbaru
      </h2>
      <p className="mb-3 text-sm text-muted">50 tagihan pembelian kredit terakhir.</p>
      {payments.length === 0 ? (
        <div className="panel p-5 text-sm text-muted">Belum ada tagihan.</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-2 font-medium">Waktu</th>
                <th className="px-4 py-2 font-medium">Pembeli</th>
                <th className="px-4 py-2 font-medium">Paket</th>
                <th className="px-4 py-2 text-right font-medium">Jumlah</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">ID doit.id</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted">{relativeDate(p.created_at)}</td>
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2">{p.package_name}</td>
                  <td className="px-4 py-2 text-right font-mono">{rupiah(p.amount)}</td>
                  <td className={`px-4 py-2 ${p.status === "paid" ? "text-accent" : p.status === "failed" ? "text-danger" : "text-muted"}`} title={p.error ?? undefined}>
                    {LABEL[p.status]}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted">{p.provider_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
