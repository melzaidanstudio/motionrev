"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandKit } from "@/lib/brandKit";
import {
  FOLLOW_STYLE,
  FONTS,
  MAX_TALKING_HEAD_BYTES,
  PALETTES,
  STYLES,
  TALKING_HEAD_VIDEO_EXT,
  fontById,
  paletteById,
  styleById,
  type FontId,
} from "@/lib/talkingHead/options";

type Mode = "render" | "editor";
type Upload =
  | { state: "idle" }
  | { state: "sending"; pct: number; mode: Mode; index: number; total: number }
  | { state: "error"; message: string };

/** Videos one Generate may queue at once. */
const MAX_BATCH = 10;

/**
 * Six numbered steps on one page: videos, style, colour mood, font, Cut & Fill, generate. Several videos can be
 * picked at once; Generate queues one task per video with the same look. Every step stays open so the
 * choices can be compared side by side; the step header turns into a check once that step is answered.
 */
export function TalkingHeadWizard({
  fontClass,
  price,
  balance,
  brand,
}: {
  fontClass: Record<FontId, string>;
  price: number;
  balance: number;
  brand: BrandKit | null;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // A saved Brand Kit fills in the look; each step can still be changed for this one video.
  const initial = {
    style: brand?.style ?? null,
    palette: brand?.palette ?? FOLLOW_STYLE,
    font: brand?.font ?? FOLLOW_STYLE,
  };
  const [style, setStyle] = useState<string | null>(initial.style);
  const [palette, setPalette] = useState<string>(initial.palette);
  const [font, setFont] = useState<string>(initial.font);
  const [cutFill, setCutFill] = useState(false); // off by default: the take stays exactly as spoken
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [done, setDone] = useState<number | null>(null); // how many tasks the last Generate queued
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), fileHelp: useId(), err: useId(), cut: useId(), cutHelp: useId() };

  // The preview shows one of the picked videos; its object URL is released whenever it changes.
  const urlRef = useRef<string | null>(null);
  function showPreview(f: File | undefined) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setPreviewUrl(urlRef.current);
  }
  function setList(next: File[], show = 0) {
    setFiles(next);
    const i = Math.min(show, Math.max(0, next.length - 1));
    setPreviewIndex(i);
    showPreview(next[i]);
  }
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const chosenStyle = style ? styleById(style) : undefined;
  const effectivePalette = paletteById(palette === FOLLOW_STYLE ? (chosenStyle?.palette ?? "") : palette);
  const effectiveFont = fontById(font === FOLLOW_STYLE ? (chosenStyle?.font ?? "") : font);
  const sending = upload.state === "sending";
  const cost = price * files.length;
  const missing =
    files.length === 0
      ? "Unggah videonya dulu (langkah 1)."
      : !style
        ? "Pilih style dulu (langkah 2)."
        : balance < cost
          ? `Kredit tidak cukup: saldo ${balance}, ${files.length} video butuh ${cost}.`
          : null;

  /** Add picked videos to the list, skipping duplicates and files that cannot be used. */
  function pickFiles(list: FileList | null) {
    setFileError(null);
    setDone(null);
    const next = [...files];
    const rejected: string[] = [];
    for (const f of Array.from(list ?? [])) {
      if (!TALKING_HEAD_VIDEO_EXT.test(f.name)) rejected.push(`${f.name} (format harus mp4, mov, mkv, webm, atau m4v)`);
      else if (f.size > MAX_TALKING_HEAD_BYTES) rejected.push(`${f.name} (lebih dari 500 MB)`);
      else if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      else if (next.length >= MAX_BATCH) rejected.push(`${f.name} (maksimal ${MAX_BATCH} video sekali generate)`);
      else next.push(f);
    }
    if (rejected.length) setFileError(`Tidak ditambahkan: ${rejected.join("; ")}.`);
    if (inputRef.current) inputRef.current.value = ""; // so the same file can be picked again after removing it
    setList(next, files.length ? previewIndex : 0);
  }

  function removeFile(i: number) {
    setList(
      files.filter((_, j) => j !== i),
      i < previewIndex ? previewIndex - 1 : previewIndex === i ? 0 : previewIndex,
    );
  }

  /** Upload one video as one task. XHR rather than fetch: it reports upload progress, which matters for big files. */
  function sendOne(file: File, mode: Mode, index: number, total: number): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("style", style!);
    fd.set("palette", palette);
    fd.set("font", font);
    fd.set("cutFill", cutFill ? "1" : "0");
    fd.set("mode", mode);
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/talking-heads");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUpload({ state: "sending", pct: Math.round((e.loaded / e.total) * 100), mode, index, total });
      };
      xhr.onload = () => {
        let j: { id?: string; error?: string } = {};
        try {
          j = JSON.parse(xhr.responseText);
        } catch {}
        resolve(xhr.status === 201 && j.id ? null : (j.error ?? `Server menjawab ${xhr.status}.`));
      };
      xhr.onerror = () => resolve("Koneksi terputus saat mengunggah.");
      xhr.send(fd);
    });
  }

  /** Queue every picked video as its own task, one upload after another. The look stays for the next batch. */
  async function generate(mode: Mode) {
    if (!files.length || !style || sending) return;
    const batch = [...files];
    let queued = 0;
    for (let i = 0; i < batch.length; i++) {
      setUpload({ state: "sending", pct: 0, mode, index: i + 1, total: batch.length });
      const err = await sendOne(batch[i], mode, i + 1, batch.length);
      if (err) {
        setList(batch.slice(i)); // what is left stays picked, so Generate can be pressed again
        setUpload({ state: "error", message: `${batch[i].name}: ${err}${queued ? ` (${queued} video sebelumnya sudah masuk antrean)` : ""}` });
        if (queued) router.refresh();
        return;
      }
      queued++;
      router.refresh(); // each task shows up in the queue as soon as it is in
    }
    setUpload({ state: "idle" });
    setDone(queued);
    setList([]);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {brand ? (
          <>
            Style, warna, dan font diisi dari <Link href="/brand" className="text-fg">Brand Kit</Link> kamu. Ubah di bawah kalau
            mau beda untuk video ini.
          </>
        ) : (
          <>
            Sering pakai tampilan yang sama? Simpan di <Link href="/brand" className="text-fg">Brand Kit</Link> supaya langkah 2–4
            terisi otomatis.
          </>
        )}
      </p>
      {/* 1. Upload */}
      <Step n={1} title="Upload video" done={files.length > 0}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <label htmlFor={ids.file} className="block text-sm font-medium">
              Video talking head (bisa pilih beberapa sekaligus)
            </label>
            <input
              ref={inputRef}
              id={ids.file}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v,.mp4,.mov,.mkv,.webm,.m4v"
              className="field mt-1 text-sm file:mr-3 file:rounded-[3px] file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-fg"
              aria-describedby={`${ids.fileHelp}${fileError ? ` ${ids.err}` : ""}`}
              aria-invalid={fileError ? true : undefined}
              multiple
              disabled={sending}
              onChange={(e) => pickFiles(e.target.files)}
            />
            <p id={ids.fileHelp} className="mt-1 text-xs text-muted">
              Rekaman ngomong ke kamera, sebaiknya vertikal 9:16. mp4, mov, mkv, webm, atau m4v, maksimal 500 MB per video,
              sampai {MAX_BATCH} video sekali generate. Setiap video jadi satu tugas di antrean.
            </p>
            {fileError && (
              <p id={ids.err} role="alert" className="mt-2 text-sm text-danger">
                {fileError}
              </p>
            )}
            {files.length > 0 && (
              <ul className="mt-3 divide-y divide-line rounded-[3px] border border-line" aria-label="Video dipilih">
                {files.map((f, i) => (
                  <li key={`${f.name}-${f.size}`} className={`flex items-center gap-2 px-3 py-1 text-sm ${i === previewIndex ? "bg-panel-2" : ""}`}>
                    <span className="w-5 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
                    <button
                      type="button"
                      className="min-h-9 min-w-0 flex-1 truncate text-left hover:text-fg"
                      onClick={() => {
                        setPreviewIndex(i);
                        showPreview(f);
                      }}
                      aria-label={`Pratinjau ${f.name}`}
                      aria-pressed={i === previewIndex}
                    >
                      {f.name}
                    </button>
                    <span className="shrink-0 font-mono text-xs text-muted">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      className="min-h-9 shrink-0 px-2 text-xs text-muted hover:text-danger disabled:opacity-50"
                      onClick={() => removeFile(i)}
                      disabled={sending}
                      aria-label={`Hapus ${f.name} dari daftar`}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div
            className={`aspect-[9/16] w-full max-w-40 overflow-hidden border border-line bg-bg sm:block sm:max-w-none ${
              previewUrl ? "" : "hidden"
            }`}
          >
            {previewUrl ? (
              <video src={previewUrl} className="h-full w-full object-cover" muted playsInline controls />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
                Pratinjau muncul di sini
              </div>
            )}
          </div>
        </div>
      </Step>

      {/* 2. Style */}
      <Step n={2} title="Pilih style" done={!!style}>
        <fieldset>
          <legend className="sr-only">Style edit</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {STYLES.map((s) => {
              const p = paletteById(s.palette)!;
              return (
                <OptionCard key={s.id} name="style" value={s.id} checked={style === s.id} onChange={setStyle} disabled={sending}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Swatches colors={p.colors} small />
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">{s.blurb}</span>
                </OptionCard>
              );
            })}
          </div>
        </fieldset>
      </Step>

      {/* 3. Colour mood */}
      <Step n={3} title="Pilih nuansa warna" done={!!style}>
        <fieldset>
          <legend className="sr-only">Nuansa warna</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <OptionCard name="palette" value={FOLLOW_STYLE} checked={palette === FOLLOW_STYLE} onChange={setPalette} disabled={sending}>
              <span className="block font-medium">Bawaan style</span>
              <span className="mt-1 block text-xs text-muted">
                {chosenStyle ? paletteById(chosenStyle.palette)?.name : "Ikut style yang dipilih"}
              </span>
            </OptionCard>
            {PALETTES.map((p) => (
              <OptionCard key={p.id} name="palette" value={p.id} checked={palette === p.id} onChange={setPalette} disabled={sending}>
                <Swatches colors={p.colors} />
                <span className="mt-2 block text-sm">{p.name}</span>
              </OptionCard>
            ))}
          </div>
        </fieldset>
      </Step>

      {/* 4. Font */}
      <Step n={4} title="Pilih font" done={!!style}>
        <fieldset>
          <legend className="sr-only">Font caption</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <OptionCard name="font" value={FOLLOW_STYLE} checked={font === FOLLOW_STYLE} onChange={setFont} disabled={sending}>
              <span className="block font-medium">Bawaan style</span>
              <span className="mt-1 block text-xs text-muted">
                {chosenStyle ? fontById(chosenStyle.font)?.name : "Ikut style yang dipilih"}
              </span>
            </OptionCard>
            {FONTS.map((f) => (
              <OptionCard key={f.id} name="font" value={f.id} checked={font === f.id} onChange={setFont} disabled={sending}>
                <span className={`block truncate text-2xl leading-tight ${fontClass[f.id]}`} aria-hidden="true">
                  lagi konsultasi
                </span>
                <span className="mt-1 block text-xs text-muted">{f.name}</span>
              </OptionCard>
            ))}
          </div>
        </fieldset>
      </Step>

      {/* 5. Cut & Fill */}
      <Step n={5} title="Cut & Fill" done={!!style}>
        <div className={`rounded-[3px] border p-4 ${cutFill ? "border-accent bg-panel-2" : "border-line"}`}>
          <div className="flex items-start gap-3">
            <input
              id={ids.cut}
              type="checkbox"
              checked={cutFill}
              onChange={(e) => setCutFill(e.target.checked)}
              disabled={sending}
              aria-describedby={ids.cutHelp}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
            />
            <div className="min-w-0">
              <label htmlFor={ids.cut} className="cursor-pointer font-medium">
                Potong jeda &amp; kata pengisi
              </label>
              <div id={ids.cutHelp} className="mt-1 text-sm text-muted">
                <p>
                  Buang bagian diam dan suara ragu seperti &ldquo;eee&rdquo;, &ldquo;mmm&rdquo;, atau &ldquo;hmm&rdquo; supaya video lebih
                  padat.
                </p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <span className="text-fg">Dicentang:</span> jeda dan kata pengisi dipotong otomatis. Video jadi lebih singkat dan
                    enak ditonton.
                  </li>
                  <li>
                    <span className="text-fg">Tidak dicentang:</span> video dipakai utuh, persis seperti saat direkam.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Step>

      {/* 6. Generate */}
      <Step n={6} title="Generate" done={done !== null}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Video</dt>
            <dd className="truncate">
              {files.length === 0 ? "belum ada" : files.length === 1 ? files[0].name : `${files.length} video, masing-masing jadi satu tugas`}
            </dd>
            <dt className="text-muted">Style</dt>
            <dd>{chosenStyle?.name ?? "belum dipilih"}</dd>
            <dt className="text-muted">Warna</dt>
            <dd className="flex items-center gap-2">
              {effectivePalette ? (
                <>
                  <Swatches colors={effectivePalette.colors} small />
                  {effectivePalette.name}
                  {palette === FOLLOW_STYLE && <span className="text-muted">(bawaan style)</span>}
                </>
              ) : (
                "bawaan style"
              )}
            </dd>
            <dt className="text-muted">Font</dt>
            <dd>
              {effectiveFont ? (
                <>
                  {effectiveFont.name}
                  {font === FOLLOW_STYLE && <span className="text-muted"> (bawaan style)</span>}
                </>
              ) : (
                "bawaan style"
              )}
            </dd>
            <dt className="text-muted">Cut &amp; Fill</dt>
            <dd>{cutFill ? "Potong jeda dan kata pengisi" : "Tidak, rekaman utuh"}</dd>
          </dl>
          <p className="text-xs text-muted md:text-right">{price > 0
            ? `Memakai ${files.length > 1 ? `${files.length} × ${price} = ${cost}` : price} kredit · saldo ${balance}`
            : "Gratis untuk admin"}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeButton
            primary
            title="Generate video"
            detail="Langsung dirender jadi MP4. Tinggal tunggu dan unduh."
            busyText={upload.state === "sending" && upload.mode === "render" ? uploadLabel(upload) : null}
            disabled={!!missing || sending}
            onClick={() => generate("render")}
          />
          <ModeButton
            title="Editor Mode"
            detail="Dibuka di editor motlab: putar per frame, beri catatan, lalu ekspor sendiri."
            busyText={upload.state === "sending" && upload.mode === "editor" ? uploadLabel(upload) : null}
            disabled={!!missing || sending}
            onClick={() => generate("editor")}
          />
        </div>

        {sending && (
          <div className="mt-4 h-1.5 w-full bg-bg" role="progressbar" aria-label="Unggahan" aria-valuenow={upload.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${upload.pct}%` }} />
          </div>
        )}
        <div aria-live="polite" className="mt-3 text-sm">
          {missing && done === null && <p className="text-muted">{missing}</p>}
          {upload.state === "error" && (
            <p role="alert" className="text-danger">
              {upload.message}
            </p>
          )}
          {done !== null && (
            <p>
              {done === 1 ? "1 video" : `${done} video`} masuk antrean dan dikerjakan satu per satu. Statusnya tampil di daftar di
              bawah. Pilihan style, warna, dan font tetap tersimpan, jadi kamu bisa langsung menambah video lain.
            </p>
          )}
        </div>
      </Step>
    </div>
  );
}

/** One of the two ways to start: a big button with a line saying what happens next. */
function ModeButton({
  title,
  detail,
  busyText,
  disabled,
  primary,
  onClick,
}: {
  title: string;
  detail: string;
  busyText: string | null;
  disabled: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-16 flex-col items-start justify-center rounded-[3px] border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
        primary ? "border-accent bg-accent text-accent-ink hover:bg-[#f7c252]" : "border-line-2 bg-panel-2 text-fg hover:border-muted"
      }`}
    >
      <span className="font-semibold">{busyText ?? title}</span>
      <span className={`mt-0.5 text-xs ${primary ? "text-accent-ink/80" : "text-muted"}`}>{detail}</span>
    </button>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  const hid = useId();
  return (
    <section aria-labelledby={hid} className="panel p-4 md:p-5">
      <h2 id={hid} className="mb-4 flex items-center gap-3 text-base font-semibold">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border font-mono text-sm ${
            done ? "border-accent bg-accent text-accent-ink" : "border-line-2 text-muted"
          }`}
          aria-hidden="true"
        >
          {done ? "✓" : n}
        </span>
        <span>
          <span className="sr-only">Langkah {n}: </span>
          {title}
          {done && <span className="sr-only"> (sudah)</span>}
        </span>
      </h2>
      {children}
    </section>
  );
}

/** A radio button drawn as a card; the native input stays for keyboard and screen readers. */
export function OptionCard({
  name,
  value,
  checked,
  onChange,
  disabled,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative block min-h-11 cursor-pointer rounded-[3px] border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        checked ? "border-accent bg-panel-2" : "border-line hover:border-line-2"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="sr-only"
      />
      {children}
    </label>
  );
}

export function Swatches({ colors, small }: { colors: readonly string[]; small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-6 flex-1";
  return (
    <span className={`flex ${small ? "gap-1" : "gap-0.5"}`} aria-hidden="true">
      {colors.map((c) => (
        <span key={c} className={`${size} rounded-[2px] border border-white/15`} style={{ background: c }} />
      ))}
    </span>
  );
}

function uploadLabel(u: { pct: number; index: number; total: number }): string {
  return u.total > 1 ? `Mengunggah ${u.index}/${u.total} · ${u.pct}%` : `Mengunggah ${u.pct}%`;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
