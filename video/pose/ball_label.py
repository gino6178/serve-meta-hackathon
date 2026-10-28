"""Contact sheets for hand-labelling the ball, frame by frame. A labelling aid only, not a detector: each sampled frame
gets up to six proposals (small things that are there now and not 0.1 s before or after), numbered, each shown as a
zoomed crop beside a thumbnail of the whole frame. The labeller writes, per frame, which proposal is the ball, 0 if
the ball is not visible, or -1 if it is visible but none of the proposals is it (its position then stays unknown).
  python ball_label.py <clip.mp4> <out_dir> [--every 8] [--rows 10]
Writes <out_dir>/<clip>_<n>.jpg and <clip>_proposals.json: {frame: [[x, y], ...]} in the clip's pixels."""
import argparse, json, os
import cv2
import numpy as np

cv2.setNumThreads(8)
ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out")
ap.add_argument("--every", type=int, default=8); ap.add_argument("--rows", type=int, default=10)
ap.add_argument("--gap", type=int, default=3, help="frames before and after a proposal must differ from")
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)
name = os.path.splitext(os.path.basename(A.clip))[0]
cap = cv2.VideoCapture(A.clip)
frames = []
while True:
    ok, im = cap.read()
    if not ok:
        break
    frames.append(im)
cap.release()
H, W = frames[0].shape[:2]
gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.int16) for f in frames]


def proposals(t, k=6):
    a, b = max(0, t - A.gap), min(len(frames) - 1, t + A.gap)
    m = np.minimum(np.abs(gray[t] - gray[a]), np.abs(gray[t] - gray[b])).astype(np.uint8)
    m = cv2.GaussianBlur(m, (3, 3), 0)
    _, bw = cv2.threshold(m, 22, 255, cv2.THRESH_BINARY)
    n, lab, st, cen = cv2.connectedComponentsWithStats(bw)
    tiny = 0.00007 * W * H  # 65 px at 1280x720: a shuttle or a ball far off, not a limb
    big = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > tiny]).astype(np.uint8)
    near_big = cv2.dilate(big, np.ones((7, 7), np.uint8)) > 0  # a fragment of a moving player
    out = []
    for i in range(1, n):
        area = st[i, cv2.CC_STAT_AREA]
        w, h = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
        if not (1 <= area <= tiny and max(w, h) <= 0.02 * W):
            continue
        cx, cy = cen[i]
        if near_big[int(cy), int(cx)]:
            continue
        inside = lab == i
        # sharp and bright beats large: the mean change, times how bright the blob is against its surroundings
        out.append((float(m[inside].mean()) * (1 + max(0.0, float(gray[t][inside].mean()) - 100) / 100), [round(float(cx), 1), round(float(cy), 1)]))
    out.sort(key=lambda x: -x[0])
    return [p for _, p in out[:k]]


sample = list(range(A.gap, len(frames) - A.gap, A.every))
props = {t: proposals(t) for t in sample}
CROP, Z = 36, 4  # 36 px around each proposal, shown four times larger
rows = []
for t in sample:
    f = frames[t]
    th = np.zeros((max(180, CROP * Z + 18), 320, 3), np.uint8)
    th[:180] = cv2.resize(f, (320, 180), interpolation=cv2.INTER_AREA)
    for j, (x, y) in enumerate(props[t]):
        cv2.putText(th, str(j + 1), (int(x * 320 / W) + 3, int(y * 180 / H) - 3), 0, 0.45, (0, 255, 255), 1, cv2.LINE_AA)
        cv2.circle(th, (int(x * 320 / W), int(y * 180 / H)), 5, (0, 255, 255), 1)
    cv2.rectangle(th, (0, 0), (60, 18), (0, 0, 0), -1)
    cv2.putText(th, str(t), (3, 14), 0, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    tiles = [th]
    for j in range(6):
        tile = np.zeros((max(180, CROP * Z + 18), CROP * Z + 8, 3), np.uint8)
        if j < len(props[t]):
            x, y = props[t][j]
            x0, y0 = int(min(max(0, x - CROP / 2), W - CROP)), int(min(max(0, y - CROP / 2), H - CROP))
            c = cv2.resize(f[y0:y0 + CROP, x0:x0 + CROP], (CROP * Z, CROP * Z), interpolation=cv2.INTER_NEAREST)
            tile[18:18 + CROP * Z, 4:4 + CROP * Z] = c
            cv2.putText(tile, str(j + 1), (6, 14), 0, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
        tiles.append(tile)
    rows.append(np.hstack(tiles))
for n in range(0, len(rows), A.rows):
    cv2.imwrite(os.path.join(A.out, f"{name}_{n // A.rows:02d}.jpg"), np.vstack(rows[n:n + A.rows]), [cv2.IMWRITE_JPEG_QUALITY, 90])
json.dump({"clip": os.path.basename(A.clip), "w": W, "h": H, "fps": round(len(frames) and cv2.VideoCapture(A.clip).get(cv2.CAP_PROP_FPS), 3),
           "every": A.every, "proposals": {str(t): p for t, p in props.items()}}, open(os.path.join(A.out, f"{name}_proposals.json"), "w"))
print(name, len(sample), "frames,", (len(rows) + A.rows - 1) // A.rows, "sheets")
