#!/usr/bin/env bash
# The short-text adapter(s) to GGUF, as distill/export.sh does for the decision model, with the tools on our server: a
# Python with torch, transformers, peft and gguf (PY), llama.cpp's converter and tools (LLAMA_CPP, built with
# llama-imatrix) and a llama-quantize (QUANTIZE).
#   distill/text_export.sh <SFT run dir> <base model dir> <out dir> <name> [<DPO run dir>] [<calibration text>]
# merges the SFT LoRA into the base, then the DPO LoRA (distill/text_dpo.py) when one is given, converts to f16 GGUF,
# and quantizes to Q4_K_M and Q5_K_M; with a calibration text (real Serve prompts) also with an importance matrix
# (llama-imatrix; output.weight and token_embd.weight left out of it, as llama.cpp's README advises).
set -eu
RUN="$1"; BASE="$2"; OUT="$3"; NAME="$4"; DPO="${5:-}"; CALIB="${6:-}"
PY="${PY:-python3}"; LLAMA_CPP="${LLAMA_CPP:-$HOME/llama.cpp}"; QUANTIZE="${QUANTIZE:-$LLAMA_CPP/build/bin/llama-quantize}"
mkdir -p "$OUT"
"$PY" - "$RUN" "$BASE" "$OUT/hf" "$DPO" <<'PYEOF'
import sys, torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
run, base, out, dpo = sys.argv[1:5]
m = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16)
m = PeftModel.from_pretrained(m, run).merge_and_unload()
if dpo: m = PeftModel.from_pretrained(m, dpo).merge_and_unload()
m.save_pretrained(out, safe_serialization=True)
AutoTokenizer.from_pretrained(base).save_pretrained(out)
print("merged", out)
PYEOF
"$PY" "$LLAMA_CPP/convert_hf_to_gguf.py" "$OUT/hf" --outtype f16 --outfile "$OUT/$NAME-f16.gguf"
for Q in Q4_K_M Q5_K_M; do "$QUANTIZE" "$OUT/$NAME-f16.gguf" "$OUT/$NAME-$Q.gguf" $Q > "$OUT/quantize-$Q.log" 2>&1; done
if [ -n "$CALIB" ]; then
  "$LLAMA_CPP/build/bin/llama-imatrix" -m "$OUT/$NAME-f16.gguf" -f "$CALIB" -o "$OUT/imatrix.gguf" -c 1024 > "$OUT/imatrix.log" 2>&1
  for Q in Q4_K_M Q5_K_M; do "$QUANTIZE" --imatrix "$OUT/imatrix.gguf" --exclude-weights output.weight --exclude-weights token_embd.weight "$OUT/$NAME-f16.gguf" "$OUT/$NAME-imat-$Q.gguf" $Q > "$OUT/quantize-imat-$Q.log" 2>&1; done
fi
rm -rf "$OUT/hf" "$OUT/$NAME-f16.gguf"
ls -la "$OUT"
echo EXPORT_DONE
