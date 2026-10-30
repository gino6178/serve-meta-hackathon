"""The ball, frame by frame, for the highlight effects: where it is, whether it is there, when it is hit, and when the
rally ends. The trackers are not ours; they are used as libraries from checkouts outside this repository, each in
its own process (worker mode below), and this file turns their output into our per-frame form.
  badminton: TrackNetV5 (Chang, Wang and Huang, ICIP 2026), https://github.com/gino6178/TrackNetV5 at commit 9116161:
             the user's own earlier published work, made before the hackathon; the repository has no LICENSE file.
  tennis, basketball: WASB (Tarashima et al., BMVC 2023), https://github.com/nttcom/WASB-SBDT at commit 923462c, MIT
             code; the weights' own licence is not stated, and they were trained on broadcast footage.
setup_ball.sh fetches the code and the weights (into the NAS cache).
  python ball.py <clip.mp4> <out.json> [--sport badminton] [--reel reel.json] [--csv tracker.csv]
  python ball.py --worker tracknetv5|wasb <clip.mp4> <rows.csv> [--sport tennis]   (the tracker's own process)
--csv: read rows that already exist instead of running the tracker. With --reel, a hit is put on the player whose
hand is nearest, and positions are also given in the reel's pixels.
Output, per frame like exists.py: {fps, w, h, sport, tracker, frames: [0..n-1], ball: {x, y, p, on, peak, reel_xy},
hits: [{frame, turn_deg, who}], rally_end}. x and y are in the clip's pixels (null where the tracker saw nothing),
reel_xy in the reel's (with --reel); peak is the tracker's heatmap peak; p is how sure we are the ball is there; on is
p with hysteresis. Environment: BALL_TRACKNETV5_DIR, BALL_WASB_DIR (the checkouts), BALL_WEIGHTS (the NAS folder),
BALL_PYTHON (a Python with the trackers' requirements)."""
import argparse, csv, json, math, os, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exists import hysteresis

TRACKERS = {"badminton": ("tracknetv5", "TrackNetV5 (gino6178/TrackNetV5 @ 9116161, ICIP 2026)"),
            "tennis": ("wasb", "WASB (nttcom/WASB-SBDT @ 923462c, BMVC 2023)"),
            "basketball": ("wasb", "WASB (nttcom/WASB-SBDT @ 923462c, BMVC 2023)")}
HOME = os.path.expanduser("~/serve/orbit/third_party")
WEIGHTS = os.environ.get("BALL_WEIGHTS", "/mnt/nas/serve/weights")


def run_tracker(clip, sport):
    """the tracker for the sport, in its own process (niced, 8 threads): rows of frame, v, x, y, peak"""
    if sport not in TRACKERS:
        return None
    py = os.environ.get("BALL_PYTHON", sys.executable)
    with tempfile.TemporaryDirectory(prefix="ball-") as tmp:
        out = os.path.join(tmp, "rows.csv")
        env = {**os.environ, "OMP_NUM_THREADS": "8", "MKL_NUM_THREADS": "8"}
        subprocess.run(["nice", "-n", "19", py, os.path.abspath(__file__), "--worker", TRACKERS[sport][0], os.path.abspath(clip), out, "--sport", sport],
                       env=env, check=True, stdout=subprocess.DEVNULL)
        return read_csv(out)


def read_csv(path):
    with open(path, newline="") as f:
        return [{"frame": int(r["Frame"]), "v": int(float(r["Visibility"])), "x": float(r["X"]), "y": float(r["Y"]),
                 "peak": float(r.get("Peak") or 0)} for r in csv.DictReader(f)]


