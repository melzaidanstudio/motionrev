import "server-only";
import { getAnalysis, type AnalysisRow } from "./db";
import type { SessionUser } from "./auth";

/** Owners see their own analyses; admins can open any, for support. */
export function canView(user: SessionUser, a: AnalysisRow): boolean {
  return a.user_id === user.id || user.role === "admin";
}

/** Load an analysis the user may see, or a 404 that does not reveal whether it exists. */
export function loadForUser(user: SessionUser, id: string): { a: AnalysisRow; error?: undefined } | { a?: undefined; error: Response } {
  const a = getAnalysis(id);
  if (!a || !canView(user, a)) {
    return { error: Response.json({ error: "Analisis tidak ditemukan." }, { status: 404 }) };
  }
  return { a };
}
