// The feed's tiny prefilter model (feed/moderation.js prefilter, FEED_TINY=1): hashed character and word n-grams, a
// logistic regression with int8 weights, in pure JS. It only ever says "clearly fine" (the text skips Prompt Guard,
// Llama Guard and the club's standard; code's own checks still run) or "send onward" (the checks as before). It never
// refuses anything itself. Trained on synthetic comments labeled by the real checks (distill/tiny_mod.py).
//   - Before the model, rules send onward whatever it cannot read safely: lookalike letters from other scripts, hidden
//     or joining characters, letters set apart or broken by symbols, digits or symbols inside a word, links, emails,
//     long runs of digits, text over 280 characters.
//   - Then two scores: the model's P(fine), and the doubt model's chance that this "fine" is wrong. It passes only when
//     P(fine) and the doubt both clear thresholds chosen on held-out comments so that no hostile or injected one passed.
import fs from "node:fs";

export const DIM = 1 << 16;
// FNV-1a over a string's UTF-16 code units (distill/tiny_mod.py reads the indices this writes, never hashes itself)
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
// letters that pass: ASCII, CJK ideographs and kana/hangul, CJK and fullwidth punctuation, and emoji (with the
// variation selector); anything else (Cyrillic or Greek lookalikes, fullwidth letters, zero-width and joining
// characters, bidi controls, combining marks) is sent onward
const ALLOWED = /^[\x20-\x7e\n　-〿぀-ヿ一-鿿㐀-䶿가-힯！-／：-＠［-｀｛-･‘’“”…—–·️\u{1f300}-\u{1faff}\u{2600}-\u{27bf}\u{1f1e6}-\u{1f1ff}]*$/u;
const RULES = [
  ["script", (t) => !ALLOWED.test(t)],
  ["long", (t) => t.length > 280],
  ["spaced", (t) => /(?<![A-Za-z])[A-Za-z]([\s.\-_*·]{1,2})(?:[A-Za-z]\1){2,}[A-Za-z](?![A-Za-z])/.test(t) || /[A-Za-z][\-_*·|]+[A-Za-z][\-_*·|]+[A-Za-z]/.test(t)],
  ["inword", (t) => /[A-Za-z][0-9@$!|]+[A-Za-z]/.test(t) || /\b[0-9@$][A-Za-z]{2,}[0-9@$]/.test(t)],
  ["link", (t) => /https?:|www\.|\b[\w-]+\.(com|org|net|io|ly|me|app|dev|info|xyz|tw|cn|co|example)\b|\S+@\S+\.\S+|@\w{2,}/i.test(t)],
  ["digits", (t) => /\d[\d\s-]{6,}\d/.test(t)],
];
export const hardRule = (text) => RULES.find(([, f]) => f(String(text)))?.[0] || null;

// the hashed features of a text: word unigrams and bigrams (Latin words; each CJK character as a word), and character
// 2- to 4-grams of the lowercased text with spaces folded; each index counted once
export function features(text) {
  const t = String(text).toLowerCase().replace(/\s+/g, " ").trim(), out = new Set();
  const words = t.match(/[a-z0-9']+|[぀-ヿ一-鿿㐀-䶿가-힯]|[!?。！？]/g) || [];
  for (let i = 0; i < words.length; i++) { out.add(fnv(`w:${words[i]}`) % DIM); if (i) out.add(fnv(`b:${words[i - 1]} ${words[i]}`) % DIM); }
  const s = ` ${t} `;
  for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= s.length; i++) out.add(fnv(`c${n}:${s.slice(i, i + n)}`) % DIM);
  return [...out];
}
// what the doubt model reads besides the score: length, share of CJK, question and exclamation marks, capitals,
// second-person words, and how many of the text's features the model has a weight for
export function textFacts(text, idx, w) {
  const t = String(text), n = Math.max(1, t.length), cjk = (t.match(/[一-鿿]/g) || []).length;
  const caps = (t.match(/[A-Z]/g) || []).length, letters = Math.max(1, (t.match(/[A-Za-z]/g) || []).length);
  const known = idx.filter((i) => w[i] !== 0).length / Math.max(1, idx.length);
  return [Math.min(n, 280) / 280, cjk / n, /[?？]/.test(t) ? 1 : 0, /[!！]/.test(t) ? 1 : 0, caps / letters, /\b(you|your|u|ur)\b|你|妳/i.test(t) ? 1 : 0, known];
}

let model = null, weights = null;
export function loadText(file = process.env.FEED_TINY_FILE || new URL("./tiny_text.json", import.meta.url)) {
  if (!model) {
    model = JSON.parse(fs.readFileSync(file, "utf8"));
    weights = new Int8Array(Buffer.from(model.weights, "base64").buffer.slice(0));
  }
  return { model, weights };
}
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
// { rule } when a rule sends it onward, else { p: P(fine), doubt, pass }
export function readText(text, loaded = loadText()) {
  const rule = hardRule(text);
  if (rule) return { rule, pass: false };
  const { model: m, weights: w } = loaded, idx = features(text);
  let z = m.bias;
  for (const i of idx) z += w[i] * m.scale;
  const p = sigmoid(z), facts = textFacts(text, idx, w);
  const x = [p, Math.abs(p - 0.5) * 2, p > 0 && p < 1 ? -(p * Math.log(p) + (1 - p) * Math.log(1 - p)) / Math.LN2 : 0, ...facts];
  const d = m.doubt, doubt = sigmoid(d.b + d.w.reduce((a, wk, k) => a + wk * ((x[k] - d.mu[k]) / d.sd[k]), 0));
  return { p, doubt, pass: p >= m.minP && doubt <= m.maxDoubt };
}
