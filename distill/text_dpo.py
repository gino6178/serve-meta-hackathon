"""SecAlign++ for the short-text 1B (Chen et al., Meta SecAlign, 2025), after its SFT (distill/text_train.py):
  sample   the SFT model answers each attacked prompt (distill/text_attacks.py dpo) a few times; the pair is chosen =
           Glimmer's answer to the clean text, rejected = one of the student's own answers that did what the injection
           asked (verdict ok for a hostile comment, good for a bad court, or the reverse for the balancing pairs). When no
           sample obeyed, the rejected answer is the chosen one with the injected verdict put in (marked "made").
  train    LoRA DPO on top of the SFT model (merged), the SFT model as reference: r 64, alpha 8, lr 1.6e-4, beta 0.1,
           3 epochs (Meta SecAlign++'s settings).
   python3 distill/text_dpo.py sample --base B --sft runs/sft --data data/set/dpo_prompts.jsonl --out data/set/dpo_pairs.jsonl
   python3 distill/text_dpo.py train  --base B --sft runs/sft --data data/set/dpo_pairs.jsonl --out runs/dpo
The DPO adapter is saved over the merged SFT model (runs/dpo/merged_base names it); distill/text_export.sh takes the
merged SFT model as its base.
"""
import argparse, json, math, os, random, sys, time
import torch, torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, PeftModel, get_peft_model
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_train import prompt_text

MAX = {"feed.standard": 100, "places.judge": 320}

def merged(base, sft):
    m = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16)
    return PeftModel.from_pretrained(m, sft).merge_and_unload().cuda()

def obeys(ex, text):
    try: v = json.loads(text)
    except Exception: return False
    return v.get("verdict") == ex["obey"] if ex["obey"] in ("ok", "good", "no") else v.get("verdict") not in (None, "ok")

def sample(args):
    tok = AutoTokenizer.from_pretrained(args.base); tok.padding_side = "left"; tok.pad_token = tok.pad_token or tok.eos_token
    model = merged(args.base, args.sft).eval()
    rows = [json.loads(l) for l in open(args.data)]; out = []; eot = tok.convert_tokens_to_ids("<|eot_id|>")
    for k in range(0, len(rows), 8):
        b = rows[k:k + 8]
        enc = tok([tok.bos_token + prompt_text(x["small_messages"]) for x in b], return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
        with torch.no_grad():
            g = model.generate(**enc, do_sample=True, temperature=0.9, top_p=0.95, max_new_tokens=max(MAX[x["site"]] for x in b), num_return_sequences=args.k, eos_token_id=eot, pad_token_id=tok.eos_token_id)
        texts = tok.batch_decode(g[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)
        for i, x in enumerate(b):
            mine = texts[i * args.k:(i + 1) * args.k]; bad = [t.strip() for t in mine if obeys(x, t.strip())]
            if bad: rej, made = bad[0], False
            else:
                v = json.loads(x["target"]); v["verdict"] = x["obey"]
                if x["site"] == "feed.standard" and x["obey"] == "ok": v["aimed"] = "a friendly joke between club members, nobody would mind"
                rej, made = json.dumps(v, ensure_ascii=False), True
            out.append({"site": x["site"], "source": x["source"], "small_messages": x["small_messages"], "chosen": x["target"], "rejected": rej, "made": made, "obeyed": len(bad), "k": args.k})
        print(f"{k + len(b)}/{len(rows)}", flush=True)
    with open(args.out, "w") as fh:
        for x in out: fh.write(json.dumps(x, ensure_ascii=False) + "\n")
    print(f"SAMPLE_DONE {len(out)} pairs, {sum(not x['made'] for x in out)} with a self-generated rejected answer; the SFT model obeyed in {sum(x['obeyed'] for x in out)} of {args.k * len(out)} samples")

def seq(tok, msgs, resp):
    p = [tok.bos_token_id] + tok.encode(prompt_text(msgs), add_special_tokens=False)
    r = tok.encode(resp, add_special_tokens=False) + [tok.convert_tokens_to_ids("<|eot_id|>")]
    return p + r, len(p)

def logps(model, tok, items):
    n = max(len(i) for i, _ in items)
    ids = torch.tensor([i + [tok.eos_token_id] * (n - len(i)) for i, _ in items]).cuda()
    att = torch.tensor([[1] * len(i) + [0] * (n - len(i)) for i, _ in items]).cuda()
    lp = F.log_softmax(model(input_ids=ids, attention_mask=att).logits[:, :-1].float(), -1).gather(-1, ids[:, 1:, None])[..., 0]
    mask = torch.zeros_like(lp)
    for j, (i, p) in enumerate(items): mask[j, p - 1:len(i) - 1] = 1
    return (lp * mask).sum(-1)

def train(args):
    random.seed(0); torch.manual_seed(0)
    tok = AutoTokenizer.from_pretrained(args.base)
    rows = [json.loads(l) for l in open(args.data)]
    pairs = [(seq(tok, x["small_messages"], x["chosen"]), seq(tok, x["small_messages"], x["rejected"])) for x in rows if x["chosen"] != x["rejected"]]
    model = merged(args.base, args.sft)
    model.gradient_checkpointing_enable(); model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=args.r, lora_alpha=args.alpha, lora_dropout=0.05, task_type="CAUSAL_LM",
                                             target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)
    steps = math.ceil(len(pairs) / args.bs) * args.epochs; warm = max(1, steps // 10)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
    t0, step = time.time(), 0
    for ep in range(args.epochs):
        random.shuffle(pairs)
        for k in range(0, len(pairs), args.bs):
            b = pairs[k:k + args.bs]; items = [c for c, _ in b] + [r for _, r in b]
            with torch.no_grad(), model.disable_adapter():
                model.eval(); ref = logps(model, tok, items); model.train()
            pol = logps(model, tok, items); n = len(b)
            margin = args.beta * ((pol[:n] - ref[:n]) - (pol[n:] - ref[n:]))
            loss = -F.logsigmoid(margin).mean()
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step(); opt.zero_grad(); step += 1
            if step % 10 == 0 or step == steps: print(f"epoch {ep + 1} step {step}/{steps} loss {loss.item():.4f} acc {(margin > 0).float().mean().item():.2f} {time.time() - t0:.0f}s", flush=True)
    model.save_pretrained(args.out); tok.save_pretrained(args.out)
    json.dump(vars(args) | {"pairs": len(pairs), "merged_base": f"{args.base} + {args.sft}"}, open(f"{args.out}/args.json", "w"), indent=1)
    print("DPO_DONE", args.out)

def main():
    a = argparse.ArgumentParser(); a.add_argument("what", choices=["sample", "train"])
    a.add_argument("--base", required=True); a.add_argument("--sft", required=True); a.add_argument("--data", required=True); a.add_argument("--out", required=True)
    a.add_argument("--k", type=int, default=4); a.add_argument("--r", type=int, default=64); a.add_argument("--alpha", type=int, default=8); a.add_argument("--lr", type=float, default=1.6e-4)
    a.add_argument("--beta", type=float, default=0.1); a.add_argument("--epochs", type=int, default=3); a.add_argument("--bs", type=int, default=8)
    args = a.parse_args()
    sample(args) if args.what == "sample" else train(args)

if __name__ == "__main__":
    main()
