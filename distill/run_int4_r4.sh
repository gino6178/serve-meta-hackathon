#!/usr/bin/env bash
# Round 4: each GGUF of an export (distill/export_r4.sh) on the CPU as the worker runs it, on val, test and the decider's
# cases (short prompts), for agreement and the pick against bf16; then latency on the first 100 test cases, one file at
# a time at 8 threads.
#   distill/run_int4_r4.sh <export name> [threads for the agreement runs, default 4]
#   QUANTS="Q4_K_M-noimat Q4_K_M Q5_K_M Q6_K" SETS="val test decider" by default
# (a file is written to a .part name and moved when complete, so an interrupted run is redone)
set -u
cd "$(dirname "$0")/.."
N="$1"; TH="${2:-4}"; E=$HOME/export/$N
mkdir -p jev/preds4
QUANTS=${QUANTS:-"Q4_K_M-noimat Q4_K_M Q5_K_M Q6_K"}; SETS=${SETS:-"val test decider"}
for q in $QUANTS; do
  for d in $SETS; do
    out=jev/preds4/${N}-${q}_${d}_short.jsonl
    [ -s "$out" ] || { python3 distill/eval_gguf.py --gguf $E/$N-$q.gguf --tokenizer ~/models/meta-1b --data jev/data/$d --out "$out.part" --threads $TH > /dev/null 2>&1 && mv "$out.part" "$out"; }
  done
done
[ "${LATENCY:-1}" = 1 ] && for q in $QUANTS; do
  out=jev/preds4/${N}-${q}_latency.jsonl
  [ -s "$out" ] || { python3 distill/eval_gguf.py --gguf $E/$N-$q.gguf --tokenizer ~/models/meta-1b --data jev/data/test --out "$out.part" --threads 8 --limit 100 > /dev/null 2>&1 && mv "$out.part" "$out"; }
done
echo "INT4_R4_DONE $N"
