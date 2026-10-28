"""Sheets for checking a tracker's ball by eye, and the scores from the labels. Sampled frames where the tracker
saw the ball are shown as 4x crops centred on its point (ticks every 4 px of the clip), to judge whether it is the
ball and how far off; frames where it saw nothing are shown whole at half size, to look for a ball it missed.
  python ball_check.py sheets <clip.mp4> <rows.csv> <out_dir> [--every 20]
  python ball_check.py score <labels.json> <rows_dir> [json_dir]   (json_dir: score ball.py's on signal)
Labels, per clip and frame: for a point shown, its offset in px of the clip [dx, dy] when it is the ball, or "no"
when it is not; for a frame with no point, "none" when the ball is not visible, or [x, y] where it is (approximate)."""
import json, math, os, sys
import cv2
import numpy as np

cv2.setNumThreads(8)


def rows_of(path):
    import csv
    return {int(r["Frame"]): (int(float(r["Visibility"])), float(r["X"]), float(r["Y"])) for r in csv.DictReader(open(path))}


def sheets(clip, rows_csv, out, every=20):
    os.makedirs(out, exist_ok=True)
    name = os.path.splitext(os.path.basename(clip))[0]
    rows = rows_of(rows_csv)
    cap = cv2.VideoCapture(clip)
    frames, i = {}, 0
    while True:
        ok, im = cap.read()
        if not ok:
            break
        if i % every == 0 and i in rows:
            frames[i] = im
        i += 1
    seen, missed = [], []
    for f, im in sorted(frames.items()):
        v, x, y = rows[f]
        H, W = im.shape[:2]
        if v:
            c, z = 48, 4
            x0, y0 = int(round(x)) - c // 2, int(round(y)) - c // 2
            pad = cv2.copyMakeBorder(im, c, c, c, c, cv2.BORDER_CONSTANT)
            t = cv2.resize(pad[y0 + c:y0 + 2 * c, x0 + c:x0 + 2 * c], (c * z, c * z), interpolation=cv2.INTER_NEAREST)
            for k in range(0, c + 1, 4):  # ticks every 4 px of the clip
                cv2.line(t, (k * z, 0), (k * z, 6 if k % 8 else 12), (0, 255, 255), 1)
                cv2.line(t, (0, k * z), (6 if k % 8 else 12, k * z), (0, 255, 255), 1)
            m = c * z // 2
            cv2.line(t, (m - 10, m), (m - 4, m), (0, 0, 255), 1); cv2.line(t, (m + 4, m), (m + 10, m), (0, 0, 255), 1)
            cv2.line(t, (m, m - 10), (m, m - 4), (0, 0, 255), 1); cv2.line(t, (m, m + 4), (m, m + 10), (0, 0, 255), 1)
            cv2.putText(t, str(f), (14, c * z - 6), 0, 0.5, (255, 255, 255), 1)
            seen.append(t)
        else:
            t = cv2.resize(im, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
            cv2.putText(t, str(f), (6, 20), 0, 0.6, (0, 255, 255), 2)
            missed.append(t)
    for k in range(0, len(seen), 32):
        part = seen[k:k + 32] + [np.zeros_like(seen[0])] * (-len(seen[k:k + 32]) % 8)
        cv2.imwrite(os.path.join(out, f"{name}_seen_{k // 32}.jpg"), np.vstack([np.hstack(part[r:r + 8]) for r in range(0, len(part), 8)]), [cv2.IMWRITE_JPEG_QUALITY, 90])
    for k in range(0, len(missed), 6):
        part = missed[k:k + 6] + [np.zeros_like(missed[0])] * (-len(missed[k:k + 6]) % 2)
        cv2.imwrite(os.path.join(out, f"{name}_missed_{k // 6}.jpg"), np.vstack([np.hstack(part[r:r + 2]) for r in range(0, len(part), 2)]), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(name, "seen", len(seen), "missed", len(missed))


def score(labels_json, rows_dir, tol=10, json_dir=None):
    """precision, recall and position error (px at 720p; a point within tol px is a hit, as 4 px at 512x288). With
    json_dir, of ball.py's 'on' signal and its positions instead of the tracker's raw points (the truth is the raw
    point plus its labelled offset; a frame refilled without a raw point has no truth and is left out)"""
    L = json.load(open(labels_json))
    out = {}
    for sport, clips in L["labels"].items():
        tp = fp = fn = tn = 0
        err = []
        for clip, lab in clips.items():
            rows = rows_of(os.path.join(rows_dir, f"{clip}.csv"))
            B = json.load(open(os.path.join(json_dir, f"{clip}.json")))["ball"] if json_dir else None
            for f, l in lab.items():
                v = rows[int(f)][0]
                if B:
                    on = bool(B["on"][int(f)]) and B["x"][int(f)] is not None
                    if on and not v:
                        continue
                    if on and l not in ("no",) and not isinstance(l, str):
                        tx, ty = rows[int(f)][1] + l[0], rows[int(f)][2] + l[1]
                        l = [B["x"][int(f)] - tx, B["y"][int(f)] - ty]
                    v = on
                if v:
                    if l == "no":
                        fp += 1
                    else:
                        e = math.hypot(*l)
                        if e <= tol:
                            tp += 1; err.append(e)
                        else:
                            fp += 1; fn += 1
                else:
                    if l == "none":
                        tn += 1
                    else:
                        fn += 1
        out[sport] = {"frames": tp + fp + fn + tn - (0), "tp": tp, "fp": fp, "fn": fn, "tn": tn,
                      "precision": round(tp / max(1, tp + fp), 3), "recall": round(tp / max(1, tp + fn), 3),
                      "median_error_px": round(float(np.median(err)), 1) if err else None, "mean_error_px": round(float(np.mean(err)), 1) if err else None}
    print(json.dumps(out, indent=1))
    return out


if __name__ == "__main__":
    if sys.argv[1] == "sheets":
        sheets(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[sys.argv.index("--every") + 1]) if "--every" in sys.argv else 20)
    else:
        score(sys.argv[2], sys.argv[3], json_dir=sys.argv[4] if len(sys.argv) > 4 else None)
