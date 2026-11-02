"""One adapter from several per-site LoRAs (distill/text_train.py --train <site's rows>), for comparing against one LoRA
trained on all the sites at once: peft's add_weighted_adapter with "cat" (the exact sum of the adapters' updates, task
arithmetic at weight 1), "ties" (TIES-Merging: keep each update's largest entries, elect a sign, average those that
agree; Yadav et al. 2023) or "dare_ties" (DARE: drop entries at random and rescale the rest, then TIES; Yu et al. 2024).
The result is saved as an ordinary LoRA adapter, so distill/text_export.sh and the evals take it as they take a run.
   python3 distill/text_merge.py --base <Llama-3.2-1B-Instruct dir> --adapters runs/feed,runs/judge,... --how ties --out runs/merge-ties
"""
import argparse, json, os, shutil
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--base", required=True); a.add_argument("--adapters", required=True); a.add_argument("--out", required=True)
    a.add_argument("--how", choices=["cat", "ties", "dare_ties"], default="ties"); a.add_argument("--density", type=float, default=0.5)
    args = a.parse_args()
    runs = args.adapters.split(","); names = [f"s{i}" for i in range(len(runs))]
    m = AutoModelForCausalLM.from_pretrained(args.base, dtype=torch.bfloat16)
    m = PeftModel.from_pretrained(m, runs[0], adapter_name=names[0])
    for n, r in zip(names[1:], runs[1:]): m.load_adapter(r, adapter_name=n)
    kw = {} if args.how == "cat" else {"density": args.density}
    m.add_weighted_adapter(names, [1.0] * len(names), adapter_name="merged", combination_type=args.how, **kw)
    m.set_adapter("merged")
    tmp = args.out + ".tmp"
    m.save_pretrained(tmp, selected_adapters=["merged"])
    shutil.rmtree(args.out, ignore_errors=True); shutil.move(os.path.join(tmp, "merged"), args.out); shutil.rmtree(tmp)
    AutoTokenizer.from_pretrained(args.base).save_pretrained(args.out)
    json.dump(vars(args), open(f"{args.out}/args.json", "w"), indent=1)
    print("MERGE_DONE", args.out)

if __name__ == "__main__":
    main()
