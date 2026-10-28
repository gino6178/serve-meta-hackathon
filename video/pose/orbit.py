"""An orbit replay for a highlight: time stops at your moment and the camera moves around you, or, when the footage
can't carry it, a plain zoom. Runs on the GPU server after reel.py, reusing its Sapiens2 keypoints and
SAM 2.1 outlines.
  python orbit.py <clip.mp4> <reel.json> <out.mp4> [--t seconds] [--who 0] [--mode auto|orbit|zoom] [--views 1]
                  [--src clip_hi.mp4] [--size 1280x720] [--shots dir] [--probe dir] [--plan plan.json]
--src: the same clip at a higher resolution (the reel's pixels are scaled to it); --views N > 1: the court from N
frames around the moment in one metric frame (approach b), else the moment's frame alone (approach a). --probe:
also render frames at fixed angles, for labelling (orbit_fit.py learns the threshold from them).
- The moment is the reel's (or the fastest swing in its pose); the cut goes in where the hand is slowest before it
  and out 0.8 s after. exists.py says, frame by frame, whether the player and the racket hand are there (SAM 2.1's
  object-presence head, the mask's area, Sapiens2's confidence, with hysteresis): the effect's window is cut to where
  they are, or the effect is held (the clip plays plain) when they aren't there around the moment. With a ball track
  (ball.py: the reel's, or --ball), the freeze goes to the ball's turn nearest the swing, the cut goes out at the
  rally's end, and the zoom leans toward the incoming ball and settles on the hit.
- Meta's MapAnything reads metric depth and the camera's intrinsics from the moment's frame (with --views, the camera
  poses too). The floor is found in that depth (RANSAC), and gives "up" and two scale checks: the camera's height and
  the player's height.
- SAM 2.1 cuts the player out again at full resolution, from the reel's outline and Sapiens2 keypoints; its own IoU
  estimate is the mask's quality. What differs from the empty court next to the player (the racket, the shuttle) goes
  with the player.
- The empty court behind the player is taken from the frames around the moment, aligned to it by homography (exact for
  a phone that pans), so the camera can look behind the player without inventing it.
- Both layers are point clouds, splatted with a soft z-buffer on the GPU; holes are filled by push-pull from the far
  side. The player gets a gentle bulge, not the depth's own edge, which tears when seen from the side.
- The decision (decide()): gates on the mask, the pose, occlusion, size, blur, the depth's scale and how much of the
  court behind the player was seen; the zoom that leaves the most room to turn; then on each side the widest angle
  whose frame invents no more than a threshold learned from labelled frames and keeps the player and the hit point in
  view. After the full render every frame is checked again; an orbit that fails is shortened once, then replaced by
  the zoom (slow motion into the moment, pushing in on the player, a held frame).
Writes the mp4 and a plan JSON: the decision, every feature it rests on, the stage timings and peak GPU memory."""
import argparse, json, math, os, subprocess, sys, time

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
# the server's CPUs are shared (the language model keeps part of itself there): 8 threads at most, unless told otherwise
THREADS = int(os.environ.get("ORBIT_THREADS", "8"))
os.environ.setdefault("OMP_NUM_THREADS", str(THREADS))
import cv2
import numpy as np
import torch

torch.set_num_threads(THREADS)
cv2.setNumThreads(THREADS)
import torch.nn.functional as Fn
from scipy.spatial.transform import Rotation, Slerp

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("reel"); ap.add_argument("out")
ap.add_argument("--t", type=float, help="the moment in seconds (default: the reel's, else the fastest swing)")
ap.add_argument("--who", type=int, default=0, help="which player in the reel: 0 you, 1 the other")
ap.add_argument("--mode", default="auto", choices=["auto", "orbit", "zoom"])
ap.add_argument("--views", type=int, default=1)
ap.add_argument("--src"); ap.add_argument("--size", default="1280x720"); ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--arc", type=float, help="force the arc on each side, degrees")
ap.add_argument("--zoom", type=float, help="force the zoom")
ap.add_argument("--shots"); ap.add_argument("--plan")
ap.add_argument("--no-render", action="store_true", help="decide only")
ap.add_argument("--probe", help="also render frames at fixed orbit angles into this folder (for labelling), with their features")
ap.add_argument("--ball", help="ball.py's output for the clip (default: the reel's own, if it has one)")
A = ap.parse_args()
dev = "cuda"
TIME, t_all = {}, time.time()


def stage(name, t0):
    torch.cuda.synchronize()
    TIME[name] = round(time.time() - t0, 3)
    return time.time()


R = json.load(open(A.reel))
FPS, RW, RH, FR = R["fps"], R["w"], R["h"], R["frames"]
SRC = A.src or A.clip
cap = cv2.VideoCapture(SRC)
SW, SH, NF = int(cap.get(3)), int(cap.get(4)), int(cap.get(7))
cap.release()
S = SW / RW  # reel pixels -> source pixels
OW, OH = map(int, A.size.split("x"))


def read_frames(idx):
    """BGR frames by index, read in order from the first"""
    idx = sorted(set(i for i in idx if 0 <= i < NF))
    out = {}
    if not idx:
        return out
    c = cv2.VideoCapture(SRC)
    c.set(cv2.CAP_PROP_POS_FRAMES, idx[0])
    i, want = idx[0], set(idx)
    while i <= idx[-1]:
        ok, im = c.read()
        if not ok:
            break
        if i in want:
            out[i] = im
        i += 1
    c.release()
    return out


def person(i, who=A.who, reach=0):
    for d in [0] + [x for k in range(1, reach + 1) for x in (-k, k)]:
        j = i + d
        f = FR[j] if 0 <= j < len(FR) else 0
        if f and len(f) > who and f[who]:
            return f[who]
    return None


def poly_mask(p, shape=(SH, SW)):
    m = np.zeros(shape, np.uint8)
    if p and p.get("m"):
        cv2.fillPoly(m, [(np.array(p["m"], np.float64).reshape(-1, 2) * S).round().astype(np.int32)], 1)
    return m


seen = lambda k, j: k[j][2] > 0.3
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(r) + 1, 2 * int(r) + 1))


