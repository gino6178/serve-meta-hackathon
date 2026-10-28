"""Does each thing a highlight effect aims at exist, frame by frame? Coordinates alone don't say: a player walks out of
the frame or behind the net post, the racket hand goes behind the body, and the pose model still returns a point.
Used by orbit.py (and exists_eval.py, which checks it against hand labels). Runs on the GPU server.
  python exists.py <clip.mp4> <reel.json> <out.json> [--who 0]
Signals, each turned into a yes or no with hysteresis (on at 0.6, off below 0.4, a change must last 3 samples):
- the player: SAM 2.1 (video) follows the player from a frame where the reel read them well, forwards and backwards
  through the clip; its object-presence head (object_score_logits) says whether the player is there at all, and the
  mask's area against its usual area says how much of them is in view (a player half behind the post is not "there"
  for an effect). The reel's own box (DETR's track) must exist too.
- a point on the player (the racket hand, the pelvis the orbit turns about, the head): Sapiens2's confidence for that
  keypoint, and only if it lies inside the frame and on the player's SAM mask (else something is in front of it).
- the ball: ball.py, from published trackers (TrackNetV5 for badminton, WASB for tennis and basketball), with this
  file's hysteresis.
  Effects follow it only where it is on.
- an orbit's own check (in orbit.py): along the arc, the share of the player's 3D points that land in the virtual
  camera's view and pass its z-buffer, and the hit point and orbit centre inside the frame and not hidden.
Output: {fps, frames: [sampled frame indices], player: {p, area, on}, points: {hit|centre|head: {p, on}}}"""
import json, sys
import cv2
import numpy as np
import torch

ON, OFF, MIN_RUN = 0.6, 0.4, 3
POINTS = {"centre": (11, 12), "head": (0,), "hit_l": (9,), "hit_r": (10,)}  # keypoints (COCO-17 order, as reel.py)


def hysteresis(p, on=ON, off=OFF, min_run=MIN_RUN):
    """yes/no from probabilities (None = unknown, counted as 0): a 3-sample median, a Schmitt trigger, and a change
    of state only once it has lasted min_run samples, so the answer doesn't flicker"""
    x = np.array([0.0 if v is None else float(v) for v in p])
    if len(x) >= 3:
        x = np.array([np.median(x[max(0, i - 1): i + 2]) for i in range(len(x))])
    raw, state = [], False
    for v in x:
        state = v >= on if not state else v > off
        raw.append(state)
    runs = []  # (state, length); a run shorter than min_run takes the state of the run before it
    for r in raw:
        if runs and runs[-1][0] == r:
            runs[-1][1] += 1
        else:
            runs.append([r, 1])
    out = []
    for n, (r, length) in enumerate(runs):
        if length < min_run and len(runs) > 1:
            r = runs[n - 1][0] if n > 0 else runs[1][0]
        out += [bool(r)] * length
    return out


def poly(p, shape, scale=1.0):
    m = np.zeros(shape, np.uint8)
    if p and p.get("m"):
        cv2.fillPoly(m, [(np.array(p["m"], np.float64).reshape(-1, 2) * scale).round().astype(np.int32)], 1)
    return m


class Presence:
    """SAM 2.1 as a tracker: one object, prompted with a box on one frame, followed both ways"""

    def __init__(self, dev="cuda"):
        from transformers import Sam2VideoModel, Sam2VideoProcessor
        self.dev = dev
        self.proc = Sam2VideoProcessor.from_pretrained("facebook/sam2.1-hiera-large")
        self.model = Sam2VideoModel.from_pretrained("facebook/sam2.1-hiera-large", torch_dtype=torch.bfloat16).to(dev).eval()

    @torch.inference_mode()
    def track(self, rgbs, k0, box):
        """per frame: presence probability and the mask (at the frames' resolution)"""
        ses = self.proc.init_video_session(video=rgbs, inference_device=self.dev, dtype=torch.bfloat16)
        self.proc.add_inputs_to_inference_session(inference_session=ses, frame_idx=k0, obj_ids=1, input_boxes=[[box]])
        H, W = rgbs[0].shape[:2]
        res = {}
        for rev in (False, True):
            for o in self.model.propagate_in_video_iterator(ses, start_frame_idx=k0, reverse=rev):
                m = self.proc.post_process_masks([o.pred_masks], original_sizes=[[H, W]], binarize=True)[0]
                res[o.frame_idx] = (float(torch.sigmoid(o.object_score_logits.float()).reshape(-1)[0]), m.reshape(-1, H, W)[0].cpu().numpy().astype(np.uint8))
        return [res.get(i, (0.0, np.zeros((H, W), np.uint8))) for i in range(len(rgbs))]


