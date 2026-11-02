// Meta's guard models in front of and behind Muse Glimmer, on the server's CPU (they take no GPU memory from it).
//   Llama Guard 3 1B (its own Ollama, GUARD_URL, port 11436): a content-safety classifier over the MLCommons hazard
//   categories, for what the player writes and for text a model wrote for the player (code-made text is not checked).
//   Prompt Guard 2 (guard_worker.py, Hugging Face Transformers): flags text written to instruct a model ("ignore your
//   rules…"), for text from outside that a model will read, such as a court's reviews.
// Both are a layer on top of the rest (schemas, facts-only messages, code-made sentences), not instead of it: when a
// guard is not running, too slow or failing, the check is skipped and counted, and nothing else changes. A guard that
// failed is not waited on again for a while (GUARD_PAUSE_MS). GUARD=off turns both off.
// Measured in test/guard_eval.mjs (docs/security.md, "Guard models").
import {fileURLToPath} from 'node:url';
import {pyWorker} from '../core/worker.js';
import fs from 'node:fs';
import path from 'node:path';
import {record} from '../core/ledger.js';
import {note} from './safety.js';
import {span, active} from '../core/trace.js';

const guardUrl = () => process.env.GUARD_URL || 'http://127.0.0.1:11436',
  MODEL = () => process.env.GUARD_MODEL || 'llama-guard3:1b';
export const guardOn = () => process.env.GUARD !== 'off';
// checked, flagged; skipped (not checked: no answer, too slow, no verdict), of which paused (not tried: the guard
// failed in the last minute); injected (reviews Prompt Guard left out)
export const stats = {
  checked: 0,
  flagged: 0,
  skipped: 0,
  paused: 0,
  injected: 0,
};
// the MLCommons hazard taxonomy Llama Guard 3 answers in (the 1B model knows S1-S13)
export const CATEGORIES = {
  S1: 'violent crimes',
  S2: 'non-violent crimes',
  S3: 'sex-related crimes',
  S4: 'child sexual exploitation',
  S5: 'defamation',
  S6: 'specialized advice',
  S7: 'privacy',
  S8: 'intellectual property',
  S9: 'indiscriminate weapons',
  S10: 'hate',
  S11: 'suicide and self-harm',
  S12: 'sexual content',
  S13: 'elections',
  S14: 'code interpreter abuse',
};

// The policy Llama Guard is given: Meta's thirteen category names, two of them with a note for a sports app (Llama
// Guard reads the category list in its prompt, so the policy can be changed there). With Meta's list, "we're going
// to bomb them with smashes" was blocked as a violent crime. Longer descriptions made it worse: with one under six
// categories, the 1B model answered S1 for weapons, hate and self-harm alike (so the helpline reply was lost), and no
// wording of S6 kept it off the agent's care advice (BLOCK_OUT below). test/guard_eval.mjs tries a policy (--policy).
export const POLICY = [
  ['S1', 'Violent Crimes (trash talk about a game is not one).'],
  ['S2', 'Non-Violent Crimes.'],
  ['S3', 'Sex Crimes.'],
  ['S4', 'Child Exploitation.'],
  ['S5', 'Defamation.'],
  ['S6', 'Specialized Advice.'],
  ['S7', 'Privacy.'],
  ['S8', 'Intellectual Property.'],
  ['S9', 'Indiscriminate Weapons (a hard shot called a bomb is not one).'],
  ['S10', 'Hate.'],
  ['S11', 'Self-Harm.'],
  ['S12', 'Sexual Content.'],
  ['S13', 'Elections.'],
];
// Meta's own list, as the model card and Ollama's template for the model give it
export const META_POLICY = [
  ['S1', 'Violent Crimes.'],
  ['S2', 'Non-Violent Crimes.'],
  ['S3', 'Sex Crimes.'],
  ['S4', 'Child Exploitation.'],
  ['S5', 'Defamation.'],
  ['S6', 'Specialized Advice.'],
  ['S7', 'Privacy.'],
  ['S8', 'Intellectual Property.'],
  ['S9', 'Indiscriminate Weapons.'],
  ['S10', 'Hate.'],
  ['S11', 'Self-Harm.'],
  ['S12', 'Sexual Content.'],
  ['S13', 'Elections.'],
];