# ---------------------------------------------------------------- the moment and the cut points, from the pose
def hand_speed():
    """the player's fastest hand at each frame read, in body heights per second (as reel.py)"""
    out = []
    idx = [i for i in range(len(FR)) if person(i)]
    for a, b in zip(idx, idx[1:]):
        if b - a > 2:
            continue
        p, q = person(a)["k"], person(b)["k"]
        if not (seen(q, 0) and (seen(q, 15) or seen(q, 16))):
            continue
        body = max(1.0, max(q[15][1] if seen(q, 15) else 0, q[16][1] if seen(q, 16) else 0) - q[0][1])
        v = max((math.hypot(q[j][0] - p[j][0], q[j][1] - p[j][1]) / body / ((b - a) / FPS)) if seen(p, j) and seen(q, j) else 0 for j in (9, 10))
        out.append((b, v))
    if len(out) >= 3:  # a median of three: one keypoint jumping is not a swing
        vs = [v for _, v in out]
        out = [(i, sorted(vs[max(0, k - 1): k + 2])[len(vs[max(0, k - 1): k + 2]) // 2]) for k, (i, _) in enumerate(out)]
    return out


speed = hand_speed()
if A.t is not None:
    moment = int(round(A.t * FPS))
elif R.get("smash") is not None and A.who == 0:
    moment = int(round(R["smash"] * FPS))
else:
    moment = max(speed, key=lambda x: x[1])[0] if speed else len(FR) // 2
near = [j for d in range(4) for j in (moment - d, moment + d) if person(j)]
moment = near[0] if near else moment  # a frame the player was read on
P = person(moment)
if not P:
    sys.exit(json.dumps({"error": "the player was not read near the moment"}))
before = [(i, v) for i, v in speed if moment - 1.5 * FPS <= i <= moment - 0.4 * FPS]
t_in = max(0.0, (min(before, key=lambda x: x[1])[0] if before else moment - FPS) / FPS)  # the swing starts where the hand is slowest
t_out = min(NF - 1, moment + 0.8 * FPS) / FPS

# the ball (ball.py, a third-party tracker), from the reel or --ball. The freeze goes to the ball's turn nearest the
# swing (within 0.3 s: the racket met it then), and the cut goes out at the rally's end when that comes within 3 s
BALL = json.load(open(A.ball)) if A.ball else R.get("ball")
ball_note = {}
if BALL and BALL.get("ball"):
    def by_hand(i, k=1.0):
        """the ball at frame i within k player-heights of the player's racket hand (the tracker also finds heads and
        lamps in the stands: a turn far from the hand is not this hit)"""
        q, xy = person(i, reach=2), BALL["ball"].get("reel_xy")
        b = xy[i] if xy and 0 <= i < len(xy) else None
        if not q or b is None:
            return False
        ys = [kp[1] for kp in q["k"][:17] if kp[2] > 0.3]
        h = (max(ys) - min(ys)) if len(ys) > 1 else 0
        return any(math.hypot(q["k"][j][0] - b[0], q["k"][j][1] - b[1]) <= k * h for j in (9, 10) if q["k"][j][2] > 0.3)

    mine = [h for h in BALL["hits"] if h["who"] in (A.who, None)]
    hit = min(mine, key=lambda h: abs(h["frame"] - moment)) if mine else None
    if hit and abs(hit["frame"] - moment) <= 0.3 * FPS and person(hit["frame"], reach=2) and by_hand(hit["frame"]):
        ball_note["moment_moved_frames"] = hit["frame"] - moment
        moment = hit["frame"] if person(hit["frame"]) else next(j for d in range(3) for j in (hit["frame"] - d, hit["frame"] + d) if person(j))
        P = person(moment)
    end = BALL.get("rally_end")
    if end is not None and moment < end <= moment + 3 * FPS:
        t_out = min(NF - 1, end + 0.4 * FPS) / FPS
        ball_note["cut_at_rally_end_s"] = round(end / FPS, 2)


def ball_at(i):
    """the ball in source pixels at frame i, when it is there"""
    if not (BALL and BALL.get("ball")) or not (0 <= i < len(BALL["ball"]["on"])) or not BALL["ball"]["on"][i]:
        return None
    xy = BALL["ball"].get("reel_xy")
    q = xy[i] if xy else None
    return None if q is None else (q[0] * S, q[1] * S)


# ---------------------------------------------------------------- models
t0 = time.time()
from transformers import Sam2Model, Sam2Processor
from mapanything.models import MapAnything
from mapanything.utils.image import find_closest_aspect_ratio, preprocess_inputs

qp = Sam2Processor.from_pretrained("facebook/sam2.1-hiera-large")
qm = Sam2Model.from_pretrained("facebook/sam2.1-hiera-large", torch_dtype=torch.bfloat16).to(dev).eval()


class no_init:
    """skip random initialisation while the model is built: every weight comes from the checkpoint"""
    names = ["uniform_", "normal_", "trunc_normal_", "kaiming_uniform_", "kaiming_normal_", "xavier_uniform_", "xavier_normal_", "constant_", "zeros_", "ones_", "orthogonal_"]

    def __enter__(self):
        self.saved = {n: getattr(torch.nn.init, n) for n in self.names if hasattr(torch.nn.init, n)}
        self.tensor = (torch.Tensor.uniform_, torch.Tensor.normal_)
        for n in self.saved:
            setattr(torch.nn.init, n, lambda t, *a, **k: t)
        torch.Tensor.uniform_ = lambda t, *a, **k: t
        torch.Tensor.normal_ = lambda t, *a, **k: t

    def __exit__(self, *e):
        for n, f in self.saved.items():
            setattr(torch.nn.init, n, f)
        torch.Tensor.uniform_, torch.Tensor.normal_ = self.tensor


MA_ID = os.environ.get("ORBIT_MAPANYTHING", "facebook/map-anything-apache")  # or a local copy of that repository
with no_init():
    ma = MapAnything.from_pretrained(MA_ID).to(dev).eval()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exists as EX

presence = EX.Presence(dev)
t0 = stage("load_models", t0)
torch.cuda.reset_peak_memory_stats()
mem0 = torch.cuda.memory_allocated()

# ---------------------------------------------------------------- does the target exist over the effect's window
# the racket hand is the wrist that moves fastest into the moment
hit_k = max((9, 10), key=lambda j: sum(math.hypot(person(i)["k"][j][0] - person(i - 2)["k"][j][0], person(i)["k"][j][1] - person(i - 2)["k"][j][1])
                                      for i in range(moment - 6, moment + 1, 2) if person(i) and person(i - 2)))
HIT = {9: "hit_l", 10: "hit_r"}[hit_k]
EXS = EX.run(A.clip, R, A.who, step=2, presence=presence, start=max(0, int(t_in * FPS) - 10), end=min(len(FR), int(t_out * FPS) + 11))


def window_check(a, b):
    """play the effect over frames a..b, cut it to where the player exists, or hold it (the clip plays plain)"""
    fr, on = EXS["frames"], EXS["player"]["on"]
    if not fr:
        return "hold", a, b, "the player was never found in the window"
    hon, con = EXS["points"][HIT]["on"], EXS["points"]["centre"]["on"]
    nm = min(range(len(fr)), key=lambda n: abs(fr[n] - moment))
    near_m = range(max(0, nm - 1), min(len(fr), nm + 2))
    if not (any(hon[n] for n in near_m) and any(con[n] for n in near_m)):
        return "hold", a, b, "the racket hand or the body is hidden or out of frame at the moment"
    ns = [n for n, j in enumerate(fr) if a <= j <= b]
    if all(on[n] for n in ns):
        return "play", a, b, ""
    lo = hi = nm
    while lo > 0 and on[lo - 1] and fr[lo - 1] >= a:
        lo -= 1
    while hi + 1 < len(on) and on[hi + 1] and fr[hi + 1] <= b:
        hi += 1
    if on[nm] and fr[lo] <= moment - 0.4 * FPS and fr[hi] >= moment + 0.2 * FPS:
        return "cut", fr[lo], fr[hi], "the player leaves the frame or is hidden in part of the window"
    return "hold", a, b, "the player is not in frame long enough around the moment"


exists_verdict = window_check(int(t_in * FPS), int(t_out * FPS))
if exists_verdict[0] == "cut":
    t_in, t_out = exists_verdict[1] / FPS, exists_verdict[2] / FPS
t0 = stage("exists", t0)


@torch.inference_mode()
def sam(rgb, box, pts):
    kw = dict(images=[rgb], input_boxes=[[box]], return_tensors="pt")
    if pts:
        kw.update(input_points=[[pts]], input_labels=[[[1] * len(pts)]])
    q = qp(**kw).to(dev)
    q["pixel_values"] = q["pixel_values"].to(torch.bfloat16)
    o = qm(**q, multimask_output=False)
    m = qp.post_process_masks(o.pred_masks.float().cpu(), q["original_sizes"])[0]
    return m.reshape(-1, *m.shape[-2:])[0].numpy().astype(np.uint8), float(o.iou_scores.float().reshape(-1)[0])


TW, TH = find_closest_aspect_ratio(SW / SH, 518)
CW, CH = min(SW, round(SH * TW / TH)), min(SH, round(SW * TH / TW))
X0, Y0 = (SW - CW) // 2, (SH - CH) // 2


@torch.inference_mode()
def mapanything(bgrs):
    """metric depth (source pixels), intrinsics (source pixels), camera-to-world pose, confidence for each frame"""
    small = [cv2.resize(cv2.cvtColor(b[Y0:Y0 + CH, X0:X0 + CW], cv2.COLOR_BGR2RGB), (TW, TH), interpolation=cv2.INTER_AREA) for b in bgrs]
    views = preprocess_inputs([{"img": torch.from_numpy(s)} for s in small])
    pr = ma.infer(views, memory_efficient_inference=True, use_amp=True, amp_dtype="bf16", apply_mask=False, mask_edges=False)
    out = []
    for p, sm in zip(pr, small):
        K = p["intrinsics"][0].float().cpu().numpy().astype(np.float64)
        Ks = K.copy()
        Ks[0, 0] *= CW / TW; Ks[1, 1] *= CH / TH
        Ks[0, 2] = (K[0, 2] + .5) * CW / TW - .5 + X0; Ks[1, 2] = (K[1, 2] + .5) * CH / TH - .5 + Y0
        out.append({"d": p["depth_z"][0, ..., 0].float().cpu().numpy(), "K": K, "Ks": Ks, "rgb": sm,
                    "pose": p["camera_poses"][0].float().cpu().numpy().astype(np.float64),
                    "conf": p["conf"][0].float().cpu().numpy(), "amb": p["non_ambiguous_mask"][0].float().cpu().numpy(),
                    "scale": float(p["metric_scaling_factor"].reshape(-1)[0])})
    return out


def to_src(a, interp=cv2.INTER_LINEAR):
    """a map at MapAnything's resolution -> source pixels (the crop's border replicated)"""
    r = cv2.resize(a.astype(np.float32), (CW, CH), interpolation=interp)
    return cv2.copyMakeBorder(r, Y0, SH - CH - Y0, X0, SW - CW - X0, cv2.BORDER_REPLICATE)


def backproject(d, K, us=None, vs=None):
    if us is None:
        vs, us = np.mgrid[0:d.shape[0], 0:d.shape[1]].astype(np.float64)
    return np.stack([(us - K[0, 2]) / K[0, 0] * d, (vs - K[1, 2]) / K[1, 1] * d, d], -1)


def pushpull_np(a, ok):
    """fill a[~ok] smoothly from its surroundings (a float map)"""
    t = torch.from_numpy(np.where(ok, a, 0)).float()[None, None].to(dev)
    w = torch.from_numpy(ok.astype(np.float32))[None, None].to(dev)
    return pushpull(t, w)[0, 0].cpu().numpy()


def pushpull(c, w):
    """c (1, C, H, W) colour times weight, w (1, 1, H, W): where w is ~0, take the next coarser level's colour"""
    levels = [(c, w)]
    while min(levels[-1][0].shape[-2:]) > 2:
        c, w = levels[-1]
        levels.append((Fn.avg_pool2d(c, 2, ceil_mode=True) * 4, Fn.avg_pool2d(w, 2, ceil_mode=True) * 4))
    c, w = levels[-1]
    col = c / w.clamp(min=1e-6)
    for c, w in reversed(levels[:-1]):
        up = Fn.interpolate(col, size=c.shape[-2:], mode="bilinear", align_corners=False)
        a = (w / 0.5).clamp(max=1)
        col = a * (c / w.clamp(min=1e-6)) + (1 - a) * up
    return col


def floor_plane(Pts, ok):
    """the floor in camera coordinates: unit normal n pointing up and d, n.X + d = 0 (d is the camera's height)"""
    pts = Pts[ok].reshape(-1, 3)
    if len(pts) < 500:
        return None
    rng = np.random.default_rng(0)
    pts = pts[rng.choice(len(pts), min(20000, len(pts)), replace=False)]
    best = (0, None, None)
    for _ in range(400):
        a, b, c = pts[rng.choice(len(pts), 3, replace=False)]
        n = np.cross(b - a, c - a)
        if np.linalg.norm(n) < 1e-9:
            continue
        n /= np.linalg.norm(n)
        if n[1] > 0:
            n = -n
        if -n[1] < 0.6:  # the floor is within about 50 degrees of the camera's up
            continue
        d = -n @ a
        if d < 0.2:
            continue
        inl = np.abs(pts @ n + d) < 0.03 + 0.01 * pts[:, 2]
        if inl.sum() > best[0]:
            best = (inl.sum(), n, inl)
    if best[1] is None:
        return None
    q = pts[best[2]]
    c0 = q.mean(0)
    n = np.linalg.svd(q - c0, full_matrices=False)[2][-1]
    n = -n if n[1] > 0 else n
    return {"n": n, "d": float(-n @ c0), "inliers": float(best[0] / len(pts))}


def ray_floor(us, vs, K, fl):
    """depth (z) where each pixel's ray meets the floor, inf where it doesn't"""
    r = np.stack([(us - K[0, 2]) / K[0, 0], (vs - K[1, 2]) / K[1, 1], np.ones_like(us)], -1)
    den = r @ fl["n"]
    with np.errstate(divide="ignore", invalid="ignore"):
        z = -fl["d"] / den
    return np.where((den < -1e-6) & (z > 0), z, np.inf)


# ---------------------------------------------------------------- read the moment
t0 = time.time()
win = [j for j in range(int(moment - 1.6 * FPS), int(moment + 1.6 * FPS) + 1) if 0 <= j < min(NF, len(FR)) and FR[j]]
if A.views > 1:
    span = [int(round(moment + (k - (A.views - 1) / 2) * 3.2 * FPS / max(1, A.views - 1))) for k in range(A.views)]
    mv = [moment] + [min(win, key=lambda j: abs(j - x)) for x in span if abs(x - moment) > 2]
    mv = list(dict.fromkeys(mv))
else:
    mv = [moment]
imgs = read_frames(set(win) | set(mv) | {moment})
img = imgs[moment]
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
t0 = stage("read_frames", t0)

# the player, cut out again at full resolution
m0 = poly_mask(P)
k = np.array(P["k"])
kx = k[:, :2] * S
ys, xs = np.nonzero(m0)
if not len(xs):  # the reel kept no outline on this frame: the keypoints' box
    ok_k = k[:, 2] > 0.3
    xs, ys = kx[ok_k, 0].clip(0, SW - 1), kx[ok_k, 1].clip(0, SH - 1)
box = [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())]
pad = 0.04 * (box[3] - box[1])
box = [max(0, box[0] - pad), max(0, box[1] - pad), min(SW - 1, box[2] + pad), min(SH - 1, box[3] + pad)]
inside = lambda j: 0 <= kx[j, 0] < SW and 0 <= kx[j, 1] < SH
pts = [[float(kx[j, 0]), float(kx[j, 1])] for j in (5, 6, 11, 12) if k[j, 2] > 0.5 and inside(j) and (m0[int(kx[j, 1]), int(kx[j, 0])] or not m0.any())]
mask, iou = sam(rgb, box, pts)
agree = float((mask & m0).sum() / max(1, (mask | m0).sum()))
if agree < 0.6:  # SAM went elsewhere at full resolution: keep the reel's outline
    mask = m0
t0 = stage("sam", t0)

# depth and camera
G = mapanything([imgs[j] for j in mv])
g = G[0]
K = g["Ks"]
t0 = stage("mapanything", t0)

# geometry at MapAnything's resolution
d = g["d"]
Pm = backproject(d, g["K"])
mask_ma = cv2.resize(mask[Y0:Y0 + CH, X0:X0 + CW], (TW, TH), interpolation=cv2.INTER_NEAREST)
others = np.zeros((SH, SW), np.uint8)
for w in range(len(FR[moment]) if FR[moment] else 0):
    if w != A.who:
        others |= poly_mask(person(moment, w))
others_ma = cv2.resize(others[Y0:Y0 + CH, X0:X0 + CW], (TW, TH), interpolation=cv2.INTER_NEAREST)
gz = np.maximum(np.abs(np.gradient(np.log(np.maximum(d, 1e-3)), axis=0)), np.abs(np.gradient(np.log(np.maximum(d, 1e-3)), axis=1)))
edge_ma = cv2.dilate((gz > 0.025).astype(np.uint8), disk(1))  # a jump of 2.5% in depth from one pixel to the next
bg_ma = (cv2.dilate(mask_ma, disk(3)) == 0) & (others_ma == 0) & (edge_ma == 0)
fl = floor_plane(Pm, bg_ma & (np.mgrid[0:TH, 0:TW][0] > TH * 0.35))
up = fl["n"] if fl else np.array([0., -1., 0.])

# the player's depth: MapAnything inside the mask, checked against the floor under the feet
er = cv2.erode(mask, disk(max(2, 0.01 * (box[3] - box[1]))))
Ds = to_src(d)
zs = Ds[er > 0] if er.sum() > 50 else Ds[mask > 0]
z_ma = float(np.median(zs))
z_iqr = float(np.percentile(zs, 75) - np.percentile(zs, 25))
feet = [j for j in (15, 16, 19, 20) if k[j, 2] > 0.4]
z_floor = None
if fl and feet:
    fu, fv = np.array([kx[j, 0] for j in feet]), np.array([kx[j, 1] for j in feet])
    zf = ray_floor(fu, fv, K, fl)
    z_floor = float(np.median(zf)) if np.isfinite(zf).all() else None
z_agree = abs(z_floor - z_ma) / z_ma if z_floor else None
zp0 = z_floor if (z_agree is not None and z_agree < 0.15) else z_ma
hp = box[3] - box[1]
player_m = hp / K[1, 1] * zp0  # the player's height in metres (box, so arms up count)
cam_h = fl["d"] if fl else None
cu, cv_ = float(xs.mean()), float(ys.mean())
C = backproject(np.array(zp0), K, np.array(cu), np.array(cv_)).reshape(3)
HIT3 = backproject(np.array(zp0), K, np.array(kx[hit_k, 0]), np.array(kx[hit_k, 1])).reshape(3)  # the hit point
t0 = stage("geometry", t0)


# ---------------------------------------------------------------- the empty court behind the player
def clean_plate(region):
    """the court in `region` (x0, y0, x1, y1) with nobody on it: frames around the moment, aligned by homography"""
    x0, y0, x1, y1 = region
    sc = 640 / SW
    sift = cv2.SIFT_create(3000)

    cache = {}

    def people(j):
        if j not in cache:
            m = np.zeros((RH, RW), np.uint8)
            for p in (FR[j] if j < len(FR) else 0) or []:
                if p and p.get("m"):
                    cv2.fillPoly(m, [np.array(p["m"], np.float64).reshape(-1, 2).round().astype(np.int32)], 1)
            cache[j] = cv2.resize(cv2.dilate(m, disk(12)), (SW, SH), interpolation=cv2.INTER_NEAREST)
        return cache[j]

    def feats(j):
        gimg = cv2.cvtColor(cv2.resize(imgs[j], None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        keep = cv2.resize(1 - people(j), (gimg.shape[1], gimg.shape[0]), interpolation=cv2.INTER_NEAREST)
        return sift.detectAndCompute(gimg, keep)

    ki, di = feats(moment)
    bf = cv2.BFMatcher()
    # where the player is now, a sample that looks like the player now is the player standing still (the reel's
    # outline missed them that frame), not the court: it must not go into the plate, or the plate gets ghost legs
    here = cv2.dilate(mask, disk(4))[y0:y1, x0:x1] > 0
    now = img[y0:y1, x0:x1].astype(np.int16)
    stack, used, Ssc = [], [], np.diag([sc, sc, 1.0])
    for j in win:  # every frame the reel read around the moment (every second frame)
        if abs(j - moment) < 2 or j not in imgs:
            continue
        kj, dj = feats(j)
        if dj is None or di is None or len(kj) < 30:
            continue
        mt = [a for a, b in bf.knnMatch(dj, di, k=2) if a.distance < 0.75 * b.distance]
        if len(mt) < 40:
            continue
        H, inl = cv2.findHomography(np.float32([kj[a.queryIdx].pt for a in mt]), np.float32([ki[a.trainIdx].pt for a in mt]), cv2.RANSAC, 2.0)
        if H is None or inl.sum() < 40:
            continue
        Hs = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1]]) @ np.linalg.inv(Ssc) @ H @ Ssc
        warp = cv2.warpPerspective(imgs[j], Hs, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=0)
        ok = cv2.warpPerspective((1 - people(j)) * 255, Hs, (x1 - x0, y1 - y0), flags=cv2.INTER_NEAREST, borderValue=0) > 128
        ok &= ~(here & (np.abs(warp.astype(np.int16) - now).max(-1) < 20))
        stack.append(np.where(ok[..., None], warp.astype(np.float32), np.nan))
        used.append(j)
    if not stack:
        return None, np.zeros((y1 - y0, x1 - x0), bool), 0
    st = torch.from_numpy(np.stack(stack)).to(dev)
    cnt = (~torch.isnan(st[..., 0])).sum(0)
    med = torch.nanmedian(st, dim=0).values
    valid = (cnt >= 3).cpu().numpy()
    return np.nan_to_num(med.cpu().numpy()).astype(np.uint8), valid, len(used)


r_band = max(6, 0.06 * hp)  # what moves with the player: up to 6% of their height beyond the outline...
hand = [j for j in (9, 10) if k[j, 2] > 0.3]
r_hand = 0.75 / player_m * hp if player_m > 0.5 else 0.25 * hp  # ...and 0.75 m around the racket hand
reach = (cv2.distanceTransform((mask == 0).astype(np.uint8), cv2.DIST_L2, 5) < r_band).astype(np.uint8)
for j in hand:
    cv2.circle(reach, (int(kx[j, 0]), int(kx[j, 1])), int(r_hand), 1, -1)
ry, rx = np.nonzero(cv2.dilate(reach, disk(8)))
region = (int(rx.min()), int(ry.min()), int(rx.max()) + 1, int(ry.max()) + 1)
plate, pvalid, n_plate = clean_plate(region)
x0r, y0r, x1r, y1r = region
fg = mask.copy()
if plate is not None:
    crop = img[y0r:y1r, x0r:x1r]
    diff = np.abs(crop.astype(np.int16) - plate.astype(np.int16)).max(-1)
    add = np.zeros_like(mask)
    feet_y = max([kx[j, 1] for j in (15, 16) if k[j, 2] > 0.3], default=box[3]) - 0.04 * hp
    band = (reach[y0r:y1r, x0r:x1r] > 0) & pvalid & (diff > 32)
    band[max(0, int(feet_y) - y0r):, :] &= False  # not the shadow under the feet
    add[y0r:y1r, x0r:x1r] = band
    add = cv2.morphologyEx(add, cv2.MORPH_OPEN, disk(1))
    n, lab = cv2.connectedComponents((add | mask).astype(np.uint8))
    keepl = set(np.unique(lab[mask > 0])) - {0}
    fg = np.isin(lab, list(keepl)).astype(np.uint8) | mask
hole = cv2.dilate(fg, disk(max(3, 0.012 * hp)))
B = img.copy()
real = np.ones((SH, SW), np.float32)
cover = 0.0
if plate is not None:
    sub = hole[y0r:y1r, x0r:x1r] > 0
    okp = sub & pvalid
    cover = float(okp.sum() / max(1, sub.sum()))
    Bs = B[y0r:y1r, x0r:x1r]
    Bs[okp] = plate[okp]
    left = np.zeros((SH, SW), np.uint8)
    left[y0r:y1r, x0r:x1r] = sub & ~pvalid
else:
    left = hole.copy()
if left.any():
    B = cv2.inpaint(B, left, 5, cv2.INPAINT_TELEA)
    real[left > 0] = 0
t0 = stage("clean_plate", t0)

# background depth: the player's hole filled from around it, never beyond the floor
hole_ma = cv2.resize(hole[Y0:Y0 + CH, X0:X0 + CW], (TW, TH), interpolation=cv2.INTER_NEAREST) > 0
db = pushpull_np(d, ~cv2.dilate(hole_ma.astype(np.uint8), disk(2)).astype(bool))
if fl:
    vv, uu = np.mgrid[0:TH, 0:TW].astype(np.float64)
    db = np.where(hole_ma, np.minimum(db, ray_floor(uu, vv, g["K"], fl)), d)
else:
    db = np.where(hole_ma, db, d)
# at a depth edge (a post, the net's tape, a person far off) a pixel takes the nearer side's depth, so thin things
# keep their place instead of smearing between the two depths
edge_ma &= ~hole_ma
db = np.where(edge_ma > 0, cv2.erode(db.astype(np.float32), np.ones((7, 7), np.uint8)), db)
edge = to_src(edge_ma.astype(np.float32), cv2.INTER_NEAREST) > 0.5
Db = np.where(edge, to_src(db, cv2.INTER_NEAREST), to_src(db))
# the player's relief: a gentle bulge, 8 cm toward the camera over the first 12% of their height in from the
# outline. MapAnything's own depth at a person's edge ramps into the background behind them; seen 20 degrees round,
# that ramp tears into a comb. The bulge has no steep edge, so it doesn't
dt_in = cv2.distanceTransform(fg.astype(np.uint8), cv2.DIST_L2, 5)
zp = np.where(fg > 0, zp0 - 0.08 * np.clip(dt_in / (0.12 * hp), 0, 1), 0).astype(np.float32)
t0 = stage("depth_layers", t0)


# ---------------------------------------------------------------- features the decision rests on
def lap_var(gray, m=None):
    l = cv2.Laplacian(gray, cv2.CV_32F)
    return float(l[m > 0].var()) if m is not None else float(l.var())


gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
pm = np.zeros_like(mask)
pm[int(box[1]):int(box[3]), int(box[0]):int(box[2])] = 1
n_cc, lab_cc, st_cc, _ = cv2.connectedComponentsWithStats(mask)
big = st_cc[1:, cv2.CC_STAT_AREA].max() if n_cc > 1 else 0
body = list(range(17))
conf_ma = g["conf"]
feat = {
    "moment_s": round(moment / FPS, 3), "player_px": round(hp), "frame_px": SH,
    "mask_iou": round(iou, 3), "mask_agree": round(agree, 3), "mask_parts": round(float(big / max(1, mask.sum())), 3),
    "border": bool(mask[:, :2].any() or mask[:, -2:].any() or mask[:2].any() or mask[-2:].any()),
    "pose_conf": round(float(k[body, 2].mean()), 3), "joints_seen": round(float((k[body, 2] > 0.3).mean()), 3),
    "occlusion": round(float((pm & cv2.dilate(others, disk(4))).sum() / max(1, pm.sum())), 3),
    "sharp": round(lap_var(gray, cv2.erode(mask, disk(2))) / max(1e-6, lap_var(gray)), 3),
    "depth_conf": round(float(np.median(conf_ma[mask_ma > 0]) / np.median(conf_ma)), 3) if mask_ma.any() else None,
    "depth_unambiguous": round(float(g["amb"][mask_ma > 0].mean()), 3) if mask_ma.any() else None,
    "player_depth_m": round(zp0, 2), "player_relief_iqr_m": round(z_iqr, 2), "depth_feet_agree": round(z_agree, 3) if z_agree is not None else None,
    "background_depth_m": round(float(np.median(Db[(cv2.distanceTransform((hole == 0).astype(np.uint8), cv2.DIST_L2, 5) < 0.3 * hp) & (hole == 0)])), 2),
    "player_height_m": round(player_m, 2), "camera_height_m": round(cam_h, 2) if cam_h else None,
    "floor_inliers": round(fl["inliers"], 3) if fl else 0, "plate_cover": round(cover, 3), "plate_frames": n_plate,
    "views": len(mv),
    # thin things at a depth jump (posts, the net, far people) are what an orbit bends: their share of the background
    "depth_edge_share": round(float(edge_ma[bg_ma | (edge_ma > 0)].mean()), 4),
}
if len(G) > 1:  # how far the phone turned and moved across the views
    rot = [np.degrees(np.arccos(np.clip((np.trace(np.linalg.inv(g["pose"]) @ q["pose"]) - 1 - 1) / 2, -1, 1))) for q in G[1:]]
    feat["views_turn_deg"] = round(float(max(rot)), 1)
    feat["views_move_m"] = round(float(max(np.linalg.norm(q["pose"][:3, 3] - g["pose"][:3, 3]) for q in G[1:])), 2)
# which way the player faces, from the nose against the shoulders (COCO: 5 left, 6 right shoulder)
face = 0.0
if seen(k, 0) and seen(k, 5) and seen(k, 6):
    mid, wid = (kx[5, 0] + kx[6, 0]) / 2, abs(kx[5, 0] - kx[6, 0]) + 0.1 * hp
    face = float(np.clip((kx[0, 0] - mid) / wid, -1, 1)) * (1 if kx[5, 0] > kx[6, 0] else 0.5)  # front view counts more
feat["facing"] = round(face, 2)


# ---------------------------------------------------------------- the splat renderer
class Scene:
    def __init__(self):
        self.parts = []

    def add(self, xyz, bgr, real, bias=0.0, target=False):
        self.parts.append((xyz.reshape(-1, 3), bgr.reshape(-1, 3), real.reshape(-1), bias, target))

    def build(self):
        self.xyz = torch.from_numpy(np.concatenate([p[0] for p in self.parts]).astype(np.float32)).to(dev)
        self.col = torch.from_numpy(np.concatenate([np.concatenate([p[1].astype(np.float32), p[2][:, None].astype(np.float32)], 1) for p in self.parts])).to(dev)
        self.bias = torch.cat([torch.full((len(p[0]),), p[3], device=dev) for p in self.parts])
        self.target = torch.cat([torch.full((len(p[0]),), bool(p[4]), device=dev) for p in self.parts])

    @torch.no_grad()
    def render(self, Rw, p, Kc, W, H, points=()):
        """the view, which pixels are invented, the share of the target's points that are in view and in front, and
        for each 3D point in `points`, whether it is inside the frame (5% in from the edge) and not hidden"""
        img, inv, zbuf, u, v, zt, ok = self._render(Rw, p, Kc, W, H)
        ui, vi = u.round().long(), v.round().long()
        inside = ok & (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H)
        # hidden means something else is in front: a z-buffer of everything but the player (the player hiding part of
        # themselves as the camera turns is what an orbit is for)
        zbg = torch.full((H * W,), float("inf"), device=dev)
        bgi = inside & ~self.target
        zbg.scatter_reduce_(0, (vi * W + ui)[bgi], zt[bgi], "amin")
        ti = inside & self.target
        front = torch.zeros_like(inside)
        front[ti] = zt[ti] <= zbg[(vi * W + ui)[ti]] * 1.01 + 0.005
        tv = float(front.sum() / max(1, int(self.target.sum())))
        zbuf = zbg
        seen_pts = []
        for P3 in points:
            c = Rw @ (np.asarray(P3) - p)
            if c[2] <= 0.05:
                seen_pts.append(False)
                continue
            pu, pv = Kc[0, 0] * c[0] / c[2] + Kc[0, 2], Kc[1, 1] * c[1] / c[2] + Kc[1, 2]
            if not (0.05 * W <= pu < 0.95 * W and 0.05 * H <= pv < 0.95 * H):
                seen_pts.append(False)
                continue
            zb = float(zbuf[int(round(pv)) * W + int(round(pu))])
            seen_pts.append(bool(c[2] * 0.94 <= zb * 1.01 + 0.05))  # the point sits on the player layer (bias -6%)
        return img, inv, tv, seen_pts

    def _render(self, Rw, p, Kc, W, H):
        X = (self.xyz - torch.tensor(p, device=dev, dtype=torch.float32)) @ torch.tensor(Rw.T, device=dev, dtype=torch.float32)
        z = X[:, 2]
        ok = z > 0.05
        zc = z.clamp(min=0.05)
        u = Kc[0, 0] * X[:, 0] / zc + Kc[0, 2]
        v = Kc[1, 1] * X[:, 1] / zc + Kc[1, 2]
        zt = z * (1 + self.bias)
        u0, v0 = torch.floor(u), torch.floor(v)
        fu, fv = u - u0, v - v0
        corners = [(0, 0, (1 - fu) * (1 - fv)), (1, 0, fu * (1 - fv)), (0, 1, (1 - fu) * fv), (1, 1, fu * fv)]
        zbuf = torch.full((H * W,), float("inf"), device=dev)
        idxs = []
        for dx, dy, w in corners:
            x, y = u0 + dx, v0 + dy
            inb = ok & (x >= 0) & (x < W) & (y >= 0) & (y < H) & (w > 1e-3)
            idx = (y[inb] * W + x[inb]).long()
            zbuf.scatter_reduce_(0, idx, zt[inb], "amin")
            idxs.append((inb, idx, w[inb]))
        acc = torch.zeros((H * W, 6), device=dev)
        for inb, idx, w in idxs:
            front = zt[inb] <= zbuf[idx] * 1.01 + 0.005
            wf = w[front, None]
            acc.index_add_(0, idx[front], torch.cat([self.col[inb][front] * wf, wf, z[inb][front, None] * wf], 1))
        acc = acc.reshape(H, W, 6).permute(2, 0, 1)[None]
        wsum = acc[:, 4:5]
        hole = (wsum < 0.15)[0, 0]
        col = acc[:, :4] / wsum.clamp(min=1e-6)
        zpix = acc[:, 5:6] / wsum.clamp(min=1e-6)
        # a hole is where something near moved off something far: fill it from the far side (weights grow with z^4),
        # so a post leaves a blur of wall behind it, not a smear of post
        far = wsum * (zpix / zpix[wsum > 0.15].median().clamp(min=1e-3)).clamp(0.2, 5) ** 4
        fill = pushpull(col * far, far)
        a = (wsum / 0.5).clamp(max=1)
        out = (a * col + (1 - a) * fill)[0]
        invented = hole | (out[3] < 0.5)
        return out[:3].permute(1, 2, 0).clamp(0, 255).byte().cpu().numpy(), invented.cpu().numpy(), zbuf, u, v, zt, ok


def make_scene():
    sc = Scene()
    vs, us = np.mgrid[0:SH, 0:SW].astype(np.float32)
    keep = np.ones((SH, SW), bool)
    sc.add(backproject(Db, K, us, vs)[keep], B[keep], real[keep], 0.0)
    up2 = 2  # the player at twice the density: no cracks as the camera turns or zooms
    x0p, y0p, x1p, y1p = [int(v) for v in (max(0, box[0] - r_hand), max(0, box[1] - r_hand), min(SW, box[2] + r_hand), min(SH, box[3] + r_hand))]
    f2 = cv2.resize(fg[y0p:y1p, x0p:x1p], None, fx=up2, fy=up2, interpolation=cv2.INTER_NEAREST) > 0
    c2 = cv2.resize(img[y0p:y1p, x0p:x1p], None, fx=up2, fy=up2, interpolation=cv2.INTER_LINEAR)
    z2 = cv2.resize(zp[y0p:y1p, x0p:x1p].astype(np.float32), None, fx=up2, fy=up2, interpolation=cv2.INTER_NEAREST)
    v2, u2 = np.mgrid[0:f2.shape[0], 0:f2.shape[1]].astype(np.float32)
    u2, v2 = u2 / up2 + x0p + (0.5 / up2 - 0.5), v2 / up2 + y0p + (0.5 / up2 - 0.5)
    sc.add(backproject(z2, K, u2, v2)[f2], c2[f2], np.ones(int(f2.sum()), np.float32), -0.06, target=True)
    if len(G) > 1:  # (b) the court from the other views, behind the moment's own pixels where both saw it
        T0 = np.linalg.inv(G[0]["pose"])
        Dm = cv2.resize(Db[Y0:Y0 + CH, X0:X0 + CW], (TW, TH))  # the moment's depth, as MapAnything saw the frame
        for j, q in zip(mv[1:], G[1:]):
            ppl = np.zeros((SH, SW), np.uint8)
            for p_ in (FR[j] or []) if j < len(FR) else []:
                if p_:
                    ppl |= poly_mask(p_)
            ppl = cv2.resize(cv2.dilate(ppl, disk(10 * S))[Y0:Y0 + CH, X0:X0 + CW], (TW, TH), interpolation=cv2.INTER_NEAREST)
            lg = np.log(np.maximum(q["d"], 1e-3))
            e = np.maximum(np.abs(np.gradient(lg, axis=0)), np.abs(np.gradient(lg, axis=1))) > 0.04
            okq = (ppl == 0) & ~cv2.dilate(e.astype(np.uint8), disk(1)).astype(bool)
            Xq = backproject(q["d"], q["K"])[okq]
            X0w = (T0 @ q["pose"] @ np.c_[Xq, np.ones(len(Xq))].T).T[:, :3]
            # drop what disagrees with the moment's depth where the moment saw it too (people who moved, errors)
            uq = np.round(g["K"][0, 0] * X0w[:, 0] / X0w[:, 2] + g["K"][0, 2]).astype(int)
            vq = np.round(g["K"][1, 1] * X0w[:, 1] / X0w[:, 2] + g["K"][1, 2]).astype(int)
            ins = (X0w[:, 2] > 0.1) & (uq >= 0) & (uq < TW) & (vq >= 0) & (vq < TH)
            bad = np.zeros(len(X0w), bool)
            bad[ins] = np.abs(X0w[ins, 2] - Dm[vq[ins], uq[ins]]) > 0.06 * Dm[vq[ins], uq[ins]]
            cq = cv2.cvtColor(q["rgb"], cv2.COLOR_RGB2BGR)[okq]
            sc.add(X0w[~bad], cq[~bad], np.ones(int((~bad).sum()), np.float32), 0.03)
    sc.build()
    return sc


# ---------------------------------------------------------------- the camera
def lookat(p, target, upv):
    f = target - p
    f = f / np.linalg.norm(f)
    x = np.cross(-upv, f)
    x = x / np.linalg.norm(x)
    return np.stack([x, np.cross(f, x), f])


def axis_rot(axis, a):
    return Rotation.from_rotvec(axis / np.linalg.norm(axis) * a).as_matrix()


def ease(s):
    s = min(1.0, max(0.0, s))
    return s * s * (3 - 2 * s)


K_out0 = np.array([[K[0, 0] * OW / SW, 0, (K[0, 2] + .5) * OW / SW - .5], [0, K[1, 1] * OH / SH, (K[1, 2] + .5) * OH / SH - .5], [0, 0, 1]])
Z_FILL = (0.55, 0.85)  # the player's share of the frame's height: at least, at most


def frame_at(z):
    """aim and zoom for zoom z: the camera turns toward the player as far as the phone's frame allows at that zoom"""
    global zoom, AIM, T_aim
    zoom = z
    fo = K_out0[0, 0] * z
    hx, hy = math.atan(OW / 2 / fo), math.atan(OH / 2 / (fo * K_out0[1, 1] / K_out0[0, 0]))
    lo, hi = math.atan(-K[0, 2] / K[0, 0]) + hx, math.atan((SW - 1 - K[0, 2]) / K[0, 0]) - hx
    room = min(max(0.0, (hi - lo) / 2), math.radians(12))
    a_p = math.atan((cu - K[0, 2]) / K[0, 0])
    w_p = 0.5 * (box[2] - box[0]) / K[0, 0]  # the player's half width, as an angle
    ax = float(np.clip(np.clip(a_p, lo + room, hi - room), a_p - (hx - w_p) * 0.9, a_p + (hx - w_p) * 0.9))
    ay = np.clip(math.atan((cv_ - K[1, 2]) / K[1, 1]), math.atan(-K[1, 2] / K[1, 1]) + hy, math.atan((SH - 1 - K[1, 2]) / K[1, 1]) - hy)
    T_aim = np.array([math.tan(ax), math.tan(ay), 1.0]) * C[2]
    AIM = Slerp([0, 1], Rotation.from_matrix([np.eye(3), lookat(np.zeros(3), T_aim, up)]))


z_fit = float(np.clip(Z_FILL[0] * SH / hp, 1.0, 2.4))  # fill at least 55% of the height
z_cap = float(max(z_fit, min(2.6, Z_FILL[1] * SH / hp)))  # never so close the player is cut
frame_at(z_fit)


def camera(theta, s_aim, zm=None):
    """the virtual camera: orbit theta (radians) about the player's vertical axis, s_aim 0 = the phone's own framing,
    1 = the player centred and zoomed"""
    zm = zoom if zm is None else zm
    turn = axis_rot(up, theta)
    p = C + turn @ (np.zeros(3) - C)
    Rs = AIM([s_aim]).as_matrix()[0]
    Rw = Rs @ turn.T  # the aimed camera, carried round the player's vertical axis
    f = K_out0[0, 0] * zm ** s_aim
    Kc = np.array([[f, 0, K_out0[0, 2] + (OW / 2 - .5 - K_out0[0, 2]) * s_aim], [0, f * K_out0[1, 1] / K_out0[0, 0], K_out0[1, 2] + (OH / 2 - .5 - K_out0[1, 2]) * s_aim], [0, 0, 1]])
    return Rw, p, Kc


def near_box(Kc, Rw, p, W, H):
    """the player's box in an output frame, grown by half"""
    c = Rw @ (C - p)
    u, v = Kc[0, 0] * c[0] / c[2] + Kc[0, 2], Kc[1, 1] * c[1] / c[2] + Kc[1, 2]
    h = Kc[1, 1] * player_m / c[2] * 1.5
    return int(max(0, u - h / 2)), int(max(0, v - h / 2)), int(min(W, u + h / 2)), int(min(H, v + h / 2))


VIS_MIN = 0.85  # the share of the player's points an orbit frame must show


def blobs(inv):
    """invented pixels that form patches (a 1280-wide frame: 9 px or more across); thin stripes behind posts, filled
    from the far side, are not counted against the budget"""
    k = max(2, round(inv.shape[1] / 140))
    return cv2.morphologyEx(inv.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k, k), np.uint8)) > 0


