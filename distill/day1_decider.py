"""Day-1 check: do the one-token decider's letter distributions (agents/decider.js, read in several orders by
distill/glimmer_more.mjs decider) agree with Muse Glimmer's reasoned answers to the same cases?
For each set: the decider read once in the listed order, in the listed and reversed orders averaged, and in all its
orders averaged (listed, reversed, 2 shuffles), each letter matched back to its time. Reported: top pick against each
of Glimmer's answers (teacher.jsonl) and against their majority (teacher.jsonl + teacher_more.jsonl); how often it picks
the first time listed; how often the listed-order pick changes when the order is reversed; the member's stated
preference on the decider's cases; and the NLL of Glimmer's answers under the distribution, at a temperature fitted on
val (for the soft-label mix in train.py --soft_beta / --dec_tau).
   python3 distill/day1_decider.py jev/data [out.json]
"""
import collections, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import label_of
from dec1b_report import load_set, maj_score

def dists(data, d):
    rows = {}
    for l in open(f"{data}/{d}/decider_dist.jsonl"):
        r = json.loads(l); rows[r["id"]] = r  # the last read of a case wins
    out = {}
    for i, r in rows.items():
        V = r["views"]
        avg = lambda names: (lambda acc: {k: v / len(names) for k, v in acc.items()})(sum((collections.Counter(V[n]["dist"]) for n in names), collections.Counter()))
        out[i] = {"listed": V["listed"]["dist"], "two": avg(["listed", "reversed"]), "all": avg(list(V)), "reversed": V["reversed"]["dist"], "order": V["listed"]["order"], "mass": V["listed"]["mass"]}
    return out

def top(p): return max(p, key=p.get) if p else None

def temp(p, tau):
    z = {k: max(v, 1e-9) ** (1 / tau) for k, v in p.items()}; s = sum(z.values()); return {k: v / s for k, v in z.items()}

def nll(D, votes, key, tau):
    t = n = 0
    for i, x in D.items():
        p = temp(x[key], tau) if x[key] else {}
        for y in votes.get(i, []): t -= math.log(max(p.get(y, 0), 1e-6)); n += 1
    return t / max(1, n)

def main():
    data = sys.argv[1]; res = {}
    S = {d: (load_set(data, d), dists(data, d)) for d in ("val", "test", "decider") if os.path.exists(f"{data}/{d}/decider_dist.jsonl")}
    taus = {}
    if "val" in S:
        (cases, orig, allv, full, full2), D = S["val"]
        for key in ("listed", "two", "all"): taus[key] = min((nll(D, allv, key, t), t) for t in [x / 10 for x in range(3, 61)])[1]
    res["tau_fitted_on_val"] = taus
    for d, ((cases, orig, allv, full, full2), D) in S.items():
        ids = [i for i in D if orig.get(i)]
        r = {"cases": len(ids)}
        # Glimmer against itself, for scale
        r["glimmer_self_pairs"] = round(sum(sum(x == y for k, x in enumerate(orig[i]) for y in orig[i][k + 1:]) / (len(orig[i]) * (len(orig[i]) - 1) / 2) for i in ids if len(orig[i]) > 1) / max(1, sum(len(orig[i]) > 1 for i in ids)), 4)
        r["glimmer_first_listed"] = round(sum(sum(y == D[i]["order"][0] for y in orig[i]) / len(orig[i]) for i in ids) / len(ids), 4)
        for key in ("listed", "two", "all"):
            pk = {i: top(D[i][key]) for i in ids}
            x = {"each": round(sum(sum(y == pk[i] for y in orig[i]) / len(orig[i]) for i in ids) / len(ids), 4),
                 "majority_all": round(sum(maj_score(pk[i], allv[i]) for i in ids) / len(ids), 4),
                 "first_listed": round(sum(pk[i] == D[i]["order"][0] for i in ids) / len(ids), 4),
                 "declines": sum(pk[i] == "decline" for i in ids)}
            if taus.get(key): x["nll_at_val_tau"] = round(nll({i: D[i] for i in ids}, allv, key, taus[key]), 4); x["nll_at_tau1"] = round(nll({i: D[i] for i in ids}, allv, key, 1.0), 4)
            if d == "decider":
                x["vs_full"] = round(sum(pk[i] == full.get(i) for i in ids) / len(ids), 4)
                x["liked"] = f"{sum(1 for i in ids if cases[i].get('liked') and pk[i] in cases[i]['liked'])} of {sum(1 for i in ids if cases[i].get('liked'))}"
            r[key] = x
        r["flips_listed_vs_reversed"] = round(sum(top(D[i]["listed"]) != top(D[i]["reversed"]) for i in ids) / len(ids), 4)
        r["mass_on_options_p50"] = sorted(D[i]["mass"] for i in ids)[len(ids) // 2]
        if d == "decider": r["full2_vs_full"] = round(sum(full2.get(i) == full.get(i) for i in ids if i in full2) / max(1, sum(i in full2 for i in ids)), 4)
        res[d] = r
    print(json.dumps(res, indent=1))
    if len(sys.argv) > 2: json.dump(res, open(sys.argv[2], "w"), indent=1)

if __name__ == "__main__":
    main()
