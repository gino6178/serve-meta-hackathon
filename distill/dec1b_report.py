"""Round 4 of the decision model (docs/decision_model.md): every variant's predictions against Muse Glimmer, on the
validation, test and decider sets, with intervals.

Per variant and set (from <preds>/<variant>_<set>_short.jsonl, and _short_reverse.jsonl when there):
  each       share of Glimmer's original answers (teacher.jsonl) the pick matches (the earlier rounds' metric);
  maj        the pick against the majority of every Glimmer answer to the case (teacher.jsonl + teacher_more.jsonl),
             paired with Glimmer itself the fair way: for each answer i, the student and answer i are both graded
             against the majority of the *other* answers (ties shared out), so the two numbers have the same reference;
  full       decider set only: against `full` (sample 0), as docs/decider.md; and the cascade at a threshold (student
             where sure and its reading of which times work matches code's, `full2` elsewhere), graded against `full`;
  ece/nll    confidence (the pick's probability) against agreement with Glimmer's answers, 10 bins; NLL of Glimmer's
             answers under the student; both raw and after temperature scaling fitted on val;
  flips      share of cases whose pick changes when the listed times are read in reverse (order sensitivity).
95% intervals: a bootstrap over members (2,000 draws). Paired differences against a reference variant the same way.
   python3 distill/dec1b_report.py --preds jev/preds4 --data jev/data --variants a,b,c [--ref a] [--out x.json]
"""
import argparse, collections, json, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import label_of

SETS = ("val", "test", "decider")

def load_set(data, d):
    cases = {c["id"]: c for c in map(json.loads, open(f"{data}/{d}/cases.jsonl"))}
    orig = collections.defaultdict(list); allv = collections.defaultdict(list); full = {}
    for f, more in (("teacher.jsonl", False), ("teacher_more.jsonl", True)):
        p = f"{data}/{d}/{f}"
        if not os.path.exists(p): continue
        for r in map(json.loads, open(p)):
            c = cases.get(r["id"])
            if c is None: continue
            y = label_of(c, r["decision"])
            if y is None: continue
            allv[r["id"]].append(y)
            if not more:
                orig[r["id"]].append(y)
                if r.get("sample") == 0: full[r["id"]] = y
    full2 = {}
    if os.path.exists(f"{data}/{d}/teacher.jsonl"):
        for r in map(json.loads, open(f"{data}/{d}/teacher.jsonl")):
            c = cases.get(r["id"]); y = c and label_of(c, r["decision"])
            if y is not None and r.get("sample") == 1: full2[r["id"]] = y
    return cases, orig, allv, full, full2

def maj_score(pick, votes):
    """1 if pick is the plurality answer of votes, shared out over ties; None without votes."""
    if not votes: return None
    cnt = collections.Counter(votes); top = max(cnt.values()); tied = [k for k, v in cnt.items() if v == top]
    return (1.0 / len(tied)) if pick in tied else 0.0

def loo(pick, votes):
    """(student, Glimmer) against the majority of the other answers, averaged over each held-out answer i."""
    if len(votes) < 2: return None
    s = g = 0.0
    for i in range(len(votes)):
        rest = votes[:i] + votes[i + 1:]
        s += maj_score(pick, rest); g += maj_score(votes[i], rest)
    return s / len(votes), g / len(votes)

def boot(groups, vals, n=2000, seed=0):
    """mean of vals {case: value} with a bootstrap over groups {group: [cases]}"""
    vals = {k: v for k, v in vals.items() if v is not None}
    if not vals: return None
    est = sum(vals.values()) / len(vals)
    gs = [g for g in groups if any(i in vals for i in groups[g])]
    rng = random.Random(seed); bs = []
    for _ in range(n):
        xs = [vals[i] for g in (rng.choice(gs) for _ in gs) for i in groups[g] if i in vals]
        if xs: bs.append(sum(xs) / len(xs))
    bs.sort()
    return {"value": round(est, 4), "ci95": [round(bs[int(.025 * len(bs))], 4), round(bs[int(.975 * len(bs)) - 1], 4)], "n": len(vals)}

def scaled(probs, T):
    if T == 1: return probs
    z = {k: math.log(max(p, 1e-9)) / T for k, p in probs.items()}; m = max(z.values())
    e = {k: math.exp(v - m) for k, v in z.items()}; s = sum(e.values())
    return {k: v / s for k, v in e.items()}

def nll(rows, votes, T=1.0):
    tot = n = 0
    for r in rows:
        p = scaled(r["probs"], T)
        for y in votes.get(r["id"], []):
            tot -= math.log(max(p.get(y, 0), 1e-9)); n += 1
    return tot / max(1, n)

def fit_T(rows, votes):
    best = min((nll(rows, votes, T), T) for T in [x / 20 for x in range(10, 81)])
    return best[1]

