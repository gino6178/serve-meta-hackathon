"""The tiny time model and its doubt model, trained on Muse Glimmer's choices (agent/src/agents/tiny.js runs them).

  python distill/tiny_times.py rows.json preds_dir out_model.json out_results.json

rows.json: distill/tiny_times_feats.mjs. preds_dir: the 1B student's saved per-case probabilities (1b_v3_*_short.jsonl),
to count the student and Glimmer calls the tiny layer would save.
  - The training members (train, trainshared, asked: 4,868 cases) are split by member: 80% fit the tiny model, 20% with
    val (seed 19) are the calibration members, never fitted on.
  - The doubt model (logistic regression) is fitted on out-of-fold answers of the tiny model over the 80% (5 folds by
    member), to predict how much its pick disagrees with Glimmer's.
  - The threshold on the doubt, on the calibration members only: conformal risk control (the loss of a case is its
    disagreement with Glimmer when the tiny layer answers it, 0 when it leaves it on; the largest threshold whose
    (n R + 1) / (n + 1) stays within EPS bounds the expected disagreement over all cases by EPS); learn-then-test over
    the answered cases only (fixed-sequence Hoeffding-Bentkus at delta 0.05: disagreement among the cases it answers at
    most EPS, certified); and the loosest threshold whose disagreement among the calibration cases it answers is at
    most EPS (not certified). The served threshold is the strictest of those that exist.
  - Measured on the held-out test (seed 7, 500 cases, 3 Glimmer answers each) and the decider's 196 cases (graded
    against `full`), never seen in fitting or calibration.
"""
import json, sys, math, hashlib, time
import numpy as np, torch, torch.nn as nn
from sklearn.linear_model import LogisticRegression

ROWS, PREDS, OUT_MODEL, OUT_RES = sys.argv[1:5]
EPS = 0.05
torch.manual_seed(0); np.random.seed(0)
D = json.load(open(ROWS))
S = D["sets"]
FIRST_TIME, FIRST_LISTED, LIKED = 22, 25, 40
h = lambda s: int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)

def target(c):
    n = len(c["answers"]); t = np.zeros(len(c["ids"]))
    for a in c["answers"]: t[c["ids"].index(a["y"])] += 1 / n
    return t

train_all = S["train"] + S["trainshared"] + S["asked"]
fit = [c for c in train_all if h(c["member"]) % 5 != 0]
cal = [c for c in train_all if h(c["member"]) % 5 == 0] + S["val"]
dim = len(fit[0]["x"][0])

def pad(cases):
    k = max(len(c["ids"]) for c in cases)
    X = np.zeros((len(cases), k, dim), np.float32); M = np.zeros((len(cases), k), bool); T = np.zeros((len(cases), k), np.float32)
    for i, c in enumerate(cases):
        n = len(c["ids"]); X[i, :n] = c["x"]; M[i, :n] = True; T[i, :n] = target(c)
    return torch.tensor(X), torch.tensor(M), torch.tensor(T)

class Net(nn.Module):
    def __init__(s, d, H): super().__init__(); s.l1 = nn.Linear(d, H); s.l2 = nn.Linear(H, 1)
    def forward(s, X): return s.l2(torch.tanh(s.l1(X))).squeeze(-1)

def train(cases, H=24, epochs=600, wd=3e-4, lr=0.01):
    X, M, T = pad(cases)
    flat = X[M]; mu = flat.mean(0); sd = flat.std(0).clamp_min(1e-3)
    net = Net(dim, H); opt = torch.optim.Adam(net.parameters(), lr=lr, weight_decay=wd)
    Xn = (X - mu) / sd
    for ep in range(epochs):
        opt.zero_grad()
        s = net(Xn).masked_fill(~M, -1e9)
        loss = -(T * torch.log_softmax(s, -1)).sum(-1).mean()
        loss.backward(); opt.step()
    return net, mu, sd

def probs(model, cases):
    X, M, _ = pad(cases)
    with torch.no_grad(): p = torch.softmax(sum(net((X - mu) / sd) for net, mu, sd in model).div(len(model)).masked_fill(~M, -1e9), -1).numpy()
    return [p[i, :len(c["ids"])] for i, c in enumerate(cases)]

