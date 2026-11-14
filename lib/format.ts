/** 12.4 -> "00:00:12.40" (the timecode motif used across the UI and in SKILL.md). */
export function timecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const whole = Math.floor(sec);
  const frac = Math.round((sec - whole) * 100);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(whole)}.${pad(frac)}`;
}

/** 12.4 -> "0:12" for compact labels. */
export function shortTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "video"
  );
}

/** 150000 -> "Rp150.000" */
export function rupiah(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** Public origin of this deployment, for links sent to third parties (return URLs). */
export function publicOrigin(req: Request): string {
  if (process.env.MOTIONREV_PUBLIC_URL) return process.env.MOTIONREV_PUBLIC_URL.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