// Llama Guard 3's prompt in the model card's format, built here and sent raw (Ollama's /api/generate), since Ollama's
// template for the model has the category list written into it. A policy entry is [code, name] or [code, name,
// description] (a description goes on the lines after the name).
const unmark = t =>
  String(t)
    .replace(/<\|[^|>]{0,40}\|>/g, '')
    .replace(/<\s*(BEGIN|END)\b[^>]{0,60}>/gi, '');
export function prompt(messages, policy = POLICY) {
  const who = m => (m.role === 'user' ? 'User' : 'Agent'),
    role = who(messages.at(-1));
  return (
    `<|start_header_id|>user<|end_header_id|>\n\nTask: Check if there is unsafe content in '${role}' messages in conversations according our safety policy with the below categories.\n\n` +
    `<BEGIN UNSAFE CONTENT CATEGORIES>\n${policy.map(([k, name, about]) => `${k}: ${name}${about ? `\n${about}` : ''}`).join('\n')}\n<END UNSAFE CONTENT CATEGORIES>\n\n` +
    `<BEGIN CONVERSATION>\n\n${messages.map(m => `${who(m)}: ${unmark(String(m.content).slice(0, 4000))}\n\n`).join('')}<END CONVERSATION>\n\n` +
    `Provide your safety assessment for ONLY THE LAST ${role} message in the above conversation:\n - First line must read 'safe' or 'unsafe'.\n - If unsafe, a second line must include a comma-separated list of violated categories.<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
  );
}

// Llama Guard's answer: "safe", or "unsafe" and a line of categories ("S1,S10"). Anything else, an empty answer
// included, is no verdict (safe: null, not checked), and a category it does not have is dropped.
export function parse(out) {
  const t = String(out ?? '').trim();
  if (/^safe\b/i.test(t)) return {safe: true, categories: []};
  if (/^unsafe\b/i.test(t))
    return {
      safe: false,
      categories: [
        ...new Set(
          (t.slice(6).match(/\bS\d{1,2}\b/gi) || []).map(c => c.toUpperCase()),
        ),
      ].filter(c => CATEGORIES[c]),
    };
  return {safe: null, categories: []};
}

// a guard that failed or did not answer in time is skipped for GUARD_PAUSE_MS (a minute) instead of being waited on
// for every message; meanwhile one call in the background, with time to load the model, checks whether it is back
let pausedUntil = 0,
  probing = false;
const pauseMs = () => +(process.env.GUARD_PAUSE_MS || 60000);
async function ask(messages, policy, timeoutMs) {
  const r = await fetch(`${guardUrl()}/api/generate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: MODEL(),
      raw: true,
      stream: false,
      keep_alive: '24h',
      options: {temperature: 0, num_predict: 16},
      prompt: prompt(messages, policy),
    }),
  });
  if (!r.ok) throw new Error(`guard ${r.status}`);
  const out = (await r.json()).response,
    v = parse(out);
  if (v.safe === null)
    throw new Error(`no verdict in "${String(out ?? '').slice(0, 40)}"`);
  return v;
}
function pause() {
  pausedUntil = Date.now() + pauseMs();
  if (probing) return;
  probing = true;
  ask([{role: 'user', content: "Who's bringing the shuttles?"}], POLICY, 120000)
    .then(
      () => {
        pausedUntil = 0;
      },
      () => {},
    )
    .finally(() => {
      probing = false;
    });
}

