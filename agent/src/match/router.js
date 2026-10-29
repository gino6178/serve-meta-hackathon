// A learned intent router behind the regular expressions (flow.js isPlayRequest): a message they miss is read by
// DRAMA (memory.js embed, the same vectors as memory) and a small softmax head trained on the CPU
// (test/router_train.py; router_head.json, five classes: play, played, body, question, chat). When "play" is the most
// likely class, the message goes to matchmaking like any request, whose game still waits for the player's yes. On the
// held-out messages (submission/results/intent_router.json) the expressions found 6 of 10 requests and the two
// together 10 of 10, with one false alarm in 22 other messages. INTENT_ROUTER=off turns it off; with no embedder it
// says no.
import fs from "node:fs";
import path from "node:path";
import { embed } from "../memory/memory.js";

const FILE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "router_head.json");
let head = null;
const load = () => (head ||= JSON.parse(fs.readFileSync(FILE, "utf8")));

// the class probabilities for one vector (rows of W are the classes)
export function classify(v, h = load()) {
  const z = h.W.map((row, i) => row.reduce((s, w, j) => s + w * (v[j] || 0), h.b[i]));
  const top = Math.max(...z), e = z.map((x) => Math.exp(x - top)), sum = e.reduce((a, b) => a + b, 0);
  const p = Object.fromEntries(h.classes.map((c, i) => [c, e[i] / sum]));
  const best = h.classes.reduce((a, c) => (p[c] > p[a] ? c : a));
  return { best, p };
}
export async function isPlay(text) {
  const t = String(text || "").trim();
  if (process.env.INTENT_ROUTER === "off" || !t || t.length > 300 || t.startsWith("/")) return false;
  const v = await embed([t]).catch(() => null);
  if (!v?.[0]) return false;
  const r = classify(v[0]);
  return r.best === "play" && r.p.play >= (load().sure || 0);
}
