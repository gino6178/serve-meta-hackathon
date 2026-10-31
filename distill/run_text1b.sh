#!/usr/bin/env bash
# The short-text 1B on our server, once the VM has trained it (distill/text_train.py, then distill/text_dpo.py) and the
# adapters are in runs/sft and runs/dpo: GGUFs (SFT alone Q4_K_M; SFT+DPO Q4_K_M and Q5_K_M, each plain and with an
# importance matrix from real Serve prompts), each on the experiment Ollama (port 11460, never the live one), the
# held-out comparison against Glimmer, the held-out attack set, the verdict's temperature; then the e2e test and both
# red teams with the chosen GGUF and every short site on the 1B.
#   EXP=~/serve-exp-text1b distill/run_text1b.sh
set -u
EXP="${EXP:-$HOME/serve-exp-text1b}"; cd "$EXP"
PY=venv/bin/python; OLL="$HOME/shuttlecoach/ollama/bin/ollama"; D=repo/distill; B=base/Llama-3.2-1B-Instruct
mkdir -p results export
export PY LLAMA_CPP=llama.cpp
[ -f export/sft/text-Q4_K_M.gguf ] || $D/text_export.sh runs/sft $B export/sft text > export/sft.log 2>&1
[ -f export/dpo/text-imat-Q4_K_M.gguf ] || $D/text_export.sh runs/sft $B export/dpo text runs/dpo data/calib.txt > export/dpo.log 2>&1
for v in sft:sft/text-Q4_K_M dpo-q4:dpo/text-Q4_K_M dpo-q4i:dpo/text-imat-Q4_K_M dpo-q5:dpo/text-Q5_K_M dpo-q5i:dpo/text-imat-Q5_K_M; do
  name=text-${v%%:*}; f=$EXP/export/${v#*:}.gguf
  sed "s#/home/gino/serve/models/serve-1b-text-Q4_K_M.gguf#$f#" $D/Modelfile.serve-1b-text > export/Modelfile.$name
  OLLAMA_HOST=127.0.0.1:11460 $OLL create $name -f export/Modelfile.$name > /dev/null 2>&1
  [ -f results/heldout_$name.summary.json ] || $PY $D/text_eval.py --data data/set/test.jsonl --model $name --out results/heldout_$name.jsonl > results/heldout_$name.log 2>&1
  [ -f results/attacks_$name.json ] || $PY $D/text_attack_eval.py --data data/set/attacks_heldout.jsonl --model $name --input-role --out results/attacks_$name.json > results/attacks_$name.log 2>&1
done
[ -f results/heldout_serve-1b.summary.json ] || $PY $D/text_eval.py --data data/set/test.jsonl --model serve-1b --out results/heldout_serve-1b.jsonl > results/heldout_serve-1b.log 2>&1
for m in text-sft text-dpo-q4i; do [ -f results/calib_$m.json ] || (cd $D && ../../venv/bin/python text_calib.py --test ../../data/set/test.jsonl --attacks ../../data/set/attacks_heldout.jsonl --model $m --out ../../results/calib_$m.json > ../../results/calib_$m.log 2>&1); done
echo RUN_TEXT1B_DONE >> results/run.log
