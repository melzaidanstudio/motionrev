import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar, SidebarFrame } from "@/components/Sidebar";
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
  description: "Edit video talking head dengan style siap pakai, dan bedah video jadi menjadi SKILL.md.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col md:flex-row">
        <Suspense fallback={<SidebarFrame />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted md:px-8">
              Video, frame, dan hasil tersimpan di server layanan ini dan hanya bisa dibuka pemilik akunnya.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
