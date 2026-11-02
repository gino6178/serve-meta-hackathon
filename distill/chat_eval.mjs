// The chat 1B on the held-out chat set (distill/chat_split.py test.jsonl), against the agent's own checks and Muse
// Glimmer as judge. For each held-out prompt: the model's reply, then
//   checks   every number in the facts or the message (answer.js check), no coaching, not data, no fact ids
//   language Chinese in, Chinese out (and Traditional: no common simplified-only characters); English in, English out
//   length   under 70 words / 140 characters of Chinese, as the prompt asks
//   judge    Glimmer, shown the facts, the message and the reply: does it answer well and truthfully? (yes / no)
// and the same for Glimmer's own first reply when it is in the row, so both are judged alike.
//   cd <agent dir> && LLM_URL=http://127.0.0.1:11434/v1 node ../distill/chat_eval.mjs test.jsonl <model> out.json [n]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [IN, MODEL, OUT, N = '400'] = process.argv.slice(2);
const A = await import(pathToFileURL(path.resolve('src/agents/answer.js')).href);
const URL = (process.env.LLM_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
const rows = fs
  .readFileSync(IN, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l))
  .slice(0, +N);

async function ask(model, messages, {max = 220, temperature = 0.3} = {}) {
  const t0 = Date.now();
  const r = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({model, messages, max_tokens: max, temperature, stream: false}),
  });
  const j = await r.json();
  return {text: String(j.choices?.[0]?.message?.content ?? '').trim(), ms: Date.now() - t0};
}
const CJK = /[㐀-鿿]/;
// simplified-only characters that a Traditional reply never has
const SIMPLIFIED = /[们这个说时间对没会来还为这里么吗问题帮场赛约优应经过现发动进关开门]/;
const numbersOf = sys => new Set((sys.match(/\d+/g) || []).map(Number));
function score(row, reply) {
  const sys = row.messages[0].content,
    user = row.messages.at(-1).content,
    facts = sys.split('FACTS:')[1]?.split('WHAT THEY TOLD YOU BEFORE:')[0] || '';
  const c = A.check(reply, {numbers: numbersOf(facts)}, user);
  // (a message in both languages may be answered in either)
  const zhIn = CJK.test(user),
    mixed = zhIn && /[A-Za-z]{2,}/.test(user),
    zhOut = CJK.test(reply);
  const words = reply.split(/\s+/).filter(Boolean).length,
    zhChars = (reply.match(/[㐀-鿿]/g) || []).length;
  return {
    empty: !reply,
    numbers: c.ok,
    coaching: A.coaching(reply),
    data: A.asData(reply),
    ids: /\[F\d+\]/.test(reply),
    language: mixed || zhIn === zhOut,
    traditional: !zhOut || !SIMPLIFIED.test(reply),
    length: zhOut ? zhChars <= 140 : words <= 75,
  };
}
const passes = s => !s.empty && s.numbers && !s.coaching && !s.data && !s.ids && s.language && s.traditional && s.length;
async function judge(row, reply) {
  const sys = row.messages[0].content,
    user = row.messages.at(-1).content;
  const facts = sys.split('FACTS:')[1]?.split('WHAT YOU CAN DO')[0] || '';
  const r = await ask(
    'muse-glimmer',
    [
      {
        role: 'system',
        content:
          "You check a sports club app agent's chat reply. The agent may use only the facts given; it is not a coach (it declines technique or training advice and offers a game instead) and never gives medical advice. Answer with one word: yes if the reply answers the member's message well, truthfully to the facts, in the member's language and in a friendly short way; no otherwise.",
      },
      {role: 'user', content: `FACTS:\n${facts}\nMEMBER: ${user}\nREPLY: ${reply}\nGood reply? yes or no.`},
    ],
    // (its reasoning comes first and used up 400 tokens, leaving no answer: every reply read as no)
    {max: 2500, temperature: 0},
  );
  return /^\s*yes/i.test(r.text.replace(/<think>[\s\S]*?<\/think>/, ''));
}

// the model's replies one at a time, so their times are its own; then the judging, 8 at a time (Glimmer reasons before
// each verdict, and one at a time took an hour for 100 rows)
const out = [];
for (const row of rows) {
  const r = await ask(MODEL, row.messages);
  const s = score(row, r.text),
    g = row.target ? score(row, row.target) : null;
  out.push({
    row,
    source: row.source,
    user: row.messages.at(-1).content,
    reply: r.text,
    ms: r.ms,
    checks: s,
    pass: passes(s),
    glimmer: row.target ?? null,
    glimmerPass: g ? passes(g) : null,
  });
}
let next = 0,
  judged = 0;
await Promise.all(
  Array.from({length: 8}, async () => {
    while (next < out.length) {
      const x = out[next++];
      x.judge = await judge(x.row, x.reply);
      x.glimmerJudge = x.glimmer ? await judge(x.row, x.glimmer) : null;
      delete x.row;
      if (++judged % 25 === 0) console.error(`judged ${judged}/${out.length}`);
    }
  }),
);
const rate = (xs, f) => +(xs.filter(f).length / Math.max(1, xs.length)).toFixed(3);
const g = out.filter(x => x.glimmer);
const ms = out.map(x => x.ms).sort((a, b) => a - b);
const summary = {
  model: MODEL,
  n: out.length,
  pass: rate(out, x => x.pass),
  judge: rate(out, x => x.judge),
  passAndJudge: rate(out, x => x.pass && x.judge),
  medianMs: ms[ms.length >> 1],
  p90Ms: ms[Math.floor(ms.length * 0.9)],
  fails: Object.fromEntries(
    ['empty', 'numbers', 'coaching', 'data', 'ids', 'language', 'traditional', 'length'].map(k => [
      k,
      out.filter(x => (k === 'empty' || k === 'coaching' || k === 'data' || k === 'ids' ? x.checks[k] : !x.checks[k])).length,
    ]),
  ),
  wholeTemplates: rate(out.filter(x => ['answer:greet:2', 'answer:plan:2', 'answer:attack:3'].includes(x.source)), x => x.pass && x.judge),
  glimmer: {n: g.length, pass: rate(g, x => x.glimmerPass), judge: rate(g, x => x.glimmerJudge)},
};
fs.writeFileSync(OUT, JSON.stringify({summary, rows: out}, null, 1));
console.log(JSON.stringify(summary, null, 1));
