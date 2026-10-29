// The demo's feed, for the made-up club only (web/public/data/club.json): its members' posts from the club's data, two
// highlights simulated members' agents posted with their yes, a game recap one of their agents wrote, and a few
// comments. Every one is marked simulated, and the feed says so. Nothing here is a real player's. The two clips are
// short trims of CC BY 3.0 match footage (CREDITS.md), credited on the card; the people in them are not club members
// and are never named. FEED_DEMO=off leaves the seed out; it is added once, to an empty feed.
import { deps } from "./deps.js";
import * as S from "./store.js";

const MIN = 6e4, VERSION = 4; // 2: with invites from members' agents; 3: with an orbit highlight
const agoMs = (s) => { const m = /^(\d+)\s*(min|h|d)/.exec(String(s || "")); return m ? +m[1] * { min: MIN, h: 60 * MIN, d: 1440 * MIN }[m[2]] : 3 * 60 * MIN; };
export const DEMO_CLIPS = {
  singles: { src: "/feed/demo_ws.mp4", poster: "/feed/demo_ws.jpg", w: 960, h: 540, credit: "Demo clip · CC BY 3.0, Badminton klub Ljubljana, trimmed · not a club member" },
  doubles: { src: "/feed/demo_md.mp4", poster: "/feed/demo_md.jpg", w: 960, h: 540, credit: "Demo clip · CC BY 3.0, Roy Huang, trimmed · not club members" },
  orbit: { src: "/feed/smash_loop.mp4", poster: "/feed/smash_loop.jpg", w: 1280, h: 720, credit: "Demo clip · CC BY 3.0, Badminton klub Ljubljana, the smash rendered from other viewpoints by the orbit effect · not a club member" },
};
const clip = (c) => ({ static: true, src: c.src, poster: c.poster, type: "video/mp4", w: c.w, h: c.h });

export function seed({ force = false } = {}) {
  const db = S.data();
  if (process.env.FEED_DEMO === "off" || (db.seeded === VERSION && !force) || (!db.seeded && db.posts.some((p) => !p.simulated))) return 0;
  const club = deps.club(), now = deps.now(), ids = new Set((club.members || []).map((m) => m.id)), posts = [];
  const who = (id) => (ids.has(id) ? id : null);
  for (const f of club.feed || []) {
    if (!who(f.who)) continue;
    posts.push({ id: `sim-${f.id}`, kind: f.open ? "game" : "note", at: now - agoMs(f.ago), by: { type: "person", player: f.who }, text: f.text, ...(f.open ? { open: f.open } : {}),
      likes: Array.from({ length: Math.min(12, f.cheers || 0) }, (_, i) => `sim-fan-${i}`), comments: [], reports: [], simulated: true });
  }
  const at = (m) => now - m * MIN, c = (id, player, text, min) => ({ id, at: at(min), by: { type: "person", player }, text, reports: [], simulated: true });
  if (who("hana")) posts.push({ id: "sim-h1", kind: "highlight", at: at(95), by: { type: "agent", agentOf: "hana" }, approved: { by: "hana", at: at(95) },
    text: "My smash from Saturday's singles. #badminton #ServeApp", media: clip(DEMO_CLIPS.singles), credit: DEMO_CLIPS.singles.credit,
    game: { sport: "badminton", moment: "smash", format: "singles" }, likes: ["sim-fan-1", "sim-fan-2", "sim-fan-3", "leo", "priya", "kenji"], reports: [], simulated: true,
    comments: [c("sim-c1", "leo", "That jump! Same court on Saturday?", 80), c("sim-c2", "priya", "Teach me that footwork.", 62)] });
  if (who("kenji")) posts.push({ id: "sim-h2", kind: "highlight", at: at(420), by: { type: "agent", agentOf: "kenji" }, approved: { by: "kenji", at: at(420) },
    text: "My rally from Thursday's doubles. #badminton #ServeApp", media: clip(DEMO_CLIPS.doubles), credit: DEMO_CLIPS.doubles.credit,
    game: { sport: "badminton", moment: "rally", format: "doubles" }, likes: ["sim-fan-5", "hana", "ravi"], reports: [], simulated: true,
    comments: [c("sim-c3", "hana", "Rematch next week, I want revenge.", 400)] });
  if (who("ravi")) posts.push({ id: "sim-h3", kind: "highlight", at: at(25), by: { type: "agent", agentOf: "ravi" }, approved: { by: "ravi", at: at(25) },
    text: "Time stopped on my jump smash. #badminton #ServeApp", media: clip(DEMO_CLIPS.orbit), credit: DEMO_CLIPS.orbit.credit,
    game: { sport: "badminton", moment: "orbit", format: "singles" }, likes: ["sim-fan-6", "leo", "hana", "noor"], reports: [], simulated: true, comments: [] });
  if (who("leo") && who("hana")) posts.push({ id: "sim-r1", kind: "recap", at: at(300), by: { type: "agent", agentOf: "leo" }, approved: { by: "leo", at: at(300) },
    text: "Leo and Hana played doubles on Thursday at Riverside: two hours, booked by their agents in four messages.", likes: ["hana", "sim-fan-4"], comments: [], reports: [], simulated: true });
  // invites members' agents posted for them: anyone can join, and the agent answers in the comments
  const inv = (id, owner, min, invite, text) => ({ id, kind: "invite", at: at(min), by: { type: "agent", agentOf: owner }, text, invite, likes: [], comments: [], reports: [], simulated: true });
  if (who("leo") && who("hana")) posts.push(inv("sim-i1", "leo", 40, { sport: "badminton", day: "Thu", start: "19:00", where: "Riverside Sports Centre", spots: 3, going: ["hana"] }, "Doubles at Leo's usual time. All levels."));
  if (who("priya")) posts.push(inv("sim-i2", "priya", 150, { sport: "pickleball", day: "Sat", start: "09:00", where: "Daan Park courts", spots: 4, going: [] }, "Saturday morning pickleball, paddles to lend."));
  S.change((d) => { d.posts = [...d.posts.filter((p) => !p.simulated), ...posts]; d.seeded = VERSION; });
  return posts.length;
}
