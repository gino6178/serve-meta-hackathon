"""submission/results/dec1b.json: round 4 of the 1B student in one file, from the per-variant report
(distill/dec1b_report.py), the day-1 check (distill/day1_decider.py), the Glimmer calls spent, the int4 files' latency
and paired McNemar tests against bf16, and the selection rule written before the held-out comparison.
   python3 distill/dec1b_results.py <report.json> <day1.json> <out.json> --int4 <export name> --bf16 <variant> [--rule rule.txt]
"""
import argparse, collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dec1b_report import load_set, mcnemar, maj_score, pick_of

def preds(path): return {json.loads(l)["id"]: json.loads(l) for l in open(path)} if os.path.exists(path) else {}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report"); ap.add_argument("day1"); ap.add_argument("out")
    ap.add_argument("--int4", default=None); ap.add_argument("--bf16", default=None); ap.add_argument("--rule", default=None)
    ap.add_argument("--data", default="jev/data"); ap.add_argument("--preds", default="jev/preds4"); ap.add_argument("--extra", default=None)
    a = ap.parse_args()
    rep = json.load(open(a.report)); out = {"round": 4, "student": "Llama 3.2 1B Instruct, LoRA r16, bf16 training on one A100; int4 GGUF on CPU", "report": rep, "day1_decider": json.load(open(a.day1))}
    if a.rule: out["selection_rule"] = open(a.rule).read()
    # Glimmer calls spent this round (answers that came back with a label)
    calls = {}
    for d in ("decider", "train", "trainshared", "asked", "test"):
        p = f"{a.data}/{d}/teacher_more.jsonl"
        if os.path.exists(p):
            rows = [json.loads(l) for l in open(p)]
            calls[d] = {"answers": len(rows), "labelled": sum(r["decision"].get("intent") in ("counter", "decline") for r in rows),
                        "output_tokens_p50": sorted(r["tokens"]["output"] for r in rows)[len(rows) // 2] if rows else None}
        p = f"{a.data}/{d}/decider_dist.jsonl"
        if os.path.exists(p): calls.setdefault(d, {})["decider_reads_cases"] = len({json.loads(l)["id"] for l in open(p)})
    out["glimmer_calls"] = calls
    if a.int4 and a.bf16:
        q = {}
        for d in ("test", "decider", "val"):
            cases, orig, allv, full, full2 = load_set(a.data, d)
            B = preds(f"{a.preds}/{a.bf16}_{d}_short.jsonl")
            for f in ("Q4_K_M-noimat", "Q4_K_M", "Q5_K_M", "Q6_K"):
                A = preds(f"{a.preds}/{a.int4}-{f}_{d}_short.jsonl")
                ids = [i for i in A if i in B and allv.get(i)]
                if not ids: continue
                pa = {i: pick_of(A[i])[0] for i in ids}; pb = {i: pick_of(B[i])[0] for i in ids}
                r = {"cases": len(ids), "same_pick_as_bf16": sum(pa[i] == pb[i] for i in ids)}
                # paired McNemar on agreement with Glimmer's majority (all answers; a tie counts as agreement when the
                # pick is among the tied), int4 against bf16
                ok = lambda p, i: maj_score(p, allv[i]) > 0
                r["mcnemar_majority"] = mcnemar([ok(pb[i], i) for i in ids], [ok(pa[i], i) for i in ids])
                if d == "decider": r["mcnemar_vs_full"] = mcnemar([pb[i] == full.get(i) for i in ids], [pa[i] == full.get(i) for i in ids])
                q.setdefault(f, {})[d] = r
            for f in ("Q4_K_M-noimat", "Q4_K_M", "Q5_K_M", "Q6_K"):
                L = preds(f"{a.preds}/{a.int4}-{f}_latency.jsonl")
                if L and d == "test":
                    ms = sorted(r["ms"] for r in L.values()); q.setdefault(f, {})["latency_ms_100_test_cases_8_threads"] = {"p50": ms[len(ms) // 2], "p95": ms[int(.95 * len(ms))], "tokens_p50": sorted(r["tokens"] for r in L.values())[len(L) // 2]}
            size = f"{os.path.expanduser('~')}/export/{a.int4}"
        for f in q:
            p = f"{os.path.expanduser('~')}/export/{a.int4}/{a.int4}-{f}.gguf"
            if os.path.exists(p): q[f]["bytes"] = os.path.getsize(p)
        out["int4"] = {"export": a.int4, "bf16_variant": a.bf16, "files": q, "note": "McNemar: a_only = bf16 right and int4 wrong, b_only = the reverse; exact two-sided p"}
    if a.extra: out.update(json.load(open(a.extra)))
    json.dump(out, open(a.out, "w"), indent=1)
    print("wrote", a.out)

if __name__ == "__main__":
    main()
