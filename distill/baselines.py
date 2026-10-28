"""Simple rules against Glimmer's choices on judge cases: how much of the judgment a fixed rule already matches.
   python3 distill/baselines.py <dir> [<dir> ...]     (each dir has cases.jsonl and teacher.jsonl)
"""
import json, sys, collections

def load(d):
    cases = {c["id"]: c for c in map(json.loads, open(f"{d}/cases.jsonl"))}
    rows = [json.loads(l) for l in open(f"{d}/teacher.jsonl")]
    return cases, rows

def label(c, dec):
    """Glimmer's decision as an option: a time id it asked for, 'accept' or 'decline' (None when it gave no answer)."""
    if not dec or dec["intent"] == "none": return None
    if dec["intent"] == "accept": return "accept"
    if dec["intent"] == "decline": return "decline"
    for x in c["offers"]:
        if x["slot"]["date"] == dec["date"] and "%02d:%02d" % divmod(x["start"], 60) == dec["start"]: return x["id"]
    return "?"

def rules(c):
    w = [x for x in c["offers"] if x["id"] in c["works"] and x["id"] != c["cur"]]
    m = c["member"]; txt = m.get("agent", "")
    home = m.get("venue")
    key = lambda x: (x["slot"]["date"], x["start"])
    out = {
        "first listed": w[0]["id"] if w else None,
        "lowest t-number": min(w, key=lambda x: int(x["id"][1:]))["id"] if w else None,
        "earliest": min(w, key=key)["id"] if w else None,
        "shortest trip": min(w, key=lambda x: (x["trip"] if x["trip"] is not None else 999, key(x)))["id"] if w else None,
    }
    # a rule from the member's words: weekends, the home venue, the earliest start; else the proposer's order
    pref = None
    if "weekends" in txt:
        we = [x for x in w if x["slot"]["day"] in ("Sat", "Sun")]
        if we: pref = min(we, key=lambda x: int(x["id"][1:]))["id"]
    if pref is None and "home venue" in txt:
        hv = [x for x in w if x.get("venue") == home]
        if hv: pref = min(hv, key=lambda x: int(x["id"][1:]))["id"]
    if pref is None and "earliest start" in txt:
        pref = out["earliest"]
    out["profile rule"] = pref or out["lowest t-number"]
    return out

if __name__ == "__main__":
    agree = collections.Counter(); n = 0; dist = collections.Counter()
    for d in sys.argv[1:]:
        cases, rows = load(d)
        for r in rows:
            c = cases[r["id"]]
            if c["kind"] != "judge": continue
            y = label(c, r["decision"]); dist[y if y in ("accept", "decline", None, "?") else "counter"] += 1
            if y is None: continue
            n += 1
            for k, v in rules(c).items(): agree[k] += (v == y)
    print("judge answers:", n, dict(dist))
    for k, v in agree.items(): print(f"  {k:16s} matches Glimmer {v}/{n} = {v / max(1, n):.3f}")
