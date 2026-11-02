// Muse Glimmer's answers to the chat inputs (distill/chat_inputs.mjs), through the agent's own answer() so the prompt
// is the one it really sends: the facts sheet, the earlier turns, the message. The call to the model is caught on its
// way out, so each row keeps the exact messages and Glimmer's reply. A row is kept as a training target only when that
// first reply passed the agent's own checks (every number in the facts, no coaching, not data); the rest are kept
// with ok: false, for counting.
//   cd <agent dir> && MEMORY_CONV=off LLM_URL=http://127.0.0.1:11434/v1 node ../distill/chat_teacher.mjs in.jsonl out.jsonl [parallel]
import fs from 'node:fs';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const [IN, OUT, PAR = '4'] = process.argv.slice(2);
const A = await import(pathToFileURL(path.resolve('src/agents/answer.js')).href);
const SYSTEM = "You are the player's own agent in Serve";
const done = new Set(
  fs.existsSync(OUT)
    ? fs
        .readFileSync(OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l).key)
    : [],
);

// the chat call, caught: which case is running is kept per async call (one fetch wrapper for all)
import {AsyncLocalStorage} from 'node:async_hooks';
const als = new AsyncLocalStorage();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const cap = als.getStore();
  const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
  const res = await realFetch(url, init);
  if (cap && body?.messages?.[0]?.content?.startsWith?.(SYSTEM)) {
    const j = await res.clone().json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content ?? j?.message?.content ?? null;
    cap.calls.push({messages: body.messages, text});
  }
  return res;
};

const rows = [];
for await (const l of readline.createInterface({input: fs.createReadStream(IN)})) if (l.trim()) rows.push(JSON.parse(l));
const out = fs.createWriteStream(OUT, {flags: 'a'});
let next = 0,
  kept = 0,
  seen = 0;
async function worker() {
  while (next < rows.length) {
    const k = next++,
      r = rows[k],
      key = `${k}`;
    if (done.has(key)) continue;
    const cap = {calls: []},
      t0 = Date.now();
    try {
      const a = await als.run(cap, () =>
        A.answer({text: r.text, app: r.app, history: r.history, now: new Date(r.now)}),
      );
      const first = cap.calls[0];
      // kept: Glimmer's first reply was used as it is (one try, passed the checks, not replaced)
      const ok = !!first && a.tries === 1 && a.verified?.ok && !a.verified?.rejected && !a.verified?.offline;
      out.write(
        JSON.stringify({
          key,
          site: 'answer',
          source: r.source,
          messages: first?.messages ?? null,
          target: ok ? String(first.text).trim() : null,
          final: a.text,
          ok,
          tries: a.tries,
          seconds: (Date.now() - t0) / 1000,
        }) + '\n',
      );
      kept += ok ? 1 : 0;
    } catch (e) {
      out.write(JSON.stringify({key, source: r.source, ok: false, error: String(e.message || e)}) + '\n');
    }
    if (++seen % 50 === 0) console.error(`${seen}/${rows.length} kept ${kept}`);
  }
}
await Promise.all(Array.from({length: +PAR}, worker));
out.end();
console.error(`done ${seen} kept ${kept}`);