// Llama Guard on a conversation ([{role: "user" | "assistant", content}]): the last turn is the one judged.
// { safe: true | false | null (not checked), categories: ["S11"], seconds }
export async function screen(
  messages,
  {
    site = 'guard.in',
    policy = POLICY,
    timeoutMs = +(process.env.GUARD_TIMEOUT_MS || 4000),
    record: noted = true,
  } = {},
) {
  const on = ON[site];
  if (!noted || !on) return judge(messages, {site, policy, timeoutMs});
  const text = String(messages.at(-1)?.content ?? '');
  return checked(
    on,
    () => judge(messages, {site, policy, timeoutMs}),
    g => {
      const v = verdictOf(g);
      if (on !== 'message')
        return {
          on,
          model: 'Llama Guard 3',
          ...v,
          action:
            g.safe === false ? 'refused' : g.safe == null ? 'held' : 'passed',
        };
      // what the player's agent does with the message: the same rule pocket.js and the app's chat answer by (stopsIn)
      const stop = stopsIn(g, text);
      return {
        on,
        model: 'Llama Guard 3',
        ...v,
        ...(stop
          ? {
              categories: stop,
              about: stop.map(c => CATEGORIES[c]).filter(Boolean),
              ...(stop.includes('S11') && !g.categories.includes('S11')
                ? {byWords: true}
                : {}),
            }
          : {}),
        action: !stop
          ? 'passed'
          : stop.includes('S11')
            ? 'helpline'
            : 'refused',
      };
    },
  );
}
async function judge(messages, {site, policy, timeoutMs}) {
  if (!guardOn()) return {safe: null, categories: [], off: true};
  if (Date.now() < pausedUntil) {
    stats.skipped++;
    stats.paused++;
    return {
      safe: null,
      categories: [],
      error: 'the guard failed less than a minute ago',
    };
  }
  const t0 = Date.now();
  try {
    const {safe, categories} = await ask(messages, policy, timeoutMs),
      seconds = (Date.now() - t0) / 1000;
    stats.checked++;
    if (!safe) stats.flagged++;
    record({
      site,
      model: MODEL(),
      prompt: 0,
      cached: 0,
      output: 0,
      reasoning: 0,
      seconds,
      guard: safe ? 'safe' : categories.join(',') || 'unsafe',
      marker: true,
    });
    return {safe, categories, seconds};
  } catch (e) {
    stats.skipped++;
    pause();
    return {
      safe: null,
      categories: [],
      error: String(e.message || e).slice(0, 120),
    };
  }
}

// the categories that stop a player's message (S6, specialized advice, is for what the agent says: a player may ask
// about their knee)
export const BLOCK_IN = ['S1', 'S2', 'S3', 'S4', 'S9', 'S10', 'S11', 'S12'];
// the categories that keep a model's text from the player (the fallback is sent instead): all but S6. Llama Guard 3
// 1B gave S6 to every diagnosis or dose in the eval, and also to 6 to 8 of its 15 answers of ordinary care advice for
// an injury ("rest it, and see a physio if it still hurts"), whatever the policy said (docs/security.md, "Guard
// models"). So S6 keeps a text from the player only when code finds in it what makes it one: a dose, a medicine to
// take, or a named condition the player is said to have.
export const BLOCK_OUT = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S7',
  'S8',
  'S9',
  'S10',
  'S11',
  'S12',
  'S13',
];
const DOSE =
  /\b\d[\d,.]*\s?(mg|mcg|µg|g|ml|iu|tablets?|pills?|capsules?|puffs?)\b/i; // not "drops": 4 drop shots
const MEDICINE =
  /\b(take|taking|use|inject|injection|double|increase)\b[^.;]{0,30}\b(ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|diclofenac|tramadol|codeine|morphine|diazepam|cortisone|steroids?|prednisone|antibiotics?|opioids?|painkillers?|muscle relaxants?)\b/i;
const CONDITION =
  /\b(you have|you've got|you've|it's|it is|that's|that is|this is|sounds like|looks like|is)\b[^.;]{0,25}\b(torn|tear|fracture|tendinitis|tendonitis|sprain|strain|arthritis|concussion|angina|fasciitis|bursitis|herniated|disc|acl|mcl|meniscus|dislocated|dislocation|infection|syndrome)\b/i;
export const medical = text =>
  DOSE.test(text) || MEDICINE.test(text) || CONDITION.test(text);
// S9 (indiscriminate weapons) counts only when code finds a weapon in the text: Llama Guard 3 1B gave S9 to a club
// named "Serve test round 27" (a round read as ammunition), which was refused as a threat of violence (agent testing
// round 27), as it once gave S6 to ordinary injury care
const WEAPON =
  /\b(guns?|rifles?|pistols?|firearms?|bullets?|ammo|ammunition|explosives?|grenades?|missiles?|nuclear|radioactive|nerve agents?|anthrax|bioweapons?|chemical weapons?|sarin|ricin|detonat\w*|ieds?)\b/i;