def write_rows(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Frame", "Visibility", "X", "Y", "Peak"])
        for fr in sorted(rows):
            w.writerow([fr, *rows[fr]])


def worker_tracknetv5(clip, out):
    """TrackNetV5 as a library: its model, its video dataset (5 frames, RGB plus the difference from the video's
    median, 512x288) and its own peak finder; the full model (alpha 1.0) at its README's best threshold, 0.30"""
    import torch
    from torch.utils.data import DataLoader
    root = os.environ.get("BALL_TRACKNETV5_DIR", os.path.join(HOME, "TrackNetV5"))
    sys.path.insert(0, root)
    from utils.general import get_model, to_img
    from dataset import Video_IterableDataset
    from test import predict_location
    torch.set_num_threads(8)
    weights = os.environ.get("BALL_TRACKNETV5_WEIGHTS", os.path.join(WEIGHTS, "tracknetv5", "TrackNetV5_best.pt"))
    alpha, thr = (0.5, 0.35) if "Lite" in os.path.basename(weights) else (1.0, 0.30)
    model = get_model("TrackNetV5", 5, "subtract_concat", alpha=alpha)
    ck = torch.load(weights, map_location="cpu", weights_only=False)
    model.load_state_dict(ck.get("model_state_dict", ck), strict=True)
    model = model.cuda().eval()
    ds = Video_IterableDataset(clip, seq_len=5, sliding_step=5, bg_mode="subtract_concat")
    rows = {}
    # (the tracker's loader pads its last window from the frames it holds; when the clip's length is a multiple of the
    # window it holds none and raises IndexError after the last frame, every frame already read: that ends the clip)
    batches = iter(DataLoader(ds, batch_size=8))
    def each():
        while True:
            try: yield next(batches)
            except StopIteration: return
            except IndexError:
                if rows: return
                raise
    with torch.no_grad():
        for idx, frames in each():
            hm = model(frames.float().cuda()).cpu().numpy()
            for b in range(hm.shape[0]):
                for t in range(hm.shape[1]):
                    f = int(idx[b][t][1])
                    if f in rows:
                        continue
                    peak = float(hm[b, t].max())
                    x0, y0, w, h = predict_location(to_img(hm[b, t] > thr))
                    if w == 0 and h == 0:
                        rows[f] = (0, 0, 0, round(peak, 3))
                    else:
                        rows[f] = (1, round((x0 + w / 2) * ds.w_scaler, 1), round((y0 + h / 2) * ds.h_scaler, 1), round(peak, 3))
    write_rows(out, rows)


def worker_wasb(clip, out, sport):
    """WASB as a library, for tennis and basketball: its HRNet from its own config (configs/model/wasb.yaml: 3 frames
    in, 3 heatmaps out, 512x288), its affine transform and ImageNet normalisation, and its own postprocessor
    (connected components above 0.5, weighted by the heatmap); per frame the highest-scoring blob"""
    import cv2
    import numpy as np
    import torch
    from PIL import Image
    import torchvision.transforms as T
    root = os.environ.get("BALL_WASB_DIR", os.path.join(HOME, "WASB-SBDT"))
    sys.path.insert(0, os.path.join(root, "src"))
    from models import build_model
    from dataloaders.dataset_loader import get_transform
    from detectors.postprocessor import TracknetV2Postprocessor
    torch.set_num_threads(8)
    from omegaconf import OmegaConf  # WASB reads its config by attribute (cfg.MODEL.EXTRA), as Hydra loads it
    mcfg = OmegaConf.load(os.path.join(root, "src", "configs", "model", "wasb.yaml"))
    dcfg = OmegaConf.load(os.path.join(root, "src", "configs", "dataloader", "default.yaml"))  # (its heatmap sigmas, read by the postprocessor)
    cfg = OmegaConf.create({"model": mcfg, "dataloader": dcfg, "detector": {"postprocessor": {"score_threshold": 0.5, "scales": [0], "blob_det_method": "concomp", "use_hm_weight": True}}})
    model = build_model(cfg)
    ck = torch.load(os.path.join(WEIGHTS, "wasb", f"wasb_{sport}_best.pth.tar"), map_location="cpu", weights_only=False)
    model.load_state_dict(ck["model_state_dict"])
    model = model.cuda().eval()
    post = TracknetV2Postprocessor(cfg)
    W, H = mcfg["inp_width"], mcfg["inp_height"]
    norm = T.Compose([T.ToTensor(), T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])
    cap = cv2.VideoCapture(clip)
    frames = []
    while True:
        ok, im = cap.read()
        if not ok:
            break
        frames.append(im)
    cap.release()
    if not frames:
        write_rows(out, {})
        return
    trans = get_transform(frames[0], (W, H))
    inv = get_transform(frames[0], (W, H), inv=1)
    rows = {}
    with torch.no_grad():
        for s in range(0, len(frames), 3):  # windows of 3, as the evaluation's step
            idx = [min(len(frames) - 1, s + k) for k in range(3)]
            x = torch.cat([norm(Image.fromarray(cv2.cvtColor(cv2.warpAffine(frames[i], trans, (W, H), flags=cv2.INTER_LINEAR), cv2.COLOR_BGR2RGB))) for i in idx], 0)
            preds = model(x[None].cuda())
            res = post.run(preds, {0: torch.from_numpy(np.array([inv]))})
            for k, i in enumerate(idx):
                if i in rows:
                    continue
                r = res[0][k][0]
                peak = float(np.max(r["hm"]))
                if len(r["xys"]):
                    b = int(np.argmax(r["scores"]))
                    rows[i] = (1, round(float(r["xys"][b][0]), 1), round(float(r["xys"][b][1]), 1), round(peak, 3))
                else:
                    rows[i] = (0, 0, 0, round(peak, 3))
    write_rows(out, rows)


def signals(rows, n, fps, w, h):
    """per frame: position, how sure (a detection the track's neighbours agree with counts fully, a lone one half),
    and yes/no with hysteresis"""
    x, y, v = [None] * n, [None] * n, [0] * n
    for r in rows:
        if 0 <= r["frame"] < n and r["v"] and not (r["x"] == 0 and r["y"] == 0):
            x[r["frame"]], y[r["frame"]], v[r["frame"]] = r["x"], r["y"], 1
    jump = 0.12 * math.hypot(w, h) * 30 / fps  # farther in one frame than a smash travels
    p = []
    for i in range(n):
        if not v[i]:
            p.append(0.0)
            continue
        nb = [j for j in (i - 1, i + 1) if 0 <= j < n and v[j]]
        agree = [j for j in nb if math.hypot(x[j] - x[i], y[j] - y[i]) <= jump]
        # a point that sits still for 0.1 s either side is a head or a lamp in the stands, or a shuttle held or lying:
        # not a ball in play, which is what the effects follow
        near = [j for j in range(i - 3, i + 4) if j != i and 0 <= j < n and v[j]]
        static = len(near) >= 4 and all(math.hypot(x[j] - x[i], y[j] - y[i]) <= 2 for j in near)
        p.append(0.3 if static else 1.0 if agree else 0.5)  # under hysteresis's 0.6: a lone or still point never switches it on
    on = hysteresis(p)
    # a lone point is not where the ball is: drop it, and while the ball is on, fill gaps of up to 3 frames from the
    # points either side
    for i in range(n):
        if p[i] == 0.5:
            x[i] = y[i] = None
    i = 0
    while i < n:
        if on[i] and x[i] is None:
            j = i
            while j < n and x[j] is None:
                j += 1
            a = i - 1
            if a >= 0 and j < n and x[a] is not None and j - i <= 3:
                for t in range(i, j):
                    u = (t - a) / (j - a)
                    x[t], y[t] = x[a] + (x[j] - x[a]) * u, y[a] + (y[j] - y[a]) * u
            i = j
        else:
            i += 1
    return x, y, p, on


def hits(x, y, on, fps, reel=None, who_scale=1.0):
    """frames where the ball turns sharply (over 50 degrees within 0.13 s on either side) while it is there, at
    least 0.3 s apart; with the reel, each goes to the player whose wrist is nearest"""
    n, k = len(x), max(2, round(0.13 * fps))
    out = []
    for i in range(k, n - k):
        if not (on[i - k] and on[i] and on[i + k]) or x[i - k] is None or x[i] is None or x[i + k] is None:
            continue
        a = (x[i] - x[i - k], y[i] - y[i - k])
        b = (x[i + k] - x[i], y[i + k] - y[i])
        la, lb = math.hypot(*a), math.hypot(*b)
        if la < 2 or lb < 2:
            continue
        turn = math.degrees(math.acos(max(-1, min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb)))))
        if turn > 50:
            out.append((i, turn))
    picked = []
    for i, t in sorted(out, key=lambda z: -z[1]):
        if all(abs(i - j) > 0.3 * fps for j, _ in picked):
            picked.append((i, t))
    res = []
    for i, t in sorted(picked):
        who = None
        if reel:
            f = reel["frames"][i] if i < len(reel["frames"]) else 0
            best = None
            for w_, q in enumerate(f or []):
                if q:
                    for j in (9, 10):
                        if q["k"][j][2] > 0.3:
                            d = math.hypot(q["k"][j][0] - x[i] * who_scale, q["k"][j][1] - y[i] * who_scale)
                            best = (d, w_) if best is None or d < best[0] else best
            who = best[1] if best else None
        res.append({"frame": i, "turn_deg": round(t), "who": who})
    return res


