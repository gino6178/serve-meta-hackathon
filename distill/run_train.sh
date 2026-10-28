#!/usr/bin/env bash
# Train and score the students (on the A100 VM), once the teacher's training answers are in (train and trainshared):
#   3b_sft   Llama 3.2 3B Instruct, LoRA r16, choice distillation + works (code truth), 3 epochs
#   1b_sft   Llama 3.2 1B Instruct, the same (a faster student for the CPU)
#   3b_jepa  3B with the LLM-JEPA term added (lambda 1, one predictor token)
# Each is scored in bf16 on every held-out set that is there (test, val, demo, varied), short and full prompts.
set -u
cd "$(dirname "$0")/.."
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
M3=$HOME/models/meta-3b; M1=$HOME/models/meta-1b   # meta-llama/Llama-3.2-{3B,1B}-Instruct
mkdir -p jev/runs jev/preds
train() { name=$1; shift; [ -f jev/runs/$name/adapter_model.safetensors ] || python3 distill/train.py --train jev/data/train,jev/data/trainshared --out jev/runs/$name --bs 4 --accum 4 "$@" > jev/runs/$name.log 2>&1; }
score() { name=$1; base=$2; for d in test shared val demo varied; do
  grep -q TEACHER_DONE jev/data/$d.log 2>/dev/null && [ ! -f jev/preds/${name}_${d}_short.jsonl ] && python3 distill/train.py --base $base --eval jev/runs/$name --test jev/data/$d --pred jev/preds/${name}_${d}.jsonl >> jev/preds/$name.scores 2>&1; done; }
train 3b_sft --base $M3
score 3b_sft $M3
train 1b_sft --base $M1
score 1b_sft $M1
train 3b_jepa --base $M3 --jepa 1.0 --k 1
score 3b_jepa $M3
# the held-out sets whose teacher run finished after a student was scored
score 3b_sft $M3; score 1b_sft $M1
echo TRAIN_ALL_DONE
