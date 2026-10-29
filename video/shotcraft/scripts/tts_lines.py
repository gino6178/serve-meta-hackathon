"""The film's narration with Kokoro (kokoro-onnx, CPU), one sentence at a time so each subtitle knows its time.
  python tts_lines.py lines.json out_dir models_dir [voice] [speed]
lines.json: [{"at": seconds in the film, "text": ...}]. Writes out_dir/n<i>.wav per line and out_dir/timings.json:
  [{"at", "dur", "subs": [{"text", "start", "end"}]}] with times relative to the line's start."""
import json, os, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

src, out, models = sys.argv[1], sys.argv[2], sys.argv[3]
voice = sys.argv[4] if len(sys.argv) > 4 else "af_heart"
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
os.makedirs(out, exist_ok=True)
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
# how words are said; the subtitles keep the written form
SAY = [("RTX 3090", "R T X thirty ninety"), ("A2A", "A to A"), ("1B", "one B"), ("89.5", "eighty-nine point five"),
       ("OpenStreetMap", "Open Street Map")]
GAP = {".": 0.32, "!": 0.32, "?": 0.32, ":": 0.22, ";": 0.22}
rows = []
for i, line in enumerate(json.load(open(src, encoding="utf8"))):
    parts = [p.strip() for p in re.findall(r"(?:[^.!?:;]|\.(?=\d))+[.!?:;]?", line["text"]) if p.strip()]
    audio, t, subs, sr = [], 0.0, [], 24000
    for p in parts:
        spoken = p
        for a, b in SAY:
            spoken = spoken.replace(a, b)
        samples, sr = k.create(spoken, voice=voice, speed=speed, lang="en-us")
        nz = np.nonzero(np.abs(samples) > 0.01)[0]
        if len(nz):
            samples = samples[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.06 * sr)]
        d = len(samples) / sr
        subs.append({"text": p, "start": round(t, 3), "end": round(t + d, 3)})
        audio.append(samples)
        gap = GAP.get(p[-1], 0.12)
        audio.append(np.zeros(int(gap * sr), dtype=samples.dtype))
        t += d + gap
    wav = np.concatenate(audio[:-1])
    sf.write(os.path.join(out, f"n{i}.wav"), wav, sr)
    rows.append({"at": line["at"], "dur": round(len(wav) / sr, 3), "subs": subs})
json.dump(rows, open(os.path.join(out, "timings.json"), "w"), indent=1)
for i, (r, nxt) in enumerate(zip(rows, rows[1:] + [{"at": 149.2}])):
    print(i, r["at"], r["dur"], "ends", round(r["at"] + r["dur"], 2), "next", nxt["at"], "OVER" if r["at"] + r["dur"] > nxt["at"] - 0.2 else "")
