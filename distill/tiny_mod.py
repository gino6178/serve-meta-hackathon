"""The feed's tiny prefilter (agent/src/feed/tiny_text.js): logistic regression on hashed n-grams, int8 weights, and its
doubt model, trained on synthetic comments labeled by the feed's own checks.

  python distill/tiny_mod.py items.jsonl labels.jsonl pg.jsonl feats.jsonl out_model.json out_results.json

  - "Fine" (the class it may pass) is a comment written as benign that every check passes: Prompt Guard 2 under 0.5 on
    the text and its folded form, code's checks, Llama Guard 3 (not in BLOCK_POST, no helpline), and the club's
    standard (Muse Glimmer) "ok". Anything else is not fine: hostile or injected by construction, or refused by a check.
  - Training items only (whole template families and generation batches are held out for the test set). The doubt
    model reads out-of-fold scores (5 folds grouped by family, so each fold's families are unseen), and the thresholds
    are read off those out-of-fold scores: conformal risk control with the loss "a not-fine comment passed", at
    EPS = 0.001, and no not-fine comment passed out of fold at all.
  - The test set is never used to fit or choose anything.
"""
import json, sys, math, base64
np_json = lambda o: o.item() if hasattr(o, "item") else str(o)
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.linear_model import LogisticRegression

ITEMS, LABELS, PG, FEATS, OUT_MODEL, OUT_RES = sys.argv[1:7]
DIM = 1 << 16
EPS = 0.001
rd = lambda f: [json.loads(l) for l in open(f, encoding="utf8") if l.strip()]
items = {x["id"]: x for x in rd(ITEMS)}
lab = {}
for f in LABELS.split(","):  # Llama Guard's and the standard's runs, merged field by field
    for x in rd(f):
        l = lab.setdefault(x["id"], {"code": x["code"], "llamaGuard": None, "standard": None})
        for k in ("llamaGuard", "standard"):
            if x.get(k) is not None: l[k] = x[k]
pg = {x["id"]: x["pg"] for x in rd(PG)}
feats = {x["id"]: x for x in rd(FEATS)}
# a comment written as benign needs every check's verdict; a hostile or injected one is not fine whatever the standard
# says, so it needs only Prompt Guard's and Llama Guard's (Glimmer read the benign ones and a sample of the rest)
ids = [i for i in items if i in lab and i in pg and lab[i]["llamaGuard"] is not None and (items[i]["intent"] != "benign" or lab[i]["standard"] is not None)]
print(f"{len(ids)} of {len(items)} labeled ({sum(1 for i in ids if lab[i]['standard'] is not None)} by the standard too)")

def checks_ok(i):
    """every check passes it (the standard counted only where it was asked)"""
    l = lab[i]; return pg[i] < 0.5 and not l["code"] and not l["llamaGuard"]["blocks"] and l["standard"] in ("ok", None)
def fine(i): return items[i]["intent"] == "benign" and checks_ok(i)

train = [i for i in ids if items[i]["split"] == "train"]
test = [i for i in ids if items[i]["split"] == "test"]
def X(rows):
    r, c = [], []
    for k, i in enumerate(rows):
        for j in feats[i]["idx"]: r.append(k); c.append(j)
    return csr_matrix((np.ones(len(r), np.float32), (r, c)), shape=(len(rows), DIM))
y = lambda rows: np.array([1 if fine(i) else 0 for i in rows])

def fit(rows, C):
    return LogisticRegression(C=C, max_iter=3000, class_weight={0: 3.0, 1: 1.0}).fit(X(rows), y(rows))
def quant(m):
    w = m.coef_[0]; scale = float(np.abs(w).max() / 127)
    return np.clip(np.round(w / scale), -127, 127).astype(np.int8), scale, float(m.intercept_[0])
def score(q, rows):
    w, scale, b = q
    return np.array([1 / (1 + math.exp(-(b + scale * float(w[feats[i]["idx"]].astype(np.int32).sum())))) for i in rows])
