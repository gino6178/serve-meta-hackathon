#!/usr/bin/env bash
# A trained adapter to int4 GGUF for llama.cpp / Ollama (on the VM):
#   distill/export.sh <run dir> <base model dir> <out name>
# merges the LoRA into the base (bf16), converts it to GGUF (llama.cpp convert_hf_to_gguf.py, f16), and quantizes it to
# Q4_K_M and Q4_0 (llama-quantize). llama.cpp is built in ~/llama.cpp.
set -eu
RUN="$1"; BASE="$2"; NAME="$3"; OUT="$HOME/export/$NAME"
mkdir -p "$OUT"
python3 - "$RUN" "$BASE" "$OUT/hf" <<'EOF'
import sys, torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
run, base, out = sys.argv[1:4]
m = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16)
m = PeftModel.from_pretrained(m, run).merge_and_unload()
m.save_pretrained(out, safe_serialization=True)
AutoTokenizer.from_pretrained(base).save_pretrained(out)
print("merged", out)
EOF
python3 ~/llama.cpp/convert_hf_to_gguf.py "$OUT/hf" --outtype f16 --outfile "$OUT/$NAME-f16.gguf"
for Q in Q4_K_M Q4_0; do ~/llama.cpp/build/bin/llama-quantize "$OUT/$NAME-f16.gguf" "$OUT/$NAME-$Q.gguf" "$Q" > "$OUT/quantize-$Q.log" 2>&1; done
ls -la "$OUT"
echo EXPORT_DONE
