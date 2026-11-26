import Link from "next/link";
import { getCurrentUser, LOGIN_ENABLED } from "@/lib/auth";
import { balanceOf } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";
import { SidebarNav, type NavGroup } from "./SidebarNav";

/**
 * The left panel: product name, the menu, and the account at the bottom. On a phone it collapses into a
 * top bar with a scrolling row of menu links. Reads the session, so it renders inside a Suspense boundary.
 */
export async function Sidebar() {
  const user = await getCurrentUser();

  const groups: NavGroup[] = user
    ? [
        {
          label: "Buat",
          items: [
            { href: "/beranda", label: "Beranda", icon: "home" },
            { href: "/talking-head", label: "Talking Head", icon: "talking-head" },
            { href: "/", label: "Bedah Video", icon: "bedah", also: ["/a"] },
          ],
        },
        { label: "Aset", items: [{ href: "/brand", label: "Brand Kit", icon: "brand" }] },
        {
          label: "Akun",
          items: [
            { href: "/kredit", label: "Kredit", icon: "kredit", badge: String(balanceOf(user.id)) },
            { href: "/pengaturan", label: "Pengaturan", icon: "settings" },
            { href: "/bantuan", label: "Bantuan", icon: "help" },
          ],
        },
        ...(user.role === "admin" ? [{ label: "Admin", items: [{ href: "/admin", label: "Panel admin", icon: "admin" as const }] }] : []),
      ]
    : [];

  return (
    <SidebarFrame>
      {user ? (
        <>
          <nav aria-label="Menu utama" className="min-w-0 flex-1 md:mt-2 md:overflow-y-auto">
            <SidebarNav groups={groups} />
          </nav>
          {LOGIN_ENABLED && (
            <div className="shrink-0 pr-2 text-sm md:hidden">
              <LogoutButton />
            </div>
          )}
          <div className="hidden border-t border-line px-3 pt-3 md:block">
            <p className="truncate text-sm" title={user.email}>
              {user.email}
            </p>
            <p className="text-xs text-muted">{user.role === "admin" ? "Admin" : "Pengguna"}</p>
            {LOGIN_ENABLED && <LogoutButton />}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-4 text-sm md:mt-4 md:flex-col md:items-stretch md:gap-1 md:px-3">
          <Link href="/masuk" className="text-muted hover:text-fg md:min-h-11 md:content-center">
            Masuk
          </Link>
          <Link href="/daftar" className="text-muted hover:text-fg md:min-h-11 md:content-center">
            Daftar
          </Link>
        </div>
      )}
    </SidebarFrame>
  );
}

/** The panel without the session: also the Suspense fallback, so the layout does not jump. */
export function SidebarFrame({ children }: { children?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 z-10 flex shrink-0 flex-col border-b border-line bg-panel md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 md:block md:pb-0">
        <Link href="/beranda" className="font-semibold tracking-tight text-fg no-underline">
          motionrev
        </Link>
      </div>
      <div className="ruler mx-4 hidden md:block" aria-hidden="true" />
      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-2 md:flex-col md:items-stretch md:pt-2 md:pb-4">
        {children}
      </div>
    </aside>
  );
}
