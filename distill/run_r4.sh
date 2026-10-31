#!/usr/bin/env bash
# Round 4 of the 1B student (docs/decision_model.md): train one variant and score it in bf16 on val, test and the
# decider's cases, short prompts in the listed order and reversed (order sensitivity), on the A100 VM.
#   distill/run_r4.sh <name> [train.py options...]      e.g. distill/run_r4.sh 1b_r4_kl05_T2 --more all --kl_w 0.5 --T 2
#   distill/run_r4.sh <name> --score-only               (score an adapter already in jev/runs/<name>)
set -u
cd "$(dirname "$0")/.."
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
M1=${M1:-$HOME/models/meta-1b}   # meta-llama/Llama-3.2-1B-Instruct
TRAIN=jev/data/train,jev/data/trainshared,jev/data/asked
name=$1; shift
mkdir -p jev/runs jev/preds4
if [ "${1:-}" != "--score-only" ]; then
  [ -f jev/runs/$name/adapter_model.safetensors ] || python3 distill/train.py --base $M1 --train $TRAIN --out jev/runs/$name --bs 4 --accum 4 --order time "$@" > jev/runs/$name.log 2>&1
fi
for d in val test decider; do
  [ -f jev/preds4/${name}_${d}_short.jsonl ] || python3 distill/train.py --base $M1 --eval jev/runs/$name --test jev/data/$d --pred jev/preds4/${name}_${d}.jsonl --perms reverse >> jev/preds4/$name.scores 2>&1
done
echo "R4_DONE $name"
