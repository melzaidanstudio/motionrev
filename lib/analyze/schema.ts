import { z } from "zod";

/** What the model returns. Keys are stable; the content is Indonesian prose and markdown. */
export const AnalysisSchema = z.object({
  nama: z.string().describe("Nama pendek untuk gaya ini, Title Case, maksimal 6 kata. Pakai nama dari pengguna bila diberikan."),
  deskripsi: z
    .string()
    .describe("Satu sampai dua kalimat: video apa ini dan apa ciri gayanya. Dipakai sebagai description di frontmatter SKILL.md."),
  kapan_dipakai: z
    .string()
    .describe("Satu kalimat: kapan skill ini dipakai (jenis permintaan pengguna yang cocok), untuk frontmatter description."),
  format: z.object({
    jenis: z.string().describe("Contoh: explainer, talking head, product demo, motion graphic, vlog, iklan"),
    platform_dugaan: z.string().describe("Platform yang paling cocok dilihat dari orientasi, durasi, caption. Tandai sebagai dugaan."),
    orientasi: z.string(),
    kelas_durasi: z.string().describe("Contoh: short <60 s, mid 1-3 mnt, long >3 mnt"),
  }),
  ringkasan_isi: z.string().describe("3-5 kalimat: apa yang disampaikan video ini, urutannya, dan inti pesannya."),
  gaya_visual: z
    .string()
    .describe(
      "Markdown. Palet warna (perkiraan hex, tandai 'perkiraan'), tipografi (jenis, bobot, ukuran relatif, kasus huruf), gaya ilustrasi atau footage, pencahayaan, tekstur, kamera dan framing. Setiap klaim merujuk frame atau timecode.",
    ),
  komposisi: z
    .string()
    .describe("Markdown. Tata letak layar: di mana judul, subjek, caption; safe area; rasio; ruang kosong; pola yang berulang."),
  editing: z
    .string()
    .describe(
      "Markdown. Tempo dan ritme dengan merujuk angka cut yang terukur, gaya potongan (hard cut, jump cut, match cut), kapan tempo berubah, cara video dibuka dan ditutup, apakah loop.",
    ),
  transisi: z
    .array(
      z.object({
        t: z.string().describe("Timecode hh:mm:ss.ff dari daftar cut yang diberikan"),
        jenis: z.string().describe("hard cut, dissolve, wipe, zoom in, whip pan, morph, dll"),
        catatan: z.string().describe("Apa yang berpindah dan bagaimana, dalam satu kalimat"),
      }),
    )
    .describe("Transisi yang terlihat jelas, maksimal 12, pilih yang mewakili."),
  motion_graphics: z
    .string()
    .describe("Markdown. Animasi teks, elemen grafis, easing, durasi masuk/keluar, kamera virtual, stiker, highlight. Tulis 'tidak ada' bila memang tidak ada."),
  teks_dan_caption: z
    .string()
    .describe("Markdown. Caption: ada atau tidak, posisi, font, warna sorotan, per kata atau per baris, kasus huruf. Judul dan label di layar."),
  audio_dugaan: z
    .string()
    .describe("Apa yang bisa disimpulkan soal audio dari visual dan transkrip (narasi, musik, SFX). Tandai jelas sebagai dugaan bila tidak ada transkrip."),
  struktur: z
    .array(
      z.object({
        mulai: z.string().describe("Timecode hh:mm:ss.ff"),
        selesai: z.string(),
        bagian: z.string().describe("Nama bagian: hook, masalah, penjelasan, contoh, CTA, dll"),
        isi: z.string().describe("Apa yang terjadi di layar dan dikatakan, satu sampai dua kalimat"),
      }),
    )
    .describe("Beat demi beat dari awal sampai akhir, 4-12 baris."),
  brief: z.object({
    hook: z.string().describe("Kalimat atau gambar pembuka yang menahan penonton, dan kenapa"),
    pesan_inti: z.string(),
    janji: z.string().describe("Apa yang penonton dapat kalau menonton sampai habis"),
    audiens: z.string(),
    nada: z.string().describe("Nada bicara dan sikap: santai, teknis, lucu, dsb"),
    cta: z.string().describe("Ajakan di akhir, atau 'tidak ada'"),
  }),
  aturan_lakukan: z.array(z.string()).describe("8-15 aturan konkret untuk meniru gaya ini. Setiap aturan bisa diperiksa dari frame."),
  aturan_hindari: z.array(z.string()).describe("5-10 hal yang tidak dilakukan video ini dan harus dihindari agar tetap mirip."),
  langkah_produksi: z
    .array(z.string())
    .describe("Urutan kerja untuk membuat video baru dengan gaya ini: dari naskah sampai render, 6-12 langkah."),
  cover_frame_index: z
    .number()
    .int()
    .describe("Indeks frame (dari daftar frame yang diberikan) yang paling mewakili gaya ini sebagai sampul."),
  kata_kunci: z.array(z.string()).describe("5-10 tag pendek, huruf kecil."),
  keyakinan: z
    .string()
    .describe("Satu kalimat: bagian mana dari analisis ini yang paling tidak pasti dan kenapa."),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
