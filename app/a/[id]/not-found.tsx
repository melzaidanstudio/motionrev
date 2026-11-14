import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel p-6 text-sm">
      <p className="font-medium">Analisis tidak ditemukan.</p>
      <p className="mt-1 text-muted">Mungkin sudah dihapus, atau link-nya salah ketik.</p>
      <Link href="/" className="btn mt-4">
        Kembali ke pustaka
      </Link>
    </div>
  );
}
