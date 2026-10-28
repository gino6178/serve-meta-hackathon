"""The student on the one-pass decider's 196 cases (distill/decider_cases.mjs), against the same references as
docs/decider.md: the full answer (full) and the full answer again (full2), and the member's stated preference where
code can grade it. 95% intervals from a bootstrap over members, as there.
   python3 distill/decider_compare.py <cases dir> name=preds.jsonl [name=preds.jsonl ...] [--threshold name=t] [--out out.json]
"""
import json, random, sys, collections

def load(d):
    cases = {c["id"]: c for c in map(json.loads, open(f"{d}/cases.jsonl"))}
    full, full2 = {}, {}
    for r in map(json.loads, open(f"{d}/teacher.jsonl")):
        dec = r["decision"]; c = cases[r["id"]]
        pick = next((x["id"] for x in c["offers"] if dec.get("intent") == "counter" and x["slot"]["date"] == dec["date"] and "%02d:%02d" % divmod(x["start"], 60) == dec["start"]), "Z" if dec.get("intent") == "decline" else None)
        (full if r["sample"] == 0 else full2)[r["id"]] = pick
    return cases, full, full2

def boot(cases, f, n=2000, seed=0):
    """the mean of f(case id) over cases, with a bootstrap over members"""
    by = collections.defaultdict(list)
    for i in cases: by[cases[i]["member"]["id"]].append(i)
    ms = list(by); vals = {i: f(i) for i in cases}; vals = {i: v for i, v in vals.items() if v is not None}
    est = sum(vals.values()) / max(1, len(vals))
    rng = random.Random(seed); bs = []
    for _ in range(n):
        xs = [v for m in (rng.choice(ms) for _ in ms) for i in by[m] if (v := vals.get(i)) is not None]
        if xs: bs.append(sum(xs) / len(xs))
    bs.sort()
    return {"value": round(est, 4), "ci95": [round(bs[int(.025 * len(bs))], 4), round(bs[int(.975 * len(bs)) - 1], 4)], "n": len(vals)}

def main():
    args = sys.argv[1:]; d = args[0]; out = None; th = {}
    specs = []
    i = 1
    while i < len(args):
        if args[i] == "--out": out = args[i + 1]; i += 2
        elif args[i] == "--threshold": k, v = args[i + 1].split("="); th[k] = float(v); i += 2
        else: specs.append(args[i]); i += 1
    cases, full, full2 = load(d)
    res = {"cases": len(cases), "members": len({c["member"]["id"] for c in cases.values()}), "graded": sum(1 for c in cases.values() if c["liked"])}
    first = lambda i: next(x["id"] for x in cases[i]["offers"] if x["id"] in cases[i]["works"])
    res["full_vs_full2"] = boot(cases, lambda i: float(full.get(i) == full2.get(i)) if i in full and i in full2 else None)
    res["full_liked"] = sum(1 for i, c in cases.items() if c["liked"] and full.get(i) in c["liked"])
    res["full2_liked"] = sum(1 for i, c in cases.items() if c["liked"] and full2.get(i) in c["liked"])
    res["full_first_listed"] = round(sum(full.get(i) == first(i) for i in cases) / len(cases), 4)
    res["students"] = {}
    for s in specs:
        name, path = s.split("=", 1)
        P = {r["id"]: r for r in map(json.loads, open(path))}
        pick = {i: max(r["probs"], key=r["probs"].get) for i, r in P.items()}
        pick = {i: ("Z" if v == "decline" else v) for i, v in pick.items()}
        conf = {i: max(P[i]["probs"].values()) for i in P}
        readok = {i: {t for t, q in P[i]["works_p"].items() if q >= .5} == set(P[i]["works"]) & set(P[i]["works_p"]) for i in P}
        r = {"vs_full": boot(cases, lambda i: float(pick.get(i) == full.get(i)) if i in pick and i in full else None),
             "vs_full2": boot(cases, lambda i: float(pick.get(i) == full2.get(i)) if i in pick and i in full2 else None),
             "vs_full_where_full_agree": boot(cases, lambda i: float(pick.get(i) == full.get(i)) if i in pick and full.get(i) is not None and full.get(i) == full2.get(i) else None),
             # paired by case: (student agrees with full) minus (full2 agrees with full); an interval that holds zero
             # means the student is not shown to differ from asking Glimmer again
             "minus_full2_vs_full": boot(cases, lambda i: float(pick.get(i) == full.get(i)) - float(full2.get(i) == full.get(i)) if i in pick and full.get(i) is not None and full2.get(i) is not None else None),
             "liked": f"{sum(1 for i, c in cases.items() if c['liked'] and pick.get(i) in c['liked'])} of {res['graded']}",
             "first_listed": round(sum(pick.get(i) == first(i) for i in cases if i in pick) / max(1, len(pick)), 4),
             "declines": sum(v == "Z" for v in pick.values()), "read_matches_code": sum(readok.values()), "by_rule": {}}
        for rule in ("endBy", "noDays", "maxTrip"):
            ids = [i for i in cases if cases[i]["rule"] == rule and i in pick]
            r["by_rule"][rule] = f"{sum(pick[i] == full.get(i) for i in ids)} of {len(ids)}"
        if "ms" in next(iter(P.values())):
            ms = sorted(P[i]["ms"] for i in P); r["latency_ms"] = {"p50": ms[len(ms) // 2], "p95": ms[int(.95 * len(ms))]}
        if name in th:
            t = th[name]; used = [i for i in P if conf[i] >= t and readok[i]]
            # the cascade on these cases: the student where it is sure, full2 elsewhere, graded against full
            casc = {i: (pick[i] if i in used else full2.get(i)) for i in cases}
            r["cascade"] = {"threshold": t, "answered": len(used), "of": len(cases), "student_differs_from_full": sum(pick[i] != full.get(i) for i in used),
                            "agrees_with_full": boot(cases, lambda i: float(casc.get(i) == full.get(i)) if full.get(i) is not None else None),
                            "liked": f"{sum(1 for i, c in cases.items() if c['liked'] and casc.get(i) in c['liked'])} of {res['graded']}"}
        res["students"][name] = r
    print(json.dumps(res, indent=1))
    if out: json.dump(res, open(out, "w"), indent=1)

if __name__ == "__main__":
    main()