def doubt_x(p, c):
    o = np.argsort(-p); top = p[o[0]]; second = p[o[1]] if len(p) > 1 else 0
    H = -sum(v * math.log(v) for v in p if v > 0) / math.log(max(2, len(p)))
    px = c["x"][o[0]]
    return [top, top - second, H, len(p) / 6, 1.0 if c["ids"][o[0]] == "decline" else 0.0, px[FIRST_TIME], px[FIRST_LISTED], px[LIKED], *c["caseX"]]

def dis(c, pick, grade=None):
    """disagreement of a pick with Glimmer: the share of its answers it misses (or with one graded answer only)"""
    ans = [a["y"] for a in c["answers"] if grade is None or a["sample"] == grade]
    return None if not ans else 1 - sum(a == pick for a in ans) / len(ans)

# model size: chosen by out-of-fold agreement on the fitting members (5 folds by member)
folds = [[c for c in fit if h(c["member"] + "f") % 5 == k] for k in range(5)]
K = 4  # nets in the ensemble (logits averaged)
def ens(cases, H, k=K): return [train(cases, H=H) for _ in range(k)]
def oof(H, k=1):
    P = {}
    for k_ in range(5):
        m = ens([c for j in range(5) if j != k_ for c in folds[j]], H, k)
        for c, p in zip(folds[k_], probs(m, folds[k_])): P[c["id"]] = p
    return P
best = None
for H in (8, 16):
    P = oof(H); agree = np.mean([1 - dis(c, c["ids"][int(np.argmax(P[c["id"]]))]) for c in fit])
    print(f"H={H}: out-of-fold agreement {agree:.4f}", flush=True)
    if best is None or agree > best[1] + 0.002: best = (H, agree, P)
H = best[0]
P = oof(H, K)  # the doubt model reads the ensemble's out-of-fold answers
print(f"ensemble of {K}: out-of-fold agreement {np.mean([1 - dis(c, c['ids'][int(np.argmax(P[c['id']]))]) for c in fit]):.4f}", flush=True)
model = ens(fit, H)

# doubt model on the out-of-fold answers (a case's disagreement as a soft label)
Xd, yd, wd = [], [], []
for c in fit:
    p = P[c["id"]]; d = dis(c, c["ids"][int(np.argmax(p))]); x = doubt_x(p, c)
    for lab, w in ((1, d), (0, 1 - d)):
        if w > 0: Xd.append(x); yd.append(lab); wd.append(w)
Xd = np.array(Xd); dmu = Xd.mean(0); dsd = Xd.std(0); dsd[dsd < 1e-3] = 1
lr = LogisticRegression(C=1.0, max_iter=2000).fit((Xd - dmu) / dsd, yd, sample_weight=wd)
doubt = lambda x: float(1 / (1 + math.exp(-(lr.intercept_[0] + ((np.array(x) - dmu) / dsd) @ lr.coef_[0]))))

def read(cases, grade=None):
    out = []
    for c, p in zip(cases, probs(model, cases)):
        k = int(np.argmax(p)); pick = c["ids"][k]
        out.append({"id": c["id"], "pick": pick, "top": float(p[k]), "doubt": doubt(doubt_x(p, c)), "dis": dis(c, pick, grade), "c": c})
    return [r for r in out if r["dis"] is not None]

# thresholds on the calibration members
calr = read(cal)
def crc(rows, eps=EPS):
    n = len(rows); best = None
    for t in sorted({r["doubt"] for r in rows}):
        R = sum(r["dis"] for r in rows if r["doubt"] <= t) / n
        if (n * R + 1) / (n + 1) > eps: break
        best = t
    return best
def hb_p(rhat, n, a):
    """Hoeffding-Bentkus p-value for 'mean loss > a' given the mean rhat of n losses in [0, 1]"""
    if rhat >= a: return 1.0
    kl = rhat * math.log(rhat / a) + (1 - rhat) * math.log((1 - rhat) / (1 - a)) if rhat > 0 else -math.log(1 - a)
    from math import comb
    k = math.ceil(n * rhat); binom = sum(comb(n, i) * a ** i * (1 - a) ** (n - i) for i in range(k + 1))
    return min(math.exp(-n * kl), math.e * binom)
