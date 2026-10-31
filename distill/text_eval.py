"""A short-text model against Muse Glimmer on the held-out set (distill/text_data.py), per call site, asked the way
llm.js asks its small tier: Ollama's chat, the call's JSON Schema as `format`, no reasoning, the site's reply budget.
   python3 distill/text_eval.py --data data/set/test.jsonl --url http://127.0.0.1:11460 --model serve-1b-text --out preds.jsonl
Per site: the share of replies that parse (in the schema), agreement with Glimmer on the fields code acts on, and the
share that pass the checks the gateway applies before using a reply (the same checks run on Glimmer's own replies).
"""
import argparse, collections, json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

MAX = {"life.read": 220, "life.events": 200, "answer.learn": 120, "memory.update": 160, "loop.paraphrase": 120, "feed.standard": 100,
       "places.judge": 320, "body.summary": 160, "answer": 220}
MEMBERS = ["Hana", "Ravi", "Tomás", "Yuki", "Aisha", "Leo", "Noor", "Sam", "Ines", "Kenji", "Priya"]
nums = lambda t: re.findall(r"\d+(?:\.\d+)?", str(t))
norm = lambda t: re.sub(r"[^\w]+", " ", str(t).lower()).strip()
LINK = re.compile(r"https?:|www\.|\S+@\S+|\.(com|net|org|io|me|ly)\b", re.I)

def ask(url, model, ex):
    body = {"model": model, "messages": ex.get("small_messages") or ex["messages"], "stream": False, "think": False, "keep_alive": "24h",
            "options": {"num_predict": MAX[ex["site"]], "temperature": ex["options"].get("temperature", 0.4)}}
    if ex["format"]: body["format"] = ex["format"]
    r = urllib.request.urlopen(urllib.request.Request(f"{url}/api/chat", json.dumps(body).encode(), {"content-type": "application/json"}), timeout=120)
    return json.loads(r.read())["message"]["content"]

def parse(site, t):
    if site == "answer.learn":
        m = re.search(r"\[[\s\S]*\]", t or "")
        try: v = json.loads(m.group(0)) if m else None
        except Exception: v = None
        return v if isinstance(v, list) else None
    if site in ("answer", "body.summary"): return (t or "").strip() or None
    try: return json.loads(t)
    except Exception: return None

def facts_of(ex): return "\n".join(str(m["content"]) for m in ex["messages"])

def checks(site, v, ex):
    """Does the gateway's code use this reply (as far as it can be said outside it)?"""
    if v is None: return False
    f = facts_of(ex)
    if site == "places.judge":
        user = ex["messages"][-1]["content"]; ok = []
        for r in v.get("reasons", []):
            m = re.match(r"^review (\d)$", r.get("cite", ""), re.I)
            rev = re.search(rf"^Review {m.group(1)} \([^)]*\): (.*)$", user, re.M) if m else None
            if m and not rev: continue
            if r.get("quote") and not (rev and norm(r["quote"]) in norm(rev.group(1))): continue
            if r.get("cite") == "weather" and "Forecast at" not in user: continue
            if LINK.search(f"{r.get('text', '')} {r.get('quote', '')}"): continue
            if re.search(r"\b(he|she|him|his|her)\b", r.get("text", ""), re.I): continue
            if any(n not in nums(user) for n in nums(r.get("text", ""))): continue
            ok.append(r)
        return v.get("verdict") in ("good", "maybe", "no") and len(ok) > 0
    if site == "answer": return all(float(n) <= 10 or n in nums(f) for n in nums(re.sub(r"\[F\d+\]", "", v)))
    if site == "body.summary": return all(n in nums(f) for n in nums(v)) and not re.search(r"diagnos|tendinitis|fracture|tear|strain|sprain|ibuprofen", v, re.I)
    if site == "loop.paraphrase":
        if not v.get("request"): return True
        t = v.get("text", "")
        return 0 < len(t) <= 100 and not re.search(r"\d|https?:", t) and not any(m in t for m in MEMBERS)
    if site == "answer.learn": return all(isinstance(x, str) for x in v)
    return True

def fields(site, v):
    """The fields code acts on, for agreement with Glimmer."""
    if v is None: return None
    if site == "life.read":
        e = (v.get("events") or [{}])[0] if v.get("intent") == "event" else {}
        return {"intent": v.get("intent"), "n_events": len(v.get("events") or []) if v.get("intent") == "event" else 0, "date": e.get("date"), "start": e.get("start"), "kind": e.get("kind"),
                "log_minutes": (v.get("log") or {}).get("minutes") if v.get("intent") == "log" else None}
    if site == "life.events":
        e = v[0] if v else {}
        return {"n": len(v), "date": e.get("date"), "start": e.get("start")}
    if site == "memory.update": return {"op": v.get("op"), "replaces": sorted(v.get("replaces") or []), "rule": (v.get("rule") or {}).get("kind"), "who": (v.get("rule") or {}).get("who") or (v.get("rule") or {}).get("day"), "until": v.get("until")}
    if site == "feed.standard": return {"verdict": v.get("verdict"), "blocked": v.get("verdict") != "ok"}
    if site == "places.judge": return {"verdict": v.get("verdict")}
    if site == "loop.paraphrase": return {"request": v.get("request"), "area": v.get("area"), "aspect": v.get("aspect")}
    if site == "answer.learn": return {"any": len(v) > 0}
    return {}

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--data", required=True); a.add_argument("--url", default="http://127.0.0.1:11460"); a.add_argument("--model", default="serve-1b-text")
    a.add_argument("--out", required=True); a.add_argument("--conc", type=int, default=4); a.add_argument("--max_tokens", type=int, default=700)
    args = a.parse_args()
    rows = [json.loads(l) for l in open(args.data)]
    rows = [r for r in rows if r["tokens"] <= args.max_tokens]  # what the router would send to the 1B
    def one(ex):
        try: t = ask(args.url, args.model, ex)
        except Exception as e: t = None
        return ex, t
    with ThreadPoolExecutor(args.conc) as pool: done = list(pool.map(one, rows))
    per = collections.defaultdict(lambda: collections.defaultdict(list))
    with open(args.out, "w") as fh:
        for ex, t in done:
            s = ex["site"]; v, g = parse(s, t), parse(s, ex["target"])
            fv, fg = fields(s, v), fields(s, g)
            d = per[s]; d["parsed"].append(v is not None); d["checks"].append(checks(s, v, ex)); d["glimmer_checks"].append(checks(s, g, ex))
            for k in (fg or {}): d[f"agree.{k}"].append(fv is not None and fv.get(k) == fg.get(k))
            if s == "feed.standard" and fg: (d["caught"] if fg["blocked"] else d["passed_ok"]).append(bool(fv and fv["blocked"] == fg["blocked"]))
            if fg: d["agree.all"].append(fv == fg)
            fh.write(json.dumps({"site": s, "tag": ex["tag"], "source": ex["source"], "reply": t, "target": ex["target"]}, ensure_ascii=False) + "\n")
    out = {s: {"n": len(d["parsed"]), **{k: round(sum(x) / len(x), 3) for k, x in sorted(d.items()) if x}, **({"n_blocked_by_glimmer": len(d["caught"])} if d.get("caught") else {})} for s, d in sorted(per.items())}
    print(json.dumps(out, indent=1))
    json.dump(out, open(args.out.replace(".jsonl", ".summary.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
