import Link from "next/link";

export const metadata = { title: "Bantuan · motionrev" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Berapa lama satu video Talking Head dirender?",
    a: "Biasanya 10–30 menit, tergantung panjang video dan style. Video dikerjakan satu per satu; di daftar \"Video kamu\" terlihat langkah yang sedang berjalan, sudah berapa lama, dan perkiraan selesainya.",
  },
  {
    q: "Apa bedanya Talking Head dan Bedah Video?",
    a: "Talking Head mengedit rekamanmu sendiri jadi reel lengkap dengan caption dan motion graphic. Bedah Video membaca video orang lain yang kamu suka, lalu menulis resep gayanya (SKILL.md) untuk dipelajari atau ditiru.",
  },
  {
    q: "Generate video atau Editor Mode?",
    a: "Keduanya dibuat dengan motlab. Generate video langsung merender MP4, jadi kamu tinggal menunggu lalu mengunduh. Editor Mode membuka proyeknya di editor motlab: kamu bisa memutar per frame, memberi catatan, lalu menekan Export sendiri. Hasil ekspornya otomatis muncul di daftar \"Video kamu\".",
  },
  {
    q: "Apa itu Cut & Fill?",
    a: "Pilihan di langkah 5. Kalau dicentang, bagian diam dan kata pengisi seperti \"eeeee\" atau \"mmmmm\" dipotong, jadi videonya lebih pendek dan padat. Kalau tidak dicentang (bawaan), rekamanmu dipakai utuh dengan durasi aslinya.",
  },
  {
    q: "Kreditku terpotong tapi videonya gagal?",
    a: "Kredit untuk video yang gagal, atau yang kamu hapus sebelum mulai dirender, dikembalikan otomatis. Riwayatnya bisa dilihat di halaman Kredit.",
  },
  {
    q: "Kenapa warna atau font hasilnya sedikit beda dari pilihan?",
    a: "Setiap style punya aturan desainnya sendiri. Warna dan font pilihanmu dipakai untuk caption dan aksen utama, sementara beberapa elemen kecil mengikuti style supaya tetap rapi.",
  },
  {
    q: "Video sumberku disimpan di mana?",
    a: "Di server layanan ini, hanya bisa dibuka akunmu. Admin bisa mengatur agar video sumber dihapus otomatis begitu hasilnya jadi.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold">Bantuan</h1>
        <p className="mt-1 text-sm text-muted">Cara merekam yang bagus, cara kerja motionrev, dan jawaban untuk pertanyaan yang sering muncul.</p>
      </header>

      <section aria-labelledby="rekam-h" className="panel p-5">
        <h2 id="rekam-h" className="text-base font-semibold">
          Tips merekam talking head
        </h2>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Tip title="Vertikal 9:16">Rekam tegak dengan kamera belakang atau depan HP. Wajah di sepertiga atas layar.</Tip>
          <Tip title="Cahaya dari depan">Hadap jendela atau lampu. Hindari cahaya dari belakang kepala.</Tip>
          <Tip title="Suara jelas">Rekam di ruangan sepi, HP tidak lebih dari satu lengan. Mic clip-on lebih bagus lagi.</Tip>
          <Tip title="Jeda tidak masalah">
            Centang <strong className="text-fg">Cut &amp; Fill</strong> supaya jeda dan &ldquo;eee&rdquo; dipotong otomatis. Kamu bisa
            mengulang kalimat yang salah tanpa berhenti merekam.
          </Tip>
          <Tip title="Durasi 15–90 detik">Paling pas untuk Reels dan TikTok. Video lebih panjang butuh waktu render lebih lama.</Tip>
          <Tip title="Sebut kata kuncinya">Kalau mau CTA &ldquo;komen KATA&rdquo;, ucapkan kata itu di akhir video.</Tip>
        </ul>
      </section>

      <section aria-labelledby="alur-h" className="panel p-5">
        <h2 id="alur-h" className="text-base font-semibold">
          Cara kerja Talking Head
        </h2>
        <ol className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <Step n={1} title="Unggah dan pilih">
            Unggah rekaman, lalu pilih style, warna, dan font. Simpan pilihan favorit di{" "}
            <Link href="/brand" className="text-fg">
              Brand Kit
            </Link>
            .
          </Step>
          <Step n={2} title="Diedit otomatis">
            Transkrip dibuat, jeda dipotong kalau Cut &amp; Fill dicentang, caption per kata dan motion graphic disusun, lalu dicek
            per frame.
          </Step>
          <Step n={3} title="Unduh dan posting">
            Hasil MP4 720×1280 muncul di daftar &ldquo;Video kamu&rdquo;. Putar langsung atau unduh.
          </Step>
        </ol>
      </section>

      <section aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-base font-semibold">
          Pertanyaan umum
        </h2>
        <div className="panel mt-3 divide-y divide-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {f.q}
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-line-2 pl-3">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-muted">{children}</p>
    </li>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-[3px] border border-line p-3">
      <p className="flex items-center gap-2 font-medium">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] border border-line-2 font-mono text-xs text-muted">{n}</span>
        {title}
      </p>
      <p className="mt-1 text-muted">{children}</p>
    </li>
  );
}
