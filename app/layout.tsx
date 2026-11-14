import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/AccountNav";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// IBM Plex: engineered, neutral, readable small. Mono only for timecodes and raw markdown (DESIGN.md).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "motionrev",
  description: "Bedah video jadi menjadi SKILL.md: gaya visual, cut, transisi, brief.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-fg no-underline">
              motionrev
            </Link>
            <nav aria-label="Utama" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
              <Suspense fallback={<span className="text-muted">…</span>}>
                <AccountNav />
              </Suspense>
            </nav>
          </div>
          <div className="ruler" aria-hidden="true" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted">
            Video, frame, dan SKILL.md tersimpan di server layanan ini dan hanya bisa dibuka pemilik akunnya.
            Analisis memakai Claude melalui penyedia yang diatur admin.
          </div>
        </footer>
      </body>
    </html>
  );
}