def ece(rows, votes, T=1.0, bins=10):
    b = collections.defaultdict(lambda: [0, 0.0, 0.0])
    for r in rows:
        v = votes.get(r["id"])
        if not v: continue
        p = scaled(r["probs"], T); k = max(p, key=p.get); conf = p[k]; acc = sum(y == k for y in v) / len(v)
        x = b[min(bins - 1, int(conf * bins))]; x[0] += 1; x[1] += conf; x[2] += acc
    n = sum(x[0] for x in b.values())
    return round(sum(abs(x[1] - x[2]) for x in b.values()) / max(1, n), 4)

def read_ok(r):
    said = {t for t, q in r["works_p"].items() if q >= .5}
    return said == set(r["works"]) & set(r["works_p"])

def pick_of(r, T=1.0):
    p = scaled(r["probs"], T); k = max(p, key=p.get); return k, p[k]

def crc(rows, votes, alpha, T=1.0, grid=None):
    """conformal risk control (as docs/decision_model.md): the smallest threshold whose risk, disagreement over all
    cases with an unanswered case counted as 0, satisfies (n R + 1) / (n + 1) <= alpha"""
    grid = grid or [x / 100 for x in range(30, 100)]
    n = len(rows)
    for t in grid:
        risk = 0.0
        for r in rows:
            k, c = pick_of(r, T)
            if c >= t and read_ok(r): risk += 1 - sum(y == k for y in votes[r["id"]]) / len(votes[r["id"]])
        if (risk + 1) / (n + 1) <= alpha: return t
    return None

def cascade(rows, cases, full, full2, groups, t, T=1.0, allv=None):
    used = {r["id"] for r in rows if pick_of(r, T)[1] >= t and read_ok(r)}
    pk = {r["id"]: pick_of(r, T)[0] for r in rows}
    casc = {i: (pk[i] if i in used else full2.get(i)) for i in pk}
    out = {"threshold": t, "answered": round(len(used) / max(1, len(rows)), 4),
           "agree_full": boot(groups, {i: float(casc[i] == full.get(i)) if i in full and casc[i] is not None else None for i in casc})}
    if allv:  # the cascade against the majority of the answers other than full2 (which it may have used)
        out["agree_majority_wo_full2"] = boot(groups, {i: maj_score(casc[i], [y for j, y in enumerate(allv[i]) if j != 1]) if casc[i] is not None else None for i in casc})
    return out

def mcnemar(a, b):
    """exact two-sided McNemar on paired 0/1 outcomes {case: (a_right, b_right)}"""
    n01 = sum(1 for x, y in zip(a, b) if x and not y); n10 = sum(1 for x, y in zip(a, b) if y and not x); n = n01 + n10
    if n == 0: return {"a_only": 0, "b_only": 0, "p": 1.0}
    k = min(n01, n10); p = min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)
    return {"a_only": n01, "b_only": n10, "p": round(p, 4)}

