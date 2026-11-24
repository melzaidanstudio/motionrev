import Database from "better-sqlite3";
import path from "node:path";
import { dataDir } from "./paths";

export type Status = "queued" | "downloading" | "extracting" | "analyzing" | "done" | "error";

export interface AnalysisRow {
  id: string;
  user_id: string | null;
  name: string;
  source_type: "url" | "file";
  source: string; // the URL, or the original file name
  status: Status;
  progress: number; // 0..100
  step: string; // human line shown under the progress bar
  error: string | null;
  description: string | null;
  skill_md: string | null;
  analysis_json: string | null; // structured result from the model
  stats_json: string | null; // measured facts from ffprobe/ffmpeg
  cover_frame: string | null; // file name inside frames/
  charge_open: number; // 1 while a credit charge for the current run is not settled
  created_at: string;
  updated_at: string;
}

export interface FrameRow {
  id: number;
  analysis_id: string;
  idx: number;
  t: number; // seconds
  file: string;
  kind: "cut" | "sample" | "sheet";
}

/** A Talking Head edit job: the uploaded clip plus the look the user picked. */
export interface TalkingHeadRow {
  id: string;
  user_id: string;
  source: string; // original file name
  size_bytes: number;
  style: string;
  palette: string; // palette id, or "style" to use the style's own
  font: string; // font id, or "style"
  cut_fill: number; // 1: cut pauses and filler words ("eee", "mmm"); 0: keep the take as spoken
  mode: "render" | "editor"; // render: straight to MP4; editor: build the motlab project and open it in the viewer
  pending_task: "notes" | null; // "notes": a finished video waits in the queue to have its motlab notes worked
  revision_summary: string | null; // what the last round of notes changed, in Claude's words
  status: "queued" | "rendering" | "done" | "error";
  step: string;
  error: string | null;
  output: string | null; // file name of the finished MP4 inside the job folder
  charge_open: number; // 1 while the credit charged at Generate is not settled
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: string;
}