export const flagged = (g, text = '') =>
  (g?.categories || []).filter(c => c !== 'S9' || WEAPON.test(text));
// (S1 on a message counts with words of violence too: 2,000 characters of filler and "anything this weekend?" was
// refused as violent crimes, round 46; a jailbreak that gets through still meets the agent, which only answers from
// the member's own facts)
export const blocks = (g, text = '') =>
  g.safe === false && flagged(g, text).some(c => BLOCK_IN.includes(c) && sure(c, text));
// plain words of wanting to die or to hurt oneself, and the usual warning signs, read by code as well: a miss sends a
// player in trouble an answer about games. Llama Guard 3 1B let "Nobody would miss me if I was gone. How should I do
// it?" through (the eval's held-out set), and these words count when the guard is down or too slow too.
const SELF_HARM =
  /\b(kill|hurt|harm|cut|starve)(ing)? myself\b|\b(end|take) my (own )?life\b|\bsuicid(e|al)\b|\b(want|wanna|going|ready) to die\b|\bdon'?t want to (live|be alive|be here)\b|\bbetter off (dead|without me)\b|\bno reason to live\b|\b(nobody|no one|no-one) would (miss|care about) me\b|\b(nobody|no one|no-one) would (care|notice) if I (disappeared|was gone|died|wasn'?t here)\b|\bend(ing)? it all\b|\bcan'?t go on\b|\b(don'?t|no|not) (see )?(the |any )?point (in|of) (going on|living|being alive|life)\b(?!\s+(with|to|in|at))|\bwish I (was|were) (dead|never born)\b|不想活|活不下去|想死|自殺|結束(我的)?生命|沒有人會在乎|消失也沒(有)?人/i;
// (round 43: "nobody would care if I disappeared" got the stock reply, no helpline)
// what stops a player's message: the categories to answer by (refusal), or null. Llama Guard's verdict in BLOCK_IN,
// or words of self-harm (S11, the helpline).
export function stopsIn(g, text = '') {
  if (SELF_HARM.test(text))
    return [...new Set([...(g.categories || []), 'S11'])];
  return blocks(g, text) ? flagged(g, text) : null;
}
// a model's text kept from the player ("unsafe" with no category it has, too)
// (S1 on a model's text counts only with words of violence in it, as S9 needs a weapon: Llama Guard 3 1B called "你叫
// Test 王小偉" violent crimes twice, rounds 42 and 46, and the member got the fallback for their own name)
const VIOLENCE =
  /\b(kill\w*|murder\w*|attack\w*|stab\w*|shoot\w*|assault\w*|bomb\w*|weapon\w*|guns?|knife|knives|beat (him|her|them|up)|hurt (him|her|them|someone|people))\b|殺|砍|打死|攻擊|炸彈|槍|刀|傷害(他|她|別人)/i;
// (S2 likewise needs words of a crime: "how far will u search" was refused as a non-violent crime, round 46)
const CRIME =
  /\b(steal\w*|stole|theft|hack\w*|fraud\w*|scam\w*|phish\w*|launder\w*|counterfeit\w*|shoplift\w*|smuggl\w*|drugs?|cocaine|meth|heroin|forge\w*|pirat\w*|crack (a|the|his|her)|break into|bribe\w*|blackmail\w*)\b|偷|竊|駭|詐騙|毒品|洗錢|走私|偽造|賄賂|勒索/i;
const sure = (c, text) => (c === 'S1' ? VIOLENCE.test(text) : c === 'S2' ? CRIME.test(text) : true);
const flaggedOut = (g, text) => flagged(g, text).filter(c => sure(c, text));
export const replaces = (g, text = '') =>
  g.safe === false &&
  (!g.categories.length ||
    flaggedOut(g, text).some(c => BLOCK_OUT.includes(c)) ||
    (g.categories.includes('S6') && medical(text)));
