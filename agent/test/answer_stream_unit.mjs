// Unit tests for the streamed answer (src/agents/answer.js sentenceGate and answer({onDelta}), src/core/llm.js
// chatDeltas): a sentence is shown only after it passes the checks, in order; one that fails ends the streaming and the
// final text replaces what was shown. A stand-in for Ollama's /api/chat streams scripted pieces: no model, no network.
//   node --test test/answer_stream_unit.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

// the replies the model gives, in order; each is the list of pieces it streams
let script = [];
const srv = http.createServer((req, res) => {
  let b = '';
  req.on('data', c => (b += c));
  req.on('end', () => {
    const j = JSON.parse(b || '{}'),
      pieces = script.shift() || ['(nothing scripted)'];
    const end = {
      model: j.model,
      done: true,
      done_reason: 'stop',
      prompt_eval_count: 50,
      eval_count: 20,
      eval_duration: 1e8,
    };
    if (!j.stream) {
      res.writeHead(200, {'content-type': 'application/json'});
      return res.end(
        JSON.stringify({
          ...end,
          message: {role: 'assistant', content: pieces.join('')},
        }),
      );
    }
    res.writeHead(200, {'content-type': 'application/x-ndjson'});
    for (const p of pieces)
      res.write(
        JSON.stringify({
          model: j.model,
          message: {role: 'assistant', content: p},
          done: false,
        }) + '\n',
      );
    res.end(
      JSON.stringify({...end, message: {role: 'assistant', content: ''}}) +
        '\n',
    );
  });
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-astream-'));
Object.assign(process.env, {
  LLM_URL: `http://127.0.0.1:${srv.address().port}/v1`,
  LLM_MODEL: 'muse-glimmer',
  LLM_FALLBACK: 'off',
  LLM_ROUTE: 'off',
  MEMORY_CONV: 'off',
  LEDGER_FILE: `${tmp}/ledger.jsonl`,
  TRACE_FILE: `${tmp}/traces.jsonl`,
  CONV_DIR: `${tmp}/conv`,
});
delete process.env.LLM_ONLY;
delete process.env.LLM_FAST;
const A = await import('../src/agents/answer.js');
test.after(() => srv.close());

const now = new Date('2026-11-02T10:00:00');
const sheet = A.factsFor({app: {}, now});
const gate = (pieces, stop = () => {}) => {
  const out = [],
    g = A.sentenceGate({sheet, extra: '', release: s => out.push(s)});
  for (const p of pieces) g.push(p, stop);
  g.end();
  return {g, out};
};

test('a clean reply is let out sentence by sentence, in order, however the pieces fall', () => {
  const {out, g} = gate([
    'Hi! ',
    'You have a game on Sat',
    'urday. See you ther',
    'e? 好的。我來安排！',
    'Done',
  ]);
  assert.deepEqual(out, [
    'Hi!',
    ' You have a game on Saturday.',
    ' See you there?',
    ' 好的。',
    '我來安排！',
    'Done',
  ]);
  assert.equal(g.failed, false);
});

test('a number such as 2.5 does not end a sentence', () => {
  const {out} = gate(['Your goal is 2.5 games', ' a week. Fine.']);
  assert.deepEqual(out, ['Your goal is 2.5 games a week.', ' Fine.']);
});

test('a sentence with a number that is not in the facts is never let out, and nothing after it', () => {
  let stopped = 0;
  const {out, g} = gate(
    ['You have a game. ', 'You played 987654 games. ', 'Then more. '],
    () => stopped++,
  );
  assert.deepEqual(out, ['You have a game.']);
  assert.equal(g.failed, true);
  assert.ok(stopped >= 1, 'the generation is stopped');
  assert.ok(!out.join('').includes('987654'));
});

test('a number the player wrote, a small count and a fact id are fine', () => {
  const out = [],
    g = A.sentenceGate({
      sheet,
      extra: 'court 4321',
      release: s => out.push(s),
    });
  g.push('Court 4321 is free [F2]. You have 3 games. ', () => {});
  g.end();
  assert.equal(g.failed, false);
  assert.equal(out.join(''), 'Court 4321 is free. You have 3 games.');
});

test('coaching and data are not let out', () => {
  assert.equal(gate(['Try to hit the shuttle higher. ']).out.length, 0);
  assert.equal(gate(['{"next": "Sat", "goal": 2}']).out.length, 0);
});

test('answer(): a clean streamed reply arrives in order and the final text is the same', async () => {
  script = [['Your goal is 2 games a week. ', 'Want me to line one up?']];
  const heard = [];
  const r = await A.answer({
    text: 'what is my goal?',
    app: {},
    now,
    onDelta: s => heard.push(s),
  });
  assert.equal(
    heard.join(''),
    'Your goal is 2 games a week. Want me to line one up?',
  );
  assert.equal(r.text, heard.join(''));
  assert.equal(r.replaced, false);
  assert.equal(r.verified.ok, true);
  assert.equal(r.tries, 1);
});

test('answer(): a bad sentence stops the stream; the retry replaces what was shown', async () => {
  script = [
    ['You have a game soon. ', 'You played 987654 games. ', 'More. '],
    ['Your next game is on its way.'],
  ];
  const heard = [];
  const r = await A.answer({
    text: 'next game?',
    app: {},
    now,
    onDelta: s => heard.push(s),
  });
  assert.deepEqual(heard, ['You have a game soon.']);
  assert.ok(!heard.join('').includes('987654'));
  assert.equal(r.text, 'Your next game is on its way.');
  assert.equal(r.replaced, true);
  assert.equal(r.tries, 2);
});

test('answer(): two bad replies give the facts instead; nothing bad was shown', async () => {
  script = [['You played 987654 games. '], ['You played 555555 games. ']];
  const heard = [];
  const r = await A.answer({
    text: 'how many games this week?',
    app: {},
    now,
    onDelta: s => heard.push(s),
  });
  assert.deepEqual(heard, []);
  assert.match(r.text, /^Here is what I know/);
  assert.equal(r.replaced, false);
});

test('answer() without onDelta is unchanged', async () => {
  script = [['Your goal is 2 games a week.']];
  const r = await A.answer({text: 'goal?', app: {}, now});
  assert.equal(r.text, 'Your goal is 2 games a week.');
  assert.ok(!('replaced' in r));
});

test('webapi.answer(): deltas go out after Llama Guard in; a flagged reply comes back replaced', async () => {
  const webapi = await import('../src/channels/webapi.js');
  const heard = [];
  script = [['Your goal is 2 games a week.']];
  const r = await webapi.answer(
    {text: 'goal?', you: {}},
    args => A.answer({...args, now}),
    {onDelta: s => heard.push(s)},
  );
  assert.deepEqual(heard, ['Your goal is 2 games a week.']);
  assert.equal(r.text, 'Your goal is 2 games a week.');
  assert.equal(r.replaced, false);
});

test("a member's facts are their own: no demo club, goal or games; their sports and area", () => {
  const s = A.factsFor({app: {member: 'm1', sports: ['tennis'], area: true, upcoming: [], history: []}, now});
  const all = s.facts.map(f => f.text).join(' ');
  assert.doesNotMatch(all, /Kenji|Tomás|Riverside|Your goal|Your club:/i);
  assert.match(all, /not set a weekly goal/);
  assert.match(all, /Your sports: tennis\. Your home area is set\./);
  assert.match(all, /body log is empty/);
  assert.ok(A.factsFor({app: {}, now}).facts.some(f => f.key === 'club'));
});

test('a possible break or swelling gets the doctor line, in the message language, once', async () => {
  assert.match(A.urgentCare('my ankle swelled up, might be broken', 'I cannot diagnose that.'), /doctor/);
  assert.match(A.urgentCare('腳踝腫起來了', '我不能診斷。'), /醫生/);
  assert.equal(A.urgentCare('my ankle is swollen', 'Please see a doctor.'), null);
  assert.equal(A.urgentCare('I need a break this week', 'Sure.'), null);
  const heard = [];
  script = [['I cannot diagnose that. ', 'Want a game later?']];
  const r = await A.answer({text: 'My knee is swollen, is it broken?', app: {}, now, onDelta: s => heard.push(s)});
  assert.match(r.text, /^That needs a doctor today/);
  // (only the doctor line is streamed; the rest comes with the finished answer)
  assert.equal(heard.length, 1);
  // (an emergency is answered by its line alone, round 46)
  assert.equal(r.text, heard[0].trim());
});

test('a reply in the other language, or a markdown list, is written again', async () => {
  assert.equal(A.sameLanguage('我這個月打得怎樣', 'You played 0 games.'), false);
  assert.equal(A.sameLanguage('我 tomorrow 有 game 嗎', 'No game tomorrow.'), true);
  script = [['You have no games this month.'], ['這個月你還沒打過球。']];
  const r = await A.answer({text: '我這個月打得怎樣', app: {}, now});
  assert.equal(r.text, '這個月你還沒打過球。');
  script = [['Here:\n* No game booked\n* 0 games'], ['No game is booked yet.']];
  assert.equal((await A.answer({text: 'list my facts', app: {}, now})).text, 'No game is booked yet.');
});

test('soreness without a word of rest gets the rest line; volleyball wording is said plainly', async () => {
  assert.match(A.sore('my knee is sore, can i play?', 'I cannot give medical advice.'), /rest it/);
  assert.equal(A.sore('my knee is sore', 'Rest it for a day.'), null);
  assert.equal(A.sore('who do i play with?', 'Nobody yet.'), null);
  script = [['我可以幫你排球賽。']];
  assert.equal((await A.answer({text: '你可以做什麼', app: {}, now})).text, '我可以幫你安排球局。');
});

test('the not-a-coach line for a question that asked no such thing is written again; a dose question gets the pharmacist line', async () => {
  assert.equal(A.misplacedRefusal('我的目標是什麼', '我不分析打法或給訓練建議。'), true);
  assert.equal(A.misplacedRefusal('反手怎麼練', '我不分析打法或給訓練建議。'), false);
  script = [['我不分析打法或給訓練建議。'], ['你還沒有設定每週目標。']];
  assert.equal((await A.answer({text: '我的目標是什麼', app: {}, now})).text, '你還沒有設定每週目標。');
  assert.match(A.medsCare('how many mg of ibuprofen?', 'I cannot give medical advice.'), /pharmacist/);
  assert.equal(A.medsCare('how many mg of ibuprofen?', 'Ask your doctor.'), null);
});

test('"what can you do" answered with the not-a-coach line among the rest stands', async () => {
  assert.equal(A.misplacedRefusal('what can you do', 'I line up games and find courts. I don\'t analyse play or give training tips.'), false);
  assert.equal(A.misplacedRefusal('whats my goal', 'I don\'t analyse play or give training tips. Want a game?'), true);
});

test('a reply given before, word for word, to a different message is written again', async () => {
  script = [['本週目前 0 場。'], ['你還沒有設定目標。']];
  const r = await A.answer({text: '我的目標是什麼', app: {}, now, history: [{role: 'user', content: '這個月打得怎樣'}, {role: 'assistant', content: '本週目前 0 場。'}]});
  assert.equal(r.text, '你還沒有設定目標。');
});

test('after the doctor line the physio sentence goes; "my facts" is said plainly', async () => {
  script = [["I can't diagnose that. If it stays swollen, see a physio. Want a game later?"]];
  const r = await A.answer({text: 'my ankle swelled up, might be broken', app: {}, now});
  assert.doesNotMatch(r.text, /physio/);
  // (the line alone: no physio, no offer of a game, nothing carried from earlier turns)
  assert.match(r.text, /^That needs a doctor today[^]*urgent care now if it is very painful or you can't move it or put weight on it\.$/);
  script = [['Nothing in my facts says so.']];
  assert.equal((await A.answer({text: 'do i have a coach', app: {}, now})).text, 'Nothing in what I can see says so.');
});

test('asked about their sports, a reply naming none of them is written again', async () => {
  const sheet = A.factsFor({app: {member: 'm', sports: ['badminton'], area: true, upcoming: [], history: []}, now});
  assert.equal(A.missesSports('我打什麼運動、住哪一區', '我這邊沒有這個資訊。', sheet), true);
  assert.equal(A.missesSports('我打什麼運動', '你打羽球，住家區域已設定。', sheet), false);
  assert.equal(A.missesSports('whats my week', 'Nothing booked.', sheet), false);
  script = [['我這邊沒有這個資訊。'], ['你打羽球，住家區域已設定。']];
  const r = await A.answer({text: '我打什麼運動、住哪一區', app: {member: 'm', sports: ['badminton'], area: true}, now});
  assert.equal(r.text, '你打羽球，住家區域已設定。');
});

test('a streamed reply that starts as one already given is held back until it differs', async () => {
  const history = [{role: 'user', content: '這個月打得怎樣'}, {role: 'assistant', content: '本週 0 場。要幫你排一場嗎？'}];
  let heard = [];
  script = [['本週 0 場。', '你還沒跟人打過。']];
  let r = await A.answer({text: '我最常跟誰打', app: {}, now, history, onDelta: s => heard.push(s)});
  assert.equal(heard.join(''), '本週 0 場。你還沒跟人打過。');
  assert.equal(r.text, '本週 0 場。你還沒跟人打過。');
  heard = [];
  script = [['本週 0 場。', '要幫你排一場嗎？'], ['你還沒跟人打過。']];
  r = await A.answer({text: '我最常跟誰打', app: {}, now, history, onDelta: s => heard.push(s)});
  // (nothing of the repeat was shown, so the second try streams)
  assert.equal(heard.join(''), '你還沒跟人打過。');
  assert.equal(r.text, '你還沒跟人打過。');
});

test('a question about their sports is not streamed until a sport is named; a dizzy head knock is the emergency room now', async () => {
  const app = {member: 'm', sports: ['badminton'], area: true};
  let heard = [];
  script = [['我這邊沒有這個資訊。'], ['你打羽球。']];
  let r = await A.answer({text: '我打什麼運動', app, now, onDelta: s => heard.push(s)});
  assert.equal(heard.join(''), '你打羽球。');
  assert.equal(r.text, '你打羽球。');
  heard = [];
  script = [['好的。', '你打羽球。']];
  r = await A.answer({text: '我打什麼運動', app, now, onDelta: s => heard.push(s)});
  assert.equal(heard.join(''), '好的。你打羽球。');
  assert.match(A.urgentCare('I hit my head and feel dizzy', ''), /emergency room or call 119/);
  assert.match(A.urgentCare('打球時撞到頭，現在有點暈', ''), /現在就去急診/);
});

test('a medical reply to a message with nothing medical in it is written again', async () => {
  script = [["I can't give medical advice. See a physio."], ['Bye! Talk soon.']];
  assert.equal((await A.answer({text: 'bye', app: {}, now})).text, 'Bye! Talk soon.');
  script = [["I can't give medical advice; see a physio if it lasts."]];
  assert.match((await A.answer({text: 'my shoulder is sore', app: {}, now})).text, /physio/);
});

test('round 41-42 wordings: a ball to the head, no weight on the ankle, too many pills, a tight calf; limits asked are answered', () => {
  assert.match(A.urgentCare('i got hit in the head by a ball and feel sick', ''), /emergency room or call 119/);
  assert.match(A.urgentCare('被球打到頭，現在想吐', ''), /急診/);
  assert.match(A.urgentCare("I can't put any weight on my ankle after a fall", ''), /doctor today/);
  assert.match(A.urgentCare('my dad swallowed a whole bottle of pills', ''), /119/);
  assert.match(A.sore('my calf feels tight', 'ok'), /rest it/);
  const sheet = A.factsFor({app: {member: 'm', sports: ['pickleball'], area: true, limitKm: 5, limitEach: 200}, now});
  assert.equal(A.missesLimits('how far will i go', "I don't have a distance limit.", sheet), true);
  assert.equal(A.missesLimits('how much will i pay', 'At most NT$200 each.', sheet), false);
});