def read_preds(path):
    return [json.loads(l) for l in open(path)] if os.path.exists(path) else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preds", default="jev/preds4"); ap.add_argument("--data", default="jev/data"); ap.add_argument("--variants", required=True)
    ap.add_argument("--ref", default=None); ap.add_argument("--out", default=None); ap.add_argument("--suffix", default="_short")
    ap.add_argument("--served", type=float, default=0.6); ap.add_argument("--alpha", type=float, default=0.05)
    a = ap.parse_args()
    S = {d: load_set(a.data, d) for d in SETS if os.path.exists(f"{a.data}/{d}/cases.jsonl")}
    groups = {d: collections.defaultdict(list) for d in S}
    for d, (cases, *_r) in S.items():
        for i, c in cases.items(): groups[d][c["member"]["id"]].append(i)
    res = {"sets": {}, "variants": {}}
    for d, (cases, orig, allv, full, full2) in S.items():
        ids = [i for i in cases if cases[i]["kind"] == "judge" and orig.get(i)]
        g = {"cases": len(ids), "glimmer_answers_original": sum(len(orig[i]) for i in ids), "glimmer_answers_all": sum(len(allv[i]) for i in ids),
             "answers_per_case_all": dict(collections.Counter(len(allv[i]) for i in ids))}
        # Glimmer against itself: pairs of its original answers; and one answer against the majority of the others (all)
        g["self_pairs_original"] = boot(groups[d], {i: (sum(x == y for k, x in enumerate(orig[i]) for y in orig[i][k + 1:]) / (len(orig[i]) * (len(orig[i]) - 1) / 2)) if len(orig[i]) > 1 else None for i in ids})
        g["self_vs_majority_of_others_all"] = boot(groups[d], {i: (loo(allv[i][0], allv[i]) or (None, None))[1] for i in ids})
        if d == "decider": g["full2_vs_full"] = boot(groups[d], {i: float(full2[i] == full[i]) if i in full and i in full2 else None for i in ids})
        res["sets"][d] = g
    names = a.variants.split(",")
    for v in names:
        out = {}
        val = read_preds(f"{a.preds}/{v}_val{a.suffix}.jsonl")
        T = fit_T(val, S["val"][2]) if val and "val" in S else 1.0
        out["temperature_fitted_on_val"] = T
        for d, (cases, orig, allv, full, full2) in S.items():
            rows = read_preds(f"{a.preds}/{v}_{d}{a.suffix}.jsonl")
            if not rows: continue
            rows = [r for r in rows if orig.get(r["id"])]
            pk = {r["id"]: pick_of(r)[0] for r in rows}
            r_ = {"cases": len(rows)}
            r_["each"] = boot(groups[d], {i: sum(y == pk[i] for y in orig[i]) / len(orig[i]) for i in pk})
            L = {i: loo(pk[i], allv[i]) for i in pk}
            r_["vs_majority_of_others"] = boot(groups[d], {i: x[0] if x else None for i, x in L.items()})
            r_["glimmer_vs_majority_of_others"] = boot(groups[d], {i: x[1] if x else None for i, x in L.items()})
            r_["minus_glimmer_paired"] = boot(groups[d], {i: (x[0] - x[1]) if x else None for i, x in L.items()})
            r_["vs_majority_all"] = boot(groups[d], {i: maj_score(pk[i], allv[i]) for i in pk})
            if d == "decider":
                r_["vs_full"] = boot(groups[d], {i: float(pk[i] == full[i]) if i in full else None for i in pk})
                r_["minus_full2_vs_full"] = boot(groups[d], {i: float(pk[i] == full[i]) - float(full2[i] == full[i]) if i in full and i in full2 else None for i in pk})
                r_["liked"] = f"{sum(1 for i in pk if cases[i].get('liked') and pk[i] in cases[i]['liked'])} of {sum(1 for i in pk if cases[i].get('liked'))}"
                r_["cascade_served"] = cascade(rows, cases, full, full2, groups[d], a.served, 1.0, allv)
                r_["cascade_served_scaled"] = cascade(rows, cases, full, full2, groups[d], a.served, T, allv)
            r_["ece"] = ece(rows, allv, 1.0); r_["ece_scaled"] = ece(rows, allv, T)
            r_["nll"] = round(nll(rows, allv, 1.0), 4); r_["nll_scaled"] = round(nll(rows, allv, T), 4)
            r_["read_matches_code"] = round(sum(read_ok(r) for r in rows) / len(rows), 4)
            r_["answered_at_served"] = round(sum(1 for r in rows if pick_of(r)[1] >= a.served and read_ok(r)) / len(rows), 4)
            rev = read_preds(f"{a.preds}/{v}_{d}{a.suffix}_reverse.jsonl")
            if rev:
                pr = {r["id"]: pick_of(r)[0] for r in rev}
                both = [i for i in pk if i in pr]
                r_["flips_reversed"] = boot(groups[d], {i: float(pk[i] != pr[i]) for i in both})
            out[d] = r_
        # the threshold: conformal risk control on val (after scaling), and what it gives on the held-out sets
        if val:
            thr = crc([r for r in val if S["val"][2].get(r["id"])], S["val"][2], a.alpha, T)
            out["crc_threshold_val_scaled"] = thr
            for d in ("test", "decider"):
                rows = read_preds(f"{a.preds}/{v}_{d}{a.suffix}.jsonl")
                if not rows or thr is None or d not in S: continue
                cases, orig, allv, full, full2 = S[d]
                rows = [r for r in rows if orig.get(r["id"])]
                used = [r for r in rows if pick_of(r, T)[1] >= thr and read_ok(r)]
                dis = sum(1 - sum(y == pick_of(r, T)[0] for y in allv[r["id"]]) / len(allv[r["id"]]) for r in used)
                out[d]["at_crc_threshold"] = {"answered": round(len(used) / len(rows), 4), "disagreement_among_answered": round(dis / max(1, len(used)), 4), "disagreement_over_all": round(dis / len(rows), 4)}
                if d == "decider": out[d]["cascade_crc"] = cascade(rows, cases, full, full2, groups[d], thr, T, allv)
        res["variants"][v] = out
    if a.ref:
        res["paired_vs_ref"] = {}
        for v in names:
            if v == a.ref: continue
            x = {}
            for d, (cases, orig, allv, full, full2) in S.items():
                A = read_preds(f"{a.preds}/{a.ref}_{d}{a.suffix}.jsonl"); B = read_preds(f"{a.preds}/{v}_{d}{a.suffix}.jsonl")
                if not A or not B: continue
                pa = {r["id"]: pick_of(r)[0] for r in A}; pb = {r["id"]: pick_of(r)[0] for r in B}
                both = [i for i in pa if i in pb and allv.get(i)]
                x[d] = {"each_diff": boot(groups[d], {i: (sum(y == pb[i] for y in orig[i]) - sum(y == pa[i] for y in orig[i])) / len(orig[i]) for i in both if orig.get(i)}),
                        "majority_diff": boot(groups[d], {i: maj_score(pb[i], allv[i]) - maj_score(pa[i], allv[i]) for i in both})}
            res["paired_vs_ref"][v] = x
    print(json.dumps(res, indent=1))
    if a.out: json.dump(res, open(a.out, "w"), indent=1)

if __name__ == "__main__":
    main()