def ltt(rows, eps=EPS, delta=0.05):
    best = None
    for t in [x / 200 for x in range(1, 200)]:  # from strict to loose: fixed-sequence testing
        a = [r["dis"] for r in rows if r["doubt"] <= t]
        if len(a) < 10: continue
        if hb_p(sum(a) / len(a), len(a), eps) > delta: break
        best = t
    return best
def strict(rows, eps=EPS):
    """the loosest threshold whose disagreement among the calibration cases it answers is at most EPS (no guarantee)"""
    best = None
    for t in sorted({r["doubt"] for r in rows}):
        a = [r["dis"] for r in rows if r["doubt"] <= t]
        if len(a) >= 30 and sum(a) / len(a) <= eps: best = t
    return best
t_crc, t_ltt, t_strict = crc(calr), ltt(calr), strict(calr)
# served: the strictest of the three that exists (learn-then-test found none at this size; conformal risk control's
# point left 5.9% and 11.6% disagreement among the held-out cases it answered, over the 5% asked for)
served = min([x for x in (t_crc, t_ltt, t_strict) if x is not None] or [0.0])
print("thresholds: crc", t_crc, "ltt", t_ltt, "served", served)

# the student's saved answers (bf16 1B v3, short prompt): sure at 0.6 with its reading of which times work right
def student(set_):
    out = {}
    for l in open(f"{PREDS}/1b_v3_{set_}_short.jsonl"):
        r = json.loads(l); pick = max(r["probs"], key=r["probs"].get)
        read_ok = {t for t, p in r["works_p"].items() if p >= 0.5} == set(r["works"])
        out[r["id"]] = {"pick": pick, "sure": r["probs"][pick] >= 0.6 and read_ok}
    return out

def evaluate(set_, grade=None, fallback=None, t=served):
    rows = read(S[set_], grade); st = student(set_) if set_ in ("test", "decider", "val", "shared", "demo", "varied") else {}
    n = len(rows); ans = [r for r in rows if r["doubt"] <= t]
    first = np.mean([dis(r["c"], r["c"]["first"], grade) for r in rows])
    res = {"cases": n, "agreement_all": round(1 - np.mean([r["dis"] for r in rows]), 4), "first_listed_agreement": round(1 - first, 4),
           "answered": len(ans), "answered_share": round(len(ans) / n, 4),
           "disagreement_answered": round(float(np.mean([r["dis"] for r in ans])), 4) if ans else None,
           "disagreement_over_all": round(sum(r["dis"] for r in ans) / n, 4)}
    if st:
        # Glimmer as the fallback: on test its first answer graded against the others; on the decider's cases full2 against full
        def glim(r):
            c = r["c"]
            if set_ == "decider":
                f2 = [a["y"] for a in c["answers"] if a["sample"] == 1]; return dis(c, f2[0], 0) if f2 else None
            a0 = [a["y"] for a in c["answers"] if a["sample"] == 0]; rest = [a["y"] for a in c["answers"] if a["sample"] != 0]
            return None if not a0 or not rest else 1 - sum(y == a0[0] for y in rest) / len(rest)
        both = [r for r in rows if r["id"] in st and glim(r) is not None]
        def casc(r, tiny):
            if tiny and r["doubt"] <= t: return r["dis"]
            s = st[r["id"]]
            return dis(r["c"], s["pick"], grade) if s["sure"] else glim(r)
        sure = sum(st[r["id"]]["sure"] for r in both)
        saved_g = sum(1 for r in both if r["doubt"] <= t and not st[r["id"]]["sure"])
        res["with_student"] = {"cases": len(both), "student_calls_saved": sum(1 for r in both if r["doubt"] <= t), "glimmer_calls_before": len(both) - sure, "glimmer_calls_saved": saved_g,
                               "cascade_agreement_without_tiny": round(1 - np.mean([casc(r, False) for r in both]), 4), "cascade_agreement_with_tiny": round(1 - np.mean([casc(r, True) for r in both]), 4),
                               "tiny_vs_student_on_answered": round(np.mean([r["pick"] == st[r["id"]]["pick"].replace("decline", "decline") for r in both if r["doubt"] <= t]), 4) if saved_g or ans else None}
    if set_ == "decider":
        liked = [r for r in rows if r["c"]["liked"]]
        res["stated_preference"] = f'{sum(r["pick"] in r["c"]["liked"] for r in liked)} of {len(liked)}'
        f2 = [r for r in rows if any(a["sample"] == 1 for a in r["c"]["answers"])]
        res["glimmer_full2_agreement"] = round(np.mean([1 - dis(r["c"], [a["y"] for a in r["c"]["answers"] if a["sample"] == 1][0], 0) for r in f2]), 4)
    if set_ == "test":
        def self_agree(c):
            ys = [a["y"] for a in c["answers"]]; pairs = [(i, j) for i in range(len(ys)) for j in range(i + 1, len(ys))]
            return np.mean([ys[i] == ys[j] for i, j in pairs]) if pairs else None
        res["glimmer_self_agreement"] = round(float(np.mean([v for v in (self_agree(r["c"]) for r in rows) if v is not None])), 4)
    return res