def dx(p, i, w):
    idx = feats[i]["idx"]; known = float(np.mean(w[idx] != 0)) if idx else 0.0
    H = -(p * math.log(p) + (1 - p) * math.log(1 - p)) / math.log(2) if 0 < p < 1 else 0.0
    return [p, abs(p - 0.5) * 2, H, *feats[i]["facts"], known]

# out-of-fold scores, folds grouped by family
fams = sorted({items[i]["family"] for i in train})
fold = {f: k % 5 for k, f in enumerate(np.random.RandomState(0).permutation(fams))}
def oof(C):
    P = {}
    for k in range(5):
        tr = [i for i in train if fold[items[i]["family"]] != k]; te = [i for i in train if fold[items[i]["family"]] == k]
        q = quant(fit(tr, C)); s = score(q, te)
        for i, p in zip(te, s): P[i] = (p, q[0])
    return P
best = None
for C in (0.03, 0.1, 0.3, 1.0):
    P = oof(C)
    # how many fine ones pass with no not-fine one passing (rules applied first)
    open_ = [i for i in train if not feats[i]["rule"]]
    worst = max([P[i][0] for i in open_ if not fine(i)] or [0])
    passed = sum(1 for i in open_ if fine(i) and P[i][0] > worst)
    print(f"C={C}: fine passed out of fold above the highest not-fine score: {passed} of {sum(fine(i) for i in train)}", flush=True)
    if best is None or passed > best[1]: best = (C, passed, P)
C, _, P = best

# the doubt model: does "fine" at this score disagree with the checks' label (out of fold)
Xd, yd = [], []
for i in train:
    if feats[i]["rule"]: continue
    p, w = P[i]; Xd.append(dx(p, i, w)); yd.append(1 if (p >= 0.5) != fine(i) else 0)
Xd = np.array(Xd); dmu = Xd.mean(0); dsd = Xd.std(0); dsd[dsd < 1e-6] = 1
dm = LogisticRegression(C=1.0, max_iter=2000, class_weight="balanced").fit((Xd - dmu) / dsd, yd)
doubt = lambda x: float(1 / (1 + math.exp(-(dm.intercept_[0] + ((np.array(x) - dmu) / dsd) @ dm.coef_[0]))))

# thresholds (P(fine) at least minP, doubt at most maxDoubt) on the out-of-fold scores: the most fine comments passed
# with no not-fine one passed, and within conformal risk control's bound at EPS
cal = [(i, P[i][0], doubt(dx(P[i][0], i, P[i][1]))) for i in train if not feats[i]["rule"]]
n = len([i for i in train])
grid = []
for minP in [x / 100 for x in range(50, 100)] + [0.995, 0.999]:
    for maxD in [x / 50 for x in range(1, 51)]:
        bad = sum(1 for i, p, d in cal if p >= minP and d <= maxD and not fine(i))
        good = sum(1 for i, p, d in cal if p >= minP and d <= maxD and fine(i))
        if bad == 0 and (n * bad / n + 1) / (n + 1) <= EPS: grid.append((good, -minP, maxD))
good, mp, maxDoubt = max(grid) if grid else (0, -1.0, 0.0)
minP = -mp
print(f"thresholds: P(fine) >= {minP}, doubt <= {maxDoubt}; out of fold {good} fine passed, 0 not fine", flush=True)

final = fit(train, C); q = quant(final); w, scale, b = q
def run(rows):
    s = score(q, rows); out = []
    for i, p in zip(rows, s):
        r = feats[i]["rule"]
        d = None if r else doubt(dx(p, i, w))
        out.append({"id": i, "rule": r, "p": float(p), "doubt": d, "pass": (not r) and p >= minP and d <= maxDoubt})
    return out
