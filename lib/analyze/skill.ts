import type { Analysis } from "./schema";
import { slugify, timecode } from "../format";
import type { ProbeInfo } from "../video/probe";
import type { ShotStats } from "../video/scenes";
import { frameKindLabel, type KeyFrame, type MotionStrip } from "../video/frames";
import type { SheetPage } from "./prompt";
import { qaSection, type QaReport } from "./qa";

export interface SkillInput {
  name: string;
  source: string;
  sourceType: "url" | "file";
  analysis: Analysis;
  probe: ProbeInfo;
  stats: ShotStats;
  cuts: number[];
  frames: KeyFrame[];
  sheets: SheetPage[];
  strips: MotionStrip[];
  /** The audit result; left out while the document is being audited. */
  qa?: QaReport;
  transcriptSource: "whisper" | "platform" | null;
  createdAt: Date;
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

/** Assemble SKILL.md: frontmatter the way Claude Code reads it, then the sections in a fixed order. */
export function composeSkillMd(i: SkillInput): string {
  const a = i.analysis;
  const slug = slugify(a.nama || i.name);
  const description = `${a.deskripsi.trim()} ${a.kapan_dipakai.trim()}`.replace(/\s+/g, " ");

  const p = i.probe;
  const s = i.stats;
  const out: string[] = [];

  out.push("---");
  out.push(`name: ${slug}`);
  out.push(`description: ${yamlString(description)}`);
  out.push("---");
  out.push("");
  out.push(`# ${a.nama}`);
  out.push("");
  out.push(a.deskripsi.trim());
  out.push("");
  out.push(`Format: ${a.format.jenis}, ${a.format.orientasi}, ${a.format.kelas_durasi}. Platform (dugaan): ${a.format.platform_dugaan}.`);
  out.push("");

  out.push("## Ringkasan isi");
  out.push("");
  out.push(a.ringkasan_isi.trim());
  out.push("");

  out.push("## Fakta terukur");
  out.push("");
  out.push("Angka di bagian ini diukur dari file video dengan ffprobe dan ffmpeg, bukan ditebak.");
  out.push("");
  out.push("| Ukuran | Nilai |");
  out.push("|---|---|");
  out.push(`| Durasi | ${timecode(p.duration)} (${p.duration.toFixed(1)} s) |`);
  out.push(`| Resolusi | ${p.width}×${p.height}, rasio ${p.aspect}, ${p.fps} fps |`);
  out.push(`| Cut terdeteksi | ${s.cutCount} (${s.shotCount} shot) |`);
  out.push(`| Panjang shot | rata-rata ${s.avgShot} s, median ${s.medianShot} s, rentang ${s.minShot}–${s.maxShot} s |`);
  out.push(`| Tempo | ${s.cutsPerMinute} cut per menit |`);
  out.push(`| Audio | ${p.hasAudio ? "ada" : "tidak ada"} |`);
  out.push("");
  if (i.cuts.length) {
    out.push(`Waktu cut: ${i.cuts.map((c) => timecode(c)).join(", ")}.`);
    out.push("");
  }

  out.push("## Struktur");
  out.push("");
  out.push("| Mulai | Selesai | Bagian | Isi |");
  out.push("|---|---|---|---|");
  for (const b of a.struktur) out.push(`| ${esc(b.mulai)} | ${esc(b.selesai)} | ${esc(b.bagian)} | ${esc(b.isi)} |`);
  out.push("");

  out.push("## Gaya visual");
  out.push("");
  out.push(a.gaya_visual.trim());
  out.push("");

  out.push("## Komposisi dan tata letak");
  out.push("");
  out.push(a.komposisi.trim());
  out.push("");

  out.push("## Editing dan cut");
  out.push("");
  out.push(a.editing.trim());
  out.push("");

  if (a.transisi.length) {
    out.push("## Transisi");
    out.push("");
    out.push("| Timecode | Jenis | Catatan |");
    out.push("|---|---|---|");
    for (const t of a.transisi) out.push(`| ${esc(t.t)} | ${esc(t.jenis)} | ${esc(t.catatan)} |`);
    out.push("");
  }

  out.push("## Motion graphics");
  out.push("");
  out.push(a.motion_graphics.trim());
  out.push("");

  out.push("## Teks dan label di layar");
  out.push("");
  out.push(a.teks_dan_caption.trim());
  out.push("");

  out.push("## Caption narasi");
  out.push("");
  if (a.caption.ada) {
    out.push(`- **Posisi:** ${a.caption.posisi}`);
    out.push(`- **Font:** ${a.caption.font}`);
    out.push(`- **Warna:** ${a.caption.warna}`);
    out.push(`- **Unit:** ${a.caption.unit}`);
    out.push(`- **Masuk dan keluar:** ${a.caption.masuk_keluar}`);
    out.push(`- **Sorotan kata kunci:** ${a.caption.sorotan}`);
  } else {
    out.push("Tidak ada caption narasi.");
  }
  out.push("");

  if (a.perangkat_berulang.length) {
    out.push("## Perangkat visual");
    out.push("");
    out.push("| Perangkat | Tampilan | Muncul pada |");
    out.push("|---|---|---|");
    for (const d of a.perangkat_berulang) out.push(`| ${esc(d.nama)} | ${esc(d.deskripsi)} | ${esc(d.muncul.join(", "))} |`);
    out.push("");
  }

  out.push("## Akhir video");
  out.push("");
  out.push(a.akhir_video.trim());
  out.push("");

  out.push(i.transcriptSource === "whisper" ? "## Audio dan narasi" : "## Audio (dugaan dari visual dan transkrip)");
  out.push("");
  out.push(a.audio_dugaan.trim());
  out.push("");

  out.push("## Brief");
  out.push("");
  out.push(`- **Hook:** ${a.brief.hook}`);
  out.push(`- **Pesan inti:** ${a.brief.pesan_inti}`);
  out.push(`- **Janji ke penonton:** ${a.brief.janji}`);
  out.push(`- **Audiens:** ${a.brief.audiens}`);
  out.push(`- **Nada:** ${a.brief.nada}`);
  out.push(`- **CTA:** ${a.brief.cta}`);
  out.push("");

  out.push("## Aturan untuk meniru gaya ini");
  out.push("");
  out.push("Lakukan:");
  out.push("");
  for (const r of a.aturan_lakukan) out.push(`- ${r}`);
  out.push("");
  out.push("Hindari:");
  out.push("");
  for (const r of a.aturan_hindari) out.push(`- ${r}`);
  out.push("");

  out.push("## Langkah produksi");
  out.push("");
  a.langkah_produksi.forEach((step, n) => out.push(`${n + 1}. ${step}`));
  out.push("");

  out.push("## Frame referensi");
  out.push("");
  out.push("File ada di folder `frames/` di samping SKILL.md (unduh paket lengkap dari aplikasi).");
  out.push("");
  for (const f of i.frames) {
    const cover = f.idx === a.cover_frame_index ? " (sampul)" : "";
    out.push(`- \`frames/${f.file}\` · ${timecode(f.t)} · ${frameKindLabel(f.kind)}${cover}`);
  }
  for (const sh of i.sheets) out.push(`- \`frames/${sh.file}\` · contact sheet ${timecode(sh.start)}–${timecode(sh.end)}, timecode di tiap ubin`);
  for (const st of i.strips) out.push(`- \`frames/${st.file}\` · potongan gerak: ${st.label}`);
  out.push("");

  if (i.qa) out.push(...qaSection(i.qa));

  out.push("## Catatan keyakinan");
  out.push("");
  out.push(a.keyakinan.trim());
  out.push("");

  out.push("---");
  out.push("");
  out.push(`Kata kunci: ${a.kata_kunci.join(", ")}.`);
  out.push("");
  out.push(
    `Dibuat oleh motionrev pada ${i.createdAt.toISOString().slice(0, 10)} dari ${i.sourceType === "url" ? i.source : `file ${i.source}`}. ` +
      (i.transcriptSource === "whisper"
        ? "Narasi ditranskrip dari audio dengan whisper; musik dan efek suara tetap dugaan."
        : "Audio tidak dianalisis langsung; bagian audio adalah dugaan."),
  );
  out.push("");
  return out.join("\n");
}

function yamlString(s: string): string {
  // Double-quoted YAML scalar: escape backslash and quote, keep it on one line.
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ")}"`;
}
