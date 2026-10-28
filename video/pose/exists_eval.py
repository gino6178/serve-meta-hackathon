"""How well exists.py says "there" and "not there", against hand labels (labels/exists_labels.json), and how many effects the
highlight would aim at a player or a racket hand that isn't there, with and without the check. Runs on the GPU server.
  python exists_eval.py <labels.json> <clips_dir> <reels_dir> <out.json>
clips_dir/<clip>.mp4 and reels_dir/<clip>_reel.json for each clip in the labels (reel.py's output on that clip).
Effects: each clip's three fastest swings (the reel's pose score, as orbit.py picks the moment), each with the window
orbit.py would cut ([the slowest hand 1.5-0.4 s before, 0.8 s after]). Without the check an effect plays its whole
window; with it, the player must exist on every sampled frame of the window and the racket hand at the moment. If
not, the window is cut to the run where the player exists, when that run still holds 0.4 s before the moment to 0.2 s
after it and the hand exists at the moment; otherwise the effect is dropped (the clip plays plain)."""
import json, math, os, sys

os.environ.setdefault("OMP_NUM_THREADS", "8")  # the server's CPUs are shared
import cv2
import torch
import exists

torch.set_num_threads(8)
cv2.setNumThreads(8)

lab_f, clips, reels, outp = sys.argv[1:5]
L = json.load(open(lab_f))
pres = exists.Presence()


def prf(pred, truth):
    tp = sum(1 for p, t in zip(pred, truth) if p and t)
    fp = sum(1 for p, t in zip(pred, truth) if p and not t)
    fn = sum(1 for p, t in zip(pred, truth) if not p and t)
    tn = sum(1 for p, t in zip(pred, truth) if not p and not t)
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": round(tp / max(1, tp + fp), 3), "recall": round(tp / max(1, tp + fn), 3),
            "absent_caught": round(tn / max(1, tn + fp), 3)}