def rally_end(x, y, on, fps):
    """the rally's end: the end of the last stretch of at least 0.3 s where the ball is there (a tracker loses a
    shuttle for seconds mid-rally, so a gap alone is no end), or earlier in that stretch where the ball, having
    flown, lies still for half a second (it landed). None when the clip stops less than 0.5 s after it"""
    n, still = len(on), round(0.5 * fps)
    runs, a = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and a is None:
            a = i
        elif not v and a is not None:
            if i - a >= 0.3 * fps:
                runs.append((a, i - 1))
            a = None
    if not runs:
        return None
    a, b = runs[-1]
    pos = lambda k: x[k] is not None and y[k] is not None
    for i in range(a + still, b + 1):
        flown = any(pos(k) and pos(k + 1) and math.hypot(x[k + 1] - x[k], y[k + 1] - y[k]) > 3 for k in range(a, i - still))
        if flown and pos(i) and all(pos(k) and math.hypot(x[k] - x[i], y[k] - y[i]) < 3 for k in range(i - still, i)):
            return i - still
    return b if n - 1 - b >= still else None


DEFAULT_WINDOW = (3.0, 1.2)  # the app's own cut around the moment when there is no rally (web Highlights: s - 3 to s + 1.2)


def rally_clip(on, at, end, fps, gap=2.0, pre=0.3, post=0.4, before=1.5, after=1.2, sparse=0.2, min_on=1.0):
    """the rally around frame at, from the ball, as (in, out, source) frames. source "ball": the first and last frame
    the ball is on (confident) in the stretch around the moment, where gaps of up to gap seconds are joined (on phone
    footage TrackNetV5 loses the shuttle for over a second mid-rally), cut at the rally's end when that falls inside
    it, with pre and post seconds of margin. Whatever the ball says, the clip starts at least before seconds before the
    moment (the slow motion's lead-in) and ends at least after seconds after it, so a lost shuttle never cuts the shot.
    source "moment": the app's default window around the moment (DEFAULT_WINDOW) when the track is too sparse to
    trust: the ball not on within gap seconds of the moment, under min_on seconds of "on" in the stretch, or "on" in
    under sparse of its frames. None without a moment"""
    n, g = len(on), round(gap * fps)
    if not n or at is None:
        return None
    at = max(0, min(n - 1, int(at)))
    default = (max(0, at - round(DEFAULT_WINDOW[0] * fps)), min(n - 1, at + round(DEFAULT_WINDOW[1] * fps)), "moment")
    lit = [i for i, v in enumerate(on) if v]
    near = [i for i in lit if abs(i - at) <= g]
    if not near:
        return default
    a = b = min(near, key=lambda i: abs(i - at))
    idx = set(lit)
    while any(a - k in idx for k in range(1, g + 1)):
        a = next(a - k for k in range(1, g + 1) if a - k in idx)
    while any(b + k in idx for k in range(1, g + 1)):
        b = next(b + k for k in range(1, g + 1) if b + k in idx)
    lit_in = sum(1 for i in lit if a <= i <= b)
    if lit_in < min_on * fps or lit_in < sparse * (b - a + 1):
        return default
    if end is not None and at <= end < b:
        b = end
    i0 = min(a - round(pre * fps), at - round(before * fps))
    i1 = max(b + round(post * fps), at + round(after * fps))
    return max(0, i0), min(n - 1, i1), "ball"


