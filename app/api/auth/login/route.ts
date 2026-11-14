import { getUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { clearLoginFailures, loginBlocked, noteLoginFailure, sameOrigin, startSession } from "@/lib/auth";

export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (loginBlocked(email)) {
    return Response.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, { status: 429 });
  }
  const user = email ? getUserByEmail(email) : undefined;
  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    noteLoginFailure(email);
    return Response.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  }
  clearLoginFailures(email);
  await startSession(user.id);
  return Response.json({ ok: true });
}
