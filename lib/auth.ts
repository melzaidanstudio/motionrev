import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { deleteSession, getSessionUser, insertSession, type UserRow } from "./db";
import { hashToken, newToken } from "./crypto";

export const SESSION_COOKIE = "mr_session";
const SESSION_DAYS = 30;

export type SessionUser = Pick<UserRow, "id" | "email" | "role">;

function narrow(u: UserRow): SessionUser {
  return { id: u.id, email: u.email, role: u.role };
}

/** The signed-in user, or null. Reads the request cookie, so call it inside a Suspense boundary. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  await connection(); // the expiry check compares against the current time: request-time only
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const u = getSessionUser(hashToken(token));
  return u ? narrow(u) : null;
}

/** Start a session; only valid inside a Route Handler or Server Function. */
export async function startSession(userId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  insertSession(hashToken(token), userId, expires);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

/* ---------- route handler guards ---------- */

export type Guard = { user: SessionUser; error?: undefined } | { user?: undefined; error: Response };

export async function requireUser(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Masuk dulu untuk melanjutkan." }, { status: 401 }) };
  return { user };
}

export async function requireAdmin(): Promise<Guard> {
  const g = await requireUser();
  if (g.error) return g;
  if (g.user.role !== "admin") return { error: Response.json({ error: "Khusus admin." }, { status: 403 }) };
  return g;
}

/**
 * Reject cross-site writes. Browsers send Origin on POST/DELETE; it must match the host we serve.
 * SameSite=Lax already keeps the session cookie off cross-site POSTs; this is the second lock.
 */
export function sameOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // non-browser clients (curl) carry no cookie of ours anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    /* fall through */
  }
  return Response.json({ error: "Asal permintaan tidak dikenali." }, { status: 403 });
}

/* ---------- login throttling: 10 failures per 15 minutes per email ---------- */

const g = globalThis as unknown as { __motionrevLoginFails?: Map<string, number[]> };
const fails = g.__motionrevLoginFails ?? (g.__motionrevLoginFails = new Map<string, number[]>());
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(email: string): boolean {
  const t = Date.now();
  const list = (fails.get(email) ?? []).filter((x) => t - x < WINDOW_MS);
  fails.set(email, list);
  return list.length >= 10;
}

export function noteLoginFailure(email: string) {
  const list = fails.get(email) ?? [];
  list.push(Date.now());
  fails.set(email, list);
}

export function clearLoginFailures(email: string) {
  fails.delete(email);
}
