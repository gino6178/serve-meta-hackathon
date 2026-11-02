"""GRPO on the text 1B at a2a.answer, with rewards from code instead of a reward model (DeepSeekMath's group-relative
policy optimisation, Shao et al. 2024; verifiable rewards as in Tülu 3's RLVR): from the SFT adapter (distill/
text_train.py), each training prompt gets G sampled answers, each answer a reward, and the policy moves toward the
answers above its group's mean, with a KL term (the k3 estimator) to the SFT adapter it started from.
The reward, with no grammar at sampling (the 1B has to write valid JSON itself):
  -1    not JSON, or no intent among accept / counter / decline
  ±0.5  the checks the gateway applies (text_eval.py's: a counter's time is one of the listed times, "works" only
        names listed ids)
  +1    the same intent as Glimmer's answer the code took; +0.5 more for the same counter time; +0.5 × the overlap
        (Jaccard) of "works" with Glimmer's
   python3 distill/text_grpo.py --base <Llama-3.2-1B-Instruct dir> --sft runs/all --data <dir with train.jsonl> --out runs/grpo
"""
import argparse, json, math, random, re, time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from text_train import prompt_text

INTENTS = ("accept", "counter", "decline")

def reward(text, ex):
    try: v = json.loads(text.strip())
    except Exception: return -1.0
    if not isinstance(v, dict) or v.get("intent") not in INTENTS: return -1.0
    times = {i: (d, s) for i, d, s in re.findall(r"(t\d+): (\d{4}-\d\d-\d\d) (\d\d:\d\d)", ex["messages"][0]["content"])}
    works = v.get("works") or []
    ok = isinstance(works, list) and all(w in times for w in works) and (v["intent"] != "counter" or (v.get("date"), v.get("start")) in times.values())
    g = json.loads(ex["target"]); r = 0.5 if ok else -0.5
    if v["intent"] == g.get("intent"):
        r += 1.0
        if g["intent"] == "counter" and (v.get("date"), v.get("start")) == (g.get("date"), g.get("start")): r += 0.5
    a, b = set(map(str, works if isinstance(works, list) else [])), set(map(str, g.get("works") or []))
    return r + 0.5 * (len(a & b) / len(a | b) if a | b else 1.0)

def seq_logprobs(model, ids, att, n_prompt):
    """Per-token log-probabilities of each sequence's completion (positions from n_prompt on), and the mask of real tokens.
    Only the completion's logits are made (logits_to_keep): the prompt's, over a 128k vocabulary, would not fit."""
    pos = (att.cumsum(-1) - 1).clamp(min=0)  # (left padding: positions as generate() gives them)
    n = ids.shape[1] - n_prompt
    logits = model(input_ids=ids, attention_mask=att, position_ids=pos, logits_to_keep=n + 1).logits[:, :-1].float()
    lp = torch.log_softmax(logits, -1).gather(-1, ids[:, n_prompt:, None]).squeeze(-1)
    return lp, att[:, n_prompt:].float()

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--base", required=True); a.add_argument("--sft", required=True); a.add_argument("--data", required=True); a.add_argument("--out", required=True)
    a.add_argument("--site", default="a2a.answer"); a.add_argument("--steps", type=int, default=120); a.add_argument("--prompts", type=int, default=8)
    a.add_argument("--group", type=int, default=8); a.add_argument("--lr", type=float, default=5e-6); a.add_argument("--beta", type=float, default=0.04)
    a.add_argument("--max_new", type=int, default=120); a.add_argument("--temp", type=float, default=1.0); a.add_argument("--seed", type=int, default=0)
    a.add_argument("--micro", type=int, default=8, help="sequences per forward/backward")
    args = a.parse_args()
    random.seed(args.seed); torch.manual_seed(args.seed)
    tok = AutoTokenizer.from_pretrained(args.base); tok.padding_side = "left"; tok.pad_token = tok.pad_token or "<|finetune_right_pad_id|>"
    rows = [json.loads(l) for l in open(f"{args.data}/train.jsonl")]
    rows = [r for r in rows if r["site"] == args.site]
    print(f"{len(rows)} prompts at {args.site}", flush=True)
    m = AutoModelForCausalLM.from_pretrained(args.base, dtype=torch.bfloat16).cuda()
    m.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False}); m.enable_input_require_grads()
    m = PeftModel.from_pretrained(m, args.sft, adapter_name="default", is_trainable=True)
    m.load_adapter(args.sft, adapter_name="ref"); m.set_adapter("default")
    opt = torch.optim.AdamW([p for p in m.parameters() if p.requires_grad], lr=args.lr, weight_decay=0.0)
    eot = tok.convert_tokens_to_ids("<|eot_id|>"); t0 = time.time(); hist = []
    for step in range(1, args.steps + 1):
        batch = random.sample(rows, args.prompts)
        prompts = [tok.bos_token + prompt_text(ex.get("small_messages") or ex["messages"]) for ex in batch for _ in range(args.group)]
        enc = tok(prompts, return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
        m.eval()
        with torch.no_grad():
            gen = m.generate(**enc, do_sample=True, temperature=args.temp, top_p=1.0, max_new_tokens=args.max_new, eos_token_id=eot, pad_token_id=tok.pad_token_id)
        n = enc.input_ids.shape[1]; comp = gen[:, n:]
        # the mask: real completion tokens up to and including the first <|eot_id|>
        done = (comp == eot).int().cumsum(1); cmask = ((done == 0) | ((done == 1) & (comp == eot))).long()
        texts = [tok.decode(c[mk.bool()], skip_special_tokens=True) for c, mk in zip(comp, cmask)]
        R = torch.tensor([reward(t, batch[i // args.group]) for i, t in enumerate(texts)], device="cuda").view(args.prompts, args.group)
        A = ((R - R.mean(1, keepdim=True)) / (R.std(1, keepdim=True) + 1e-4)).view(-1)
        att = torch.cat([enc.attention_mask, cmask], 1)
        N = gen.shape[0]; kls = []
        for i in range(0, N, args.micro):  # (in micro-batches, the gradient accumulated over the whole group)
            sl = slice(i, i + args.micro)
            m.set_adapter("ref")
            with torch.no_grad(): ref_lp, _ = seq_logprobs(m, gen[sl], att[sl], n)
            m.set_adapter("default"); m.train()
            lp, mk = seq_logprobs(m, gen[sl], att[sl], n)
            d = ref_lp - lp; kl = torch.exp(d) - d - 1
            per_tok = -(A[sl, None] * torch.exp(lp - lp.detach())) + args.beta * kl
            loss = ((per_tok * mk).sum(1) / mk.sum(1).clamp(min=1)).sum() / N
            loss.backward(); kls.append(((kl * mk).sum() / mk.sum()).item())
        torch.nn.utils.clip_grad_norm_([p for p in m.parameters() if p.requires_grad], 1.0); opt.step(); opt.zero_grad()
        hist.append({"step": step, "reward": round(R.mean().item(), 4), "valid": round((R > -1).float().mean().item(), 4), "kl": round(sum(kls) / len(kls), 5)})
        if step % 5 == 0 or step == 1: print(json.dumps(hist[-1]), f"{time.time() - t0:.0f}s", flush=True)
    m.save_pretrained(args.out, selected_adapters=["default"]); tok.save_pretrained(args.out)
    json.dump(vars(args) | {"history": hist}, open(f"{args.out}/args.json", "w"), indent=1)
    print("GRPO_DONE", args.out, flush=True)

if __name__ == "__main__":
    main()