def signals(R, who, idx, tracked, hit=None):
    """the player's and the points' probabilities and yes/no at the sampled frames idx (tracked: Presence.track's)"""
    F = R["frames"]
    H, W = R["h"], R["w"]
    areas = [m.sum() for p, m in tracked if p > 0.5]
    usual = float(np.median(areas)) if areas else 1.0
    pl, pts = {"p": [], "area": [], "box": [], "sam": [], "share": [], "pose": []}, {n: [] for n in POINTS}
    for (pres, m), j in zip(tracked, idx):
        f = F[j] if j < len(F) else 0
        q = f[who] if f and len(f) > who else 0
        border = m[:, :2].any() or m[:, -2:].any() or m[:2].any() or m[-2:].any()
        share = min(1.0, m.sum() / (0.6 * usual)) * (0.8 if border else 1.0)
        pl["p"].append(round(pres * share * (1.0 if q else 0.0), 3))  # the reel's track must have the player too
        pl["area"].append(round(float(m.sum() / usual), 3))
        pl["box"].append(bool(q))
        pl["sam"].append(round(pres, 3))
        pl["share"].append(round(share, 3))
        pl["pose"].append(round(float(np.mean([c for _, _, c in q["k"][:17]])), 3) if q else 0.0)
        md = cv2.dilate(m, np.ones((9, 9), np.uint8))
        for n, ks in POINTS.items():
            if not q:
                pts[n].append(0.0)
                continue
            v = []
            for k in ks:
                x, y, c = q["k"][k]
                inside = 0 <= x < W and 0 <= y < H and md[int(min(H - 1, max(0, y))), int(min(W - 1, max(0, x)))]
                v.append(c if inside else 0.0)
            pts[n].append(round(float(min(v)), 3))
    pl["on"] = hysteresis(pl["p"])
    out = {"player": pl, "points": {n: {"p": v, "on": hysteresis(v)} for n, v in pts.items()}}
    return out


def anchor(R, who, idx):
    """the sampled frame where the reel read the player best: the largest outline with the surest pose"""
    best, k0 = -1, None
    for k, j in enumerate(idx):
        f = R["frames"][j] if j < len(R["frames"]) else 0
        q = f[who] if f and len(f) > who else 0
        if not q or not q.get("m"):
            continue
        a = cv2.contourArea(np.array(q["m"], np.float32).reshape(-1, 2))
        s = a * np.mean([c for _, _, c in q["k"][:17]])
        if s > best:
            best, k0 = s, k
    return k0


def run(clip, R, who=0, step=2, presence=None, start=0, end=None):
    """the signals for the whole clip (frames start..end every `step`), at the reel's resolution"""
    end = len(R["frames"]) if end is None else end
    start -= start % step  # outside its slow-motion window the reel read every second frame, the even ones
    idx = list(range(start, end, step))
    cap = cv2.VideoCapture(clip)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    frames, i = {}, start
    want = set(idx)
    while True:
        ok, im = cap.read()
        if not ok or i >= end:
            break
        if i in want:
            if im.shape[1] != R["w"]:
                im = cv2.resize(im, (R["w"], R["h"]), interpolation=cv2.INTER_AREA)
            frames[i] = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
        i += 1
    cap.release()
    idx = [j for j in idx if j in frames]
    k0 = anchor(R, who, idx)
    if k0 is None:
        return {"fps": R["fps"], "frames": idx, "player": {"p": [0.0] * len(idx), "on": [False] * len(idx)}, "points": {}}
    q = R["frames"][idx[k0]][who]
    xs, ys = q["m"][0::2], q["m"][1::2]
    presence = presence or Presence()
    tr = presence.track([frames[j] for j in idx], k0, [float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))])
    out = signals(R, who, idx, tr)
    out.update({"fps": R["fps"], "frames": idx, "anchor": idx[k0]})
    return out


if __name__ == "__main__":
    clip, reel, outp = sys.argv[1:4]
    who = int(sys.argv[sys.argv.index("--who") + 1]) if "--who" in sys.argv else 0
    R = json.load(open(reel))
    res = run(clip, R, who)
    json.dump(res, open(outp, "w"), default=bool)
    on = res["player"]["on"]
    print(f"{len(on)} frames, the player there in {sum(on)}; anchor {res.get('anchor')}")
