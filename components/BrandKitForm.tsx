"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandKit } from "@/lib/brandKit";
import { FOLLOW_STYLE, FONTS, PALETTES, STYLES, fontById, paletteById, styleById, type FontId } from "@/lib/talkingHead/options";
import { OptionCard, Swatches } from "./talking-head/TalkingHeadWizard";

/** Save the look new Talking Head videos start with, and preview it as a caption card. */
export function BrandKitForm({ initial, fontClass }: { initial: BrandKit | null; fontClass: Record<FontId, string> }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [style, setStyle] = useState<string | null>(initial?.style ?? null);
  const [palette, setPalette] = useState(initial?.palette ?? FOLLOW_STYLE);
  const [font, setFont] = useState(initial?.font ?? FOLLOW_STYLE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameId = useId();

  const s = style ? styleById(style) : undefined;
  const p = paletteById(palette === FOLLOW_STYLE ? (s?.palette ?? "monokrom") : palette)!;
  const f = fontById(font === FOLLOW_STYLE ? (s?.font ?? "poppins") : font)!;

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, style, palette, font }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error ?? "Gagal menyimpan." });
    setMsg({ ok: true, text: "Tersimpan. Video Talking Head berikutnya langsung memakai tampilan ini." });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
      <div className="space-y-6">
        <section className="panel p-4 md:p-5">
          <label htmlFor={nameId} className="block text-sm font-medium">
            Nama brand
          </label>
          <input
            id={nameId}
            className="field mt-1"
            value={name}
            maxLength={60}
            placeholder="Misalnya: Toko Kopi Senja"
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </section>

        <fieldset className="panel p-4 md:p-5">
          <legend className="px-1 text-base font-semibold">Style utama</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {STYLES.map((x) => (
              <OptionCard key={x.id} name="b-style" value={x.id} checked={style === x.id} onChange={setStyle} disabled={busy}>
                <span className="font-medium">{x.name}</span>
                <span className="mt-1 block text-xs leading-snug text-muted">{x.blurb}</span>
              </OptionCard>
            ))}
          </div>
        </fieldset>

        <fieldset className="panel p-4 md:p-5">
          <legend className="px-1 text-base font-semibold">Warna brand</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <OptionCard name="b-palette" value={FOLLOW_STYLE} checked={palette === FOLLOW_STYLE} onChange={setPalette} disabled={busy}>
              <span className="block font-medium">Bawaan style</span>
            </OptionCard>
            {PALETTES.map((x) => (
              <OptionCard key={x.id} name="b-palette" value={x.id} checked={palette === x.id} onChange={setPalette} disabled={busy}>
                <Swatches colors={x.colors} />
                <span className="mt-2 block text-sm">{x.name}</span>
              </OptionCard>
            ))}
          </div>
        </fieldset>

        <fieldset className="panel p-4 md:p-5">
          <legend className="px-1 text-base font-semibold">Font brand</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <OptionCard name="b-font" value={FOLLOW_STYLE} checked={font === FOLLOW_STYLE} onChange={setFont} disabled={busy}>
              <span className="block font-medium">Bawaan style</span>
            </OptionCard>
            {FONTS.map((x) => (
              <OptionCard key={x.id} name="b-font" value={x.id} checked={font === x.id} onChange={setFont} disabled={busy}>
                <span className={`block truncate text-2xl leading-tight ${fontClass[x.id]}`} aria-hidden="true">
                  konsultasi
                </span>
                <span className="mt-1 block text-xs text-muted">{x.name}</span>
              </OptionCard>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan Brand Kit"}
          </button>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-fg" : "text-danger"}`}>
              {msg.text}
            </p>
          )}
        </div>
      </div>

      <aside aria-label="Pratinjau" className="lg:sticky lg:top-6">
        <p className="mb-2 text-xs text-muted">Pratinjau caption</p>
        <div
          className="flex aspect-[9/16] w-full max-w-64 flex-col items-center justify-end overflow-hidden rounded-[3px] border border-line p-4 pb-16"
          style={{ background: `linear-gradient(180deg, ${p.colors[0]}cc, ${p.colors[0]})` }}
        >
          <span className="text-sm" style={{ color: p.colors[2] }}>
            lagi
          </span>
          <span className={`text-4xl leading-tight ${fontClass[f.id as FontId]}`} style={{ color: p.colors[1] }}>
            konsultasi
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          {name || "Brand kamu"} · {s?.name ?? "style belum dipilih"} · {p.name} · {f.name}
        </p>
      </aside>
    </div>
  );
}
