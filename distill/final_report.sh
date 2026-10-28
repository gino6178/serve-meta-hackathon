#!/usr/bin/env bash
# Every number in docs/decision_model.md, from the raw predictions and teacher answers (on the VM, where they are):
# writes ~/serve/jev/results/*.json, which are copied to submission/results/decision_model/.
#   distill/final_report.sh <student> [<student> ...]     e.g. 3b_v3 1b_v3 3b_v3_jepa 3b_v2 1b_v2
set -u
cd "$(dirname "$0")/.."
R=jev/results; mkdir -p $R
S="$*"
# Glimmer itself, the fixed rules and every student, per held-out set (the threshold set on the validation club)
for d in test shared val demo varied; do
  args=""
  for s in $S; do
    [ -f jev/preds/${s}_${d}_short.jsonl ] || continue
    v=""; [ -f jev/preds/${s}_val_short.jsonl ] && [ "$d" != val ] && v=",jev/preds/${s}_val_short.jsonl"
    args="$args --pred $s=jev/preds/${s}_${d}_short.jsonl$v --pred ${s}_full=jev/preds/${s}_${d}_full.jsonl"
  done
  python3 distill/report.py --data jev/data/$d --val-data jev/data/val $args --out $R/heldout_$d.json > /dev/null
done
# the one-pass decider's 196 cases, against its full and full2
args=""; for s in $S; do [ -f jev/preds/${s}_decider_short.jsonl ] && args="$args $s=jev/preds/${s}_decider_short.jsonl"; done
python3 distill/decider_compare.py jev/data/decider $args --out $R/decider_cases.json > /dev/null
# int4 against bf16, on the VM's CPU
python3 - $S <<'EOF'
import json, os, sys, glob, collections
out = {}
for f in sorted(glob.glob("jev/preds/serve-jev-*_cpu.jsonl")):
    name = os.path.basename(f)[:-len("_cpu.jsonl")]           # serve-jev-3b-v3-Q4_0_test
    model, d = name.rsplit("_", 1)
    stu = {"serve-jev-3b-v2": "3b_v2", "serve-jev-1b-v2": "1b_v2", "serve-jev-3b-v3": "3b_v3", "serve-jev-1b-v3": "1b_v3"}.get(model.rsplit("-", 1)[0].replace("-Q4_K", ""), None)
    q = model.split("-")[-1] if not model.endswith("K_M") else "Q4_K_M"
    base = model.replace("-Q4_K_M", "").replace("-Q4_0", "")
    stu = {"serve-jev-3b-v2": "3b_v2", "serve-jev-1b-v2": "1b_v2", "serve-jev-3b-v3": "3b_v3", "serve-jev-1b-v3": "1b_v3"}.get(base)
    bf = f"jev/preds/{stu}_{d}_short.jsonl"
    A = {json.loads(l)["id"]: json.loads(l) for l in open(f)}
    if not A or not os.path.exists(bf): continue
    B = {json.loads(l)["id"]: json.loads(l) for l in open(bf)}
    pick = lambda r: max(r["probs"], key=r["probs"].get)
    same = sum(pick(A[i]) == pick(B[i]) for i in A if i in B)
    ms = sorted(r["ms"] for r in A.values())
    out[f"{base} {q} {d}"] = {"cases": len(A), "same_pick_as_bf16": same, "ms_p50_vm_cpu_8_threads": ms[len(ms) // 2], "tokens_p50": sorted(r["tokens"] for r in A.values())[len(A) // 2]}
json.dump(out, open("jev/results/int4.json", "w"), indent=1)
EOF
# the int4 files' agreement with Glimmer, as for bf16
for f in jev/preds/serve-jev-*_cpu.jsonl; do
  b=$(basename $f _cpu.jsonl); d=${b##*_}; [ "$d" = decider ] && continue
  python3 distill/report.py --data jev/data/$d --pred int4=$f --out $R/int4_${b}.json > /dev/null
done
args=""; for f in jev/preds/serve-jev-*_decider_cpu.jsonl; do b=$(basename $f _decider_cpu.jsonl); args="$args $b=$f"; done
[ -n "$args" ] && python3 distill/decider_compare.py jev/data/decider $args --out $R/int4_decider_cases.json > /dev/null
# the teacher sets: what each holds
python3 - <<'EOF'
import json, collections
out = {}
for d in ("train", "trainshared", "asked", "test", "shared", "val", "demo", "varied", "decider"):
    try: cs = [json.loads(l) for l in open(f"jev/data/{d}/cases.jsonl")]; rows = [json.loads(l) for l in open(f"jev/data/{d}/teacher.jsonl")]
    except FileNotFoundError: continue
    ok = [r for r in rows if (r["decision"] or {}).get("intent") not in (None, "none")]
    out[d] = {"cases": len(cs), "members": len({c["member"]["id"] for c in cs}), "glimmer_answers": len(ok), "asked": len(rows), "private_calendars": sum(bool(c.get("private")) for c in cs),
              "doubles": sum(c["format"] == "doubles" for c in cs), "reworded_habits": sum(bool(c["member"].get("varied")) for c in cs), "intents": dict(collections.Counter((r["decision"] or {}).get("intent") for r in rows)),
              "times_that_work_p50": sorted(len(c["works"]) for c in cs)[len(cs) // 2], "listed_p50": sorted(len(c["offers"]) for c in cs)[len(cs) // 2],
              "why_the_proposed_time_fails": dict(collections.Counter(" ".join(c["curBad"].split(" ")[:2]) for c in cs).most_common(6))}
json.dump(out, open("jev/results/teacher_sets.json", "w"), indent=1)
EOF
# training logs
for s in $S; do [ -f jev/runs/$s/log.jsonl ] && cp jev/runs/$s/log.jsonl $R/train_log_$s.jsonl; [ -f jev/runs/$s/args.json ] && cp jev/runs/$s/args.json $R/train_args_$s.json; done
cp jev/data/test/teacher.jsonl $R/test_glimmer_answers.jsonl
for s in $S; do for d in test decider; do [ -f jev/preds/${s}_${d}_short.jsonl ] && cp jev/preds/${s}_${d}_short.jsonl $R/preds_${s}_${d}.jsonl; done; done
ls -la $R
echo REPORT_DONE
