import { randomBytes } from "node:crypto";
import { createUser, getUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { sameOrigin, startSession } from "@/lib/auth";
import { getBillingSettings } from "@/lib/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const bad = sameOrigin(req);
  if (bad) return bad;
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!EMAIL.test(email)) return err("Alamat email tidak valid.");
  if (password.length < 8) return err("Kata sandi minimal 8 karakter.");
  if (password.length > 200) return err("Kata sandi terlalu panjang.");
  if (getUserByEmail(email)) return err("Email ini sudah terdaftar. Silakan masuk.", 409);

  const user = createUser(
    { id: randomBytes(8).toString("hex"), email, password_hash: await hashPassword(password) },
    getBillingSettings().signupBonus,
  );
  await startSession(user.id);
  return Response.json({ ok: true, role: user.role }, { status: 201 });
}

function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
