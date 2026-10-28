"""The threshold curve for the shipped student (int4 on the CPU): at each A2A_STUDENT_SURE, the share of the real
choices it answers (each one a Muse Glimmer call saved), and how the cascade (the student where it is sure, Glimmer
elsewhere) agrees with Glimmer, with the member's stated preference on the decider's cases.
   python3 distill/curve.py <data dir> <student test preds> <student decider preds> <out.json>
On the test set Glimmer answered each case 3 times: the cascade's fallback is its first answer, graded against the other
two. On the decider's cases the fallback is full2, graded against full (as in docs/decider.md).
"""
import json, sys, collections
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from prompt import label_of
from decider_compare import load as load_decider

def main():
    D, tp, dp, out = sys.argv[1:5]
    ths = [0.0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]
    res = {"thresholds": []}
    # test
    cases = {c["id"]: c for c in map(json.loads, open(f"{D}/test/cases.jsonl"))}
    ans = collections.defaultdict(dict)
    for r in map(json.loads, open(f"{D}/test/teacher.jsonl")): ans[r["id"]][r["sample"]] = label_of(cases[r["id"]], r["decision"])
    T = {r["id"]: r for r in map(json.loads, open(tp))}
    cd, full, full2 = load_decider(f"{D}/decider")
    P = {r["id"]: r for r in map(json.loads, open(dp))}
    read = lambda r: {t for t, q in r["works_p"].items() if q >= .5} == set(r["works"]) & set(r["works_p"])
    pick = lambda r: (lambda k: "Z" if k == "decline" else k)(max(r["probs"], key=r["probs"].get))
    for th in ths:
        used_t = {i for i, r in T.items() if max(r["probs"].values()) >= th and read(r)}
        k = n = 0
        for i, s in ans.items():
            if i not in T: continue
            y = pick(T[i]) if i in used_t else s.get(0)
            for j in (1, 2):
                if s.get(j) is not None: n += 1; k += y == s[j]
        used_d = {i for i, r in P.items() if max(r["probs"].values()) >= th and read(r)}
        casc = {i: (pick(P[i]) if i in used_d else full2.get(i)) for i in cd}
        agree = sum(casc[i] == full.get(i) for i in cd) / len(cd)
        liked = sum(1 for i, c in cd.items() if c["liked"] and casc[i] in c["liked"])
        res["thresholds"].append({"threshold": th, "test_answered_by_student": round(len(used_t) / len(T), 4), "test_cascade_agrees_with_glimmer": round(k / max(1, n), 4),
                                  "decider_answered_by_student": round(len(used_d) / len(cd), 4), "decider_cascade_agrees_with_full": round(agree, 4), "decider_liked": f"{liked} of {sum(1 for c in cd.values() if c['liked'])}"})
    # references: Glimmer with itself
    n = k = 0
    for s in ans.values():
        if s.get(0) is None: continue
        for j in (1, 2):
            if s.get(j) is not None: n += 1; k += s[0] == s[j]
    res["test_glimmer_first_answer_vs_others"] = round(k / n, 4)
    res["decider_full2_vs_full"] = round(sum(full2.get(i) == full.get(i) for i in cd) / len(cd), 4)
    res["decider_full_liked"] = sum(1 for i, c in cd.items() if c["liked"] and full.get(i) in c["liked"])
    json.dump(res, open(out, "w"), indent=1)
    print(json.dumps(res, indent=1))

if __name__ == "__main__":
    main()
