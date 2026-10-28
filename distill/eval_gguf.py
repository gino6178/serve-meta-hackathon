"""Score the int4 GGUF on held-out cases on the CPU, as the worker runs it (one request at a time), with the latency of
each forward pass.
   python distill/eval_gguf.py --gguf m.gguf --tokenizer dir --data jev/data/test --out preds.jsonl [--threads 16] [--full]
"""
import argparse, collections, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import from_case, label_of
from worker import Model, Tok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gguf", required=True); ap.add_argument("--tokenizer", required=True); ap.add_argument("--data", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--threads", type=int, default=8); ap.add_argument("--full", action="store_true"); ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--order", default="time", choices=["time", "listed"])
    a = ap.parse_args()
    cases = {c["id"]: c for c in map(json.loads, open(f"{a.data}/cases.jsonl"))}
    lab = collections.defaultdict(collections.Counter)
    for r in map(json.loads, open(f"{a.data}/teacher.jsonl")):
        y = label_of(cases[r["id"]], r["decision"])
        if y is not None: lab[r["id"]][y] += 1
    ids = [i for i in cases if cases[i]["kind"] == "judge" and lab[i]]
    if a.limit: ids = ids[:a.limit]
    M = Model(a.gguf, Tok(a.tokenizer), a.threads, order=a.order)
    M.decide({**from_case(cases[ids[0]]), "short": not a.full})  # load and warm up
    with open(a.out, "w") as f:
        for i in ids:
            c = cases[i]; t0 = time.time()
            r = M.decide({**from_case(c), "short": not a.full})
            probs = {("decline" if o["kind"] == "decline" else o["id"]): o["p"] for o in r["options"]}
            f.write(json.dumps({"id": i, "probs": probs, "works_p": r["works_p"], "works": c["works"], "glimmer": dict(lab[i]), "ms": r["ms"], "wall_ms": round((time.time() - t0) * 1000, 1), "tokens": r["tokens"]}) + "\n"); f.flush()
    print("EVAL_DONE", len(ids))

if __name__ == "__main__":
    main()
