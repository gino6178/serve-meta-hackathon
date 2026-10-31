"""Post-hoc temperature for the 1B's verdict at feed.standard and places.judge: its probability that a comment is
blocked (any label but "ok") and that a court is "good", read from Ollama's top-20 logprobs at the verdict's first
token, against the truth: Glimmer's verdict on the held-out set (distill/text_data.py) and the attack set's truth by
construction (distill/text_attacks.py). A scalar T is fitted on NLL (Guo et al. 2017) on half the items and ECE (10
bins) reported on the other half, before and after. The gateway does not read this confidence today; it is what a
"send the unsure ones to Glimmer" threshold would use.
   python3 distill/text_calib.py --test data/set/test.jsonl --attacks data/set/attacks_heldout.jsonl --model serve-1b-text --out calib.json
"""
import argparse, json, math, random, urllib.request
from concurrent.futures import ThreadPoolExecutor
from text_soft import soft_of

def ask(url, model, ex):
    body = {"model": model, "messages": ex["small_messages"], "stream": False, "think": False, "keep_alive": "24h", "format": ex["format"],
            "logprobs": True, "top_logprobs": 20, "options": {"num_predict": 100 if ex["site"] == "feed.standard" else 320, "temperature": 0}}
    r = urllib.request.urlopen(urllib.request.Request(f"{url}/api/chat", json.dumps(body).encode(), {"content-type": "application/json"}), timeout=120)
    return json.loads(r.read())

def ece(ps, ys, bins=10):
    e = 0.0
    for b in range(bins):
        idx = [i for i, p in enumerate(ps) if b / bins <= p < (b + 1) / bins or (b == bins - 1 and p == 1.0)]
        if idx: e += len(idx) / len(ps) * abs(sum(ys[i] for i in idx) / len(idx) - sum(ps[i] for i in idx) / len(idx))
    return round(e, 4)

def scaled(p, T):
    p = min(max(p, 1e-6), 1 - 1e-6); z = math.log(p / (1 - p)) / T
    return 1 / (1 + math.exp(-z))

def nll(ps, ys, T): return -sum(math.log(scaled(p, T)) if y else math.log(1 - scaled(p, T)) for p, y in zip(ps, ys)) / len(ps)

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--test", required=True); a.add_argument("--attacks", required=True); a.add_argument("--url", default="http://127.0.0.1:11460")
    a.add_argument("--model", required=True); a.add_argument("--out", required=True)
    args = a.parse_args()
    items = []
    for l in open(args.test):
        x = json.loads(l)
        if x["site"] in ("feed.standard", "places.judge"):
            v = json.loads(x["target"])["verdict"]; items.append((x, v != "ok" if x["site"] == "feed.standard" else v == "good"))
    for l in open(args.attacks):
        x = json.loads(l)
        items.append((x, x["bad"] == "ok" if x["site"] == "feed.standard" else False))  # hostile: should be blocked; the bad courts: not good
    def one(it):
        x, y = it
        try: s = soft_of(x["site"], ask(args.url, args.model, x))
        except Exception: s = None
        if not s: return None
        return x["site"], (1 - s["ok"]) if x["site"] == "feed.standard" else s["good"], y
    with ThreadPoolExecutor(4) as pool: got = [g for g in pool.map(one, items) if g]
    out = {"model": args.model}
    for site in ("feed.standard", "places.judge"):
        g = [(p, y) for s, p, y in got if s == site]; random.Random(0).shuffle(g)
        fit, ev = g[: len(g) // 2], g[len(g) // 2:]
        if not fit or not ev: continue
        T = min((t / 20 for t in range(4, 200)), key=lambda t: nll([p for p, _ in fit], [y for _, y in fit], t))
        ps, ys = [p for p, _ in ev], [y for _, y in ev]
        out[site] = {"what": "P(blocked)" if site == "feed.standard" else "P(good)", "n_fit": len(fit), "n_eval": len(ev), "T": T,
                     "ece_before": ece(ps, ys), "ece_after": ece([scaled(p, T) for p in ps], ys), "nll_before": round(nll(ps, ys, 1), 4), "nll_after": round(nll(ps, ys, T), 4)}
    json.dump(out, open(args.out, "w"), indent=1)
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main()
