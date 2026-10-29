"""A vision judge for orbit frames, against the hand labels (labels/orbit_labels.json): would a viewer notice a defect in
a 2-second sweep on a phone? Each probe frame (orbit.py --probe, 84 of them: 14 moments at -18 to +18 degrees) is shown
to a vision model with the same question the labels answer. Two judges:
  glimmer   Muse Glimmer (open weights, vision) on an Ollama endpoint, JSON Schema output, no cloud
  wonder    Muse Wonder on the Meta Model API (META_API_KEY), the frame at 768 px wide
Scored like orbit_fit.py: precision and recall of "good" (a frame the judge passes that the label calls broken is the
costly mistake), and accuracy; next to the learned threshold on invented pixels (6.26%, precision 1.00, recall 0.79).
    python orbit_judge.py <labels.json> <probe dir> <glimmer|wonder> <out.json> [--ollama http://127.0.0.1:11448] [--limit n]
Standard library and ffmpeg only.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

LAB, DIR, WHO, OUT = sys.argv[1:5]
opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OLLAMA, LIMIT = opt("--ollama", "http://127.0.0.1:11448"), int(opt("--limit", "0"))
labels = json.load(open(LAB))["labels"]

ASK = ("This is one frame of a sports highlight where time is frozen and the camera swings around the player. It was "
       "rendered from a single phone video, so parts of the scene are reconstructed. Would a viewer notice something broken "
       "if this frame were part of a 2-second sweep on a phone? Broken means: a bent or doubled net post or net, doubled or "
       "smeared people, a blurred or empty band at an edge, a half-transparent or warped player. Small softness is fine. "
       'Answer JSON: {"broken": true or false, "what": "the defect you see, or none"}')
SCHEMA = {"type": "object", "properties": {"broken": {"type": "boolean"}, "what": {"type": "string"}}, "required": ["broken", "what"]}


def jpeg(path, width):
    return subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={width}:-2", "-q:v", "4", "-f", "image2", "-c:v", "mjpeg", "-"], capture_output=True, check=True).stdout


def post(url, body, headers, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def parse(text):
    s = text[text.find("{"): text.rfind("}") + 1]
    return json.loads(s)


def glimmer(path):
    b64 = base64.b64encode(jpeg(path, 1024)).decode()
    r = post(f"{OLLAMA}/api/chat", {"model": "muse-glimmer", "stream": False, "format": SCHEMA, "options": {"temperature": 0},
                                    "messages": [{"role": "user", "content": ASK, "images": [b64]}]}, {})
    return parse(r["message"]["content"]), {"prompt": r.get("prompt_eval_count"), "output": r.get("eval_count")}


def wonder(path):
    key = os.environ["META_API_KEY"]
    b64 = base64.b64encode(jpeg(path, 768)).decode()
    r = post("https://api.meta.ai/v1/chat/completions", {"model": "muse-wonder-1.0", "max_completion_tokens": 1500, "reasoning_effort": "low",
                                                         "messages": [{"role": "user", "content": [{"type": "text", "text": ASK}, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}]}]},
             {"authorization": f"Bearer {key}"})
    u = r.get("usage", {})
    return parse(r["choices"][0]["message"]["content"]), {"prompt": u.get("prompt_tokens"), "output": u.get("completion_tokens")}


judge = {"glimmer": glimmer, "wonder": wonder}[WHO]
rows = []
for moment, angles in sorted(labels.items()):
    for a, good in sorted(angles.items(), key=lambda x: int(x[0])):
        f = os.path.join(DIR, f"{moment}_v1_{'+' if int(a) > 0 else ''}{a}.png")
        if not os.path.exists(f):
            continue
        t0 = time.time()
        try:
            j, use = judge(f)
            rows.append({"frame": os.path.basename(f), "label": good, "said": 0 if j["broken"] else 1, "what": j.get("what", "")[:200], "seconds": round(time.time() - t0, 1), **use})
        except Exception as e:
            rows.append({"frame": os.path.basename(f), "label": good, "said": None, "error": str(e)[:200]})
        print(rows[-1], flush=True)
        if LIMIT and len(rows) >= LIMIT:
            break
    if LIMIT and len(rows) >= LIMIT:
        break

ok = [r for r in rows if r["said"] is not None]
tp = sum(1 for r in ok if r["said"] == 1 and r["label"] == 1); fp = sum(1 for r in ok if r["said"] == 1 and r["label"] == 0); fn = sum(1 for r in ok if r["said"] == 0 and r["label"] == 1)
res = {"judge": {"glimmer": "Muse Glimmer (Ollama, JSON Schema)", "wonder": "Muse Wonder 1.0 (Meta Model API)"}[WHO], "frames": len(rows), "answered": len(ok),
       "precisionGood": round(tp / (tp + fp), 3) if tp + fp else None, "recallGood": round(tp / (tp + fn), 3) if tp + fn else None,
       "accuracy": round(sum(1 for r in ok if r["said"] == r["label"]) / len(ok), 3) if ok else None,
       "passedBroken": fp, "tokens": {"prompt": sum(r.get("prompt") or 0 for r in ok), "output": sum(r.get("output") or 0 for r in ok)},
       "medianSeconds": sorted(r["seconds"] for r in ok)[len(ok) // 2] if ok else None,
       "threshold": {"what": "the learned share of invented pixels (6.26%), leave-one-moment-out", "precisionGood": 1.0, "recallGood": 0.79, "accuracy": 0.96}, "rows": rows}
json.dump(res, open(OUT, "w"), indent=1)
print({k: v for k, v in res.items() if k != "rows"})