BUDGET = {"frame": 0.035, "near": 0.05}  # stage 1 (the zoom): invented patches allowed, whole frame and around the player


def room_check(scene, theta, W=320, H=180):
    """stage 1, at low resolution: the share of invented patches, in the whole frame and around the player"""
    Rw, p, Kc = camera(theta, 1.0)
    Kc = Kc.copy()
    Kc[:2] *= W / OW
    _, inv, _, _ = scene.render(Rw, p, Kc, W, H)
    inv = blobs(inv)
    x0, y0, x1, y1 = near_box(Kc, Rw, p, W, H)
    return float(inv.mean()), float(inv[y0:y1, x0:x1].mean()) if x1 > x0 and y1 > y0 else 1.0


def view_check(scene, theta):
    """at orbit angle theta, rendered at full size: the invented share (all of it, thin stripes too: what the learned
    threshold is on), the player's visible share, and whether the orbit centre and the hit point are in frame and
    not hidden"""
    _, inv, tv, seen_pts = scene.render(*camera(theta, 1.0), OW, OH, points=(C, HIT3))
    return float(inv.mean()), tv, all(seen_pts)


# ---------------------------------------------------------------- the decision
def decide(scene):
    why = []
    gates = [
        (feat["border"], "the player is cut off by the frame's edge"),
        (feat["mask_iou"] < 0.80, f"the cut-out is unsure (SAM 2.1 rates it {feat['mask_iou']:.2f})"),
        (feat["mask_parts"] < 0.85, "the cut-out is in pieces (something is in front of the player)"),
        (feat["joints_seen"] < 0.6, "the pose is not read well enough"),
        (feat["occlusion"] > 0.2, "another player overlaps"),
        (feat["player_px"] < 0.18 * SH, "the player is too small in the frame"),
        (feat["sharp"] < THRESH["sharp"], "the player is blurred at the moment"),
        (not (0.9 <= feat["player_height_m"] <= 2.8), f"the depth's scale is off (the player measures {feat['player_height_m']} m)"),
        (feat["camera_height_m"] is not None and not (0.3 <= feat["camera_height_m"] <= 6), "the depth's scale is off (the camera's height)"),
        (feat["depth_feet_agree"] is not None and feat["depth_feet_agree"] > 0.3, "the depth at the player disagrees with the floor under the feet"),
        ((feat["depth_unambiguous"] or 0) < 0.8, "MapAnything marks the depth at the player as ambiguous"),
        (feat["plate_cover"] < THRESH["plate"], "too little of the court behind the player was ever seen"),
    ]
    why = [w for bad, w in gates if bad]
    # 1 the zoom. An orbit turns the view, so it needs a margin of background the phone saw at the frame's edges, and
    # zooming in buys that margin. From the zoom that fills 55% of the height up to the closest that keeps the whole
    # player in frame, take the first that leaves 12 degrees either way with few invented patches (at low
    # resolution), else the one with the most room
    tried = []
    for z in ([A.zoom] if A.zoom else np.unique(np.round(np.geomspace(z_fit, z_cap, 6) if z_cap > z_fit * 1.02 else [z_fit], 3))):
        frame_at(float(z))
        room = {}
        for side in (+1, -1):
            room[side] = 0
            for a in range(2, 25, 2):
                fr, nr = room_check(scene, math.radians(side * a))
                if fr > BUDGET["frame"] or nr > BUDGET["near"]:
                    break
                room[side] = a
        tried.append((float(z), room))
        if min(room.values()) >= 12:
            break
    z, room = next(((z, r) for z, r in tried if min(r.values()) >= 12), max(tried, key=lambda x: (sum(x[1].values()), -x[0])))
    frame_at(z)
    # 2 the arc on each side, at that zoom: the widest angle (2-degree steps) whose full-size frame invents no more
    # than the learned threshold, and that keeps the player and the hit point in view
    arcs, blind = {}, {}
    for side in (+1, -1):
        arcs[side] = blind[side] = A.arc or 0
        lost = False
        for a in ([] if A.arc else range(2, 25, 2)):
            inv_share, tv, pts_ok = view_check(scene, math.radians(side * a))
            if os.environ.get("ORBIT_DEBUG"):
                print("arc", round(float(z), 2), side * a, round(inv_share, 4), round(tv, 3), pts_ok, file=sys.stderr)
            if inv_share > THRESH["invented"]:
                break
            blind[side] = a  # what the arc would be with no check that the target stays in view
            lost = lost or tv < VIS_MIN or not pts_ok
            if not lost:
                arcs[side] = a
    feat["zoom"] = round(z, 2)
    feat["arc_room_deg"] = {"right": arcs[+1], "left": arcs[-1]}
    feat["zooms_tried"] = [[round(z, 2), r[-1], r[+1]] for z, r in tried]
    feat["arc_room_without_view_check_deg"] = {"right": blind[+1], "left": blind[-1]}
    if arcs[+1] + arcs[-1] < 8:
        why.append(f"the background has too little room to orbit ({arcs[-1]}° left, {arcs[+1]}° right)")
    # the main sweep ends on the side the player faces (a front view), else on the side with more room
    pref = 1 if arcs[+1] >= arcs[-1] else -1
    if abs(face) > 0.15 and arcs[1 if face > 0 else -1] >= 10:
        pref = 1 if face > 0 else -1
    a_end, a_start = min(20, arcs[pref]), min(12, arcs[-pref])
    mode = "orbit" if (A.mode == "orbit" or (A.mode == "auto" and not why)) else "zoom"
    ev, ea, eb, ereason = exists_verdict
    if ev == "hold":  # no effect aims at a player or a hand that isn't there: the clip plays plain
        mode = "none"
    fr = EXS["frames"]
    inwin = [n for n, j in enumerate(fr) if int(t_in * FPS) <= j <= int(t_out * FPS)]
    return {"mode": mode, "why_not_orbit": why, "sweep_deg": [-pref * a_start, pref * a_end], "zoom": round(zoom, 2),
            "centre_px": [round(cu), round(cv_)], "centre_m": [round(float(x), 2) for x in C],
            "cut": {"in": round(t_in, 2), "freeze": round(moment / FPS, 3), "out": round(t_out, 2)},
            "exists": {"verdict": ev, "why": ereason, "hit_point": HIT,
                       "player_on": f"{sum(EXS['player']['on'][n] for n in inwin)}/{len(inwin)}",
                       "hit_on": f"{sum(EXS['points'][HIT]['on'][n] for n in inwin)}/{len(inwin)}",
                       "centre_on": f"{sum(EXS['points']['centre']['on'][n] for n in inwin)}/{len(inwin)}",
                       "ball_on": f"{sum(1 for j in fr if int(t_in * FPS) <= j <= int(t_out * FPS) and ball_at(j))}/{len(inwin)}" if BALL else None},
            "ball": {"tracker": BALL.get("tracker"), **ball_note} if BALL else None}


