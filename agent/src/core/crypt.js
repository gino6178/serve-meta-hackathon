// Encryption at rest. What Serve keeps about people (members, their limits and answers, their games, what they told
// their agent, their conversations, their venue notes) is written to disk sealed, so a copied disk, a backup on the NAS
// or a stray file shows nothing readable.
//   The master key: DATA_KEY (32 bytes, base64), or the file DATA_KEY_FILE (default data/keys/master.key, made once
//   with mode 600 when DATA_ENCRYPT=on). It never leaves this machine and is never in a backup of data/.
//   A key per store: HKDF-SHA256 of the master key, with the store's name as its purpose, so one store's key opens
//   nothing else. AES-256-GCM, a fresh 12-byte IV per write, the store's name as associated data (a sealed file moved
//   under another store's name does not open).
//   A key per person, for crypto-shredding (subjectKey, shred): what is kept about one person in a store that holds
//   it per person (their conversation memory) is sealed with a random key of their own, kept in a keyring sealed with
//   the master key. Deleting a person deletes their key, so their records, in this copy and in every backup made
//   before, can no longer be opened by anyone.
// Envelope: {"$enc":"serve/v1","kid":"<key id>","iv","tag","ct"} (base64url), in place of the JSON it holds.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const b64 = b => Buffer.from(b).toString('base64url'),
  unb64 = s => Buffer.from(String(s), 'base64url');
const KEY_FILE = () =>
  path.resolve(process.env.DATA_KEY_FILE || 'data/keys/master.key');
let master = null,
  masterFrom = null;
export const encryptOn = () =>
  process.env.DATA_ENCRYPT === 'on' || !!process.env.DATA_KEY;
export function masterKey() {
  const from = `${process.env.DATA_KEY || ''}|${KEY_FILE()}`;
  if (master && masterFrom === from) return master;
  masterFrom = from;
  if (process.env.DATA_KEY)
    master = Buffer.from(process.env.DATA_KEY, 'base64'); // (Node reads base64url here too)
  else if (fs.existsSync(KEY_FILE()))
    master = unb64(fs.readFileSync(KEY_FILE(), 'utf8').trim());
  else if (encryptOn()) {
    fs.mkdirSync(path.dirname(KEY_FILE()), {recursive: true, mode: 0o700});
    master = crypto.randomBytes(32);
    // wx: when two processes start at once, the first key written is the one both use
    try {
      fs.writeFileSync(KEY_FILE(), b64(master), {mode: 0o600, flag: 'wx'});
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      master = unb64(fs.readFileSync(KEY_FILE(), 'utf8').trim());
    }
  } else master = null;
  if (master && master.length !== 32)
    throw new Error('the data key must be 32 bytes');
  return master;
}
export const kidOf = key =>
  crypto.createHash('sha256').update(key).digest('base64url').slice(0, 8);
const derive = purpose =>
  Buffer.from(
    crypto.hkdfSync(
      'sha256',
      masterKey(),
      'serve-data-v1',
      `store:${purpose}`,
      32,
    ),
  );

export const sealed = x =>
  !!x && typeof x === 'object' && x.$enc === 'serve/v1';
export function sealWith(key, value, aad) {
  const iv = crypto.randomBytes(12),
    c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([
    c.update(JSON.stringify(value), 'utf8'),
    c.final(),
  ]);
  return {
    $enc: 'serve/v1',
    kid: kidOf(key),
    iv: b64(iv),
    tag: b64(c.getAuthTag()),
    ct: b64(ct),
  };
}
export function openWith(key, env, aad) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, unb64(env.iv));
  d.setAAD(Buffer.from(String(aad)));
  d.setAuthTag(unb64(env.tag));
  return JSON.parse(
    Buffer.concat([d.update(unb64(env.ct)), d.final()]).toString('utf8'),
  );
}
// a whole store, under its own derived key
export const seal = (value, store) => sealWith(derive(store), value, store);
export const open = (env, store) => openWith(derive(store), env, store);

// the keyring of per-person keys, itself a sealed store
const RING = () =>
  path.resolve(process.env.DATA_KEYRING_FILE || 'data/keys/subjects.json');
let ring = null,
  ringFrom = null;
function keyring() {
  if (ring && ringFrom === RING()) return ring;
  ringFrom = RING();
  try {
    const j = JSON.parse(fs.readFileSync(RING(), 'utf8'));
    ring = sealed(j) ? open(j, 'keyring') : j;
  } catch {
    ring = {};
  }
  return ring;
}
const saveRing = () => {
  fs.mkdirSync(path.dirname(RING()), {recursive: true, mode: 0o700});
  const tmp = `${RING()}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(masterKey() ? seal(ring, 'keyring') : ring),
    {mode: 0o600},
  );
  fs.renameSync(tmp, RING());
};
export function subjectKey(id, {create = true} = {}) {
  const r = keyring(),
    k = `s:${crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 24)}`;
  if (!r[k] && create) {
    r[k] = b64(crypto.randomBytes(32));
    saveRing();
  }
  return r[k] ? unb64(r[k]) : null;
}
// crypto-shredding: the person's key is gone, so whatever was sealed with it, anywhere, stays sealed forever
export function shred(id) {
  const r = keyring(),
    k = `s:${crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 24)}`;
  if (!r[k]) return false;
  delete r[k];
  saveRing();
  return true;
}
export const keyringSize = () => Object.keys(keyring()).length;