def swings(R, who=0, k=3):
    F, fps = R["frames"], R["fps"]
    get = lambda i: F[i][who] if 0 <= i < len(F) and F[i] and len(F[i]) > who and F[i][who] else None
    idx = [i for i in range(len(F)) if get(i)]
    sp = []
    for a, b in zip(idx, idx[1:]):
        if b - a > 2:
            continue
        p, q = get(a)["k"], get(b)["k"]
        ok = lambda kk, j: kk[j][2] > 0.3
        if not (ok(q, 0) and (ok(q, 15) or ok(q, 16))):
            continue
        body = max(1.0, max(q[15][1] if ok(q, 15) else 0, q[16][1] if ok(q, 16) else 0) - q[0][1])
        v = max((math.hypot(q[j][0] - p[j][0], q[j][1] - p[j][1]) / body / ((b - a) / fps)) if ok(p, j) and ok(q, j) else 0 for j in (9, 10))
        sp.append((b, v))
    vs = [v for _, v in sp]
    sp = [(i, sorted(vs[max(0, n - 1): n + 2])[len(vs[max(0, n - 1): n + 2]) // 2]) for n, (i, _) in enumerate(sp)]
    peaks = []
    for i, v in sorted(sp, key=lambda x: -x[1]):
        if all(abs(i - j) > 0.8 * fps for j, _ in peaks):
            peaks.append((i, v))
    out = []
    for i, v in peaks[:k]:
        before = [(j, u) for j, u in sp if i - 1.5 * fps <= j <= i - 0.4 * fps]
        t_in = min(before, key=lambda x: x[1])[0] if before else int(i - fps)
        out.append({"moment": i, "speed": round(v, 2), "in": max(0, t_in), "out": min(len(F) - 1, int(i + 0.8 * fps))})
    return out


res = {"player": {}, "hand": {}, "effects": []}
pool = {m: ([], []) for m in ("reel_box", "pose_conf", "sam_presence", "sam_presence_and_area", "combined_raw", "combined_hysteresis")}
hpool = {m: ([], []) for m in ("pose_conf", "combined_hysteresis")}
for clip in L["clips"]:
    R = json.load(open(f"{reels}/{clip}_reel.json"))
    ex = exists.run(f"{clips}/{clip}.mp4", R, 0, presence=pres)
    pos = {j: n for n, j in enumerate(ex["frames"])}
    pl, hit = ex["player"], ex["points"]["hit_r"]
    flips = lambda s: sum(1 for a, b in zip(s, s[1:]) if a != b)  # how often the answer changes: flicker
    res.setdefault("flips", {})[clip] = {"seconds": round(len(ex["frames"]) * 2 / R["fps"], 1),
                                         "player_raw": flips([v >= 0.5 for v in pl["p"]]), "player_hysteresis": flips(pl["on"]),
                                         "hand_raw": flips([v > 0.3 for v in hit["p"]]), "hand_hysteresis": flips(hit["on"])}
    pred = {"reel_box": lambda n: pl["box"][n], "pose_conf": lambda n: pl["pose"][n] > 0.3, "sam_presence": lambda n: pl["sam"][n] > 0.5,
            "sam_presence_and_area": lambda n: pl["sam"][n] * pl["share"][n] >= 0.5, "combined_raw": lambda n: pl["p"][n] >= 0.5,
            "combined_hysteresis": lambda n: pl["on"][n]}
    for fr, t in L["player"][clip].items():
        n = pos.get(int(fr))
        if n is None:
            continue
        for m, f in pred.items():
            pool[m][0].append(bool(f(n))); pool[m][1].append(bool(t))
    for fr, t in L["hand"][clip].items():
        n = pos.get(int(fr))
        if n is None:
            continue
        hpool["pose_conf"][0].append(bool(pl["box"][n] and hit["p"][n] > 0.3)); hpool["pose_conf"][1].append(bool(t))
        hpool["combined_hysteresis"][0].append(bool(hit["on"][n])); hpool["combined_hysteresis"][1].append(bool(t))
    # the effects
    labp = {int(k): v for k, v in L["player"][clip].items()}
    labh = {int(k): v for k, v in L["hand"][clip].items()}
    for e in swings(R):
        near_m = min(labh, key=lambda j: abs(j - e["moment"])) if labh else None

        def absent(a, b, m):
            gone = [j for j, v in labp.items() if a <= j <= b and v == 0]
            hand_gone = near_m is not None and abs(near_m - m) <= 10 and labh[near_m] == 0
            return bool(gone or hand_gone), gone

        bad0, gone0 = absent(e["in"], e["out"], e["moment"])
        # with the check
        ns = [n for n, j in enumerate(ex["frames"]) if e["in"] <= j <= e["out"]]
        nm = min(range(len(ex["frames"])), key=lambda n: abs(ex["frames"][n] - e["moment"]))
        hand_ok = any(hit["on"][n] for n in range(max(0, nm - 1), min(len(hit["on"]), nm + 2)))
        if all(pl["on"][n] for n in ns) and hand_ok:
            decision, a, b = "play", e["in"], e["out"]
        else:
            lo = hi = nm
            while lo - 1 >= 0 and pl["on"][lo - 1] and ex["frames"][lo - 1] >= e["in"]:
                lo -= 1
            while hi + 1 < len(pl["on"]) and pl["on"][hi + 1] and ex["frames"][hi + 1] <= e["out"]:
                hi += 1
            a, b = ex["frames"][lo], ex["frames"][hi]
            core = pl["on"][nm] and a <= e["moment"] - 0.4 * R["fps"] and b >= e["moment"] + 0.2 * R["fps"]
            decision = "cut" if core and hand_ok else "drop"
        bad1, gone1 = absent(a, b, e["moment"]) if decision != "drop" else (False, [])
        res["effects"].append({"clip": clip, **e, "aimed_at_absent_without_check": bad0, "absent_frames": gone0, "with_check": decision,
                               "window_with_check": [a, b] if decision != "drop" else None, "aimed_at_absent_with_check": bad1})
for m, (p, t) in pool.items():
    res["player"][m] = prf(p, t)
for m, (p, t) in hpool.items():
    res["hand"][m] = prf(p, t)
E = res["effects"]
res["effects_summary"] = {"effects": len(E), "aimed_at_absent_without_check": sum(e["aimed_at_absent_without_check"] for e in E),
                          "with_check": {d: sum(e["with_check"] == d for e in E) for d in ("play", "cut", "drop")},
                          "aimed_at_absent_with_check": sum(e["aimed_at_absent_with_check"] for e in E),
                          "dropped_though_fine": sum(e["with_check"] == "drop" and not e["aimed_at_absent_without_check"] for e in E)}
json.dump(res, open(outp, "w"), indent=1)
print(json.dumps({k: res[k] for k in ("player", "hand", "flips", "effects_summary")}, indent=1))
