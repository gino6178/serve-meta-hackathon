"""The agent testing as one picture: every logged tester session (video/shotcraft/public/swarm/sessions.json, built
from the rounds' requests.jsonl), one row each, grouped by round; a dot per request at its second since the session
began, green for 2xx, amber for 4xx, red for 5xx. Writes video/deck/swarm.png.
   python video/deck/make_swarm.py
"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
d = json.load(open(os.path.join(ROOT, "video/shotcraft/public/swarm/sessions.json"), encoding="utf-8"))
ss = sorted(d["sessions"], key=lambda s: (s["round"], s["who"]))
T = 780  # seconds shown: the longest session ends at 740 s
W, H, L, R, TOP, BOT = 2400, 1400, 250, 40, 40, 120
img = Image.new("RGB", (W, H), "white")
g = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("segoeui.ttf", 44); small = ImageFont.truetype("segoeui.ttf", 40)
except OSError:
    font = small = ImageFont.load_default()
rows = len(ss); rh = (H - TOP - BOT) / rows
col = lambda st: (10, 127, 68) if st < 400 else (178, 106, 0) if st < 500 else (209, 53, 43)
last = None
for i, s in enumerate(ss):
    y = TOP + i * rh
    if s["round"] != last:
        g.line([(L, y), (W - R, y)], fill=(220, 220, 224), width=1)
        if s["round"] % 3 == 1 or last is None: g.text((10, y), f"round {s['round']}", fill=(85, 85, 92), font=small)
        last = s["round"]
    for t, _m, _p, st in s["steps"]:
        if t > T: break
        x = L + (W - L - R) * t / T
        g.ellipse([x - 3.2, y + rh / 2 - 3.2, x + 3.2, y + rh / 2 + 3.2], fill=col(st))
for m in range(0, T + 1, 120):
    x = L + (W - L - R) * m / T
    g.text((x - 40, H - BOT + 30), f"{m // 60} min", fill=(85, 85, 92), font=font)
n = sum(len(s["steps"]) for s in ss)
img.save(os.path.join(ROOT, "video/deck/swarm.png"))
print(rows, "sessions,", n, "requests drawn (first 13 minutes)")
