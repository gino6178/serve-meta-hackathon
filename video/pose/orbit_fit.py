"""Learn the orbit's threshold from hand-labelled frames (labels/orbit_labels.json) and check it, leaving one moment out at a
time (a moment's six frames share a scene, so they are never split between fitting and testing).
  python orbit_fit.py <labels/orbit_labels.json> <dir of orbit.py --probe plan JSONs, named <moment>_v1.json> [out.json]
Compared:
- arcs_chosen: a frame is fine if its angle is within the arc orbit.py chose in that run (in the first runs, invented
  patches under a budget at low resolution; now, the learned threshold below, so on those runs it is in-sample);
- one threshold on the share of invented pixels at full resolution, thin stripes included (orbit.py: invented_any);
- a logistic model on that share, the share around the player, the angle and the share of depth edges in the scene.
The threshold is picked on the training moments for precision first (a wrong orbit costs more than a missed one):
the largest threshold whose training precision is 1, else the one with the best F1."""
import json, sys
import numpy as np

lab = json.load(open(sys.argv[1]))["labels"]
rows = []
for tag, L in lab.items():
    r = json.load(open(f"{sys.argv[2]}/{tag}_v1.json"))
    f = r["features"]
    for p in r["probe"]:
        rows.append({"moment": tag, "angle": p["angle"], "y": L[str(p["angle"])], "room": bool(p["in_room"]),
                     "any": p["invented_any"], "near": p["invented_near"], "blobs": p["invented"],
                     "edge": f["depth_edge_share"], "vis": p["target_visible"]})
moments = sorted({r["moment"] for r in rows})


def score(pred, y):
    tp = sum(p and t for p, t in zip(pred, y)); fp = sum(p and not t for p, t in zip(pred, y))
    fn = sum((not p) and t for p, t in zip(pred, y)); tn = sum((not p) and (not t) for p, t in zip(pred, y))
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": round(tp / max(1, tp + fp), 3), "recall": round(tp / max(1, tp + fn), 3),
            "accuracy": round((tp + tn) / max(1, len(y)), 3)}


def pick(xs, ys):
    """threshold on x (fine if x <= t): largest t with precision 1 on (xs, ys), else best F1"""
    cand = sorted(set(xs))
    best, bt = None, None
    for t in cand:
        pr = [x <= t for x in xs]
        s = score(pr, ys)
        if s["fp"] == 0 and s["tp"] > 0:
            bt = t
    if bt is not None:
        nxt = [x for x in cand if x > bt]  # halfway to the next value, so a new frame isn't judged on the edge
        return (bt + nxt[0]) / 2 if nxt else bt
    for t in cand:
        s = score([x <= t for x in xs], ys)
        f1 = 2 * s["tp"] / max(1, 2 * s["tp"] + s["fp"] + s["fn"])
        if best is None or f1 > best:
            best, bt = f1, t
    return bt


def feats(r):
    return [r["any"], r["near"], abs(r["angle"]) / 10 * r["edge"] * 10, abs(r["angle"]) / 10]


def logit_fit(X, y, lam=1e-2, it=500):
    X = np.c_[np.ones(len(X)), X]
    w = np.zeros(X.shape[1])
    for _ in range(it):  # Newton steps with a little ridge
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (p - y) + lam * np.r_[0, w[1:]]
        H = X.T @ (X * (p * (1 - p))[:, None]) + lam * np.diag(np.r_[0, np.ones(len(w) - 1)])
        w -= np.linalg.solve(H, g)
    return w


res = {"frames": len(rows), "good": sum(r["y"] for r in rows), "moments": len(moments)}
y = [r["y"] for r in rows]
res["arcs_chosen"] = score([r["room"] for r in rows], y)
# leave one moment out
pa, pl, ts = [None] * len(rows), [None] * len(rows), []
for m in moments:
    tr = [i for i, r in enumerate(rows) if r["moment"] != m]
    te = [i for i, r in enumerate(rows) if r["moment"] == m]
    t = pick([rows[i]["any"] for i in tr], [rows[i]["y"] for i in tr])
    ts.append(t)
    for i in te:
        pa[i] = rows[i]["any"] <= t
    X = np.array([feats(rows[i]) for i in tr]); mu, sd = X.mean(0), X.std(0) + 1e-9
    w = logit_fit((X - mu) / sd, np.array([rows[i]["y"] for i in tr], float))
    for i in te:
        z = np.r_[1, (np.array(feats(rows[i])) - mu) / sd] @ w
        pl[i] = bool(z > 0)
res["threshold_invented_any_loo"] = score(pa, y)
res["threshold_invented_any_loo"]["thresholds"] = [round(t, 4) for t in ts]
res["logistic_loo"] = score(pl, y)
t_all = pick([r["any"] for r in rows], y)
res["threshold_invented_any_all"] = {"threshold": round(t_all, 4), **score([r["any"] <= t_all for r in rows], y)}
X = np.array([feats(r) for r in rows]); mu, sd = X.mean(0), X.std(0) + 1e-9
res["logistic_all_weights"] = {"names": ["bias", "invented_any", "invented_near", "angle_x_edges", "angle"], "w": [round(float(v), 3) for v in logit_fit((X - mu) / sd, np.array(y, float))],
                               "mean": [round(float(v), 4) for v in mu], "sd": [round(float(v), 4) for v in sd]}
print(json.dumps(res, indent=1))
if len(sys.argv) > 3:
    json.dump(res, open(sys.argv[3], "w"), indent=1)