# coverage at fixed disagreement, on the held-out sets (an oracle curve: the threshold read off the test set itself)
def curve(set_, grade=None):
    rows = sorted(read(S[set_], grade), key=lambda r: r["doubt"]); out = {}
    for target in (0.02, 0.05, 0.10):
        k, s = 0, 0.0
        for i, r in enumerate(rows):
            s += r["dis"]
            if s / (i + 1) <= target: k = i + 1
        out[f"{int(target * 100)}%"] = round(k / len(rows), 4)
    return out

results = {"model": {"hidden": H, "ensemble": K, "inputs": dim, "fit_cases": len(fit), "calibration_cases": len(cal)},
           "thresholds": {"eps": EPS, "crc_all_cases": t_crc, "ltt_answered": t_ltt, "strict_answered_empirical": t_strict, "served": served},
           "calibration": {"answered_share": round(np.mean([r["doubt"] <= served for r in calr]), 4),
                           "disagreement_answered": round(float(np.mean([r["dis"] for r in calr if r["doubt"] <= served] or [0])), 4)},
           "test": evaluate("test"), "decider": evaluate("decider", grade=0),
           "other_sets": {s: evaluate(s) for s in ("shared", "demo", "varied")},
           "coverage_at_fixed_disagreement_oracle": {"test": curve("test"), "decider": curve("decider", 0)}}
if t_strict is not None:
    results["at_strict_threshold"] = {"test": evaluate("test", t=t_strict), "decider": evaluate("decider", grade=0, t=t_strict)}
if t_crc is not None:
    results["at_crc_threshold"] = {"test": evaluate("test", t=t_crc), "decider": evaluate("decider", grade=0, t=t_crc)}
print(json.dumps(results, indent=1))
r6 = lambda a: [round(float(v), 6) for v in a]
json.dump({"about": "Serve tiny time model (agent/src/agents/tiny.js): MLP per option, softmax over options; doubt model: logistic regression. distill/tiny_times.py",
           "mlp": [{"W1": [r6(w) for w in net.l1.weight.detach().numpy()], "b1": r6(net.l1.bias.detach().numpy()), "w2": r6(net.l2.weight.detach().numpy()[0]), "b2": round(float(net.l2.bias.item()), 6), "mu": r6(mu.numpy()), "sd": r6(sd.numpy())} for net, mu, sd in model],
           "doubt": {"w": r6(lr.coef_[0]), "b": round(float(lr.intercept_[0]), 6), "mu": r6(dmu), "sd": r6(dsd)}, "threshold": served,
           "check": [{"id": r["id"], "top": round(r["top"], 6), "doubt": round(r["doubt"], 6)} for r in read(S["test"][:20])]}, open(OUT_MODEL, "w"))
json.dump(results, open(OUT_RES, "w"), indent=1)
