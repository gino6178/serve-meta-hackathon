"""Speech to text for voice notes, with Meta's Omnilingual ASR (facebookresearch/omnilingual-asr, Apache 2.0), kept
loaded between notes. Reads one JSON request per line on stdin, {"id": ..., "path": "/tmp/x.wav", "lang": "eng_Latn"
or null}, and writes one JSON line per request: {"id": ..., "text": ...} or {"id": ..., "error": ...}. The model card
is ASR_MODEL (default omniASR_CTC_1B: a CTC model, fast, and it needs no language code, so a note in Mandarin or
English is read the same way). It runs on the CPU unless ASR_DEVICE says otherwise, so it never competes with the
models on the GPUs. Started by agent/src/asr.js."""
import json, os, sys, time

if os.environ.get("ASR_DEVICE", "cpu") == "cpu":
    os.environ["CUDA_VISIBLE_DEVICES"] = ""

def say(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n"); sys.stdout.flush()

t0 = time.time()
try:
    import torch
    from omnilingual_asr.models.inference.pipeline import ASRInferencePipeline
    card, dev = os.environ.get("ASR_MODEL", "omniASR_CTC_1B"), os.environ.get("ASR_DEVICE", "cpu")
    # the pipeline's default, bfloat16, is emulated on a CPU without AMX and runs about ten times slower: float32 there
    pipeline = ASRInferencePipeline(model_card=card, device=dev, dtype=torch.float32 if dev == "cpu" else torch.bfloat16)
    say({"ready": True, "model": card, "seconds": round(time.time() - t0, 1)})
except Exception as e:  # the gateway reports it and keeps working without voice
    say({"ready": False, "error": f"{type(e).__name__}: {e}"}); sys.exit(1)

for line in sys.stdin:
    try:
        req = json.loads(line)
    except ValueError:
        continue
    t = time.time()
    try:
        lang = req.get("lang")
        out = pipeline.transcribe([req["path"]], lang=[lang] if lang else None, batch_size=1)
        say({"id": req.get("id"), "text": str(out[0]).strip(), "seconds": round(time.time() - t, 2)})
    except Exception as e:
        say({"id": req.get("id"), "error": f"{type(e).__name__}: {e}"})
