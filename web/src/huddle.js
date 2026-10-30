// Getting a game together, and how the member likes to play: the calls to the club's gateway (agent
// src/members/huddle.js, taste.js, deals.js). Every one needs a signed-in member.
import { agentFetch } from "./agent.js";
import { myPlace } from "./where.js";

export async function call(path, body) {
  const r = await agentFetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `The server answered ${r.status}.`);
  return j;
}
export const today = () => call("/api/huddle/today");
export const mine = () => call("/api/huddle/me");
export const one = (id) => call(`/api/huddle/one?id=${encodeURIComponent(id)}`);
export const question = () => call("/api/huddle/question");
export const answer = (q, pick) => call("/api/huddle/answer", { q, pick });
export const start = (b) => call("/api/huddle/start", b);
export const reply = (id, yes, why = null) => call("/api/huddle/reply", { id, yes, why });
export const cancel = (id) => call("/api/huddle/cancel", { id });
export const game = (post, yes, why = null) => call("/api/huddle/game", { post, yes, why });
export const places = (sport) => call(`/api/huddle/places${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`);
export const setSports = (sports) => call("/api/huddle/sports", { sports });
export const reset = () => call("/api/huddle/reset", {});
export const setOpen = (on) => call("/api/huddle/open", { on });
export const attend = (key, came, level = {}) => call("/api/huddle/attend", { key, came, level });
export const trust = () => call("/api/huddle/trust");
// the member's rough area, from the browser (they can say no); the gateway keeps it rounded to about 1 km
export async function shareHome() {
  const p = await myPlace({ timeoutMs: 10000 });
  if (!p) throw new Error("The browser didn't give a location. Allow it for this site and try again.");
  return call("/api/huddle/home", { lat: p.lat, lon: p.lon });
}
export const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash"];
export const FACTOR = { time: "Time", place: "Distance", price: "Price", quiet: "Quiet court" };
export const WHY = [["busy", "Busy then"], ["time", "Not a good time"], ["place", "Too far"], ["price", "Costs too much"]];
export const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
export const pct = (x) => `${Math.round(x * 100)}%`;
