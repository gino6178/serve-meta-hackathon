"""Glimmer's reasoning condensed to a short why, for the rationale loss (train.py --rat_w): from each extra answer
(teacher_more.jsonl, which keeps the reasoning), the sentences that decide between the times (a preference word, or
the chosen time named), the last two of them, cut to about 40 words. Mechanical, no model call: the why is kept only
when the answer it came from chose the case's majority answer (train.py checks), so it explains the label trained.
   python3 distill/rationale.py jev/data/train jev/data/trainshared jev/data/asked
writes rationale.jsonl beside each teacher_more.jsonl: {id, sample, decision, why}.
"""
import json, os, re, sys

SKIP = re.compile(r"json|return|format|works list|ids that work|intent|[{}\[\]]", re.I)  # the reply's bookkeeping, not the choice
PREF = re.compile(r"\b(prefer|prefers|preference|likes?|best|rather|earliest|soonest|latest|weekend|morning|evening|trip|closest|shortest|choose|chosen|pick|picks|habit)\b", re.I)

def why(thinking, decision, case):
    if not thinking: return None
    t = re.sub(r"\s+", " ", thinking).strip()
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n", t) if len(s.strip()) > 12 and not SKIP.search(s)]
    chosen = None
    if decision.get("intent") == "counter":
        for x in case["offers"]:
            if x["slot"]["date"] == decision["date"] and "%02d:%02d" % divmod(x["start"], 60) == decision["start"]: chosen = x["id"]
    keep = [s for s in sents if PREF.search(s) or (chosen and re.search(rf"\b{chosen}\b", s))]
    if not keep: keep = sents[-2:]
    w = " ".join(keep[-2:]).split()
    return " ".join(w[:40]) if w else None

def main():
    for d in sys.argv[1:]:
        p = f"{d}/teacher_more.jsonl"
        if not os.path.exists(p): continue
        cases = {c["id"]: c for c in map(json.loads, open(f"{d}/cases.jsonl"))}
        n = 0
        with open(f"{d}/rationale.jsonl", "w") as f:
            for r in map(json.loads, open(p)):
                c = cases.get(r["id"])
                if not c or r["decision"].get("intent") not in ("counter", "decline"): continue
                y = why(r.get("thinking"), r["decision"], c)
                if y: f.write(json.dumps({"id": r["id"], "sample": r["sample"], "decision": r["decision"], "why": y}) + "\n"); n += 1
        print(d, n, "rationales")

if __name__ == "__main__":
    main()
