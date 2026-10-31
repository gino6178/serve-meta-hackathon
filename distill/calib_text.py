"""Calibration text for llama.cpp's importance matrix (llama-imatrix): Serve's own decision prompts, exactly as the
worker builds them (prompt.py Builder, short and full, the chat template included), from training cases only (never the
held-out sets), one prompt after another.
   python3 distill/calib_text.py <tokenizer dir> <out.txt> [cases=800] data_dir [data_dir ...]
"""
import json, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import Builder, from_case
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained(sys.argv[1]); out = sys.argv[2]; n = int(sys.argv[3]); dirs = sys.argv[4:]
cases = [c for d in dirs for c in map(json.loads, open(f"{d}/cases.jsonl")) if c["kind"] == "judge"]
random.seed(0); random.shuffle(cases)
b = Builder(tok, "time")
with open(out, "w") as f:
    for i, c in enumerate(cases[:n]):
        x = b.build(from_case(c), short=i % 2 == 0)
        f.write(tok.decode(x["ids"]) + "\n")
print(out, n, "prompts")
