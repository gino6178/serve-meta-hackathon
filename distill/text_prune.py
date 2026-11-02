"""A smaller student by depth pruning, as Llama 3.2 1B itself was made from Llama 3.1 8B (pruned, then distilled) and as
Minitron does (Muralidharan et al. 2024): each decoder layer's importance is its block influence on Serve's own prompts,
1 - cos(the hidden state entering the layer, the one leaving it), averaged over tokens (ShortGPT, Men et al. 2024); the
k least important layers are removed and the rest saved as a new base model. distill/text_train.py then distils into it
(a larger LoRA rank, since it has to heal the cut as well as learn the sites).
   python3 distill/text_prune.py --base <Llama-3.2-1B-Instruct dir> --data <dir with train.jsonl> --drop 4 --out base-pruned
"""
import argparse, json, random
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from text_train import prompt_text

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--base", required=True); a.add_argument("--data", required=True); a.add_argument("--out", required=True)
    a.add_argument("--drop", type=int, default=4); a.add_argument("--n", type=int, default=256); a.add_argument("--seed", type=int, default=0)
    args = a.parse_args()
    tok = AutoTokenizer.from_pretrained(args.base)
    rows = [json.loads(l) for l in open(f"{args.data}/train.jsonl")]
    random.Random(args.seed).shuffle(rows)
    m = AutoModelForCausalLM.from_pretrained(args.base, dtype=torch.bfloat16).cuda().eval()
    L = m.config.num_hidden_layers; bi = torch.zeros(L, dtype=torch.float64)
    with torch.no_grad():
        for ex in rows[:args.n]:
            ids = tok(tok.bos_token + prompt_text(ex.get("small_messages") or ex["messages"]) + ex["target"], return_tensors="pt", add_special_tokens=False).input_ids[:, :1600].cuda()
            hs = m(input_ids=ids, output_hidden_states=True).hidden_states  # L+1 states: the embeddings, then each layer's output
            for i in range(L):
                bi[i] += (1 - torch.nn.functional.cosine_similarity(hs[i][0].float(), hs[i + 1][0].float(), dim=-1)).mean().item()
    bi /= args.n
    drop = sorted(sorted(range(L), key=lambda i: bi[i].item())[:args.drop])
    keep = [i for i in range(L) if i not in drop]
    m.model.layers = torch.nn.ModuleList([m.model.layers[i] for i in keep])
    for j, layer in enumerate(m.model.layers): layer.self_attn.layer_idx = j
    m.config.num_hidden_layers = len(keep)
    if getattr(m.config, "layer_types", None): m.config.layer_types = [m.config.layer_types[i] for i in keep]
    m.save_pretrained(args.out, safe_serialization=True); tok.save_pretrained(args.out)
    info = {"block_influence": [round(x, 5) for x in bi.tolist()], "dropped": drop, "layers": len(keep),
            "params": sum(p.numel() for p in m.parameters())}
    json.dump(info, open(f"{args.out}/prune.json", "w"), indent=1)
    print(json.dumps(info))

if __name__ == "__main__":
    main()
