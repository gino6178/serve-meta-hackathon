"""Distill Muse Glimmer's member decisions into a small Meta model (Llama 3.2 3B Instruct) that answers in one forward
pass over declared options (distill/prompt.py), with LoRA.

Losses, at positions code knows (no text is generated):
  choice  cross-entropy at the answer position over the valid option letters only, against Glimmer's answers to the
          case (a distribution when Glimmer was asked more than once): distillation of the teacher's choice;
  works   two-way cross-entropy (" yes" against " no") at each listed time's marker, against the code-computed truth;
  jepa    (optional, --jepa L) LLM-JEPA (Huang, LeCun, Balestriero, ICLR 2026): the hidden state after k predictor tokens
          appended to the prompt is pulled toward the model's own embedding of a second view of the same decision (the
          member's calendar, hard rules and answer as JSON), by cosine distance, weighted L.
   python3 distill/train.py --train d1,d2 --val d3 --out runs/x [--epochs 3] [--jepa 1.0]
   python3 distill/train.py --eval runs/x --test d4 --pred out.jsonl     (score a saved adapter on held-out cases)
"""
import argparse, json, math, os, random, sys, time, collections
import torch, torch.nn.functional as F
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import Builder, from_case, structured_view, options, label_of

def _ids(spec):
    """None (every case) or the set of case ids listed in the files of a comma list ("all" for every case)."""
    if not spec or spec == "all": return None
    out = set()
    for f in spec.split(","): out |= set(open(f).read().split())
    return out

def load(dirs, kinds=("judge",), more=None, dec_tau=0.0, rationale=False):
    """[(case, Counter of Glimmer's answers as time id / 'decline')] for the cases Glimmer answered.
    more: also count Glimmer's extra answers (teacher_more.jsonl, distill/glimmer_more.mjs) for the cases in these id
    files ("all": every case). dec_tau > 0: attach the one-token decider's letter distribution, averaged over the orders
    it was read in (decider_dist.jsonl; one order alone is mostly position) and sharpened or softened by 1/dec_tau, as
    case["_dec"]. rationale: attach a short why (rationale.jsonl) from a Glimmer answer that chose the case's majority
    answer, as case["_why"]."""
    out = []
    keep = _ids(more) if more else set()
    for d in dirs.split(","):
        cases = {c["id"]: c for c in map(json.loads, open(f"{d}/cases.jsonl"))}
        lab = collections.defaultdict(collections.Counter)
        rows = list(map(json.loads, open(f"{d}/teacher.jsonl")))
        if more and os.path.exists(f"{d}/teacher_more.jsonl"):
            rows += [r for r in map(json.loads, open(f"{d}/teacher_more.jsonl")) if keep is None or r["id"] in keep]
        for r in rows:
            c = cases.get(r["id"])
            if c is None: continue
            y = label_of(c, r["decision"])
            if y is not None: lab[r["id"]][y] += 1
        if dec_tau and os.path.exists(f"{d}/decider_dist.jsonl"):
            for r in map(json.loads, open(f"{d}/decider_dist.jsonl")):
                if r["id"] not in cases: continue
                acc = collections.Counter()
                for v in r["views"].values():
                    for k, p in v["dist"].items(): acc[k] += p / len(r["views"])
                z = {k: p ** (1 / dec_tau) for k, p in acc.items() if p > 0}
                tot = sum(z.values())
                if tot: cases[r["id"]]["_dec"] = {k: v / tot for k, v in z.items()}
        if rationale and os.path.exists(f"{d}/rationale.jsonl"):
            for r in map(json.loads, open(f"{d}/rationale.jsonl")):
                c = cases.get(r["id"])
                if c is None or not lab[r["id"]] or not r.get("why") or "_why" in c: continue
                y = label_of(c, r["decision"]); top = max(lab[r["id"]].values())
                if y is not None and lab[r["id"]][y] == top: c["_why"] = (r["why"], y)
        out += [(cases[i], lab[i]) for i in cases if cases[i]["kind"] in kinds and lab[i]]
    return out

def letter_of(opts, y):
    for l, k, t in opts:
        if (k == "decline" and y == "decline") or (k != "decline" and t == y): return l
    return None

def reordered(c, how, rnd=random):
    """The case with its listed times (after the proposed one, which stays first) in another order: "reverse" or
    "shuffle". The options' letters stay in time order (prompt.py options), so only the lines move; labels are by id."""
    if not how: return c
    head, rest = c["offers"][:1], c["offers"][1:]
    rest = rest[::-1] if how == "reverse" else rnd.sample(rest, len(rest))
    return {**c, "offers": head + rest}

