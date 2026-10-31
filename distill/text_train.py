"""SFT a LoRA on Llama 3.2 1B Instruct to write Muse Glimmer's short answers (distill/text_data.py builds the set):
the prompt is the call's messages in the chat template distill/Modelfile.serve-1b-text gives Ollama, the target is
Glimmer's reply (compact JSON where the call had a schema), and only the reply's tokens carry loss. At feed.standard
and places.judge, the verdict's first token also gets a KL term toward Glimmer's own distribution over the labels
(soft labels from its logprobs, distill/text_soft.py), restricted to the labels' first tokens.
   python3 distill/text_train.py --base <Llama-3.2-1B-Instruct dir> --data <dir with train.jsonl> --out <run dir>
"""
import argparse, json, math, os, random, time
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

# the template the Modelfile gives Ollama, token for token (llama.cpp puts <|begin_of_text|> in front)
def prompt_text(messages):
    s = "".join(f"<|start_header_id|>{m['role']}<|end_header_id|>\n\n{m['content']}<|eot_id|>" for m in messages)
    return s + "<|start_header_id|>assistant<|end_header_id|>\n\n"

VERDICT = '"verdict": "'

def encode(tok, ex, max_len):
    """(ids, labels, soft): soft is (position of the verdict's first token, [label token ids], [Glimmer's probabilities])
    for an example with soft labels (distill/text_soft.py), else None."""
    p = [tok.bos_token_id] + tok.encode(prompt_text(ex.get("small_messages") or ex["messages"]), add_special_tokens=False)
    tgt, soft = ex["target"], None
    k = tgt.find(VERDICT) + len(VERDICT) if ex.get("soft") and VERDICT in tgt else -1
    if k > 0:  # the target in two pieces, so the verdict's value begins a token of its own
        head = tok.encode(tgt[:k], add_special_tokens=False)
        t = head + tok.encode(tgt[k:], add_special_tokens=False)
        labels = list(ex["soft"]); ids = [tok.encode(l, add_special_tokens=False)[0] for l in labels]
        if len(set(ids)) == len(ids): soft = (len(p) + len(head), ids, [ex["soft"][l] for l in labels])
    else:
        t = tok.encode(tgt, add_special_tokens=False)
    t = t + [tok.convert_tokens_to_ids("<|eot_id|>")]
    if len(p) + len(t) > max_len: return None
    return p + t, [-100] * len(p) + t, soft

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--base", required=True); a.add_argument("--data", required=True); a.add_argument("--out", required=True)
    a.add_argument("--epochs", type=float, default=3); a.add_argument("--lr", type=float, default=2e-4); a.add_argument("--bs", type=int, default=8)
    a.add_argument("--r", type=int, default=32); a.add_argument("--max_len", type=int, default=1600); a.add_argument("--seed", type=int, default=0)
    a.add_argument("--soft", type=float, default=1.0, help="weight of the KL to Glimmer's verdict distribution")
    a.add_argument("--train", default="train.jsonl")
    args = a.parse_args()
    random.seed(args.seed); torch.manual_seed(args.seed)
    tok = AutoTokenizer.from_pretrained(args.base)
    rows = [json.loads(l) for l in open(f"{args.data}/{args.train}")]
    data = [e for e in (encode(tok, r, args.max_len) for r in rows) if e]
    print(f"{len(data)} of {len(rows)} examples fit in {args.max_len} tokens, {sum(e[2] is not None for e in data)} with soft labels", flush=True)
    model = AutoModelForCausalLM.from_pretrained(args.base, dtype=torch.bfloat16).cuda()
    model.gradient_checkpointing_enable(); model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=args.r, lora_alpha=2 * args.r, lora_dropout=0.05, task_type="CAUSAL_LM",
                                             target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
    model.print_trainable_parameters()
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=0.0)
    steps = math.ceil(len(data) / args.bs * args.epochs); warm = max(1, steps // 20)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
    model.train(); t0 = time.time(); step = 0
    while step < steps:
        random.shuffle(data)
        # batches of similar length, so little of each is padding
        order = sorted(range(len(data)), key=lambda i: len(data[i][0]) + random.random() * 64)
        batches = [order[i:i + args.bs] for i in range(0, len(order), args.bs)]; random.shuffle(batches)
        for b in batches:
            if step >= steps: break
            n = max(len(data[i][0]) for i in b)
            ids = torch.tensor([data[i][0] + [tok.eos_token_id] * (n - len(data[i][0])) for i in b]).cuda()
            lab = torch.tensor([data[i][1] + [-100] * (n - len(data[i][1])) for i in b]).cuda()
            att = torch.tensor([[1] * len(data[i][0]) + [0] * (n - len(data[i][0])) for i in b]).cuda()
            out = model(input_ids=ids, attention_mask=att, labels=lab); loss = out.loss
            kl = [F.kl_div(F.log_softmax(out.logits[j, data[i][2][0] - 1, data[i][2][1]].float(), -1), torch.tensor(data[i][2][2], device=ids.device), reduction="sum")
                  for j, i in enumerate(b) if data[i][2] is not None]
            if kl and args.soft: loss = loss + args.soft * torch.stack(kl).mean()
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); sched.step(); opt.zero_grad(); step += 1
            if step % 20 == 0 or step == steps: print(f"step {step}/{steps} loss {loss.item():.4f} {time.time() - t0:.0f}s", flush=True)
    model.save_pretrained(args.out); tok.save_pretrained(args.out)
    json.dump(vars(args) | {"examples": len(data)}, open(f"{args.out}/args.json", "w"), indent=1)
    print("TRAIN_DONE", args.out, flush=True)

if __name__ == "__main__":
    main()
