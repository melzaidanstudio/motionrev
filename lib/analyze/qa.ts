import { z } from "zod";

/**
 * Quality gate for everything Bedah Video hands out (the visual SKILL.md and its zip, and the script skill).
 * Each result goes through:
 *   1. Uji: deterministic checks in code (timecodes inside the video, hard cuts where the detector measured them,
 *      quotes that really are in the transcript, word counts, ...).
 *   2. Audit: a second model call checks every concrete claim against the evidence and lists what was missed.
 *   3. Revisi: when the score is below PASS_SCORE, the findings go back to the model to fix, and the result is
 *      tested and audited again, up to MAX_ROUNDS audits. The best-scoring version is kept.
 * Score = 10 × (benar + ½·sebagian) / (benar + sebagian + salah + terlewat penting + uji gagal).
 */
export const PASS_SCORE = 9.5;
export const MAX_ROUNDS = 3;

export const AuditSchema = z.object({
  klaim: z
    .array(
      z.object({
        bagian: z.string().describe("Bagian dokumen tempat klaim ini ada"),
        klaim: z.string().describe("Klaimnya, diringkas dalam satu kalimat"),
        vonis: z.enum(["benar", "sebagian", "salah", "tak_terverifikasi"]),
        bukti: z.string().describe("Timecode, frame, ubin, atau kalimat transkrip yang jadi dasar vonis"),
        koreksi: z.string().describe("Untuk sebagian/salah: apa yang benar menurut bukti. Kosongkan untuk benar."),
      }),
    )
    .describe("SETIAP klaim konkret yang bisa diperiksa (posisi, ukuran, warna, font, timecode, urutan, perilaku, aturan, kutipan, angka). Biasanya 50-150 klaim."),
  terlewat: z
    .array(
      z.object({
        apa: z.string().describe("Hal penting yang ada di bukti tetapi tidak disebut dokumen"),
        timecode: z.string(),
        penting: z.boolean().describe("true bila pembuat ulang akan gagal meniru gaya tanpa hal ini"),
      }),
    )
    .describe("Hal yang terlewat. Jangan mengulang klaim yang sudah dinilai."),
  ringkasan: z.string().describe("Dua sampai tiga kalimat: kualitas dokumen dan masalah terbesarnya."),
});

export type Audit = z.infer<typeof AuditSchema>;

export interface QaReport {
  score: number;
  passed: boolean;
  /** How many audits ran. */
  rounds: number;
  /** Score after each audit, in order. */
  history: number[];
  counts: { benar: number; sebagian: number; salah: number; tak_terverifikasi: number; terlewat_penting: number; uji_gagal: number };
  /** Deterministic checks that still fail on the kept version. */
  tests: string[];
  /** The remaining wrong or partial claims and important misses, for the reader. */
  issues: string[];
  /** Findings of every audit round, in order: shows what the first draft got wrong, for tuning the prompts. */
  roundIssues?: string[][];
  summary: string;
  checkedAt: string;
}

export function scoreOf(audit: Audit, testFailures: string[]): { score: number; counts: QaReport["counts"] } {
  const c = { benar: 0, sebagian: 0, salah: 0, tak_terverifikasi: 0, terlewat_penting: 0, uji_gagal: testFailures.length };
  for (const k of audit.klaim) c[k.vonis]++;
  c.terlewat_penting = audit.terlewat.filter((t) => t.penting).length;
  const denom = c.benar + c.sebagian + c.salah + c.terlewat_penting + c.uji_gagal;
  const score = denom ? (10 * (c.benar + 0.5 * c.sebagian)) / denom : 0;
  return { score: Math.round(score * 100) / 100, counts: c };
}

