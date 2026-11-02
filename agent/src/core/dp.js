// Differential privacy for what Serve shows about many people at once. Encryption at rest (crypt.js) keeps a copied
// disk unreadable; this keeps what Serve itself publishes from giving one person away.
//   Randomized response (local DP) for a venue mark: before a player's mark is kept anywhere (the notes file or the trust
//   chain), it is kept as given with probability e^ε/(e^ε+k-1) and otherwise swapped for one of the other k-1 values at
//   random. Serve never holds the true mark, so no record, backup or court order can say what one player answered;
//   counts over many players are debiased back (debias), so a venue's record stays useful.
//   Laplace noise on a released count (noisyCount): Lap(1/ε), seeded by a keyed hash of what is released, so asking
//   again gives the same answer and noise can't be averaged away by repeating the question.
//   A k threshold (MIN_GROUP): an aggregate over fewer than k people is not shown at all.
// DP=off turns all three off (tests that check exact counts). DP_EPS_MARK (default 2: with three values, a mark is kept
// as given 79% of the time), DP_EPS_COUNT (default 1) and DP_MIN_GROUP (default 5) set the parameters.
import crypto from 'node:crypto';
import path from 'node:path';
import * as crypt from './crypt.js';

export const on = () => process.env.DP !== 'off';
export const EPS_MARK = () => +(process.env.DP_EPS_MARK || 2);
export const EPS_COUNT = () => +(process.env.DP_EPS_COUNT || 1);
export const MIN_GROUP = () => +(process.env.DP_MIN_GROUP || 5);

// k-ary randomized response: the probability a value is kept, and the probability of each other value
export const keepP = (eps, k) => Math.exp(eps) / (Math.exp(eps) + k - 1);
export const swapP = (eps, k) => 1 / (Math.exp(eps) + k - 1);
export function randomize(
  value,
  values,
  eps = EPS_MARK(),
  rnd = () => crypto.randomInt(2 ** 31) / 2 ** 31,
) {
  const k = values.length;
  if (rnd() < keepP(eps, k)) return value;
  const others = values.filter(v => v !== value);
  return others[Math.min(others.length - 1, Math.floor(rnd() * others.length))];
}
// unbiased estimate of the true counts from randomized ones: (c_v - n·q)/(p - q), clamped at 0 and rounded
export function debias(counts, values, eps = EPS_MARK()) {
  const k = values.length,
    p = keepP(eps, k),
    q = swapP(eps, k),
    n = values.reduce((s, v) => s + (counts[v] || 0), 0);
  return Object.fromEntries(
    values.map(v => [
      v,
      Math.max(0, Math.round(((counts[v] || 0) - n * q) / (p - q))),
    ]),
  );
}

// the key that seeds the noise: from the data key when there is one, else a key file of its own
let secret = null,
  secretFrom = null;
function key() {
  const m = crypt.encryptOn() ? crypt.masterKey() : null,
    from = m
      ? 'master'
      : path.resolve(process.env.DP_KEY_FILE || 'data/keys/dp.key');
  if (secret && secretFrom === from) return secret;
  secretFrom = from;
  if (m)
    secret = Buffer.from(
      crypto.hkdfSync('sha256', m, 'serve-dp-v1', 'laplace', 32),
    );
  else {
    try {
      secret = Buffer.from(
        crypt.secretFile(from, () =>
          crypto.randomBytes(32).toString('base64url'),
        ),
        'base64url',
      );
    } catch {
      secret = null;
    }
    if (!secret || secret.length !== 32) secret = crypto.randomBytes(32); // kept in memory only
  }
  return secret;
}
// Laplace(0, scale), drawn from a keyed hash of `seed`: the same release always gets the same noise
export function laplace(scale, seed) {
  const h = crypto.createHmac('sha256', key()).update(String(seed)).digest();
  const u = (h.readUIntBE(0, 6) + 0.5) / 2 ** 48 - 0.5; // in (-0.5, 0.5)
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}
export const noisyCount = (n, seed, eps = EPS_COUNT()) =>
  on() ? Math.max(0, Math.round(n + laplace(1 / eps, `${seed}|${n}`))) : n;
// an aggregate is shown only over at least k people
export const enough = n => !on() || n >= MIN_GROUP();
