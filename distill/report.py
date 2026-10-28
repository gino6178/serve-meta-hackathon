"""The decision model's numbers on held-out cases, against Muse Glimmer and against code.
   python3 distill/report.py --data jev/data/test --val-data jev/data/val --pred "name=test_preds.jsonl[,val_preds.jsonl]" ... --out results.json

For each student (a predictions file from train.py --eval or eval_gguf.py):
  agreement with Glimmer: with each of its answers (Glimmer asked 3 times per case, at the gateway's temperature), and
    with its majority answer (cases where 2 of 3 agree);
  works: precision and recall of the times it reads as working (P >= 0.5) against the code-computed truth;
  selective: at each confidence threshold, the share of cases it answers (coverage) and its agreement there; the
    threshold is set on the validation cases (another club) as the lowest at which agreement with Glimmer there is at
    least Glimmer's agreement with itself;
  latency: per forward pass, when measured.
Glimmer itself: how often two of its answers to the same case agree, what one answer costs, and its own works list.
Fixed rules (distill/baselines.py) are scored the same way.
"""
import argparse, collections, itertools, json, math, os, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import label_of
from baselines import rules

def wilson(k, n, z=1.96):
    if not n: return [0, 0]
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [round((c - h) / d, 4), round((c + h) / d, 4)]

def pct(xs, q):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else None

def load_teacher(d):
    cases = {c["id"]: c for c in map(json.loads, open(f"{d}/cases.jsonl"))}
    rows = [json.loads(l) for l in open(f"{d}/teacher.jsonl")]
    ans = collections.defaultdict(dict)
    for r in rows: ans[r["id"]][r["sample"]] = r
    return cases, rows, ans

def glimmer_labels(cases, ans):
    out = {}
    for i, s in ans.items():
        if cases[i]["kind"] != "judge": continue
        ys = [label_of(cases[i], s[k]["decision"]) for k in sorted(s)]
        out[i] = [y for y in ys if y is not None]
    return {i: ys for i, ys in out.items() if ys}

def majority(ys):
    c = collections.Counter(ys); y, n = c.most_common(1)[0]
    return y if n * 2 > len(ys) else None

def agreement(pick, labels):
    """pick: {id: answer}. Agreement with every Glimmer answer, and with the majority where there is one."""
    ks = ns = km = nm = 0
    for i, ys in labels.items():
        if i not in pick: continue
        ks += sum(y == pick[i] for y in ys); ns += len(ys)
        m = majority(ys)
        if m is not None: nm += 1; km += m == pick[i]
    return {"with_each_answer": round(ks / max(1, ns), 4), "with_each_answer_ci95": wilson(ks, ns), "answers": ns,
            "with_majority": round(km / max(1, nm), 4), "with_majority_ci95": wilson(km, nm), "cases_with_majority": nm}

def works_pr(preds):
    tp = fp = fn = exact = 0
    for r in preds:
        P = {t for t, q in r["works_p"].items() if q >= 0.5}; T = set(r["works"]) & set(r["works_p"])
        tp += len(P & T); fp += len(P - T); fn += len(T - P); exact += P == T
    return {"precision": round(tp / max(1, tp + fp), 4), "recall": round(tp / max(1, tp + fn), 4), "exact_cases": exact, "cases": len(preds), "false_works": fp, "missed_works": fn,
            "precision_ci95": wilson(tp, tp + fp), "recall_ci95": wilson(tp, tp + fn)}

def read_ok(r):
    P = {t for t, q in r["works_p"].items() if q >= 0.5}; T = set(r["works"]) & set(r["works_p"])
    return P == T

