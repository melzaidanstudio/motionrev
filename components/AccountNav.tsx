import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { balanceOf } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";

/** Right side of the header. Reads the session, so it renders inside a Suspense boundary. */
export async function AccountNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Link href="/masuk" className="text-muted hover:text-fg">
          Masuk
        </Link>
        <Link href="/daftar" className="text-muted hover:text-fg">
          Daftar
        </Link>
      </>
    );
  }
  const balance = balanceOf(user.id);
  return (
    <>
      <Link href="/" className="text-muted hover:text-fg">
        Pustaka
      </Link>
      {user.role === "admin" && (
        <Link href="/admin" className="text-muted hover:text-fg">
          Admin
        </Link>
      )}
      <Link href="/kredit" className="text-muted hover:text-fg" aria-label={`Kredit: saldo ${balance}`}>
        Kredit <span className="font-mono text-fg">{balance}</span>
      </Link>
      <span className="hidden max-w-40 truncate text-muted sm:inline" title={user.email}>
        {user.email}
      </span>
      <LogoutButton />
    </>
  );
}