export function findingsText(audit: Audit, testFailures: string[]): string {
  const lines: string[] = [];
  if (testFailures.length) {
    lines.push("UJI OTOMATIS YANG GAGAL (pasti salah, wajib diperbaiki):");
    for (const t of testFailures) lines.push(`- ${t}`);
  }
  const bad = audit.klaim.filter((k) => k.vonis === "salah" || k.vonis === "sebagian");
  if (bad.length) {
    lines.push("", "KLAIM SALAH ATAU SEBAGIAN BENAR (perbaiki sesuai koreksi, atau hapus bila tidak bisa dibuktikan):");
    for (const k of bad) lines.push(`- [${k.vonis}] (${k.bagian}) ${k.klaim} → ${k.koreksi} (bukti: ${k.bukti})`);
  }
  const unverifiable = audit.klaim.filter((k) => k.vonis === "tak_terverifikasi");
  if (unverifiable.length) {
    lines.push("", "KLAIM TAK TERVERIFIKASI (tandai sebagai dugaan atau hapus):");
    for (const k of unverifiable) lines.push(`- (${k.bagian}) ${k.klaim}`);
  }
  if (audit.terlewat.length) {
    lines.push("", "HAL YANG TERLEWAT (tambahkan ke field yang tepat):");
    for (const t of audit.terlewat) lines.push(`- ${t.penting ? "[penting] " : ""}${t.apa} (${t.timecode})`);
  }
  return lines.join("\n");
}

/**
 * Test, audit, and revise until the score reaches PASS_SCORE or MAX_ROUNDS audits have run. Keeps the best version.
 */
export async function qaLoop<A>(o: {
  analysis: A;
  compose: (a: A) => string;
  tests: (a: A) => string[];
  audit: (doc: string) => Promise<Audit>;
  revise: (a: A, findings: string) => Promise<A>;
  onPhase?: (round: number, phase: "audit" | "revisi") => void;
  maxRounds?: number;
}): Promise<{ analysis: A; report: QaReport }> {
  const maxRounds = o.maxRounds ?? MAX_ROUNDS;
  let current = o.analysis;
  let best: { analysis: A; report: QaReport } | null = null;
  const history: number[] = [];
  const roundIssues: string[][] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const tests = o.tests(current);
    o.onPhase?.(round, "audit");
    const audit = await o.audit(o.compose(current));
    const { score, counts } = scoreOf(audit, tests);
    history.push(score);
    const issues = [
      ...tests.map((t) => `uji gagal: ${t}`),
      ...audit.klaim.filter((k) => k.vonis === "salah" || k.vonis === "sebagian").map((k) => `${k.vonis}: ${k.klaim} → ${k.koreksi}`),
      ...audit.terlewat.filter((t) => t.penting).map((t) => `terlewat: ${t.apa} (${t.timecode})`),
    ];
    roundIssues.push(issues);
    const report: QaReport = {
      score,
      passed: score >= PASS_SCORE,
      rounds: round,
      history: [...history],
      counts,
      tests,
      issues: issues.filter((x) => !x.startsWith("uji gagal: ")).slice(0, 20),
      summary: audit.ringkasan,
      checkedAt: new Date().toISOString(),
    };
    if (!best || score > best.report.score) best = { analysis: current, report };
    else best.report = { ...best.report, rounds: round, history: [...history] };
    best.report.roundIssues = roundIssues.map((r) => [...r]);
    if (report.passed || round === maxRounds) break;
    o.onPhase?.(round, "revisi");
    current = await o.revise(current, findingsText(audit, tests));
  }
  return best!;
}

/** "9,66/10". Two decimals, so a 9.46 never shows as a passing "9,5". */
export function formatScore(score: number): string {
  return `${score.toFixed(2).replace(".", ",")}/10`;
}

/** The section both SKILL files end with, so the score travels with the file. */
export function qaSection(r: QaReport): string[] {
  const c = r.counts;
  const out = [
    "## Audit dan uji",
    "",
    `**Skor ${formatScore(r.score)} · ${r.passed ? "LULUS" : "BELUM LULUS"}** (ambang ${formatScore(PASS_SCORE)}, ketepatan minimal 95%).`,
    "",
    `Diperiksa ${r.rounds} putaran audit (skor per putaran: ${r.history.map(formatScore).join(" → ")}). ` +
      `Klaim benar ${c.benar}, sebagian ${c.sebagian}, salah ${c.salah}, tak terverifikasi ${c.tak_terverifikasi}; ` +
      `hal penting terlewat ${c.terlewat_penting}; uji otomatis gagal ${c.uji_gagal}.`,
    "",
    r.summary,
    "",
  ];
  if (!r.passed && r.issues.length) {
    out.push("Masalah yang tersisa:", "");
    for (const i of r.issues.slice(0, 10)) out.push(`- ${i}`);
    out.push("");
  }
  return out;
}
