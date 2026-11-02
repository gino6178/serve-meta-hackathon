"""Soft labels for the verdict at the classification-like sites (feed.standard, places.judge): Muse Glimmer is asked
each training call again, as the gateway asks it (its schema, reasoning at "low"), with Ollama's top-20 logprobs, and
the distribution over the verdict labels is read at the first token of the verdict's value in its reply. The target
stays the reply the code accepted; the distribution becomes the example's "soft" field, which distill/text_train.py
adds as a KL term at that position.
   python3 distill/text_soft.py --data data/set/train.jsonl --url http://127.0.0.1:11460 --out data/set/train_soft.jsonl
A label's probability is the sum over the top tokens that begin it (a token that begins two labels is split between them).
"""
import argparse, json, math, re, urllib.request
from concurrent.futures import ThreadPoolExecutor

LABELS = {"feed.standard": ["ok", "threat", "harassment", "sexual", "hate", "privacy", "spam"], "places.judge": ["good", "maybe", "no"],
          "a2a.answer": ["accept", "counter", "decline"]}
KEY = {"feed.standard": "verdict", "places.judge": "verdict", "a2a.answer": "intent"}

def ask(url, ex):
    body = {"model": "muse-glimmer", "messages": ex["messages"], "stream": False, "think": "low", "keep_alive": "24h", "format": ex["format"],
            "logprobs": True, "top_logprobs": 20, "options": ex["options"]}
    r = urllib.request.urlopen(urllib.request.Request(f"{url}/api/chat", json.dumps(body).encode(), {"content-type": "application/json"}), timeout=300)
    return json.loads(r.read())

def raw_prompt(messages):
    """The turns as Ollama's glimmer renderer writes them for its llama-server (read off the wire), reasoning off, up to
    the assistant's header: its "to=user" is what a call with a schema skips (the grammar forces "{" at once, where the
    model would write the header), which leaves the label's distribution at a place the model never answers from."""
    s = ""
    for m in messages:
        if m["role"] == "system": s += f'<|start|>system<|message|>{m["content"]}\n\nReasoning strength: none.\n\n# Valid recipients: "self", "user".<|eot|>'
        elif m["role"] == "assistant": s += f'<|start|>assistant to=user<|message|>{m["content"]}<|eot|>'
        else: s += f'<|start|>user<|message|>{m["content"]}<|eot|>'
    return s + "<|start|>assistant to=user<|message|>"

def ask_raw(url, ex):
    """Glimmer's distribution at the label, after its own accepted reply up to the label (the target's prefix), unconstrained."""
    key = f'"{KEY[ex["site"]]}": "'; k = ex["target"].find(key)
    if k < 0: return None
    body = {"model": "muse-glimmer", "prompt": raw_prompt(ex["messages"]) + ex["target"][:k + len(key)], "raw": True, "stream": False, "keep_alive": "24h",
            "logprobs": True, "top_logprobs": 20, "options": {"temperature": 0, "num_predict": 1}}
    r = urllib.request.urlopen(urllib.request.Request(f"{url}/api/generate", json.dumps(body).encode(), {"content-type": "application/json"}), timeout=300)
    lps = json.loads(r.read()).get("logprobs") or []
    if not lps: return None
    mass = {l: 0.0 for l in LABELS[ex["site"]]}
    for alt in lps[0]["top_logprobs"]:
        s = alt["token"].lstrip(' "'); hits = [l for l in LABELS[ex["site"]] if s and l.startswith(s)]
        for l in hits: mass[l] += math.exp(alt["logprob"]) / len(hits)
    z = sum(mass.values())
    return {l: round(v / z, 5) for l, v in mass.items()} if z > 0 else None

def soft_of(site, j):
    content, lps = j["message"]["content"], j.get("logprobs") or []
    toks = [x["token"] for x in lps]
    text = "".join(toks)
    i = text.rfind(content) if content and text.rfind(content) >= 0 else len(text) - len(content)  # the reply is at the end, after the reasoning
    m = re.search(rf'"{KEY[site]}"\s*:\s*"', content)
    if not m or i < 0: return None
    at, pos = i + m.end(), 0
    for k, t in enumerate(toks):
        if pos <= at < pos + len(t) or (pos >= at and t):
            mass = {l: 0.0 for l in LABELS[site]}
            for alt in lps[k]["top_logprobs"]:
                s = alt["token"][max(0, at - pos):] if alt["token"] == t else alt["token"].lstrip(' "')
                hits = [l for l in LABELS[site] if s and l.startswith(s)]
                for l in hits: mass[l] += math.exp(alt["logprob"]) / len(hits)
            z = sum(mass.values())
            return {l: round(v / z, 5) for l, v in mass.items()} if z > 0 else None
        pos += len(t)
    return None

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--data", required=True); a.add_argument("--url", default="http://127.0.0.1:11460"); a.add_argument("--out", required=True); a.add_argument("--conc", type=int, default=4)
    a.add_argument("--raw", action="store_true", help="read the label's distribution with the renderer's own turns (ask_raw), not through a chat call with a schema")
    args = a.parse_args()
    rows = [json.loads(l) for l in open(args.data)]
    def one(ex):
        if ex["site"] not in LABELS: return ex
        try:
            if args.raw:
                s = ask_raw(args.url, ex); want = json.loads(ex["target"]).get(KEY[ex["site"]])
                return {**ex, "soft": s, "soft_agrees": max(s, key=s.get) == want} if s else ex
            j = ask(args.url, ex); v = json.loads(j["message"]["content"]); s = soft_of(ex["site"], j)
            if s: return {**ex, "soft": s, "soft_agrees": v.get(KEY[ex["site"]]) == json.loads(ex["target"]).get(KEY[ex["site"]])}
        except Exception as e:
            pass
        return ex
    with ThreadPoolExecutor(args.conc) as pool: out = list(pool.map(one, rows))
    with open(args.out, "w") as fh:
        for x in out: fh.write(json.dumps(x, ensure_ascii=False) + "\n")
    n = [x for x in out if "soft" in x]
    print(f"{sum(x['soft_agrees'] for x in n)} agree with the target verdict;", end=" ")
    print(f"{len(n)} soft labels of {sum(x['site'] in LABELS for x in out)}; mean top probability {sum(max(x['soft'].values()) for x in n) / max(1, len(n)):.3f}")

if __name__ == "__main__":
    main()
