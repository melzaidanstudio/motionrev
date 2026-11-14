# DESIGN.md: motionrev

Arah dari pemilik produk (dipilih 8 Nov 2026): **gelap seperti NLE** (Premiere, DaVinci). Frame video
adalah benda paling terang di layar; UI mundur ke belakang seperti panel editor.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Identitas

- **Produk:** alat untuk membedah video jadi menjadi SKILL.md (gaya visual, cut, transisi, brief).
- **Pengguna:** kreator video dan tim yang mau meniru gaya sebuah video dengan Claude.
- **Kepribadian:** meja kerja editor. Padat, presisi, tidak banyak hiasan. Angka adalah data, bukan dekorasi.

## Motif identitas: penggaris timecode

Satu motif yang diulang di setiap halaman: strip timecode dengan tick mark, seperti ruler timeline NLE.
Muncul sebagai garis status di header, label `00:00:12.40` di tiap frame, dan bar kemajuan analisis.

## Palet (2 inti + 1 aksen, merah hanya untuk error)

| Token | Nilai | Alasan |
|---|---|---|
| `--bg` | `#141518` | dasar charcoal, bukan hitam pekat, supaya frame gelap masih terpisah dari latar |
| `--panel` | `#1c1e22` | panel satu tingkat lebih terang, dipisah garis, bukan bayangan |
| `--line` | `#2b2e34` | garis 1px pembatas panel (NLE memakai garis, bukan shadow) |
| `--fg` | `#e8e6e1` | off-white hangat, kontras 12:1 di atas `--bg` |
| `--muted` | `#9d9b95` | teks sekunder, kontras 5.9:1 di atas `--bg` |
| `--accent` | `#f2b134` | amber playhead/marker: satu aksen, dipakai di playhead, kata sorotan, tombol utama |
| `--danger` | `#e5484d` | hanya status error dan tombol hapus |

Aksen hanya di: tombol utama (satu per layar), status "berjalan", playhead di filmstrip. Tidak di ikon, garis, atau latar.

## Tipografi

- **IBM Plex Sans** untuk UI: netral, berkarakter teknis, tetap terbaca kecil di panel padat.
- **IBM Plex Mono** hanya untuk timecode, angka ukur, dan SKILL.md mentah: data tabular memang butuh lebar tetap, dan satu keluarga font menjaga kesatuan.
- Tidak ada heading monospace besar, tidak ada uppercase bertracking lebar.

## Bentuk

- Radius 3px di semua kontrol (panel NLE hampir persegi). Tidak ada pill.
- Tidak ada shadow dan glow. Elevasi dinyatakan dengan garis dan warna panel.
- Spasi: 8px skala. Panel padat (12-16px), pemisah bagian longgar (32-48px).

## Gerak

MOTION 1: hover state dan bar kemajuan yang bergerak hanya mengikuti progres nyata. Tidak ada loop, tidak ada fade-up massal.

## Bahasa

UI berbahasa Indonesia, kalimat pendek. CTA spesifik: "Mulai bedah", "Unduh SKILL.md", "Hapus analisis".
