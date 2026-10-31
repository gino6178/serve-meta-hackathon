"""submission/results/text1b.json from a short-text run (distill/run_text1b.sh): the set, the held-out comparison per
site (the new 1B and the old serve-1b against Muse Glimmer), and each e2e / red-team run with the sites it widened,
its failures, and how many calls each site sent to the 1B (from the run's ledger).
   python3 distill/text_results.py --exp ~/serve-exp-text1b --run text1b_v1 --checks wide-text1b_v1,... --out text1b.json
"""
import argparse, collections, glob, json, os, re

def lines(f, rx):
    return [l.strip() for l in open(f, errors="replace") if re.search(rx, l)] if os.path.exists(f) else None

def ledger_tiers(files):
    t = collections.defaultdict(collections.Counter)
    for f in files:
        if not os.path.exists(f): continue
        for l in open(f):
            try: r = json.loads(l)
            except Exception: continue
            t[r.get("site", "?")][r.get("tier") or "local"] += 1
    return {s: dict(c) for s, c in sorted(t.items()) if "small" in c}

def check_run(d):
    env = open(f"{d}/env.txt").read().split("\n")[0] if os.path.exists(f"{d}/env.txt") else ""
    out = {"env": env}
    for name, f, total in (("e2e", "e2e.log", None), ("feed_redteam", "feed_redteam.log", None), ("redteam", "redteam.log", r"(\d+) of (\d+) attacks stopped")):
        p = f"{d}/{f}"
        if not os.path.exists(p): continue
        fails = lines(p, r"^\s*FAIL\b") or []; passes = lines(p, r"^\s*PASS\b") or []
        out[name] = {"passed": len(passes), "failed": len(fails), "failures": fails, "all_passed": bool(lines(p, r"ALL PASSED")), "exit": (lines(p, r"_EXIT \d+") or ["?"])[-1]}
        if name == "e2e": out[name]["errors"] = lines(p, r"^ERROR")
    out["small_calls"] = ledger_tiers([f"{d}/e2e_ledger.jsonl", f"{d}/ledger.jsonl"])
    return out

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--exp", required=True); a.add_argument("--run", required=True); a.add_argument("--checks", default=""); a.add_argument("--out", required=True)
    a.add_argument("--note", default="")
    args = a.parse_args(); E = os.path.expanduser(args.exp)
    res = {"what": "Llama 3.2 1B Instruct, LoRA-distilled from Muse Glimmer's short answers at the gateway's call sites (distill/text_*.py, text_*.mjs)",
           "set": json.load(open(f"{E}/data/set/summary.json")),
           "train": json.load(open(f"{E}/runs/{args.run}/args.json")),
           "heldout": {"serve-1b-text": json.load(open(f"{E}/results/heldout_{args.run}.summary.json")), "serve-1b (old)": json.load(open(f"{E}/results/heldout_serve-1b.summary.json"))},
           "checks": {c: check_run(f"{E}/checks/{c}") for c in args.checks.split(",") if c}}
    if args.note: res["note"] = args.note
    json.dump(res, open(args.out, "w"), indent=1, ensure_ascii=False)
    print(json.dumps(res["checks"], indent=1)[:4000])

if __name__ == "__main__":
    main()