def selective(preds, labels, ths=(0.0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99)):
    out = []
    for th in ths:
        used = [r for r in preds if max(r["probs"].values()) >= th and read_ok(r)]
        pick = {r["id"]: max(r["probs"], key=r["probs"].get) for r in used}
        a = agreement(pick, {i: labels[i] for i in pick if i in labels})
        out.append({"threshold": th, "coverage": round(len(used) / max(1, len(preds)), 4), "answered": len(used), **{k: a[k] for k in ("with_each_answer", "with_majority", "answers")}})
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--val-data"); ap.add_argument("--pred", action="append", default=[]); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    cases, rows, ans = load_teacher(a.data)
    labels = glimmer_labels(cases, ans)
    judge = [r for r in rows if cases[r["id"]]["kind"] == "judge"]
    # Glimmer with itself
    pairs = [(x == y) for ys in labels.values() for x, y in itertools.combinations(ys, 2)]
    intents = collections.Counter((r["decision"] or {}).get("intent") for r in judge)
    gw = [{"works_p": {t: (1.0 if t in (r["decision"].get("worksRaw") or []) else 0.0) for t in cases[r["id"]]["works"] + [cases[r["id"]]["cur"]]}, "works": cases[r["id"]]["works"]}
          for r in judge if r["decision"] and r["decision"].get("worksRaw") is not None]
    sec = [r["seconds"] for r in judge]; tok = [r["tokens"] for r in judge]
    G = {"cases": len(labels), "answers": len(judge), "intents": dict(intents), "self_agreement_pairs": round(sum(pairs) / max(1, len(pairs)), 4), "self_agreement_ci95": wilson(sum(pairs), len(pairs)), "pairs": len(pairs),
         "cases_all_answers_same": sum(len(set(ys)) == 1 for ys in labels.values() if len(ys) > 1),
         "seconds_p50": pct(sec, .5), "seconds_p95": pct(sec, .95), "prompt_tokens_mean": round(st.mean(t["prompt"] for t in tok)), "output_tokens_mean": round(st.mean(t["output"] for t in tok)),
         "output_tokens_p50": pct([t["output"] for t in tok], .5), "reasoning_tokens_mean": round(st.mean(t["reasoning"] for t in tok)), "calls_mean": round(st.mean(t["calls"] for t in tok), 3), "empty": sum(t["empty"] for t in tok),
         "works_shown_times": works_pr(gw)}
    # fixed rules
    B = {}
    for name in rules(next(iter(cases.values()))):
        pick = {i: rules(cases[i])[name] for i in labels}
        B[name] = agreement(pick, labels)
    out = {"data": a.data, "glimmer": G, "rules": B, "students": {}}
    # validation labels, for the threshold
    vlabels = vG = None
    if a.val_data:
        vc, _, va = load_teacher(a.val_data); vlabels = glimmer_labels(vc, va)
        vp = [(x == y) for ys in vlabels.values() for x, y in itertools.combinations(ys, 2)]
        vG = round(sum(vp) / max(1, len(vp)), 4)
        out["val_glimmer_self_agreement"] = vG
    for spec in a.pred:
        name, files = spec.split("=", 1); fs = files.split(",")
        preds = [json.loads(l) for l in open(fs[0])]
        pick = {r["id"]: max(r["probs"], key=r["probs"].get) for r in preds}
        s = {"cases": len(preds), "agreement": agreement(pick, labels), "works": works_pr(preds), "selective": selective(preds, labels),
             "picked_decline": sum(v == "decline" for v in pick.values())}
        ms = [r["ms"] for r in preds if "ms" in r]
        if ms: s["latency_ms"] = {"p50": pct(ms, .5), "p95": pct(ms, .95), "mean": round(st.mean(ms), 1), "tokens_p50": pct([r["tokens"] for r in preds], .5)}
        if len(fs) > 1 and vlabels:
            vpred = [json.loads(l) for l in open(fs[1])]
            sel = selective(vpred, vlabels, ths=[x / 100 for x in range(0, 100)])
            ok = [x for x in sel if x["with_each_answer"] >= vG and x["answered"] >= 20]
            th = ok[0]["threshold"] if ok else 0.99
            s["threshold"] = {"value": th, "rule": "lowest at which agreement with each Glimmer answer on the validation club is at least Glimmer's self-agreement there", "val": next(x for x in sel if x["threshold"] == th),
                              "test": selective(preds, labels, ths=[th])[0]}
        out["students"][name] = s
    json.dump(out, open(a.out, "w"), indent=1)
    print(json.dumps({"glimmer_self": G["self_agreement_pairs"], "rules": {k: v["with_each_answer"] for k, v in B.items()},
                      "students": {k: {"each": v["agreement"]["with_each_answer"], "majority": v["agreement"]["with_majority"], "works": [v["works"]["precision"], v["works"]["recall"]], "threshold": v.get("threshold", {}).get("test")} for k, v in out["students"].items()}}, indent=1))

if __name__ == "__main__":
    main()
