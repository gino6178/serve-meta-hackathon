#!/usr/bin/env bash
# Round 4: a trained adapter to GGUF for the CPU worker, with an importance matrix from Serve's own decision prompts:
#   distill/export_r4.sh <run dir> <base model dir> <out name>
# merges the LoRA (bf16), converts to GGUF f16, computes the importance matrix (llama-imatrix) over 800 training-case
# decision prompts (distill/calib_text.py; the first 120 chunks of 512 tokens, about 61k tokens, for time on the CPU), and quantizes to Q4_K_M without and with it, Q5_K_M and Q6_K (with it).
set -eu
RUN="$1"; BASE="$2"; NAME="$3"; OUT="$HOME/export/$NAME"
mkdir -p "$OUT"
[ -f "$OUT/$NAME-f16.gguf" ] || python3 - "$RUN" "$BASE" "$OUT/hf" <<'PY'
import sys, torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
run, base, out = sys.argv[1:4]
m = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16)
m = PeftModel.from_pretrained(m, run).merge_and_unload()
m.save_pretrained(out, safe_serialization=True)
AutoTokenizer.from_pretrained(base).save_pretrained(out)
print("merged", out)
PY
[ -f "$OUT/$NAME-f16.gguf" ] || python3 ~/llama.cpp/convert_hf_to_gguf.py "$OUT/hf" --outtype f16 --outfile "$OUT/$NAME-f16.gguf"
python3 "$(dirname "$0")/calib_text.py" "$BASE" "$OUT/calib.txt" 800 jev/data/train jev/data/trainshared jev/data/asked
~/llama.cpp/build/bin/llama-imatrix -m "$OUT/$NAME-f16.gguf" -f "$OUT/calib.txt" -o "$OUT/imatrix.dat" -c 512 --chunks 120 -t 8 > "$OUT/imatrix.log" 2>&1
Q=~/llama.cpp/build/bin/llama-quantize
$Q "$OUT/$NAME-f16.gguf" "$OUT/$NAME-Q4_K_M-noimat.gguf" Q4_K_M > "$OUT/q-noimat.log" 2>&1
for T in Q4_K_M Q5_K_M Q6_K; do $Q --imatrix "$OUT/imatrix.dat" "$OUT/$NAME-f16.gguf" "$OUT/$NAME-$T.gguf" "$T" > "$OUT/q-$T.log" 2>&1; done
ls -la "$OUT"
echo EXPORT_DONE
