# motionrev

Bedah video jadi menjadi `SKILL.md`: gaya visual, komposisi, cut dan transisi, motion graphics,
caption, brief, aturan tiru, dan langkah produksi. Masukannya link video atau file; keluarannya
nama, deskripsi, frame kunci, dan SKILL.md yang bisa diunduh (sendiri atau zip bersama frame).
Semua hasil tersimpan di pustaka.

## Cara kerja

1. **Sumber.** Link diunduh dengan `yt-dlp` (plus subtitle dan judul bila ada); file diunggah langsung.
2. **Ukur.** `ffprobe` membaca durasi, resolusi, fps. `ffmpeg` mendeteksi cut (scene score > 0,3)
   dan menghitung panjang shot, tempo cut per menit.
3. **Frame.** Satu frame per awal shot (maksimal 20, ditambah sampel merata bila cut sedikit) dan satu
   contact sheet seluruh video.
4. **Analisis.** Frame, contact sheet, angka terukur, dan transkrip dikirim ke Claude dengan keluaran
   terstruktur (zod) melalui penyedia yang dipilih admin: Anthropic langsung, OpenRouter, endpoint lain
   yang kompatibel dengan Messages API Anthropic, atau Claude Code lokal (pribadi/dev saja). Bila
   endpoint menolak structured output, aplikasi meminta JSON lewat prompt lalu memvalidasinya.
   Audio tidak didengar langsung; bagian audio ditandai dugaan.
5. **Susun.** `SKILL.md` dirakit dari hasil terstruktur plus tabel fakta terukur, lalu disimpan di
   SQLite dan folder `data/analyses/<id>/`.

## Akun, kredit, dan admin

- **Akun pertama yang mendaftar menjadi admin** dan mengambil alih analisis yang dibuat sebelum ada akun.
  Daftarkan akunmu sendiri lebih dulu sebelum membuka layanan ke publik.
- Admin mengatur penyedia AI dan kuncinya di `/admin`. Kunci disimpan terenkripsi (AES-256-GCM dengan
  `MOTIONREV_SECRET`) dan tidak pernah dikirim ke browser.
- Pengguna membeli kredit dari admin. Setiap analisis memotong kredit sesuai harga yang diatur admin;
  analisis yang gagal dikembalikan otomatis. Admin tidak dipotong kredit.
- Pembelian kredit online lewat **doit.id** (QRIS, virtual account, transfer bank). Admin mengisi kunci
  API (`pb_test_…` untuk sandbox, `pb_live_…` untuk live), signing secret webhook, dan paket kredit di
  `/admin`. Pembeli memilih paket di `/kredit`, membayar di halaman doit.id, lalu kembali ke `/kredit`.
- Kredit ditambahkan hanya setelah status `paid` dibaca langsung dari API doit.id, tepat sekali per
  tagihan, dan hanya bila referensi serta jumlahnya cocok. Webhook (tanda tangan `PayBridge-Signature`
  HMAC-SHA256) memicu pembacaan itu; tombol "Cek status" melakukan hal sama bila webhook belum sampai.
- Tempel URL webhook yang ditampilkan di `/admin` ke portal doit.id (menu Developer). URL itu harus bisa
  dijangkau dari internet; di localhost, kredit masuk lewat "Cek status".
- Top-up manual oleh admin tetap tersedia untuk pembayaran di luar doit.id. Semua mutasi tercatat di
  buku besar.

## Syarat

- Node.js 20+, `ffmpeg` dan `ffprobe`, `yt-dlp` (untuk link).
- Kunci API dari penyedia pilihan admin (Anthropic atau OpenRouter), atau Claude Code yang sudah login
  untuk pemakaian pribadi.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # isi MOTIONREV_SECRET untuk produksi
npm run dev
```

Buka http://localhost:3000, daftar (akun pertama = admin), lalu atur penyedia di `/admin`.
Data ada di `data/` (diabaikan git); ubah lokasinya dengan `MOTIONREV_DATA_DIR`.

## Batas saat ini

- Antrean berjalan di dalam proses server: satu analisis sekaligus, satu server. Untuk banyak pengguna
  bersamaan, antrean perlu dipindah ke worker terpisah.
- Belum ada reset kata sandi maupun verifikasi email.
- Pengembalian dana dilakukan dari portal doit.id. Event webhook apa pun memicu pembacaan ulang status;
  status `refunded` menarik kembali kredit pembelian itu (saldo bisa menjadi negatif).
- Video maksimal 15 menit, unggahan maksimal 500 MB.
- Analisis yang sedang berjalan saat server dimulai ulang ditandai gagal; tekan "Jalankan ulang".

## Struktur

```
app/            halaman (pustaka, detail, masuk, daftar, kredit, admin) dan route API
components/     form, daftar, filmstrip, panel kemajuan, tampilan SKILL.md
lib/video/      run, download (yt-dlp), probe, scenes (cut), frames (ekstraksi, contact sheet)
lib/analyze/    schema (zod), prompt, claude (penyedia API), claudeCode (CLI lokal), index, skill
lib/auth.ts     sesi cookie, guard route, batas percobaan login
lib/settings.ts penyedia AI dan harga kredit (disimpan di database)
lib/crypto.ts   hash kata sandi (scrypt), token sesi, enkripsi kunci penyedia
lib/payments/   klien doit.id, verifikasi webhook, penyelesaian tagihan menjadi kredit
lib/jobs.ts     antrean dan pipeline
lib/db.ts       SQLite: analisis, pengguna, sesi, buku besar kredit, pengaturan
DESIGN.md       arah visual UI
```
