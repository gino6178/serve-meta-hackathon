#!/usr/bin/env bash
# The students on every training set (train, trainshared, asked), on the A100 VM:
#   3b_v2       Llama 3.2 3B Instruct, LoRA r16, choice distillation + works, 3 epochs
#   1b_v2       Llama 3.2 1B Instruct, the same
#   3b_v2_jepa  3B with the LLM-JEPA term (lambda 1, one predictor token)
# Each is scored in bf16 on every held-out set whose teacher run has finished, short and full prompts.
set -u
cd "$(dirname "$0")/.."
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
M3=$HOME/models/meta-3b; M1=$HOME/models/meta-1b   # meta-llama/Llama-3.2-{3B,1B}-Instruct
TRAIN=jev/data/train,jev/data/trainshared,jev/data/asked
mkdir -p jev/runs jev/preds
train() { name=$1; shift; [ -f jev/runs/$name/adapter_model.safetensors ] || python3 distill/train.py --train $TRAIN --out jev/runs/$name --bs 4 --accum 4 "$@" > jev/runs/$name.log 2>&1; }
score() { name=$1; base=$2; for d in decider test shared val demo varied; do
  grep -q TEACHER_DONE jev/data/$d.log 2>/dev/null && [ ! -f jev/preds/${name}_${d}_short.jsonl ] && python3 distill/train.py --base $base --eval jev/runs/$name --test jev/data/$d --pred jev/preds/${name}_${d}.jsonl >> jev/preds/$name.scores 2>&1; done; }
train 3b_v2 --base $M3
score 3b_v2 $M3
train 1b_v2 --base $M1
score 1b_v2 $M1
train 3b_v2_jepa --base $M3 --jepa 1.0 --k 1
score 3b_v2_jepa $M3
score 3b_v2 $M3; score 1b_v2 $M1
echo TRAIN2_ALL_DONE