def track(clip, sport="badminton", reel=None, csv_path=None):
    import cv2
    cap = cv2.VideoCapture(clip)
    fps, n = cap.get(cv2.CAP_PROP_FPS) or 30, int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(3)), int(cap.get(4))
    cap.release()
    rows = read_csv(csv_path) if csv_path else run_tracker(clip, sport)
    if rows is None:
        return {"fps": round(fps, 3), "w": w, "h": h, "sport": sport, "tracker": None, "frames": list(range(n)), "ball": None, "hits": [], "rally_end": None}
    x, y, p, on = signals(rows, n, fps, w, h)
    scale = (reel["w"] / w) if reel else 1.0
    peak = [0.0] * n
    for r in rows:
        if 0 <= r["frame"] < n:
            peak[r["frame"]] = r["peak"]
    out = {"fps": round(fps, 3), "w": w, "h": h, "sport": sport, "tracker": f"rows from {os.path.basename(csv_path)}" if csv_path else TRACKERS[sport][1],
           "frames": list(range(n)),
           "ball": {"x": [None if v is None else round(v, 1) for v in x], "y": [None if v is None else round(v, 1) for v in y],
                    "p": p, "on": on, "peak": peak},
           "hits": hits(x, y, on, fps, reel, scale), "rally_end": rally_end(x, y, on, fps)}
    if reel:  # the same positions in the reel's pixels, for the app's drawn view
        out["ball"]["reel_xy"] = [None if v is None else [round(v * scale, 1), round(y[i] * scale, 1)] for i, v in enumerate(x)]
    return out


if __name__ == "__main__" and "--worker" in sys.argv:
    k = sys.argv.index("--worker")
    kind, clip_, out_ = sys.argv[k + 1], sys.argv[k + 2], sys.argv[k + 3]
    sport_ = sys.argv[sys.argv.index("--sport") + 1] if "--sport" in sys.argv else "badminton"
    if kind == "tracknetv5":
        worker_tracknetv5(clip_, out_)
    else:
        worker_wasb(clip_, out_, sport_)
    sys.exit(0)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("clip"); ap.add_argument("out")
    ap.add_argument("--sport", default="badminton"); ap.add_argument("--reel"); ap.add_argument("--csv")
    A = ap.parse_args()
    res = track(A.clip, A.sport.lower(), json.load(open(A.reel)) if A.reel else None, A.csv)
    json.dump(res, open(A.out, "w"), separators=(",", ":"))
    b = res["ball"]
    print(json.dumps({"tracker": res["tracker"], "frames": len(res["frames"]), "ball_on": sum(b["on"]) if b else 0,
                      "hits": [h_["frame"] for h_ in res["hits"]], "rally_end": res["rally_end"]}))