class Data:
    def __init__(self, tok, jepa_k=0, short_p=0.5, order="time", soft_beta=0.0, order_aug=0.0, why_max=48):
        self.b = Builder(tok, order); self.tok = tok; self.k = jepa_k; self.short_p = short_p
        self.soft_beta = soft_beta; self.order_aug = order_aug; self.why_max = why_max
        self.pred = tok.encode(" =>", add_special_tokens=False)[-1]  # the predictor token(s) appended for the JEPA view
        self.why_tok = tok.encode(" Why:", add_special_tokens=False)
    def example(self, c, counts, short=None, perm=None, train=False):
        if short is None: short = random.random() < self.short_p  # half the prompts list only the proposed time and those that work
        if perm is None and train and self.order_aug and random.random() < self.order_aug: perm = "shuffle"
        x = self.b.build(from_case(reordered(c, perm)), short)
        opts = x["options"]; letters = [l for l, _, _ in opts]
        tgt = torch.zeros(len(opts))
        for y, n in counts.items():
            l = letter_of(opts, y)
            if l is not None: tgt[letters.index(l)] += n
        if tgt.sum() == 0: return None
        tgt /= tgt.sum()
        hard = (tgt == tgt.max()).float(); hard /= hard.sum()  # the majority answer (a tie is shared, not settled by letter order)
        soft = tgt
        if self.soft_beta and c.get("_dec"):
            dec = torch.tensor([c["_dec"].get("decline" if k == "decline" else t, 0.0) for _, k, t in opts])
            if dec.sum() > 0: soft = (1 - self.soft_beta) * tgt + self.soft_beta * dec / dec.sum()
        ids = x["ids"] + [self.pred] * self.k
        works = set(c["works"])
        ex = {"ids": ids, "answer": x["answer"], "letters": [self.b.letter[l] for l in letters], "target": tgt, "hard": hard, "soft": soft,
              "markers": [p for _, p in x["markers"]], "mlabels": [1 if t in works else 0 for t, _ in x["markers"]], "mids": [t for t, _ in x["markers"]], "opts": opts}
        if train and c.get("_why") and letter_of(opts, c["_why"][1]):
            # the rationale, after the prompt and the letter of the answer it explains (a majority answer): trained as a
            # language-model loss of its own, so the prompt's positions (and the answer read there) see nothing of it at inference
            why = self.tok.encode(" " + c["_why"][0].strip(), add_special_tokens=False)[:self.why_max]
            ex["tail"] = [self.b.letter[letter_of(opts, c["_why"][1])]] + self.why_tok + why
            ex["tail_from"] = 1 + len(self.why_tok)  # the loss is on the why's own tokens
        if self.k:
            top = max(counts, key=counts.get)
            ex["view2"] = self.tok.encode(structured_view(c, top), add_special_tokens=False)
        return ex

def pad(seqs, val):
    n = max(len(s) for s in seqs)
    return torch.tensor([s + [val] * (n - len(s)) for s in seqs]), torch.tensor([[1] * len(s) + [0] * (n - len(s)) for s in seqs])

def heads(model, batch, dev, tails=False):
    """Hidden states for a batch, then the LM head only at the positions and tokens that matter."""
    ids, att = pad([e["ids"] + (e.get("tail", []) if tails else []) for e in batch], 0)
    base = model.get_base_model() if hasattr(model, "get_base_model") else model
    h = base.model(input_ids=ids.to(dev), attention_mask=att.to(dev)).last_hidden_state
    W = base.lm_head.weight
    return h, W

def losses(model, batch, dev, d, jepa_w=0.0, works_w=1.0, kl_w=None, T=1.0, rat_w=0.0):
    """kl_w None: cross-entropy against Glimmer's vote distribution (the earlier rounds). Otherwise (1 - kl_w) times
    cross-entropy against the majority answer plus kl_w * T^2 * KL(soft target at T || student at T), the soft target
    being the votes mixed with the decider's debiased distribution (Data soft_beta)."""
    h, W = heads(model, batch, dev, tails=rat_w > 0)
    lc, lw, lj, lr = [], [], [], []
    for i, e in enumerate(batch):
        z = (h[i, e["answer"]] @ W[e["letters"]].T).float()
        if kl_w is None: lc.append(-(e["target"].to(dev) * F.log_softmax(z, -1)).sum())
        else:
            ce = -(e["hard"].to(dev) * F.log_softmax(z, -1)).sum()
            q = e["soft"].to(dev).clamp_min(1e-8) ** (1 / T); q = q / q.sum()
            kl = (q * (q.log() - F.log_softmax(z / T, -1))).sum() * T * T
            lc.append((1 - kl_w) * ce + kl_w * kl)
        if rat_w and e.get("tail"):
            n0 = len(e["ids"]); tl = e["tail"]; a = e["tail_from"]
            # position n0 - 1 + j predicts tail[j]; the loss is on the why's tokens (j >= a)
            hp = h[i, n0 - 1 + a:n0 - 1 + len(tl)]
            lr.append(F.cross_entropy((hp @ W.T).float(), torch.tensor(tl[a:], device=dev)))
        hm = h[i, e["markers"]]
        zw = (hm @ W[[d.b.yes, d.b.no]].T).float()
        lw.append(F.cross_entropy(zw, torch.tensor([0 if y else 1 for y in e["mlabels"]], device=dev)))
    out = {"choice": torch.stack(lc).mean(), "works": torch.stack(lw).mean()}
    loss = out["choice"] + works_w * out["works"]
    if lr:
        out["why"] = torch.stack(lr).mean(); loss = loss + rat_w * out["why"]
    if jepa_w:
        base = model.get_base_model() if hasattr(model, "get_base_model") else model
        v2, a2 = pad([e["view2"] for e in batch], 0)
        h2 = base.model(input_ids=v2.to(dev), attention_mask=a2.to(dev)).last_hidden_state
        last2 = a2.sum(1) - 1
        for i, e in enumerate(batch):
            p = h[i, len(e["ids"]) - 1].float(); t = h2[i, last2[i]].float()
            lj.append(1 - F.cosine_similarity(p, t, dim=0))
        out["jepa"] = torch.stack(lj).mean()
        loss = loss + jepa_w * out["jepa"]
    out["loss"] = loss
    return out

