"""A certificate for letting the text 1B pass comments alone at feed.standard (Learn then Test, Angelopoulos et al. 2021):
the 1B passes a comment by itself only when its probability of "ok" (Ollama's top-20 logprobs at the verdict's first
token, as distill/text_calib.py reads it) is at least λ; anything below goes to Glimmer. The risk is the share of
hostile comments the 1B passes alone. The truth is by construction, not Glimmer's word: the attack set's hostile
comments, plain and attacked (distill/text_attacks.py, bad == "ok"), are hostile; its fine ones and the held-out
comments of the "fine" families (distill/text_inputs*.mjs) are not. Calibration and test are disjoint halves.
λ is chosen on the calibration half by fixed-sequence testing from the strictest λ down: at each λ, H0 "risk > α" is
rejected when the exact binomial p-value P(Bin(n, α) <= misses) is at most δ, and the last λ rejected is kept. With
probability at least 1 - δ the 1B's own misses are at most α. The test half then reports the misses it makes, with a
Clopper-Pearson 95% upper bound, and how many comments the 1B decides without Glimmer.
   python3 distill/text_cert.py --test data/set/test.jsonl --attacks data/set/attacks_heldout.jsonl --model serve-1b-text --out cert.json
"""
import argparse, hashlib, json, math, urllib.request
from concurrent.futures import ThreadPoolExecutor
from text_soft import soft_of
from text_calib import ask

FINE = {"fine", "zh_fine"}

def binom_cdf(k, n, p):
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k + 1))

def cp_upper(k, n, conf=0.95):
    """Clopper-Pearson upper bound: the p at which P(Bin(n, p) <= k) = 1 - conf (by bisection)."""
    if k >= n: return 1.0
    lo, hi = k / n, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if binom_cdf(k, n, mid) > 1 - conf: lo = mid
        else: hi = mid
    return round(hi, 4)

def half(source): return int(hashlib.sha1(source.encode()).hexdigest(), 16) % 2

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--test", required=True); a.add_argument("--attacks", required=True); a.add_argument("--url", default="http://127.0.0.1:11460")
    a.add_argument("--model", required=True); a.add_argument("--out", required=True)
    a.add_argument("--alpha", default="0.02,0.05,0.1,0.2"); a.add_argument("--delta", type=float, default=0.1)
    args = a.parse_args()
    # the held-out fine comments, and the attack set (its "hostile" items are the held-out hostile comments, each also
    # attacked; an item and its attacked copy are written one after the other and stay in the same half)
    items = []
    for l in open(args.test):
        x = json.loads(l)
        if x["site"] == "feed.standard" and x["source"].split(":")[1] in FINE: items.append((x, False, x["source"]))
    std = [json.loads(l) for l in open(args.attacks)]
    for i, x in enumerate(y for y in std if y["site"] == "feed.standard"): items.append((x, x["bad"] == "ok", f"attack:{i // 2}"))
    def one(it):
        x, y, src = it
        try: s = soft_of("feed.standard", ask(args.url, args.model, x))
        except Exception: s = None
        return (s["ok"] if s else 0.0, y, half(src))  # an unreadable reply never passes alone (it goes to Glimmer)
    with ThreadPoolExecutor(4) as pool: got = list(pool.map(one, items))
    cal = [(q, y) for q, y, h in got if h == 0]; tst = [(q, y) for q, y, h in got if h == 1]

    grid = [1 - 10 ** (-e / 4) for e in range(24, 0, -1)] + [0.4 - i / 20 for i in range(0, 8)]  # 0.999999 down to 0.05
    hostile = [q for q, y in cal if y]; th = [q for q, y in tst if y]; tf = [q for q, y in tst if not y]
    out = {"model": args.model, "delta": args.delta, "calibration": {"hostile": len(hostile), "fine": sum(not y for _, y in cal)},
           "test_size": {"hostile": len(th), "fine": len(tf)}, "levels": [], "smallest_alpha": None}
    for alpha in map(float, args.alpha.split(",")):
        lam, path = None, []
        for g in grid:
            k = sum(q >= g for q in hostile); p = binom_cdf(k, len(hostile), alpha)
            path.append({"lambda": round(g, 6), "misses": k, "p": round(p, 5)})
            if p > args.delta: break
            lam = g
        lv = {"alpha": alpha, "lambda": lam, "path": path}
        if lam is not None:
            k = sum(q >= lam for q in th)
            lv["test"] = {"misses": k, "miss_rate": round(k / max(1, len(th)), 4), "miss_upper95": cp_upper(k, len(th)),
                          "fine_passed_alone": round(sum(q >= lam for q in tf) / max(1, len(tf)), 4), "decided_alone": round(sum(q >= lam for q, _ in tst) / max(1, len(tst)), 4)}
            if out["smallest_alpha"] is None: out["smallest_alpha"] = alpha
        out["levels"].append(lv)
    json.dump(out, open(args.out, "w"), indent=1)
    print(json.dumps({**out, "levels": [{k: v for k, v in l.items() if k != "path"} for l in out["levels"]]}, indent=1))

if __name__ == "__main__":
    main()
