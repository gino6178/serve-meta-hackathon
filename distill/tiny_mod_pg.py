"""Prompt Guard 2's score on each synthetic comment, as feed/posts.js moderate reads it: the text, and its folded form
when that differs (letters set apart run together), flagged at 0.5 (PROMPT_GUARD_THRESHOLD). The same model, commit
and loading as agent/src/safety/guard_worker.py, on the CPU.
  HF_HUB_OFFLINE=1 python distill/tiny_mod_pg.py in.jsonl out.jsonl      (in: {id, text, folded} per line)
"""
import json, os, sys
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

name = os.environ.get("PROMPT_GUARD", "meta-llama/Llama-Prompt-Guard-2-86M")
rev = os.environ.get("PROMPT_GUARD_REVISION", "a8ded8e697ce7c355e395a0df51f94adb4a2fd27")
tok = AutoTokenizer.from_pretrained(name, revision=rev, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(name, revision=rev, local_files_only=True).eval()
torch.set_num_threads(int(os.environ.get("GUARD_THREADS", "4")))
rows = [json.loads(l) for l in open(sys.argv[1], encoding="utf8")]
with open(sys.argv[2], "w", encoding="utf8") as out:
    for i in range(0, len(rows), 32):
        batch = rows[i:i + 32]
        texts = [t for r in batch for t in ([r["text"]] + ([r["folded"]] if r["folded"] != r["text"] else []))]
        with torch.no_grad():
            enc = tok([t[:2000] for t in texts], return_tensors="pt", padding=True, truncation=True, max_length=512)
            p = torch.softmax(model(**enc).logits, dim=-1)[:, -1].tolist()
        k = 0
        for r in batch:
            n = 2 if r["folded"] != r["text"] else 1
            out.write(json.dumps({"id": r["id"], "pg": round(max(p[k:k + n]), 4)}) + "\n"); k += n
print("PG_DONE", len(rows))
