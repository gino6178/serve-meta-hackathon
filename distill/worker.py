"""The decision model's worker: the int4 GGUF on the CPU (llama.cpp through llama-cpp-python), one forward pass per
decision, nothing generated. POST /decide with the facts of one member decision (distill/prompt.py from_case's fields);
it answers with a probability for every declared option and P(works) for every listed time.
   python distill/worker.py --gguf model.gguf --tokenizer dir_with_tokenizer.json [--port 11447] [--threads 8]
Requests are answered one at a time (one llama.cpp context); seconds each on the server's shared CPU (8 threads).
"""
import argparse, json, os, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prompt import Builder

class Tok:
    """The Hugging Face tokenizer (tokenizer.json), so the ids are the ones the model was trained on."""
    def __init__(self, path):
        from tokenizers import Tokenizer
        self.t = Tokenizer.from_file(os.path.join(path, "tokenizer.json"))
    def encode(self, s, add_special_tokens=False):
        return self.t.encode(s, add_special_tokens=add_special_tokens).ids

class BusyError(Exception):
    pass

def softmax(z):
    z = np.asarray(z, dtype=np.float64); z = z - z.max(); e = np.exp(z); return e / e.sum()

class Model:
    """One llama.cpp context. The vocabulary logits are computed only at the positions read (the markers and the answer),
    and the cache of the prefix shared with the previous request is kept."""
    def __init__(self, gguf, tok, threads, ctx=1024, order="time"):
        import llama_cpp as lc
        from llama_cpp import Llama
        self.lc = lc
        self.llm = Llama(model_path=gguf, n_ctx=ctx, n_batch=ctx, n_ubatch=512, n_threads=threads, n_threads_batch=threads, logits_all=False, verbose=False)
        self.ctx = self.llm._ctx.ctx; self.mem = lc.llama_get_memory(self.ctx); self.nv = self.llm.n_vocab(); self.n_ctx = ctx
        self.batch = lc.llama_batch_init(ctx, 0, 1); self.prev = []
        self.b = Builder(tok, order); self.lock = threading.Lock(); self.name = os.path.basename(gguf)
    def forward(self, ids, want, cols):
        lc = self.lc
        if len(ids) > self.n_ctx: raise ValueError(f"{len(ids)} tokens, more than the context ({self.n_ctx})")
        L = 0
        for a, b in zip(self.prev, ids):
            if a != b: break
            L += 1
        L = min(L, min(want), len(ids) - 1)
        lc.llama_memory_seq_rm(self.mem, 0, L, -1)
        b = self.batch; n = len(ids) - L; b.n_tokens = n
        for i in range(n):
            b.token[i] = ids[L + i]; b.pos[i] = L + i; b.n_seq_id[i] = 1; b.seq_id[i][0] = 0; b.logits[i] = (L + i) in want
        self.prev = []
        rc = lc.llama_decode(self.ctx, b)
        if rc != 0: raise RuntimeError(f"llama_decode returned {rc}")
        self.prev = list(ids)
        out = {}
        for p in want:
            row = np.ctypeslib.as_array(lc.llama_get_logits_ith(self.ctx, p - L), shape=(self.nv,))
            out[p] = row[cols[p]].astype(np.float64)
        return out, L
    def decide(self, case):
        x = self.b.build(case, case.get("short", True))
        letters = [self.b.letter[l] for l, _, _ in x["options"]]
        cols = {pos: [self.b.yes, self.b.no] for _, pos in x["markers"]}; cols[x["answer"]] = letters
        q0 = time.time()
        # one decision at a time: a request that would wait longer than max_wait_ms for the one before it is turned
        # away at once (busy), so its caller asks Muse Glimmer without having waited for nothing
        if not self.lock.acquire(timeout=max(0.0, float(case.get("max_wait_ms", 8000)) / 1000)): raise BusyError("busy")
        try:
            # a request whose caller has stopped waiting (its deadline, ms since the epoch) is not computed
            if case.get("deadline") and time.time() * 1000 > case["deadline"]: raise TimeoutError("past its deadline")
            t0 = time.time()
            z, reused = self.forward(x["ids"], set(cols), cols)
            ms = (time.time() - t0) * 1000
        finally:
            self.lock.release()
        p = softmax(z[x["answer"]])
        pw = {t: float(softmax(z[pos])[0]) for t, pos in x["markers"]}
        opts = [{"letter": l, "kind": k, "id": t, "p": round(float(q), 4)} for (l, k, t), q in zip(x["options"], p)]
        best = max(opts, key=lambda o: o["p"])
        return {"options": opts, "pick": best, "works_p": {t: round(q, 4) for t, q in pw.items()}, "ms": round(ms, 1), "queued_ms": round((t0 - q0) * 1000, 1), "tokens": len(x["ids"]), "reused": reused, "model": self.name}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gguf", required=True); ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--port", type=int, default=11447); ap.add_argument("--threads", type=int, default=8)  # a shared CPU: 8 at most
    ap.add_argument("--order", default="time", choices=["time", "listed"])  # as the model was trained
    a = ap.parse_args()
    M = Model(a.gguf, Tok(a.tokenizer), a.threads, order=a.order)
    class H(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def reply(self, code, obj):
            b = json.dumps(obj).encode(); self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            self.reply(200, {"ready": True, "model": M.name}) if self.path == "/health" else self.reply(404, {"error": "not found"})
        def do_POST(self):
            if self.path != "/decide": return self.reply(404, {"error": "not found"})
            try:
                case = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
                self.reply(200, M.decide(case))
            except TimeoutError as e:
                self.reply(408, {"error": str(e)})
            except BusyError as e:
                self.reply(503, {"error": str(e)})
            except BrokenPipeError:
                pass
            except Exception as e:
                self.reply(400, {"error": str(e)[:200]})
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    print(f"decision worker on 127.0.0.1:{a.port} ({M.name}, {a.threads} threads)", flush=True)
    srv.serve_forever()

if __name__ == "__main__":
    main()
