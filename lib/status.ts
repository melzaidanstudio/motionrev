import type { Status } from "./db";

export const STATUS_LABEL: Record<Status, string> = {
  queued: "Antre",
  downloading: "Mengunduh",
  extracting: "Mengekstrak",
  analyzing: "Menganalisis",
  done: "Selesai",
  error: "Gagal",
};

export const isRunning = (s: Status) => s !== "done" && s !== "error";