def report(rows):
    rr = run(rows); by = {r["id"]: r for r in rr}
    it = lambda i: items[i]
    harmful = [i for i in rows if it(i)["intent"] != "benign"]; refused = [i for i in rows if not checks_ok(i)]
    benign_ok = [i for i in rows if fine(i)]
    res = {"items": len(rows), "passed_without_model": sum(by[i]["pass"] for i in rows), "passed_share": round(np.mean([by[i]["pass"] for i in rows]), 4),
           "fine": len(benign_ok), "fine_passed": sum(by[i]["pass"] for i in benign_ok), "fine_passed_share": round(np.mean([by[i]["pass"] for i in benign_ok]), 4) if benign_ok else None,
           "hostile_or_injected": len(harmful), "hostile_or_injected_passed": sum(by[i]["pass"] for i in harmful),
           "refused_by_a_check": len(refused), "refused_by_a_check_passed": sum(by[i]["pass"] for i in refused),
           "sent_onward_by_rule": sum(1 for i in rows if by[i]["rule"]),
           "by_intent": {k: {"n": sum(1 for i in rows if it(i)["intent"] == k), "passed": sum(by[i]["pass"] for i in rows if it(i)["intent"] == k)} for k in ("benign", "hostile", "injection")},
           "by_disguise": {k: {"n": sum(1 for i in harmful if it(i)["obf"] == k), "passed": sum(by[i]["pass"] for i in harmful if it(i)["obf"] == k)} for k in sorted({it(i)["obf"] or "none" for i in rows}) if True},
           "benign_by_lang": {k: {"n": sum(1 for i in benign_ok if it(i)["lang"] == k), "passed": sum(by[i]["pass"] for i in benign_ok if it(i)["lang"] == k)} for k in sorted({it(i)["lang"] for i in benign_ok})},
           "benign_refused_by_checks": sum(1 for i in rows if it(i)["intent"] == "benign" and not checks_ok(i)),
           "harmful_passed_by_checks": sum(1 for i in harmful if checks_ok(i))}
    for k in res["by_disguise"]:
        if k == "none": res["by_disguise"][k] = {"n": sum(1 for i in harmful if not it(i)["obf"]), "passed": sum(by[i]["pass"] for i in harmful if not it(i)["obf"])}
    res["harmful_max_p"] = round(max([by[i]["p"] for i in harmful if not by[i]["rule"]] or [0]), 4)
    return res
results = {"labels": {"source": "simulated (synthetic comments, labeled by Prompt Guard 2, code, Llama Guard 3 1B and Muse Glimmer's feed.standard)",
                      "train": len(train), "test": len(test), "families_train": len(fams), "families_test": len({items[i]["family"] for i in test})},
           "model": {"dim": DIM, "C": C, "nonzero_weights": int((w != 0).sum()), "scale": scale},
           "thresholds": {"minP": minP, "maxDoubt": maxDoubt, "eps": EPS, "out_of_fold_fine_passed": good},
           "train": report(train), "test": report(test)}
print(json.dumps(results, indent=1, default=np_json))
json.dump({"about": "Serve tiny feed prefilter (agent/src/feed/tiny_text.js): logistic regression on hashed n-grams (int8), doubt model; distill/tiny_mod.py",
           "dim": DIM, "weights": base64.b64encode(w.tobytes()).decode(), "scale": scale, "bias": b,
           "doubt": {"w": [round(float(v), 6) for v in dm.coef_[0]], "b": round(float(dm.intercept_[0]), 6), "mu": [round(float(v), 6) for v in dmu], "sd": [round(float(v), 6) for v in dsd]},
           "minP": minP, "maxDoubt": maxDoubt,
           "check": [{"text": items[r["id"]]["text"], "p": round(r["p"], 6), "doubt": None if r["doubt"] is None else round(r["doubt"], 6), "pass": bool(r["pass"])} for r in run(test[:12])]},
          open(OUT_MODEL, "w", encoding="utf8"), ensure_ascii=False, default=np_json)
json.dump(results, open(OUT_RES, "w"), indent=1, default=np_json)
