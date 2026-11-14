import { run } from "./run";

export interface ProbeInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  bitrateKbps: number | null;
  aspect: string; // "9:16", "16:9", "1:1", "4:5" or "w:h"
}

export async function probe(file: string): Promise<ProbeInfo> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const j = JSON.parse(stdout);
  const streams: Record<string, unknown>[] = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error("File ini tidak punya track video.");
  const a = streams.find((s) => s.codec_type === "audio");

  const width = Number(v.width) || 0;
  const height = Number(v.height) || 0;
  // Rotation metadata (phone footage) swaps the visible orientation.
  const rot = readRotation(v);
  const [w, h] = rot % 180 !== 0 ? [height, width] : [width, height];

  const duration = Number(j.format?.duration) || Number(v.duration) || 0;
  const fps = parseRate(String(v.avg_frame_rate || v.r_frame_rate || "0/1"));
  const br = Number(j.format?.bit_rate);

  return {
    duration,
    width: w,
    height: h,
    fps,
    hasAudio: Boolean(a),
    codec: String(v.codec_name ?? "?"),
    bitrateKbps: Number.isFinite(br) && br > 0 ? Math.round(br / 1000) : null,
    aspect: aspectLabel(w, h),
  };
}

function readRotation(v: Record<string, unknown>): number {
  const tags = v.tags as Record<string, string> | undefined;
  if (tags?.rotate) return Math.abs(Number(tags.rotate)) || 0;
  const side = v.side_data_list as { rotation?: number }[] | undefined;
  const r = side?.find((s) => typeof s.rotation === "number")?.rotation;
  return r ? Math.abs(r) : 0;
}

function parseRate(r: string): number {
  const [n, d] = r.split("/").map(Number);
  if (!d) return n || 0;
  return Math.round((n / d) * 100) / 100;
}

function aspectLabel(w: number, h: number): string {
  if (!w || !h) return "?";
  const r = w / h;
  const known: [string, number][] = [
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["21:9", 21 / 9],
  ];
  for (const [label, v] of known) if (Math.abs(r - v) < 0.03) return label;
  return `${w}:${h}`;
}
