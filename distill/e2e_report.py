"""The end-to-end evals with the student tier off and on (distill/run_e2e.sh), side by side.
   python3 distill/e2e_report.py <agent data dir> <out.json> <off label> <on label> [more labels]
From each run: the eval's own summary (autopilot_eval: weeks that reached the goal and passed their oracle; persona_eval:
rules kept, moved to a time that keeps them; private_eval: agreed where a time existed, rules kept), and from its token
ledger the member decisions: how many went to Muse Glimmer (site a2a.answer) and what they cost, and how many the
student answered (site a2a.student), with its time.
"""
import json, os, sys

def pct(xs, q):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else None

def ledger(path):
    rows = [json.loads(l) for l in open(path)] if os.path.exists(path) else []
    calls = [r for r in rows if not r.get("marker")]
    g = [r for r in calls if r.get("site") == "a2a.answer"]
    s = [r for r in rows if r.get("site") == "a2a.student"]
    ok = [r for r in s if not r.get("error")]
    glim = [r for r in calls if r.get("site") != "a2a.student"]  # every other row is a Muse Glimmer call
    tok = lambda xs, k: sum(r.get(k, 0) for r in xs)
    return {"glimmer_calls_all_sites": len(glim), "glimmer_tokens_all_sites": {"prompt": tok(glim, "prompt"), "output": tok(glim, "output"), "reasoning": tok(glim, "reasoning")},
            "member_answers_by_glimmer": len(g), "member_answer_tokens": {"prompt": tok(g, "prompt"), "output": tok(g, "output"), "reasoning": tok(g, "reasoning")},
            "member_answer_seconds_p50": pct([r["seconds"] for r in g], .5), "member_answer_seconds_p95": pct([r["seconds"] for r in g], .95),
            "student_asked": len(s), "student_answered": sum(1 for r in s if r.get("used")), "student_errors": len(s) - len(ok),
            "student_worker_ms_p50": pct([r.get("workerMs") or 0 for r in ok], .5), "student_worker_ms_p95": pct([r.get("workerMs") or 0 for r in ok], .95),
            "student_wall_s_p50": pct([r["seconds"] for r in ok], .5), "student_wall_s_p95": pct([r["seconds"] for r in ok], .95), "student_prompt_tokens": tok(ok, "prompt")}

def main():
    d, out, *labels = sys.argv[1:]
    res = {}
    for L in labels:
        r = {}
        a = f"{d}/autopilot_eval_{L}_summary.json"
        if os.path.exists(a):
            rows = json.load(open(f"{d}/autopilot_eval_{L}.json"))
            r["autopilot"] = json.load(open(a)) | {"weeks": [{k: x.get(k) for k in ("scenario", "success", "oracle", "seconds", "modelCalls", "games")} for x in rows], "ledger": ledger(f"{d}/eval-ledger-{L}.jsonl")}
        p = f"{d}/persona_eval_{L}.json"
        if os.path.exists(p):
            pe = json.load(open(p)); s = pe["arms"]["code"]["summary"]
            r["persona"] = {k: s[k] for k in ("members", "agreed", "broke", "movedToAKeptTime", "keepable", "seconds", "sets")} | {"ledger": ledger(f"{d}/persona-ledger-{L}.jsonl")}
            r["persona"]["said"] = {t: sum(1 for x in pe["arms"]["code"]["rows"] for y in x["said"] if y.endswith(":" + t)) for t in ("rules", "agent", "student")}
        q = f"{d}/private_eval_{L}.json"
        if os.path.exists(q):
            pv = json.load(open(q))
            r["private"] = {m: {k: a["summary"].get(k) for k in ("talks", "possible", "agreedWhenPossible", "agreedWhenNot", "broke", "meanRounds", "seconds")} for m, a in pv["arms"].items()} | {"ledger": ledger(f"{d}/private-ledger-{L}.jsonl")}
        res[L] = r
    # the same talks in two runs: did they end at the same time? (the first label is the reference)
    ref = labels[0]
    for kind, f, key in (("persona", "persona_eval_{}.json", "member"),):
        pr = f"{d}/{f.format(ref)}"
        if not os.path.exists(pr): continue
        A = {x[key]: x["agreed"] for x in json.load(open(pr))["arms"]["code"]["rows"]}
        for L in labels[1:]:
            p = f"{d}/{f.format(L)}"
            if not os.path.exists(p): continue
            B = {x[key]: x["agreed"] for x in json.load(open(p))["arms"]["code"]["rows"]}
            both = [m for m in A if m in B]
            res[L].setdefault(kind, {})["same_outcome_as_" + ref] = {"talks": len(both), "same": sum(A[m] == B[m] for m in both)}
    json.dump(res, open(out, "w"), indent=1)
    for L, r in res.items():
        for k, v in r.items():
            lg = v.get("ledger", {})
            head = {"autopilot": lambda v: f"{v['ok']}/{v['runs']} weeks ok, {v['seconds']} s mean", "persona": lambda v: f"{v['agreed']}/{v['members']} agreed, broke {v['broke']}, moved {v['movedToAKeptTime']}/{v['keepable']}, {v['seconds']} s",
                    "private": lambda v: " ; ".join(f"{m}: {a['agreedWhenPossible']}/{a['possible']} agreed, broke {a['broke']}, {a['seconds']} s" for m, a in v.items() if m not in ("ledger",))}[k](v)
            print(L, k + ":", head, "| Glimmer calls", lg.get("glimmer_calls_all_sites"), "member answers", lg.get("member_answers_by_glimmer"), "| student", lg.get("student_answered"), "of", lg.get("student_asked"), "asked, worker ms p50", lg.get("student_worker_ms_p50"))

if __name__ == "__main__":
    main()
