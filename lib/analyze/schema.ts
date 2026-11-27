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
    .describe(
      "Markdown. Tata letak layar sebagai pita dari atas ke bawah dengan rentang persen TINGGI frame (isi dan warna tiap pita), diperiksa di minimal tiga adegan, dengan pengecualian per adegan. Lalu di mana judul, subjek, caption; safe area; ruang kosong; pola yang berulang.",
    ),
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
    .describe("Markdown. Judul, subjudul, label, chip, dan angka di layar: posisi (px asli dan % tinggi), font, bobot, ukuran px, warna, kasus huruf, kapan muncul. Caption narasi ditulis di field caption."),
  caption: z
    .object({
      ada: z.boolean(),
      posisi: z.string().describe("Letak pita caption: px asli dan % tinggi frame, rata kiri/tengah, lebar maksimal"),
      font: z.string().describe("Jenis, bobot, kasus huruf, ukuran px asli dan % tinggi"),
      warna: z.string().describe("Hex untuk kata yang sedang diucapkan, kata yang sudah lewat, dan kata berikutnya bila terlihat"),
      unit: z.string().describe("Per kata, per frasa, atau per kalimat; berapa kata per halaman; jumlah baris yang terlihat (dengan timecode contoh)"),
      masuk_keluar: z.string().describe("Bagaimana kata masuk (fade, blur, pop) dan bagaimana satu halaman caption hilang, dari potongan gerak pita caption"),
      sorotan: z.string().describe("Penanda kata kunci: bentuk, warna isi dan garis (hex), satu kotak per kata atau per frasa, berapa per kalimat, contoh timecode"),
    })
    .describe("Perilaku caption narasi. Isi ada=false dan field lain '-' bila tidak ada caption."),
  perangkat_berulang: z
    .array(
      z.object({
        nama: z.string().describe("Nama perangkat: penampang x-ray, label garis penunjuk, chip, penghitung angka, tracker langkah, kotak sorotan, dll"),
        deskripsi: z.string().describe("Tampilan dan animasinya, dengan warna hex dan posisi"),
        muncul: z.array(z.string()).describe("Setiap timecode hh:mm:ss.ff saat perangkat ini terlihat (awal tiap kemunculan)"),
      }),
    )
    .describe("Setiap perangkat visual yang dipakai, termasuk yang hanya muncul sekali, dengan semua kemunculannya."),
  akhir_video: z.string().describe("Bagaimana video berakhir di detik-detik terakhir: shot apa, fade ke hitam, loop ke awal, kartu akhir. Dengan timecode."),
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
