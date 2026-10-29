"""Speech for the live voice agent: Kokoro (kokoro-onnx) kept loaded, one JSON line in, one JSON line out.
  in:  {"id": n, "text": "...", "lang": "en" | "zh"}
  out: {"id": n, "wav": "<base64 16-bit mono WAV, 24 kHz>"} or {"id": n, "error": "..."}
VOICE_TTS_MODELS is the folder with kokoro-v1.0.onnx and voices-v1.0.bin."""
import base64, io, json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

d = os.environ.get("VOICE_TTS_MODELS", ".")
k = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
VOICE = {"en": ("af_heart", "en-us"), "zh": ("zf_xiaobei", "cmn")}
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    try:
        q = json.loads(line)
    except ValueError:
        continue
    try:
        voice, lang = VOICE.get(q.get("lang"), VOICE["en"])
        samples, sr = k.create(str(q["text"])[:600], voice=voice, speed=1.05, lang=lang)
        nz = np.nonzero(np.abs(samples) > 0.01)[0]
        if len(nz):
            samples = samples[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.08 * sr)]
        buf = io.BytesIO()
        sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
        print(json.dumps({"id": q.get("id"), "wav": base64.b64encode(buf.getvalue()).decode()}), flush=True)
    except Exception as e:  # one sentence that fails must not stop the worker
        print(json.dumps({"id": q.get("id"), "error": str(e)[:200]}), flush=True)
