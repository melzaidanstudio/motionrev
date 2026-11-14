#!/usr/bin/env python3
"""Draft VO via edge-tts, with word timings taken from the engine's own WordBoundary events
(exact, no whisper needed). Writes <out.wav> (48 kHz) and <out.json> as [[script_word, start, end], ...]."""
import asyncio, json, re, subprocess, sys
import edge_tts

script_path, out_wav, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
voice = sys.argv[4] if len(sys.argv) > 4 else "id-ID-ArdiNeural"
rate = sys.argv[5] if len(sys.argv) > 5 else "+0%"
text = open(script_path, encoding="utf-8").read()
script = text.split()
mp3 = out_wav.rsplit(".", 1)[0] + ".mp3"

async def run():
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append((ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7))
    return words

ws = asyncio.run(run())
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
out, j, ok = [], 0, True
for sw in script:
    target, acc, st, en = norm(sw), "", None, None
    while j < len(ws) and len(acc) < len(target):
        if st is None: st = ws[j][1]
        acc += norm(ws[j][0]); en = ws[j][2]; j += 1
    m = acc == target; ok &= m
    out.append([sw, round(st or 0, 3), round(en or 0, 3)])
    if not m: print("!!", sw, acc, st, en)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ar", "48000", "-ac", "1", out_wav], check=True)
json.dump(out, open(out_json, "w", encoding="utf-8"), ensure_ascii=False)
print("all match:", ok, len(script), "script words,", len(ws), "engine words; last end", out[-1][2])