# invented: learned by orbit_fit.py from 84 hand-labelled orbit frames (14 moments), leave-one-moment-out precision
# 1.0, recall 0.79; sharp and plate are set by hand
THRESH = {"invented": 0.0626, "sharp": 0.25, "plate": 0.5}


# ---------------------------------------------------------------- render
def writer(path, W, H, fps):
    return subprocess.Popen(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps),
                             "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "fast", "-movflags", "+faststart", path], stdin=subprocess.PIPE)


def plain(i):
    return cv2.resize(real_frames[i], (OW, OH), interpolation=cv2.INTER_AREA)


def crop_zoom(im, cx, cy, z):
    """a 2D zoom of z about (cx, cy) in source pixels, kept inside the frame, to the output size"""
    w, h = SW / z, SH / z
    x0, y0 = min(max(0, cx - w / 2), SW - w), min(max(0, cy - h / 2), SH - h)
    M = np.array([[OW / w, 0, -x0 * OW / w], [0, OH / h, -y0 * OH / h]])
    return cv2.warpAffine(im, M, (OW, OH), flags=cv2.INTER_LINEAR)


def render_orbit(scene, plan, path, shots=None):
    """lead-in at full speed, time stops: push in while swinging to one end of the arc, sweep to the other, come
    back to the phone's own view, and play on"""
    a0, a1 = [math.radians(a) for a in plan["sweep_deg"]]
    nB, nC, nD = int(0.7 * A.fps), int(1.6 * A.fps), int(0.7 * A.fps)
    w = writer(path, OW, OH, A.fps)
    worst, vis_min, pts_ok = [0, 0], 1.0, True
    for x in np.arange(t_in, moment / FPS, 1 / A.fps):
        w.stdin.write(plain(min(real_frames, key=lambda i: abs(i - x * FPS))).tobytes())
    n = 0
    torch.cuda.synchronize()
    t = time.time()
    for ph, cnt in (("B", nB), ("C", nC), ("D", nD)):
        for q in range(cnt):
            s = (q + 1) / cnt
            if ph == "B":
                th, aim = a0 * ease(s), ease(s)
            elif ph == "C":
                th, aim = a0 + (a1 - a0) * ease(s), 1.0
            else:
                th, aim = a1 * (1 - ease(s)), 1 - ease(s)
            Rw, p, Kc = camera(th, aim)
            fr, inv, tv, seen_pts = scene.render(Rw, p, Kc, OW, OH, points=(C, HIT3))
            x0, y0, x1, y1 = near_box(Kc, Rw, p, OW, OH)
            worst = [max(worst[0], float(inv.mean())), max(worst[1], float(inv[y0:y1, x0:x1].mean()) if x1 > x0 and y1 > y0 else 0)]
            vis_min, pts_ok = min(vis_min, tv), pts_ok and all(seen_pts)
            w.stdin.write(fr.tobytes())
            n += 1
            if shots and ph == "C" and q in (0, cnt // 2, cnt - 1):
                cv2.imwrite(os.path.join(shots, f"orbit_{'start' if q == 0 else 'mid' if q < cnt - 1 else 'end'}.png"), fr)
    torch.cuda.synchronize()
    per = (time.time() - t) / max(1, n)
    for x in np.arange(moment / FPS, t_out, 1 / A.fps):
        w.stdin.write(plain(min(real_frames, key=lambda i: abs(i - x * FPS))).tobytes())
    w.stdin.close(); w.wait()
    return {"frames_3d": n, "s_per_frame": round(per, 4), "invented_max": {"frame": round(worst[0], 4), "near": round(worst[1], 4)},
            "target_visible_min": round(vis_min, 3), "hit_and_centre_in_view": pts_ok}


def orbit_ok(r):
    return r["invented_max"]["frame"] <= 1.1 * THRESH["invented"] and r["target_visible_min"] >= VIS_MIN - 0.05 and r["hit_and_centre_in_view"]


def render_zoom(plan, path, shots=None):
    """the plain version: slow motion into the moment with the camera pushing in on the player, a held frame, out"""
    w = writer(path, OW, OH, A.fps)
    track = {}
    for i in real_frames:
        p = person(i, reach=2)
        if p and p.get("m"):
            q = np.array(p["m"]).reshape(-1, 2) * S
            track[i] = (q[:, 0].mean(), q[:, 1].mean())
    ks = sorted(track)
    ctr = lambda i: track[min(ks, key=lambda j: abs(j - i))] if ks else (SW / 2, SH / 2)
    tm, sm = moment / FPS, None
    out = []
    t = t_in
    zt = float(np.clip(Z_FILL[0] * SH / hp, 1.0, 2.0))
    wrist = (kx[hit_k, 0], kx[hit_k, 1])
    followed = 0
    while t < t_out:
        slow = tm - 0.5 <= t <= tm + 0.3
        z = 1 + (zt - 1) * ease((t - (tm - 0.9)) / 0.6) * (1 - ease((t - (tm + 0.35)) / 0.45))
        cx, cy = ctr(t * FPS)
        # into the moment the camera settles between the player and the racket hand; while the ball is on its way,
        # it leans toward the ball (half way at most, so the player stays in the picture)
        u = ease((t - (tm - 0.5)) / 0.5) if t <= tm else 1 - ease((t - tm) / 0.4)
        cx, cy = cx + 0.5 * u * (wrist[0] - cx), cy + 0.5 * u * (wrist[1] - cy)
        b = ball_at(int(round(t * FPS))) if t < tm else None
        if b and math.hypot(b[0] - cx, b[1] - cy) > 1.5 * hp:  # not near the player: likely a false point in the stands
            b = None
        if b:
            wb = 0.5 * (1 - ease((t - (tm - 0.6)) / 0.6))
            cx, cy = cx + wb * (b[0] - cx), cy + wb * (b[1] - cy)
            followed += wb > 0.05
        sm = (cx, cy) if sm is None else (0.8 * sm[0] + 0.2 * cx, 0.8 * sm[1] + 0.2 * cy)
        out.append(crop_zoom(real_frames[min(real_frames, key=lambda i: abs(i - t * FPS))], sm[0], sm[1], z))
        if abs(t - tm) < 0.5 / A.fps:
            out += [out[-1]] * int(0.5 * A.fps)  # hold the moment for half a second
            if shots:
                cv2.imwrite(os.path.join(shots, "zoom_moment.png"), out[-1])
        t += (0.4 if slow else 1.0) / A.fps
    for f in out:
        w.stdin.write(f.tobytes())
    w.stdin.close(); w.wait()
    return {"frames": len(out), "zoom": round(zt, 2), "frames_leaning_to_ball": followed}


def render_plain(path):
    w = writer(path, OW, OH, A.fps)
    for x in np.arange(t_in, t_out, 1 / A.fps):
        w.stdin.write(plain(min(real_frames, key=lambda i: abs(i - x * FPS))).tobytes())
    w.stdin.close(); w.wait()
    return {"frames": int((t_out - t_in) * A.fps)}


t0 = time.time()
scene = make_scene()
t0 = stage("build_scene", t0)
plan = decide(scene)
t0 = stage("decide", t0)
if A.shots:
    os.makedirs(A.shots, exist_ok=True)
    cv2.imwrite(os.path.join(A.shots, "moment.png"), cv2.resize(img, (OW, OH), interpolation=cv2.INTER_AREA))
    dbg = img.copy()
    cs, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(dbg, cs, -1, (255, 0, 255), 2)
    dv = cv2.applyColorMap(np.clip(255 * (1 - (Db - 1) / 15), 0, 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    dv[fg > 0] = (255, 255, 255)
    cv2.imwrite(os.path.join(A.shots, "cutout_depth.png"), cv2.resize(np.hstack([dbg, dv]), (OW, OH // 2), interpolation=cv2.INTER_AREA))
    if plate is not None:
        cv2.imwrite(os.path.join(A.shots, "plate.png"), np.hstack([img[y0r:y1r, x0r:x1r], B[y0r:y1r, x0r:x1r]]))
    for name, a in (("check_start", plan["sweep_deg"][0]), ("check_end", plan["sweep_deg"][1])):  # invented pixels in magenta
        fr, inv, _, _ = scene.render(*camera(math.radians(a), 1.0), OW, OH)
        fr[inv] = (0.5 * fr[inv] + (127, 0, 127)).astype(np.uint8)
        cv2.imwrite(os.path.join(A.shots, f"{name}.png"), fr)
result = {"plan": plan, "features": feat}
if A.probe:  # frames at fixed angles at the chosen zoom, for labelling by eye, with what the decision sees in each
    os.makedirs(A.probe, exist_ok=True)
    result["probe"] = []
    tag = os.path.splitext(os.path.basename(A.out))[0]
    for a in (-18, -12, -6, 6, 12, 18):
        fr, inv, tv, seen_pts = scene.render(*camera(math.radians(a), 1.0), OW, OH, points=(C, HIT3))
        Rw, p, Kc = camera(math.radians(a), 1.0)
        x0, y0, x1, y1 = near_box(Kc, Rw, p, OW, OH)
        ib = blobs(inv)
        cv2.imwrite(os.path.join(A.probe, f"{tag}_{a:+d}.png"), fr)
        side = feat["arc_room_deg"]["right" if a > 0 else "left"]
        result["probe"].append({"angle": a, "in_room": abs(a) <= side, "invented": round(float(ib.mean()), 4),
                                "invented_near": round(float(ib[y0:y1, x0:x1].mean()), 4) if x1 > x0 and y1 > y0 else 1.0,
                                "invented_any": round(float(inv.mean()), 4), "target_visible": round(tv, 3), "points_seen": all(seen_pts)})
if not A.no_render:
    real_frames = read_frames(range(int(t_in * FPS) - 1, int(t_out * FPS) + 2))
    t0 = time.time()
    if plan["mode"] == "orbit":
        r = render_orbit(scene, plan, A.out, A.shots)
        if A.mode == "auto" and not orbit_ok(r):  # checked again on the real render: shorten once, then zoom
            plan["sweep_deg"] = [round(a * 0.6) for a in plan["sweep_deg"]]
            plan["shortened"] = True
            r = render_orbit(scene, plan, A.out, A.shots)
            if not orbit_ok(r):
                plan["mode"], plan["why_not_orbit"] = "zoom", plan["why_not_orbit"] + ["the rendered orbit invented too much or lost the player"]
                r = {"orbit_tried": r, **render_zoom(plan, A.out, A.shots)}
        result["render"] = r
    elif plan["mode"] == "zoom":
        result["render"] = render_zoom(plan, A.out, A.shots)
    else:
        result["render"] = render_plain(A.out)
    t0 = stage("render", t0)
TIME["total"] = round(time.time() - t_all, 2)
result["time_s"] = TIME
result["gpu"] = {"peak_allocated_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2), "models_gb": round(mem0 / 1e9, 2),
                 "peak_reserved_gb": round(torch.cuda.max_memory_reserved() / 1e9, 2)}
json.dump(result, open(A.plan or os.path.splitext(A.out)[0] + ".json", "w"), indent=1, default=float)
print(json.dumps(result, default=float))
