"""A learned intent router for Messenger messages (match/router.js): DRAMA vectors (memory/embed_worker.py) and a small
softmax head trained here, on the CPU, in numpy. Five classes: play (asks for a game), played (how a game went), body
(something hurts), question (about Serve), chat (anything else). Slash commands never reach it.

Training: what the simulated users wrote in the three runs after the fixes (each message carries what its persona meant
to say), deduplicated, and the phrasings written by hand for the regular expressions' tests. Test: test/sim_users/judge_heldout.json, 40 messages written separately in a person's style
(the judge's held-out set), mapped to the same classes; 'bail' and 'idea' have no class here and are left out. The
regular expressions that route a game request today (match/flow.js isPlayRequest) are scored on the same messages.
    python test/router_train.py <runs dir> <out head.json> <out results.json>
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

RUNS, HEAD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
CLASSES = ["play", "played", "body", "question", "chat"]
TRAIN_MAP = {"request": "play", "log": "played", "checkin-reply": "played", "niggle": "body", "question": "question", "hello": "chat", "trash-talk": "chat", "feed-post": "played", "feed-comment": "chat"}
TEST_MAP = {"request": "play", "log": "played", "checkin-reply": "played", "post": "played", "question": "question", "hello": "chat", "trash-talk": "chat", "comment": "chat"}
here = os.path.dirname(os.path.abspath(__file__))

train, seen = [], set()
for run in sorted(os.listdir(RUNS)):
    f = os.path.join(RUNS, run, "run.jsonl")
    if not os.path.exists(f):
        continue
    for line in open(f, encoding="utf-8"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        t, c = (e.get("text") or "").strip(), TRAIN_MAP.get(e.get("what"))
        if e.get("kind") == "user" and c and t and not t.startswith("/") and t.lower() not in seen:
            seen.add(t.lower())
            train.append((t, c, run))
# and the phrasings written by hand for the regular expressions' own tests (test/match_unit.mjs, sim_users_unit.mjs)
WRITTEN = [(t, "play") for t in ["I want to play", "anyone for doubles Thursday?", "Anyone up for a game tonight?", "we'd like to play tennis on Saturday", "fancy a hit tomorrow", "find me a partner for Sunday", "我週六早上想打球", "有人要打羽球嗎",
    "need badminton doubles tonight 19 to 22", "Find badminton doubles for Sunday afternoon, level A.", "下午想找 badminton doubles，level A，有場嗎？", "幫我安排今晚羽毛球單打，程度B左右，謝謝", "Need badminton doubles this afternoon. Level A. Can you find partner?"]] + [
    ("my knee hurts after playing", "body"), ("My right knee is sore after jumping", "body"), ("I played two hours with Leo", "played"), ("When is my next game?", "question"),
    ("club training Wed 19:00-21:00", "chat"), ("I have club training on Wednesday from 19:00 to 21:00", "chat"), ("I want to rest this week", "chat"), ("有人在嗎", "chat")]
train += [(t, c, "written") for t, c in WRITTEN if t.lower() not in seen]
held = json.load(open(os.path.join(here, "sim_users", "judge_heldout.json"), encoding="utf-8"))["messages"]
test = [(m["text"], TEST_MAP[m["kind"]]) for m in held if m["kind"] in TEST_MAP]

# the server's embedder, as the gateway runs it
w = subprocess.Popen([sys.executable, os.path.join(here, "..", "src", "memory", "embed_worker.py")], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
def embed(texts):
    w.stdin.write(json.dumps({"documents": texts}) + "\n"); w.stdin.flush()
    j = json.loads(w.stdout.readline())
    if "error" in j:
        raise SystemExit(j["error"])
    return np.array(j["vectors"], dtype=np.float32)

Xtr, ytr = embed([t for t, _, _ in train]), np.array([CLASSES.index(c) for _, c, _ in train])
Xte, yte = embed([t for t, _ in test]), np.array([CLASSES.index(c) for _, c in test])

def fit(X, y, l2=1e-3, steps=800, lr=0.5):
    # class weights: the rare classes count as much as the common ones
    k, n = len(CLASSES), len(y)
    cw = np.array([n / (k * max(1, (y == i).sum())) for i in range(k)])[y]
    W, b = np.zeros((X.shape[1], k)), np.zeros(k)
    Y = np.eye(k)[y]
    for _ in range(steps):
        Z = X @ W + b; Z -= Z.max(1, keepdims=True); P = np.exp(Z); P /= P.sum(1, keepdims=True)
        G = (P - Y) * cw[:, None] / n
        W -= lr * (X.T @ G + l2 * W); b -= lr * G.sum(0)
    return W, b
def predict(W, b, X):
    Z = X @ W + b; Z -= Z.max(1, keepdims=True); P = np.exp(Z); return P / P.sum(1, keepdims=True)

# leave one run out, on the training runs
runs = sorted({r for _, _, r in train} - {"written"}); cv = []
for r in runs:
    m = np.array([x[2] == r for x in train])
    W, b = fit(Xtr[~m], ytr[~m]); cv.append(float((predict(W, b, Xtr[m]).argmax(1) == ytr[m]).mean()))
W, b = fit(Xtr, ytr)
P = predict(W, b, Xte); pred = P.argmax(1)

# the regular expressions, on the binary question that decides routing: is this a request for a game?
src = open(os.path.join(here, "..", "src", "match", "flow.js"), encoding="utf-8").read()
node = subprocess.run(["node", "--input-type=module", "-e", "import { isPlayRequest } from './src/match/flow.js'; let s=''; process.stdin.on('data', d => s += d).on('end', () => console.log(JSON.stringify(JSON.parse(s).map(isPlayRequest))));"],
                      input=json.dumps([t for t, _ in test]), capture_output=True, text=True, cwd=os.path.join(here, ".."))
regex = json.loads(node.stdout) if node.returncode == 0 else None
play = CLASSES.index("play")
def binary(said):
    tp = sum(1 for s, y in zip(said, yte) if s and y == play); fp = sum(1 for s, y in zip(said, yte) if s and y != play); fn = sum(1 for s, y in zip(said, yte) if not s and y == play)
    return {"found": tp, "of": int((yte == play).sum()), "falseAlarms": fp, "missed": fn}
sure = 0.0  # the most likely class; with five classes and little data the probabilities are flat (0.3 to 0.5)
learned_play = [(p == play and P[i, play] >= sure) for i, p in enumerate(pred)]
both = [bool(r) or l for r, l in zip(regex or [False] * len(test), learned_play)]

res = {
    "simulated": True, "what": "intent router: DRAMA vectors and a softmax head (numpy), on the CPU", "classes": CLASSES,
    "train": {"messages": len(train), "runs": runs, "perClass": {c: int((ytr == i).sum()) for i, c in enumerate(CLASSES)}, "leaveOneRunOut": [round(x, 3) for x in cv]},
    "test": {"messages": len(test), "source": "test/sim_users/judge_heldout.json (bail and idea left out)", "accuracy": round(float((pred == yte).mean()), 3),
             "perClass": {c: {"right": int(((pred == i) & (yte == i)).sum()), "of": int((yte == i).sum())} for i, c in enumerate(CLASSES)},
             "gameRequests": {"regex": binary(regex) if regex else None, "learned": binary(learned_play), "regexOrLearned": binary(both), "learnedSure": sure},
             "wrong": [{"text": t, "is": c, "said": CLASSES[pred[i]], "p": round(float(P[i].max()), 2)} for i, (t, c) in enumerate(test) if pred[i] != yte[i]]},
}
json.dump({"model": os.environ.get("EMBED_MODEL") or "facebook/drama-base", "classes": CLASSES, "sure": sure, "W": np.round(W, 5).T.tolist(), "b": np.round(b, 5).tolist()}, open(HEAD, "w"))
json.dump(res, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(json.dumps({k: res["test"][k] for k in ("accuracy", "perClass", "gameRequests")}, ensure_ascii=False))
print("leave one run out:", res["train"]["leaveOneRunOut"])
w.stdin.close()
