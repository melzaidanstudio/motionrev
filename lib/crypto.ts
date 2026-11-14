import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { dataDir } from "./paths";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/* ---------- passwords: scrypt with a per-user salt ---------- */

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const got = await scryptAsync(pw, Buffer.from(saltB64, "base64"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/* ---------- session tokens: random, stored only as a hash ---------- */

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ---------- secrets at rest: AES-256-GCM ---------- */

/**
 * Key for encrypting provider API keys in the database. Set MOTIONREV_SECRET (any long random
 * string) in production. Without it, a key is generated once into data/secret.key (mode 600), which
 * is fine on a single machine but is lost if the data folder is moved without that file.
 */
function secretKey(): Buffer {
  const env = process.env.MOTIONREV_SECRET;
  if (env) return createHash("sha256").update(env).digest();
  const file = path.join(dataDir(), "secret.key");
  if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  const [v, ivB64, tagB64, dataB64] = blob.split(":");
  if (v !== "v1") throw new Error("Format rahasia tidak dikenal.");
  const d = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivB64, "base64"));
  d.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([d.update(Buffer.from(dataB64, "base64")), d.final()]).toString("utf8");
}

/** "sk-or-v1-abcd...wxyz" -> "sk-or-…wxyz", for showing a stored key without revealing it. */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "••••";
  return `${plain.slice(0, 5)}…${plain.slice(-4)}`;
}