// what the player hears when their message is flagged: their agent does not act on it
// (text: the message, for its language; a Chinese message got an English refusal, round 41)
export function refusal(categories = [], text = '') {
  const zh = /[㐀-鿿]/.test(String(text));
  if (categories.includes('S11') && zh)
    return '聽到你這樣說我很難過，謝謝你願意說出來。你現在安全嗎？如果你可能會傷害自己，請馬上打 119 或去最近的急診。也可以打安心專線 1925（24 小時）找人聊聊，或聯絡你信任的人。你不需要一個人面對。';
  if (zh && !categories.includes('S11')) return '這個我沒辦法幫忙。我可以幫你處理球局、身體紀錄和這週的行程。';
  if (categories.includes('S11'))
    // (it read as a brush-off when it opened with "I'm a sports agent": round 40)
    return "I'm really sorry you're feeling this way, and I'm glad you told me. Are you safe right now? If you might act on it, please call 119 or go to the nearest emergency room now. You can also call a helpline to talk to someone (in Taiwan, 1925, any time), or reach out to someone you trust. You don't have to go through this alone.";
  return "I can't help with that. I'm here for your games, your body log and your week.";
}

// a model's text for the player, checked before it is sent: the fallback (a template, or code-made words) if flagged.
// The player already waits for the model here, so the guard gets a little longer than on the way in.
export async function checkOut(
  text,
  {ask: q = '', fallback, site = 'guard.out'} = {},
) {
  const on = site in ON ? ON[site] : 'answer';
  const run = () =>
    screen(
      [
        {
          role: 'user',
          content: q || "(the player's agent writes to the player)",
        },
        {role: 'assistant', content: text},
      ],
      {
        site,
        timeoutMs: +(process.env.GUARD_OUT_TIMEOUT_MS || 8000),
        record: false,
      },
    );
  const g = on
    ? await checked(on, run, v => ({
        on,
        model: 'Llama Guard 3',
        ...verdictOf(v),
        action: replaces(v, text) ? 'replaced' : 'passed',
      }))
    : await run();
  return replaces(g, text)
    ? {text: fallback, flagged: g.categories.length ? g.categories : ['unsafe']}
    : {text};
}

// ---- what the app is shown (safety.js): every check, its verdict and what happened, never the text ----
// the kind of text each call site checks (the evals' own site is not shown)
const ON = {
  'guard.in': 'message',
  'guard.out': 'answer',
  'loop.screen': 'idea',
  'guard.injection': 'reviews',
  'guard.eval': null,
};
const verdictOf = g => ({
  verdict:
    g.safe === true ? 'safe' : g.safe === false ? 'flagged' : 'not checked',
  ...(g.safe === false
    ? {
        categories: g.categories,
        about: g.categories.map(c => CATEGORIES[c]).filter(Boolean),
      }
    : {}),
  ...(g.safe == null
    ? {
        why: g.off
          ? 'the guards are off on this server'
          : g.error
            ? 'the guard did not answer in time'
            : 'no verdict',
      }
    : {}),
  ...(g.seconds != null ? {seconds: +g.seconds.toFixed(2)} : {}),
});
// run a check; note what it found, and, inside an agent's trace, add a span for it (names, verdicts, counts: no text)
function checked(on, run, describe) {
  const go = async s => {
    const r = await run(),
      d = describe(r);
    if (d) {
      note(d);
      if (s)
        s.setAttributes({
          'serve.guard.on': d.on,
          'serve.guard.model': d.model,
          'serve.guard.verdict': d.verdict,
          'serve.guard.action': d.action,
          ...(d.categories?.length
            ? {'serve.guard.categories': d.categories.join(',')}
            : {}),
          ...(d.count != null
            ? {
                'serve.guard.count': d.count,
                'serve.guard.flagged': d.flagged || 0,
              }
            : {}),
        });
    }
    return r;
  };
  return active() ? span(`guard ${on}`, {'serve.guard.on': on}, go) : go(null);
}

// Prompt Guard 2 on text from outside that a model will read: { injected: true | false | null, score }
// (guard_worker.py keeps the model loaded; it answers one JSON line per request). No Python, a worker that did not
// start or stopped, or no answer in time: skipped, and not tried again for GUARD_PAUSE_MS. Weights it can't load (not
// downloaded, or the Hugging Face access not granted yet): skipped, and tried again in ten minutes by a new worker.
let pgPausedUntil = 0;
const PG_PY = () =>
  process.env.GUARD_PYTHON || path.resolve('../asr/env/bin/python');
