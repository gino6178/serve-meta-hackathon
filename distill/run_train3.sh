#!/usr/bin/env bash
# The students with the options' letters in time order (B the soonest time that works), on every training set, on
# the A100 VM, after 1b_v2 (the proposer's order) has finished:
#   3b_v3       Llama 3.2 3B Instruct, LoRA r16, choice distillation + works, 3 epochs
#   3b_v3_jepa  the same with the LLM-JEPA term (lambda 1, one predictor token)
#   1b_v3       Llama 3.2 1B Instruct, as 3b_v3
# Each is scored in bf16 on every held-out set whose teacher run has finished, short and full prompts.
set -u
cd "$(dirname "$0")/.."
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
M3=$HOME/models/meta-3b; M1=$HOME/models/meta-1b   # meta-llama/Llama-3.2-{3B,1B}-Instruct
TRAIN=jev/data/train,jev/data/trainshared,jev/data/asked
mkdir -p jev/runs jev/preds
while pgrep -f "distill/train.py --train .* --out jev/runs/1b_v[2] " > /dev/null; do sleep 30; done
train() { name=$1; shift; [ -f jev/runs/$name/adapter_model.safetensors ] || python3 distill/train.py --train $TRAIN --out jev/runs/$name --bs 4 --accum 4 --order time "$@" > jev/runs/$name.log 2>&1; }
score() { name=$1; base=$2; for d in decider test shared val demo varied; do
  grep -q TEACHER_DONE jev/data/$d.log 2>/dev/null && [ ! -f jev/preds/${name}_${d}_short.jsonl ] && python3 distill/train.py --base $base --eval jev/runs/$name --test jev/data/$d --pred jev/preds/${name}_${d}.jsonl >> jev/preds/$name.scores 2>&1; done; }
score 1b_v2 $M1; score 3b_v2 $M3
train 3b_v3 --base $M3
score 3b_v3 $M3
train 3b_v3_jepa --base $M3 --jepa 1.0 --k 1
score 3b_v3_jepa $M3
train 1b_v3 --base $M1
score 1b_v3 $M1
# the held-out sets whose teacher run finished after a student was scored
for n in 3b_v2 3b_v3 3b_v3_jepa; do score $n $M3; done; for n in 1b_v2 1b_v3; do score $n $M1; done
echo TRAIN3_ALL_DONE
