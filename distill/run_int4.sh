#!/usr/bin/env bash
# int4 against bf16 (on the VM's CPU, 8 threads): each exported GGUF on the held-out sets, short prompts, as the worker
# runs it. For accuracy only; latency is measured on the GPU server's CPU.
#   distill/run_int4.sh <export name> <order: time|listed> [sets, default "test decider shared"]
set -u
cd "$(dirname "$0")/.."
N="$1"; O="$2"; SETS="${3:-test decider shared}"
for q in Q4_0 Q4_K_M; do for d in $SETS; do
  out=jev/preds/${N}-${q}_${d}_cpu.jsonl
  [ -f "$out" ] && grep -q . "$out" && [ "$(wc -l < "$out")" -ge "$(python3 -c "import json; print(sum(1 for _ in open('jev/data/$d/cases.jsonl')) - 30)")" ] && continue
  nice -n 5 python3 distill/eval_gguf.py --gguf ~/export/$N/$N-$q.gguf --tokenizer ~/models/meta-3b --data jev/data/$d --out "$out" --threads 8 --order "$O" > /dev/null 2>&1
done; done
echo "INT4_DONE $N"