@torch.no_grad()
def predict(model, data, items, dev, bs=8, short=True, perm=None):
    model.eval(); rows = []
    for s in range(0, len(items), bs):
        chunk = items[s:s + bs]
        exs = [data.example(c, n, short, perm=perm or "") for c, n in chunk]
        keep = [(c, n, e) for (c, n), e in zip(chunk, exs) if e is not None]
        if not keep: continue
        h, W = heads(model, [e for _, _, e in keep], dev)
        for i, (c, n, e) in enumerate(keep):
            p = F.softmax((h[i, e["answer"]] @ W[e["letters"]].T).float(), -1).tolist()
            pw = F.softmax((h[i, e["markers"]] @ W[[data.b.yes, data.b.no]].T).float(), -1)[:, 0].tolist()
            opts = e["opts"]
            ans = {("decline" if k == "decline" else t): round(q, 4) for (l, k, t), q in zip(opts, p)}
            rows.append({"id": c["id"], "probs": ans, "works_p": dict(zip(e["mids"], [round(q, 4) for q in pw])), "works": c["works"], "glimmer": dict(n)})
    model.train()
    return rows

def summarize(rows):
    """Agreement with Glimmer (its majority answer; every sample) and works precision/recall against code."""
    n = agree = agree_s = tot_s = 0; tp = fp = fn = 0
    for r in rows:
        pick = max(r["probs"], key=r["probs"].get)
        g = r["glimmer"]; maj = max(g, key=g.get)
        n += 1; agree += pick == maj
        agree_s += g.get(pick, 0); tot_s += sum(g.values())
        P = {t for t, q in r["works_p"].items() if q >= 0.5}; T = set(r["works"])
        tp += len(P & T); fp += len(P - T); fn += len(T - P)
    return {"cases": n, "agree_majority": round(agree / max(1, n), 4), "agree_samples": round(agree_s / max(1, tot_s), 4),
            "works_precision": round(tp / max(1, tp + fp), 4), "works_recall": round(tp / max(1, tp + fn), 4)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.path.expanduser("~/models/meta-3b"))  # meta-llama/Llama-3.2-3B-Instruct
    ap.add_argument("--train"); ap.add_argument("--val"); ap.add_argument("--test"); ap.add_argument("--out"); ap.add_argument("--eval"); ap.add_argument("--pred")
    ap.add_argument("--epochs", type=float, default=3); ap.add_argument("--lr", type=float, default=2e-4); ap.add_argument("--bs", type=int, default=8); ap.add_argument("--accum", type=int, default=2)
    ap.add_argument("--r", type=int, default=16); ap.add_argument("--jepa", type=float, default=0.0); ap.add_argument("--k", type=int, default=1); ap.add_argument("--works_w", type=float, default=1.0); ap.add_argument("--short_p", type=float, default=0.5)
    ap.add_argument("--order", default="time", choices=["time", "listed"])  # the options' letters: soonest first, or the proposer's order
    ap.add_argument("--seed", type=int, default=0); ap.add_argument("--limit", type=int, default=0)
    # this round (docs/decision_model.md, "Round 4"): soft labels, rationale, extra teacher answers, order augmentation
    ap.add_argument("--more", default="")            # count Glimmer's extra answers for the cases in these id files ("all": every case)
    ap.add_argument("--kl_w", type=float, default=None)  # None: CE against the votes (earlier rounds); else (1-w) CE(majority) + w T^2 KL(soft)
    ap.add_argument("--T", type=float, default=1.0)
    ap.add_argument("--soft_beta", type=float, default=0.0)  # share of the decider's debiased distribution in the soft target
    ap.add_argument("--dec_tau", type=float, default=1.0)    # the decider distribution's temperature (fitted on val)
    ap.add_argument("--rat_w", type=float, default=0.0)      # weight of the rationale loss (rationale.jsonl)
    ap.add_argument("--order_aug", type=float, default=0.0)  # share of training prompts with the listed times shuffled
    ap.add_argument("--perms", default="")  # --eval: also score with the listed times in these orders (e.g. "reverse")
    a = ap.parse_args()
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from peft import LoraConfig, get_peft_model, PeftModel
    random.seed(a.seed); torch.manual_seed(a.seed)
    dev = "cuda"
    tok = AutoTokenizer.from_pretrained(a.base)
    model = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype=torch.bfloat16).to(dev)
    if a.eval:
        model = PeftModel.from_pretrained(model, a.eval).to(dev)
        # the letters' order the adapter was trained with (runs before the switch used the proposer's order)
        saved = json.load(open(f"{a.eval}/args.json")) if os.path.exists(f"{a.eval}/args.json") else {}
        d = Data(tok, 0, order=saved.get("order", "listed")); items = load(a.test)
        for short, perm in [(True, None), (False, None)] + [(True, p) for p in a.perms.split(",") if p]:
            t0 = time.time(); rows = predict(model, d, items, dev, short=short, perm=perm)
            s = summarize(rows); s["seconds"] = round(time.time() - t0, 1); s["prompt"] = ("short" if short else "full") + (f"_{perm}" if perm else ""); print(json.dumps(s), flush=True)
            if a.pred:
                with open(a.pred.replace(".jsonl", f"_{s['prompt']}.jsonl"), "w") as f:
                    for r in rows: f.write(json.dumps(r) + "\n")
        return
    model.gradient_checkpointing_enable(); model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=a.r, lora_alpha=2 * a.r, lora_dropout=0.05, target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"], task_type="CAUSAL_LM"))
    d = Data(tok, a.k if a.jepa else 0, a.short_p, a.order, a.soft_beta, a.order_aug)
    train = load(a.train, more=a.more or None, dec_tau=a.dec_tau if a.soft_beta else 0.0, rationale=a.rat_w > 0); val = load(a.val) if a.val else []
    if a.limit: train = train[:a.limit]
    train = [(c, n) for c, n in train if d.example(c, n, short=True, perm="") is not None]
    exs = train  # examples are built afresh each time a case is drawn (its prompt length and, with --order_aug, its order)
    print(f"train {len(exs)} cases ({sum(sum(n.values()) for _, n in train)} Glimmer answers, {sum(1 for c, _ in train if c.get('_dec'))} with the decider's distribution, {sum(1 for c, _ in train if c.get('_why'))} with a rationale), val {len(val)}; jepa {a.jepa}", flush=True)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=0.0)
    steps = math.ceil(len(exs) * a.epochs / (a.bs * a.accum)); warm = max(1, steps // 20)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1, s / steps))))
    os.makedirs(a.out, exist_ok=True); log = open(f"{a.out}/log.jsonl", "a")
    t0 = time.time(); step = 0; seen = 0; acc = collections.defaultdict(float); nacc = 0
    order = []
    while len(order) < steps * a.bs * a.accum:
        o = list(range(len(exs))); random.shuffle(o); order += o
    model.train()
    for s in range(steps):
        for _ in range(a.accum):
            batch = [e for e in (d.example(*exs[i], train=True) for i in order[seen:seen + a.bs]) if e is not None]; seen += a.bs
            out = losses(model, batch, dev, d, a.jepa, a.works_w, a.kl_w, a.T, a.rat_w)
            (out["loss"] / a.accum).backward()
            for k, v in out.items(): acc[k] += float(v)
            nacc += 1
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step(); sched.step(); opt.zero_grad(set_to_none=True); step += 1
        if step % 20 == 0 or step == steps:
            row = {"step": step, "of": steps, "sec": round(time.time() - t0), **{k: round(v / nacc, 4) for k, v in acc.items()}}
            if val and (step % 100 == 0 or step == steps): row["val"] = summarize(predict(model, d, val, dev, short=True)); row["val_full"] = summarize(predict(model, d, val, dev, short=False))
            print(json.dumps(row), flush=True); log.write(json.dumps(row) + "\n"); log.flush()
            acc.clear(); nacc = 0
    model.save_pretrained(a.out)
    json.dump(vars(a), open(f"{a.out}/args.json", "w"))
    print("TRAIN_DONE", round(time.time() - t0), "s", flush=True)

if __name__ == "__main__":
    main()
