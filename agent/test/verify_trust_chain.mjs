// Check a Serve server's trust chain from outside, with nothing but its public addresses:
//   node test/verify_trust_chain.mjs https://play.theminimallab.com
// It reads /api/trust/chain (every entry and the signed daily heads) and /a2a/keys.json (the server's Ed25519 key),
// recomputes every hash and link, and checks each head's signature. Exit code 0 when all of it holds.
import crypto from "node:crypto";

const base = (process.argv[2] || "http://127.0.0.1:8790").replace(/\/$/, "");
const get = (p) => fetch(base + p, { signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
const entries = [];
let page;
do { page = await get(`/api/trust/chain?after=${entries.length - 1}&n=2000`); entries.push(...page.entries); } while (page.entries.length && entries.length < page.length);
const keys = await get("/a2a/keys.json");
const hashOf = (e) => crypto.createHash("sha256").update(JSON.stringify([e.n, e.at, e.kind, e.who, e.d, e.prev])).digest("hex");
let prev = page.genesis, bad = null;
for (const e of entries) {
  if (e.prev !== prev) { bad = `entry ${e.n} does not point at the one before it`; break; }
  if (hashOf(e) !== e.hash) { bad = `entry ${e.n} was changed after it was written`; break; }
  prev = e.hash;
}
let signed = 0;
for (const h of page.heads) {
  if (!bad && h.n && entries[h.n - 1]?.hash !== h.hash) bad = `the chain no longer matches the head signed on ${h.day}`;
  const k = keys.keys.find((x) => x.kid === h.kid) || keys.keys[0];
  if (h.sig && k) {
    const pub = crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: k.x }, format: "jwk" });
    if (crypto.verify(null, Buffer.from(`serve-trust-head:${h.day}:${h.n}:${h.hash}`), pub, Buffer.from(h.sig, "base64url"))) signed++;
    else if (!bad) bad = `the head of ${h.day} is not signed by this server's key`;
  }
}
console.log(bad ? `BROKEN: ${bad}` : `OK: ${entries.length} entries, every hash and link holds; ${signed} of ${page.heads.length} daily heads signed by ${keys.keys[0]?.kid}`);
process.exitCode = bad ? 1 : 0;
