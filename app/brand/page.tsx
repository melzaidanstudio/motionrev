import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBrandKit } from "@/lib/brandKit";
import { FONT_CLASS } from "@/lib/talkingHead/fonts";
import { BrandKitForm } from "@/components/BrandKitForm";

export const metadata = { title: "Brand Kit · motionrev" };

export default function BrandPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Brand Kit</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Simpan style, warna, dan font brand kamu sekali. Setiap video Talking Head baru langsung memakainya, jadi semua
          konten terlihat seragam.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Membuka Brand Kit…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  return <BrandKitForm initial={getBrandKit(user.id)} fontClass={FONT_CLASS} />;
}
