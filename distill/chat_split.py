"""The chat set (distill/chat_teacher.mjs) split for training: whole templates held out (a mixed-language greeting, a
request to play written as a question, the Chinese "say I played 50 games" bait), then 8% of every other template's
rows at random. Train keeps only the rows whose Glimmer reply passed the agent's checks; test keeps every held-out
row's prompt, so the 1B is judged on the same inputs Glimmer was, whatever Glimmer did with them.
   python3 distill/chat_split.py teacher.jsonl <out dir>
"""
import json, random, re, sys, collections

HELD = {"answer:greet:2", "answer:plan:2", "answer:attack:3"}
CJK = re.compile(r"[㐀-鿿]")
# a reply in the language of the message it answers: Glimmer sometimes kept the earlier turns' Chinese for an English
# message (87 of 4,042), and the first 1B learned to answer "help" in Chinese. A message with both is either.
def same_language(user, reply):
    zh_in, en_in = bool(CJK.search(user)), bool(re.search(r"[A-Za-z]{2,}", user))
    if zh_in and en_in: return True
    return bool(CJK.search(reply)) == zh_in
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
rows = [r for r in rows if r.get("messages")]
random.seed(7)
train, test = [], []
for r in rows:
    held = r["source"] in HELD or random.random() < 0.08
    if held:
        test.append(r)
    elif r["ok"] and same_language(r["messages"][-1]["content"], r["target"]):
        train.append({"site": "answer", "source": r["source"], "messages": r["messages"], "target": r["target"]})
out = sys.argv[2]
with open(f"{out}/train.jsonl", "w") as f:
    for r in train: f.write(json.dumps(r, ensure_ascii=False) + "\n")
with open(f"{out}/test.jsonl", "w") as f:
    for r in test: f.write(json.dumps(r, ensure_ascii=False) + "\n")
n = collections.Counter(r["source"].split(":")[1] for r in train)
print(json.dumps({"rows": len(rows), "kept": sum(r["ok"] for r in rows), "train": len(train), "test": len(test),
                  "test_whole_templates": sum(r["source"] in HELD for r in test), "train_by_family": n}, ensure_ascii=False))