export interface LedgerRow {
  id: number;
  user_id: string;
  delta: number;
  reason: "analysis" | "talking_head" | "refund" | "topup" | "adjust" | "signup" | "purchase" | "purchase_refund";
  analysis_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  step TEXT NOT NULL DEFAULT '',
  error TEXT,
  description TEXT,
  skill_md TEXT,
  analysis_json TEXT,
  stats_json TEXT,
  cover_frame TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  t REAL NOT NULL,
  file TEXT NOT NULL,
  kind TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS frames_by_analysis ON frames(analysis_id, idx);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  analysis_id TEXT,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_by_user ON credit_ledger(user_id, id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT,
  hosted_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  credited INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS payments_by_user ON payments(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS payments_by_provider ON payments(provider, provider_id);
CREATE TABLE IF NOT EXISTS talking_heads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  style TEXT NOT NULL,
  palette TEXT NOT NULL,
  font TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT NOT NULL DEFAULT '',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS talking_heads_by_user ON talking_heads(user_id, created_at);
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
`;

function addColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

function open(): Database.Database {
  const db = new Database(path.join(dataDir(), "motionrev.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // Columns added after the first release; existing databases get them here.
  addColumn(db, "analyses", "user_id", "user_id TEXT REFERENCES users(id) ON DELETE CASCADE");
  addColumn(db, "analyses", "charge_open", "charge_open INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE INDEX IF NOT EXISTS analyses_by_user ON analyses(user_id, created_at)");
  addColumn(db, "talking_heads", "output", "output TEXT");
  addColumn(db, "talking_heads", "charge_open", "charge_open INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "talking_heads", "cut_fill", "cut_fill INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "talking_heads", "mode", "mode TEXT NOT NULL DEFAULT 'render'");
  addColumn(db, "talking_heads", "pending_task", "pending_task TEXT");
  addColumn(db, "talking_heads", "revision_summary", "revision_summary TEXT");
  return db;
}

// One connection per process. `globalThis` keeps it across Next's dev-mode module reloads.
const g = globalThis as unknown as { __motionrevDb?: Database.Database };
export const db: Database.Database = g.__motionrevDb ?? (g.__motionrevDb = open());

const now = () => new Date().toISOString();

/* ---------------- analyses ---------------- */

export function listAnalyses(userId: string): AnalysisRow[] {
  return db
    .prepare("SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as AnalysisRow[];
}

export function getAnalysis(id: string): AnalysisRow | undefined {
  return db.prepare("SELECT * FROM analyses WHERE id = ?").get(id) as AnalysisRow | undefined;
}

export function listFrames(id: string): FrameRow[] {
  return db
    .prepare("SELECT * FROM frames WHERE analysis_id = ? ORDER BY idx")
    .all(id) as FrameRow[];
}

export function setProgress(id: string, status: Status, progress: number, step: string) {
  db.prepare(
    "UPDATE analyses SET status = ?, progress = ?, step = ?, error = NULL, updated_at = ? WHERE id = ?",
  ).run(status, progress, step, now(), id);
}

/** Mark failed and give back the credit charged for this run, once. */
export function setError(id: string, message: string) {
  db.transaction(() => {
    db.prepare(
      "UPDATE analyses SET status = 'error', error = ?, step = 'Gagal', updated_at = ? WHERE id = ?",
    ).run(message, now(), id);
    refundOpenCharge(id);
  })();
}

export function setResult(
  id: string,
  r: { description: string; skill_md: string; analysis_json: string; cover_frame: string | null; name?: string },
) {
  db.prepare(
    `UPDATE analyses SET status = 'done', progress = 100, step = 'Selesai', error = NULL, charge_open = 0,
       description = @description, skill_md = @skill_md, analysis_json = @analysis_json,
       cover_frame = @cover_frame, name = COALESCE(@name, name), updated_at = @t
     WHERE id = @id`,
  ).run({ id, t: now(), name: r.name ?? null, ...r });
}

export function setStats(id: string, stats: unknown) {
  db.prepare("UPDATE analyses SET stats_json = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(stats),
    now(),
    id,
  );
}

export function replaceFrames(id: string, frames: Omit<FrameRow, "id" | "analysis_id">[]) {
  const del = db.prepare("DELETE FROM frames WHERE analysis_id = ?");
  const ins = db.prepare(
    "INSERT INTO frames (analysis_id, idx, t, file, kind) VALUES (?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    del.run(id);
    for (const f of frames) ins.run(id, f.idx, f.t, f.file, f.kind);
  })();
}

/* ---------------- talking heads ---------------- */

/** Create the job and charge for it in one transaction; a failed render refunds it (setTalkingHeadError). */
export function insertTalkingHeadCharged(
  t: Pick<TalkingHeadRow, "id" | "user_id" | "source" | "size_bytes" | "style" | "palette" | "font" | "cut_fill" | "mode">,
  price: number,
) {
  db.transaction(() => {
    const bal = balanceOf(t.user_id);
    if (bal < price) throw new InsufficientCreditError(bal, price);
    const t0 = now();
    db.prepare(
      `INSERT INTO talking_heads (id, user_id, source, size_bytes, style, palette, font, cut_fill, mode, status, step, charge_open, created_at, updated_at)
       VALUES (@id, @user_id, @source, @size_bytes, @style, @palette, @font, @cut_fill, @mode, 'queued', 'Menunggu giliran', @open, @t, @t)`,
    ).run({ ...t, open: price > 0 ? 1 : 0, t: t0 });
    if (price > 0) {
      addLedger({ user_id: t.user_id, delta: -price, reason: "talking_head", analysis_id: t.id, note: null, created_by: null });
    }
  })();
}

/** Queue a finished video to have its motlab notes worked, and charge for the round (refunded if it fails). */
export function queueTalkingHeadNotes(id: string, userId: string, price: number) {
  db.transaction(() => {
    const bal = balanceOf(userId);
    if (bal < price) throw new InsufficientCreditError(bal, price);
    db.prepare(
      `UPDATE talking_heads SET status = 'queued', pending_task = 'notes', step = 'Menunggu giliran: kerjakan catatan',
         error = NULL, charge_open = ?, updated_at = ? WHERE id = ?`,
    ).run(price > 0 ? 1 : 0, now(), id);
    if (price > 0) {
      addLedger({ user_id: userId, delta: -price, reason: "talking_head", analysis_id: id, note: "kerjakan catatan", created_by: null });
    }
  })();
}

/** A round of notes is done: the video stays finished, with what changed. `output` is set when it was re-rendered. */
export function setTalkingHeadNotesDone(id: string, summary: string, output?: string) {
  db.prepare(
    `UPDATE talking_heads SET status = 'done', step = 'Selesai', pending_task = NULL, error = NULL, charge_open = 0,
       revision_summary = ?, output = COALESCE(?, output), updated_at = ? WHERE id = ?`,
  ).run(summary.slice(0, 4000), output ?? null, now(), id);
}

/** A round of notes failed: the video stays as it was (still finished), the error is shown and the charge refunded. */
export function setTalkingHeadNotesFailed(id: string, message: string) {
  db.transaction(() => {
    refundTalkingHead(id, "kerjakan catatan gagal");
    db.prepare(
      "UPDATE talking_heads SET status = 'done', step = 'Selesai', pending_task = NULL, error = ?, updated_at = ? WHERE id = ?",
    ).run(`Catatan gagal dikerjakan: ${message}`.slice(0, 1000), now(), id);
  })();
}

/** Take a notes round back out of the queue before it starts: the video is finished again and the charge refunded. */
export function cancelTalkingHeadNotes(id: string) {
  db.transaction(() => {
    refundTalkingHead(id, "kerjakan catatan dibatalkan");
    db.prepare(
      "UPDATE talking_heads SET status = 'done', step = 'Selesai', pending_task = NULL, updated_at = ? WHERE id = ? AND status = 'queued'",
    ).run(now(), id);
  })();
}

function refundTalkingHead(id: string, note: string) {
  const t = getTalkingHead(id);
  if (!t || !t.charge_open) return;
  const last = db
    .prepare("SELECT delta FROM credit_ledger WHERE analysis_id = ? AND reason = 'talking_head' ORDER BY id DESC LIMIT 1")
    .get(id) as { delta: number } | undefined;
  if (last && last.delta < 0) {
    addLedger({ user_id: t.user_id, delta: -last.delta, reason: "refund", analysis_id: id, note, created_by: null });
  }
  db.prepare("UPDATE talking_heads SET charge_open = 0 WHERE id = ?").run(id);
}

export function setTalkingHeadStep(id: string, status: "queued" | "rendering", step: string) {
  db.prepare("UPDATE talking_heads SET status = ?, step = ?, error = NULL, updated_at = ? WHERE id = ?").run(status, step, now(), id);
}

export function setTalkingHeadDone(id: string, output: string | null) {
  db.prepare(
    "UPDATE talking_heads SET status = 'done', step = 'Selesai', error = NULL, output = ?, charge_open = 0, updated_at = ? WHERE id = ?",
  ).run(output, now(), id);
}

/** Mark failed and give back the credit charged at Generate, once. */
export function setTalkingHeadError(id: string, message: string) {
  db.transaction(() => {
    db.prepare("UPDATE talking_heads SET status = 'error', step = 'Gagal', error = ?, updated_at = ? WHERE id = ?").run(
      message.slice(0, 1000),
      now(),
      id,
    );
    const t = getTalkingHead(id);
    if (!t || !t.charge_open) return;
    const last = db
      .prepare("SELECT delta FROM credit_ledger WHERE analysis_id = ? AND reason = 'talking_head' ORDER BY id DESC LIMIT 1")
      .get(id) as { delta: number } | undefined;
    if (last && last.delta < 0) {
      addLedger({ user_id: t.user_id, delta: -last.delta, reason: "refund", analysis_id: id, note: "render talking head gagal", created_by: null });
    }
    db.prepare("UPDATE talking_heads SET charge_open = 0 WHERE id = ?").run(id);
  })();
}

export function listTalkingHeads(userId: string): TalkingHeadRow[] {
  return db.prepare("SELECT * FROM talking_heads WHERE user_id = ? ORDER BY created_at DESC").all(userId) as TalkingHeadRow[];
}

/** Every job still waiting or rendering, across users, in the order the worker takes them. */
export function listTalkingHeadBacklog(): Pick<TalkingHeadRow, "id" | "status">[] {
  return db
    .prepare("SELECT id, status FROM talking_heads WHERE status IN ('queued', 'rendering') ORDER BY status = 'queued', created_at")
    .all() as Pick<TalkingHeadRow, "id" | "status">[];
}

export function getTalkingHead(id: string): TalkingHeadRow | undefined {
  return db.prepare("SELECT * FROM talking_heads WHERE id = ?").get(id) as TalkingHeadRow | undefined;
}

export function deleteTalkingHead(id: string) {
  db.prepare("DELETE FROM talking_heads WHERE id = ?").run(id);
}

export function deleteAnalysis(id: string) {
  db.prepare("DELETE FROM analyses WHERE id = ?").run(id);
}

/* ---------------- credits ---------------- */

export class InsufficientCreditError extends Error {
  constructor(
    public balance: number,
    public price: number,
  ) {
    super(`Kredit tidak cukup: saldo ${balance}, perlu ${price}.`);
  }
}

export function balanceOf(userId: string): number {
  const r = db.prepare("SELECT COALESCE(SUM(delta), 0) AS b FROM credit_ledger WHERE user_id = ?").get(userId) as {
    b: number;
  };
  return r.b;
}

export function addLedger(e: Omit<LedgerRow, "id" | "created_at">) {
  db.prepare(
    `INSERT INTO credit_ledger (user_id, delta, reason, analysis_id, note, created_by, created_at)
     VALUES (@user_id, @delta, @reason, @analysis_id, @note, @created_by, @t)`,
  ).run({ ...e, t: now() });
}

export function listLedger(userId: string, limit = 50): LedgerRow[] {
  return db
    .prepare("SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit) as LedgerRow[];
}

/** Create the analysis row and charge for it in one transaction, so a run never starts unpaid. */
export function insertAnalysisCharged(
  a: Pick<AnalysisRow, "id" | "name" | "source_type" | "source"> & { user_id: string },
  price: number,
) {
  db.transaction(() => {
    const bal = balanceOf(a.user_id);
    if (bal < price) throw new InsufficientCreditError(bal, price);
    const t = now();
    db.prepare(
      `INSERT INTO analyses (id, user_id, name, source_type, source, status, progress, step, charge_open, created_at, updated_at)
       VALUES (@id, @user_id, @name, @source_type, @source, 'queued', 0, 'Menunggu giliran', @open, @t, @t)`,
    ).run({ ...a, open: price > 0 ? 1 : 0, t });
    if (price > 0) {
      addLedger({ user_id: a.user_id, delta: -price, reason: "analysis", analysis_id: a.id, note: null, created_by: null });
    }
  })();
}

/** Re-queue a finished or failed analysis; it is charged again like a new run. */
export function resetForRerunCharged(id: string, userId: string, price: number) {
  db.transaction(() => {
    const bal = balanceOf(userId);
    if (bal < price) throw new InsufficientCreditError(bal, price);
    db.prepare(
      `UPDATE analyses SET status = 'queued', progress = 0, step = 'Menunggu giliran', error = NULL,
         description = NULL, skill_md = NULL, analysis_json = NULL, charge_open = ?, updated_at = ? WHERE id = ?`,
    ).run(price > 0 ? 1 : 0, now(), id);
    if (price > 0) {
      addLedger({ user_id: userId, delta: -price, reason: "analysis", analysis_id: id, note: "jalankan ulang", created_by: null });
    }
  })();
}

function refundOpenCharge(id: string) {
  const a = getAnalysis(id);
  if (!a || !a.charge_open || !a.user_id) return;
  const last = db
    .prepare(
      "SELECT delta FROM credit_ledger WHERE analysis_id = ? AND reason = 'analysis' ORDER BY id DESC LIMIT 1",
    )
    .get(id) as { delta: number } | undefined;
  if (last && last.delta < 0) {
    addLedger({ user_id: a.user_id, delta: -last.delta, reason: "refund", analysis_id: id, note: "analisis gagal", created_by: null });
  }
  db.prepare("UPDATE analyses SET charge_open = 0 WHERE id = ?").run(id);
}

/* ---------------- users and sessions ---------------- */

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

/** New password; every other session of this user is signed out, the current one stays. */
export function setPassword(userId: string, passwordHash: string, keepTokenHash: string | null) {
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash IS NOT ?").run(userId, keepTokenHash);
  })();
}

export function getUser(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

/** The first account becomes admin and adopts analyses made before accounts existed. */
export function createUser(u: { id: string; email: string; password_hash: string }, signupBonus: number): UserRow {
  return db.transaction(() => {
    const role = countUsers() === 0 ? "admin" : "user";
    db.prepare(
      "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(u.id, u.email, u.password_hash, role, now());
    if (role === "admin") db.prepare("UPDATE analyses SET user_id = ? WHERE user_id IS NULL").run(u.id);
    if (signupBonus > 0) {
      addLedger({ user_id: u.id, delta: signupBonus, reason: "signup", analysis_id: null, note: "bonus pendaftaran", created_by: null });
    }
    return getUser(u.id)!;
  })();
}

export interface UserSummary {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  balance: number;
  analyses: number;
}

export function listUsersWithBalance(): UserSummary[] {
  return db
    .prepare(
      `SELECT u.id, u.email, u.role, u.created_at,
         COALESCE((SELECT SUM(delta) FROM credit_ledger l WHERE l.user_id = u.id), 0) AS balance,
         (SELECT COUNT(*) FROM analyses a WHERE a.user_id = u.id) AS analyses
       FROM users u ORDER BY u.created_at ASC`,
    )
    .all() as UserSummary[];
}

export function insertSession(tokenHash: string, userId: string, expiresAt: Date) {
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt.toISOString(),
    now(),
  );
}

export function getSessionUser(tokenHash: string): UserRow | undefined {
  return db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now()) as UserRow | undefined;
}

export function deleteSession(tokenHash: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

/* ---------------- payments (credit purchases) ---------------- */

export type PaymentStatus = "creating" | "pending" | "paid" | "expired" | "failed" | "refunded";

export interface PaymentRow {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  credits: number;
  amount: number; // rupiah
  provider: "doit";
  provider_id: string | null;
  hosted_url: string | null;
  status: PaymentStatus;
  credited: number; // 1 once credits were added; guards against double crediting
  error: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export function insertPayment(p: Pick<PaymentRow, "id" | "user_id" | "package_id" | "package_name" | "credits" | "amount" | "provider">) {
  const t = now();
  db.prepare(
    `INSERT INTO payments (id, user_id, package_id, package_name, credits, amount, provider, status, created_at, updated_at)
     VALUES (@id, @user_id, @package_id, @package_name, @credits, @amount, @provider, 'creating', @t, @t)`,
  ).run({ ...p, t });
}

export function getPayment(id: string): PaymentRow | undefined {
  return db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as PaymentRow | undefined;
}

export function getPaymentByProviderId(provider: string, providerId: string): PaymentRow | undefined {
  return db.prepare("SELECT * FROM payments WHERE provider = ? AND provider_id = ?").get(provider, providerId) as
    | PaymentRow
    | undefined;
}

export function listPaymentsForUser(userId: string, limit = 20): PaymentRow[] {
  return db.prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as PaymentRow[];
}

export function listRecentPayments(limit = 50): (PaymentRow & { email: string })[] {
  return db
    .prepare(
      `SELECT p.*, u.email FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT ?`,
    )
    .all(limit) as (PaymentRow & { email: string })[];
}

export function markPaymentCreated(id: string, providerId: string, hostedUrl: string) {
  db.prepare("UPDATE payments SET provider_id = ?, hosted_url = ?, status = 'pending', updated_at = ? WHERE id = ?").run(
    providerId,
    hostedUrl,
    now(),
    id,
  );
}

export function markPaymentFailed(id: string, error: string) {
  db.prepare("UPDATE payments SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(error, now(), id);
}

/**
 * Apply the provider's status. Credits are added exactly once, on the first transition to paid;
 * a refund after crediting takes them back. Returns the updated row.
 */
export function applyPaymentStatus(id: string, status: PaymentStatus, paidAt: string | null): PaymentRow | undefined {
  return db.transaction(() => {
    const p = getPayment(id);
    if (!p) return undefined;
    if (status === "paid" && !p.credited) {
      addLedger({ user_id: p.user_id, delta: p.credits, reason: "purchase", analysis_id: null, note: `${p.package_name} · ${p.id}`, created_by: null });
      db.prepare("UPDATE payments SET credited = 1 WHERE id = ?").run(id);
    }
    if (status === "refunded" && p.credited) {
      addLedger({ user_id: p.user_id, delta: -p.credits, reason: "purchase_refund", analysis_id: null, note: `pembayaran ${p.id} dikembalikan`, created_by: null });
      db.prepare("UPDATE payments SET credited = 0 WHERE id = ?").run(id);
    }
    db.prepare("UPDATE payments SET status = ?, paid_at = COALESCE(?, paid_at), updated_at = ? WHERE id = ?").run(
      status,
      paidAt,
      now(),
      id,
    );
    return getPayment(id);
  })();
}

/** True the first time an event id is seen; webhooks are delivered at least once. */
export function recordWebhookEvent(id: string, provider: string, type: string): boolean {
  const r = db
    .prepare("INSERT OR IGNORE INTO webhook_events (id, provider, type, received_at) VALUES (?, ?, ?, ?)")
    .run(id, provider, type, now());
  return r.changes === 1;
}

export function forgetWebhookEvent(id: string) {
  db.prepare("DELETE FROM webhook_events WHERE id = ?").run(id);
}

/* ---------------- settings ---------------- */

export function getSetting<T>(key: string): T | undefined {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return r ? (JSON.parse(r.value) as T) : undefined;
}

export function setSetting(key: string, value: unknown) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}
