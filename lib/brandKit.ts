import "server-only";
import { getSetting, setSetting } from "./db";
import { FOLLOW_STYLE, fontById, paletteById, styleById } from "./talkingHead/options";

/** A user's saved look: what the Talking Head wizard starts with. */
export interface BrandKit {
  name: string;
  style: string | null;
  palette: string; // palette id or "style"
  font: string; // font id or "style"
}

const key = (userId: string) => `brand:${userId}`;

export function getBrandKit(userId: string): BrandKit | null {
  return getSetting<BrandKit>(key(userId)) ?? null;
}

/** Validate and store; returns an error message, or null when saved. */
export function saveBrandKit(userId: string, b: BrandKit): string | null {
  if (b.name.length > 60) return "Nama brand maksimal 60 karakter.";
  if (b.style !== null && !styleById(b.style)) return "Style tidak dikenal.";
  if (b.palette !== FOLLOW_STYLE && !paletteById(b.palette)) return "Nuansa warna tidak dikenal.";
  if (b.font !== FOLLOW_STYLE && !fontById(b.font)) return "Font tidak dikenal.";
  setSetting(key(userId), { name: b.name.trim(), style: b.style, palette: b.palette, font: b.font } satisfies BrandKit);
  return null;
}
