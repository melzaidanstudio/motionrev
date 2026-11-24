/**
 * Choices offered by the Talking Head wizard. Shared by the page, the form and the API (no server imports).
 * Each style is one of the talking-head editing skills; its palette and font are what that style uses
 * when the user keeps "Bawaan style".
 */

export interface TalkingHeadStyle {
  id: string;
  name: string;
  blurb: string;
  palette: PaletteId;
  font: FontId;
}

export const STYLES = [
  {
    id: "jadireel",
    name: "Jadireel",
    blurb: "Caption per kata serif miring + sans tebal, panel warna yang menggeser video, kata besar di belakang kepala.",
    palette: "navy-krem",
    font: "instrument-serif",
  },
  {
    id: "lime-fuschia",
    name: "Lime Fuschia",
    blurb: "Banner judul fuchsia/lime, subtitle dua tingkat, widget UI di tengah, video duotone ungu-magenta.",
    palette: "fuchsia-lime",
    font: "poppins",
  },
  {
    id: "snap-matic",
    name: "Snap Matic",
    blurb: "Teks sepertiga atas campur font, efek ketik dan tulis tangan, layar terbelah dengan panel produk.",
    palette: "monokrom",
    font: "poppins",
  },
  {
    id: "reel-kartu-krem",
    name: "Kartu Krem",
    blurb: "Subtitle per kalimat, kartu krem beraksen oranye, checklist yang tercentang, balon chat, poll penutup.",
    palette: "krem-oranye",
    font: "poppins",
  },
  {
    id: "sky-creator-reel",
    name: "Sky Creator",
    blurb: "B-roll 3D biru langit dengan kartu UI melayang, whip dan zoom cut, CTA komentar kata kunci.",
    palette: "biru-langit",
    font: "instrument-serif",
  },
  {
    id: "itsaddie-hd",
    name: "Addie",
    blurb: "Hook serif kecil + emoji, caption satu kata serif lilac, kartu screenshot di atas kepala.",
    palette: "plum-lilac",
    font: "instrument-serif",
  },
  {
    id: "jossieliuu",
    name: "Jossie",
    blurb: "Panel motion graphic plum, label pink, caption script lime, kartu prompt dan checklist.",
    palette: "plum-lilac",
    font: "inter",
  },
] as const satisfies readonly TalkingHeadStyle[];

export type StyleId = (typeof STYLES)[number]["id"];

export interface Palette {
  id: string;
  name: string;
  /** Background, main, accent: drawn as swatches in that order. */
  colors: readonly [string, string, string];
}

export const PALETTES = [
  { id: "fuchsia-lime", name: "Fuchsia Lime", colors: ["#2a0f2e", "#e0218a", "#c6f432"] },
  { id: "krem-oranye", name: "Krem Oranye", colors: ["#f5ebdd", "#2b2118", "#f28c28"] },
  { id: "biru-langit", name: "Biru Langit", colors: ["#0e2a47", "#8ec9ff", "#ffffff"] },
  { id: "plum-lilac", name: "Plum Lilac", colors: ["#3b1f4a", "#c8a2f0", "#f4eef8"] },
  { id: "navy-krem", name: "Navy Krem", colors: ["#14213d", "#f3e9d2", "#e8a33d"] },
  { id: "monokrom", name: "Monokrom", colors: ["#111111", "#ffffff", "#9a9a9a"] },
  { id: "kuning-neon", name: "Kuning Neon", colors: ["#111111", "#ffe600", "#ffffff"] },
  { id: "hijau-sage", name: "Hijau Sage", colors: ["#344e41", "#a3b18a", "#f1f3ec"] },
] as const satisfies readonly Palette[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const FONTS = [
  { id: "poppins", name: "Poppins" },
  { id: "inter", name: "Inter" },
  { id: "instrument-serif", name: "Instrument Serif" },
  { id: "montserrat", name: "Montserrat" },
  { id: "bebas-neue", name: "Bebas Neue" },
  { id: "playfair", name: "Playfair Display" },
  { id: "space-grotesk", name: "Space Grotesk" },
  { id: "lobster", name: "Lobster" },
  { id: "yellowtail", name: "Yellowtail" },
  { id: "pacifico", name: "Pacifico" },
  { id: "caveat", name: "Caveat" },
  { id: "great-vibes", name: "Great Vibes" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

/** "style" means: use what the chosen style uses. */
export const FOLLOW_STYLE = "style";

export const styleById = (id: string) => STYLES.find((s) => s.id === id);
export const paletteById = (id: string) => PALETTES.find((p) => p.id === id);
export const fontById = (id: string) => FONTS.find((f) => f.id === id);

export const MAX_TALKING_HEAD_BYTES = 500 * 1024 * 1024;
export const TALKING_HEAD_VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v)$/i;
