import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listRecentPayments, listUsersWithBalance } from "@/lib/db";
import { getAiSettingsPublic, getBillingSettings, getPaymentSettingsPublic } from "@/lib/settings";
import { getClaudeCodeAccount } from "@/lib/claudeCodeAccount";
import { ProviderForm } from "@/components/admin/ProviderForm";
import { BillingForm } from "@/components/admin/BillingForm";
import { PaymentForm } from "@/components/admin/PaymentForm";
import { PaymentsTable } from "@/components/admin/PaymentsTable";
import { UsersTable } from "@/components/admin/UsersTable";

export const metadata = { title: "Admin · motionrev" };

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Membuka panel admin…</p>}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  if (user.role !== "admin") notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = (process.env.MOTIONREV_PUBLIC_URL || `${proto}://${host}`).replace(/\/+$/, "");

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted">Penyedia AI, harga dan penjualan kredit, serta saldo pengguna.</p>
      </header>
      <ProviderForm initial={getAiSettingsPublic()} claudeCode={await getClaudeCodeAccount()} />
      <BillingForm initial={getBillingSettings()} />
      <PaymentForm initial={getPaymentSettingsPublic()} webhookUrl={`${origin}/api/payments/doit/webhook`} />
      <PaymentsTable payments={listRecentPayments()} />
      <UsersTable users={listUsersWithBalance()} currentUserId={user.id} />
    </div>
  );
}
