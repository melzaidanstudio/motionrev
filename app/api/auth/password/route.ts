import { cookies } from "next/headers";
import { getUser, setPassword } from "@/lib/db";
import { hashPassword, hashToken, verifyPassword } from "@/lib/crypto";
import { SESSION_COOKIE, requireUser, sameOrigin } from "@/lib/auth";

/** Change the signed-in user's password after checking the current one. Other devices are signed out. */
export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const g = await requireUser();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");

  if (next.length < 8) return err("Kata sandi baru minimal 8 karakter.");
  if (next.length > 200) return err("Kata sandi baru terlalu panjang.");
  const u = getUser(g.user.id);
  if (!u || !(await verifyPassword(current, u.password_hash))) return err("Kata sandi sekarang salah.", 403);
  if (current === next) return err("Kata sandi baru sama dengan yang lama.");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  setPassword(u.id, await hashPassword(next), token ? hashToken(token) : null);
  return Response.json({ ok: true });
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