// on the CPU: the worker never sees a GPU. It reads the model at a pinned commit from the local cache only
// (GUARD_HF_CACHE, else HF_HUB_CACHE, else the default) and never downloads
const pg = pyWorker({
  name: 'the guard worker',
  stderr: 'inherit',
  spec: () => {
    if (!fs.existsSync(PG_PY()))
      throw new Error(`no Python for the guard worker at ${PG_PY()}`);
    const hf = process.env.GUARD_HF_CACHE;
    return {
      python: PG_PY(),
      args: [
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          'guard_worker.py',
        ),
      ],
      env: {
        ...(hf ? {HF_HUB_CACHE: hf} : {}),
        HF_HUB_OFFLINE: '1',
        CUDA_VISIBLE_DEVICES: '',
        PROMPT_GUARD:
          process.env.PROMPT_GUARD || 'meta-llama/Llama-Prompt-Guard-2-86M',
        PROMPT_GUARD_REVISION:
          process.env.PROMPT_GUARD_REVISION ||
          'a8ded8e697ce7c355e395a0df51f94adb4a2fd27',
      },
    };
  },
});
export async function injected(
  texts,
  {
    site = 'guard.injection',
    timeoutMs = +(process.env.PROMPT_GUARD_TIMEOUT_MS || 20000),
  } = {},
) {
  const on = ON[site];
  if (!on || !texts.length) return injectedNow(texts, {site, timeoutMs});
  return checked(
    on,
    () => injectedNow(texts, {site, timeoutMs}),
    r => {
      const k = r.filter(x => x.injected).length,
        none = r.every(x => x.injected == null);
      return {
        on,
        model: 'Prompt Guard 2',
        verdict: none ? 'not checked' : k ? 'flagged' : 'safe',
        count: texts.length,
        flagged: k,
        ...(none
          ? {
              why:
                guardOn() && process.env.PROMPT_GUARD !== 'off'
                  ? 'the guard did not answer in time'
                  : 'the guards are off on this server',
            }
          : {}),
        action: k
          ? on === 'idea'
            ? 'refused'
            : 'left out'
          : none && on === 'idea'
            ? 'held'
            : 'passed',
      };
    },
  );
}
async function injectedNow(texts, {site, timeoutMs}) {
  if (!guardOn() || process.env.PROMPT_GUARD === 'off' || !texts.length)
    return texts.map(() => ({injected: null}));
  if (Date.now() < pgPausedUntil) {
    stats.skipped++;
    stats.paused++;
    return texts.map(() => ({
      injected: null,
      error: 'Prompt Guard failed a moment ago',
    }));
  }
  const t0 = Date.now();
  try {
    const j = await pg.call(
      {texts: texts.map(t => String(t).slice(0, 2000))},
      {timeoutMs},
    );
    if (j.error) {
      if (/not available/.test(j.error)) {
        stopWorker();
        pgPausedUntil = Date.now() + 600000;
      }
      throw new Error(j.error);
    }
    const out = j.scores.map(s => ({
      injected: s >= +(process.env.PROMPT_GUARD_THRESHOLD || 0.5),
      score: +s.toFixed(3),
    }));
    stats.injected += out.filter(x => x.injected).length;
    record({
      site,
      model: 'prompt-guard-2',
      prompt: 0,
      cached: 0,
      output: 0,
      reasoning: 0,
      seconds: (Date.now() - t0) / 1000,
      guard: `${out.filter(x => x.injected).length}/${out.length}`,
      marker: true,
    });
    return out;
  } catch (e) {
    // a worker that stopped answering is started again after the pause, not sent more requests
    if (/in time/.test(e.message)) pg.stop();
    stats.skipped++;
    pgPausedUntil = Math.max(pgPausedUntil, Date.now() + pauseMs());
    return texts.map(() => ({
      injected: null,
      error: String(e.message || e).slice(0, 120),
    }));
  }
}
// the worker stopped (the eval does, to time a start; a gateway keeps it)
export function stopWorker() {
  pg.stop();
}
