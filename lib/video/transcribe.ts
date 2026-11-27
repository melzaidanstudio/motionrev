import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { timecode } from "../format";
import { MAX_THREADS } from "../threads";
import { run } from "./run";

export interface TranscriptWord {
  w: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** What Bedah Video knows about the spoken words of a video. Saved as transcript.json next to the frames. */
export interface Transcript {
  /** whisper: heard from the audio, with times. platform: the video site's subtitles, text only. */
  source: "whisper" | "platform";
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
}

export const TRANSCRIPT_FILE = "transcript.json";

/**
 * Speech to text with the local whisper CLI (a whisper.cpp wrapper), word timestamps on, held to the app's thread
 * cap. Returns null when the video has no speech worth keeping.
 */
export async function transcribe(file: string): Promise<Transcript | null> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "motionrev-whisper-"));
  try {
    const wav = path.join(tmp, "audio.wav");
    await run("ffmpeg", ["-hide_banner", "-nostats", "-y", "-i", file, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    await run(
      "whisper",
      [wav, "--model", "turbo", "--word_timestamps", "True", "--output_format", "json", "--output_dir", tmp, "--fp16", "False", "--threads", String(MAX_THREADS)],
      { timeoutMs: 30 * 60 * 1000 },
    );
    const raw = JSON.parse(fs.readFileSync(path.join(tmp, "audio.json"), "utf8")) as {
      language?: string;
      segments?: { start: number; end: number; text: string; words?: { word: string; start: number; end: number }[] }[];
    };
    const segments: TranscriptSegment[] = [];
    const words: TranscriptWord[] = [];
    for (const s of raw.segments ?? []) {
      const text = s.text.replace(/\s+/g, " ").trim();
      if (!text || isNoise(text)) continue;
      segments.push({ start: s.start, end: s.end, text });
      for (const w of s.words ?? []) {
        const t = w.word.trim();
        if (t) words.push({ w: t, start: w.start, end: w.end });
      }
    }
    const text = segments.map((s) => s.text).join(" ").trim();
    // A few words over music ("[Musik]", "Terima kasih.") is not narration.
    if (words.length < 5) return null;
    return { source: "whisper", language: raw.language ?? null, text, segments, words };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Platform subtitles as a transcript: text only, no timing. */
export function platformTranscript(text: string): Transcript {
  return { source: "platform", language: null, text, segments: [], words: [] };
}

function isNoise(t: string): boolean {
  return /^[[(♪*].*[\])♪*]$/.test(t);
}

export function readTranscript(dir: string): Transcript | null {
  const f = path.join(dir, TRANSCRIPT_FILE);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as Transcript;
  } catch {
    return null;
  }
}

export function saveTranscript(dir: string, t: Transcript) {
  fs.writeFileSync(path.join(dir, TRANSCRIPT_FILE), JSON.stringify(t));
  fs.writeFileSync(path.join(dir, "transcript.txt"), transcriptText(t));
}

/** One line per segment with when it is said (start–end), or the plain text when there is no timing. */
export function transcriptText(t: Transcript): string {
  if (!t.segments.length) return t.text;
  return t.segments.map((s) => `[${timecode(s.start)}–${timecode(s.end)}] ${s.text}`).join("\n");
}

export interface SpeechStats {
  words: number;
  sentences: number;
  wordsPerSentence: number;
  /** Words per minute over the time someone is speaking (first word to last). */
  wpm: number | null;
  firstWordAt: number | null;
  lastWordAt: number | null;
  /** Share of the video's length between the first and the last word, 0-100. */
  speechCoverage: number | null;
  longestPause: { at: number; seconds: number } | null;
  /** Gaps between words of 0.6 s or more. */
  pauses: number;
  /** Where those gaps are, with the word before each, in order. */
  pauseList: { at: number; seconds: number; after: string }[];
}

/** Numbers measured from the transcript, so the script skill does not have to guess pace or sentence length. */
export function speechStats(t: Transcript, duration: number): SpeechStats {
  const words = t.words.length || t.text.split(/\s+/).filter(Boolean).length;
  const sentences = Math.max(1, (t.text.match(/[.!?…]+(\s|$)/g) ?? []).length);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  if (!t.words.length) {
    return { words, sentences, wordsPerSentence: r1(words / sentences), wpm: null, firstWordAt: null, lastWordAt: null, speechCoverage: null, longestPause: null, pauses: 0, pauseList: [] };
  }
  const first = t.words[0].start;
  const last = t.words[t.words.length - 1].end;
  let longest: { at: number; seconds: number } | null = null;
  const pauseList: SpeechStats["pauseList"] = [];
  for (let i = 1; i < t.words.length; i++) {
    const gap = t.words[i].start - t.words[i - 1].end;
    if (gap >= 0.6) pauseList.push({ at: t.words[i - 1].end, seconds: r1(gap), after: t.words[i - 1].w });
    if (!longest || gap > longest.seconds) longest = { at: t.words[i - 1].end, seconds: r1(gap) };
  }
  const span = Math.max(last - first, 1);
  return {
    words,
    sentences,
    wordsPerSentence: r1(words / sentences),
    wpm: Math.round((words / span) * 60),
    firstWordAt: r1(first),
    lastWordAt: r1(last),
    speechCoverage: duration > 0 ? Math.round((span / duration) * 100) : null,
    longestPause: longest && longest.seconds >= 0.3 ? longest : null,
    pauses: pauseList.length,
    pauseList,
  };
}
