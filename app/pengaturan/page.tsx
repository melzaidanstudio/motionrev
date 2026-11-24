import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUser } from "@/lib/db";
import { getBrandKit } from "@/lib/brandKit";
import { relativeDate } from "@/lib/format";
import { PasswordForm } from "@/components/PasswordForm";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata = { title: "Pengaturan · motionrev" };

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted">Akun, keamanan, dan preferensi video kamu.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Membuka pengaturan…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const u = getUser(user.id);
  const brand = getBrandKit(user.id);

  return (
    <>
      <section aria-labelledby="akun-h" className="panel p-5">
        <h2 id="akun-h" className="text-base font-semibold">
          Akun
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{user.email}</dd>
          <dt className="text-muted">Peran</dt>
          <dd>{user.role === "admin" ? "Admin" : "Pengguna"}</dd>
          {u && (
            <>
              <dt className="text-muted">Terdaftar</dt>
              <dd>{relativeDate(u.created_at)}</dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="pw-h" className="panel p-5">
        <h2 id="pw-h" className="text-base font-semibold">
          Kata sandi
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">Setelah diganti, semua perangkat lain yang masih masuk akan dikeluarkan.</p>
        <PasswordForm />
      </section>

      <section aria-labelledby="pref-h" className="panel p-5">
        <h2 id="pref-h" className="text-base font-semibold">
          Preferensi video
        </h2>
        <p className="mt-1 text-sm text-muted">
          {brand
            ? `Brand Kit "${brand.name || "tanpa nama"}" dipakai sebagai tampilan awal setiap video Talking Head.`
            : "Belum ada Brand Kit. Simpan style, warna, dan font favoritmu supaya tidak perlu memilih ulang."}
        </p>
        <Link href="/brand" className="btn mt-4">
          {brand ? "Ubah Brand Kit" : "Buat Brand Kit"}
        </Link>
      </section>

      <section aria-labelledby="sesi-h" className="panel p-5">
        <h2 id="sesi-h" className="text-base font-semibold">
          Sesi
        </h2>
        <p className="mt-1 text-sm text-muted">Keluar dari motionrev di perangkat ini.</p>
        <div className="mt-2">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}
