"""Two cheap reads that agree (talk.js A2A_AGREE): on the decider's 196 cases, the cascade as it was (the student when
at least 0.6 sure, then the decider when at least 0.85 sure, else Glimmer's full answer) against the same plus one more
step: when the student is unsure and the decider not sure enough, but both pick the same time and each gives it at
least `lo` and `dlo`, that time. Measured against Glimmer's full answer: the share answered without Glimmer, and the
share that match it (where Glimmer answers, a second sample of its full answer stands in, so the cascade is charged
with Glimmer's own disagreement with itself). The thresholds are chosen on a random half (the most answered without
Glimmer whose match is no lower than the old cascade's on that half) and measured on the other, 500 times.
  python distill/agree_cascade.py [out.json]
"""
import json, random, sys, collections

R = "submission/results"
rows = json.load(open(f"{R}/decider_raw.json")) + json.load(open(f"{R}/decider_raw_full2.json"))
by = collections.defaultdict(dict)
for r in rows: by[r["id"]][r["system"]] = r
st = {}
for l in open(f"{R}/decision_model/preds_1b_v3_decider.jsonl"):
    r = json.loads(l); k = max(r["probs"], key=r["probs"].get); st[r["id"]] = ("Z" if k == "decline" else k, r["probs"][k])
ids = sorted(i for i in by if i in st and "full2" in by[i] and "raw:habits" in by[i])
full = lambda i: by[i]["full"]["pick"]
full2 = lambda i: by[i]["full2"]["pick"]
dec = lambda i: (by[i]["raw:habits"]["pick"], by[i]["raw:habits"]["p"] or 0)
old = lambda i: st[i][0] if st[i][1] >= 0.6 else (dec(i)[0] if dec(i)[1] >= 0.85 and dec(i)[0] != "Z" else None)

def agree(lo, dlo):
    def f(i):
        a = old(i)
        if a is not None: return a
        (s, ps), (d, pd) = st[i], dec(i)
        return s if s == d and s != "Z" and ps >= lo and pd >= dlo else None
    return f

def run(policy, S):
    cheap = match = 0
    for i in S:
        a = policy(i); cheap += a is not None; match += (a if a is not None else full2(i)) == full(i)
    return cheap / len(S), match / len(S)

grid = [(lo, d) for lo in (0.2, 0.3, 0.4, 0.5) for d in (0.0, 0.3, 0.5, 0.6, 0.7, 0.8)]
held, chosen = [], collections.Counter()
for rep in range(500):
    random.seed(rep); S = ids[:]; random.shuffle(S); A, B = S[:len(S) // 2], S[len(S) // 2:]
    base = run(old, A)[1]
    ok = [g for g in grid if run(agree(*g), A)[1] >= base]
    g = max(ok, key=lambda g: run(agree(*g), A)[0]) if ok else None
    chosen[str(g)] += 1
    held.append(run(old, B) + (run(agree(*g), B) if g else run(old, B)))
m = lambda k: round(sum(h[k] for h in held) / len(held), 4)
out = {"label": "Two cheap reads that agree (A2A_AGREE) on the decider's 196 cases: answered without Glimmer, and matching Glimmer's full answer", "cases": len(ids),
       "glimmerSelf": round(sum(full(i) == full2(i) for i in ids) / len(ids), 4),
       "heldOut": {"halves": 500, "old": {"answeredWithoutGlimmer": m(0), "matchesGlimmer": m(1)}, "agree": {"answeredWithoutGlimmer": m(2), "matchesGlimmer": m(3)}, "chosen": dict(chosen.most_common(5))},
       "served": {"lo": 0.5, "dlo": 0.5, "all": dict(zip(["answeredWithoutGlimmer", "matchesGlimmer"], [round(x, 4) for x in run(agree(0.5, 0.5), ids)])), "oldAll": dict(zip(["answeredWithoutGlimmer", "matchesGlimmer"], [round(x, 4) for x in run(old, ids)]))}}
print(json.dumps(out, indent=1))
if len(sys.argv) > 1: json.dump(out, open(sys.argv[1], "w"), indent=1)
