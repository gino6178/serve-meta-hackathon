// Clubs for the groups that have no one to organise them: a teacher or volunteer running games for children, an older
// adults' group, a charity tournament. Each is a club (clubs.js) of a kind, and everything here is code: no model
// decides who plays when.
//   youth    organiser-led and always private. Children have no accounts: the organiser keeps a roster of first names
//            that only they see, marks who came, and code shares the courts out in rotations so everyone plays the same
//            time; a note for parents says when to pick up.
//   seniors  gentle games, held by code on every game posted in the club: starting 08:00 to 16:00 (60 minutes, done by
//            17:00), at most 8 players, doubles for racket sports.
//   charity  a tournament for a cause. Players enter with a level (1 to 5) and a pledge, which is a promise to the cause
//            and only recorded (Serve handles no money); the organiser makes the draw: balanced doubles teams, a round
//            robin, each match on a court and a time.
export const KINDS = ["club", "youth", "seniors", "charity"];
const RACKET = ["badminton", "tennis", "pickleball", "table tennis", "squash"];
const hm = (s) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
const clock = (n) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const tidy = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// ---- gentle games ----
export const GENTLE = { from: "08:00", last: "16:00", minutes: 60, spots: 8 };
// a game posted in a club, held to the club's kind; { error } or { invite } with what the card shows
export function holdInvite(club, player, invite) {
  if (!club || !invite) return { invite };
  if (club.kind === "youth" && club.owner !== player) return { error: "Only the organiser posts games in this club." };
  if (club.kind !== "seniors") return { invite };
  const t = hm(invite.start);
  if (t == null || t < hm(GENTLE.from) || t > hm(GENTLE.last)) return { error: `A gentle game starts between ${GENTLE.from} and ${GENTLE.last}, so it is done by 17:00.` };
  if (invite.spots > GENTLE.spots) return { error: `A gentle game has ${GENTLE.spots} players at most.` };
  return { invite: { ...invite, gentle: { minutes: GENTLE.minutes, ...(RACKET.includes(invite.sport) ? { format: "doubles" } : {}) } } };
}

// ---- children's sessions ----
export const ROSTER_MAX = 40;
// first names only (a child's full name, school or contact never goes in); { error } or { roster }
export function rosterOf(names) {
  const xs = [...new Set((Array.isArray(names) ? names : String(names || "").split(/[\n,，、]+/)).map((x) => tidy(x, 20)).filter(Boolean))];
  if (xs.length > ROSTER_MAX) return { error: `${ROSTER_MAX} children at most.` };
  if (xs.some((x) => /\d{3,}|@|\s\S+\s/.test(x))) return { error: "First names only: no numbers, emails or full names." };
  return { roster: xs };
}
// the courts shared out: rotations of `minutes`, `perCourt` on each court, whoever sat out goes on first next time, so
// nobody plays more than one rotation more than anyone else
export function youthPlan({ present, courts = 1, perCourt = 4, start, end, minutes = 15, sport = "badminton", where = "", day = "" }) {
  const kids = [...new Set((present || []).map((x) => tidy(x, 20)).filter(Boolean))];
  const a = hm(start), b = hm(end);
  if (!kids.length) return { error: "Mark who came first." };
  if (a == null || b == null || b <= a) return { error: "Say when the session starts and ends (HH:MM)." };
  courts = Math.max(1, Math.min(12, Math.round(+courts) || 1)); perCourt = Math.max(2, Math.min(12, Math.round(+perCourt) || 4)); minutes = Math.max(5, Math.min(60, Math.round(+minutes) || 15));
  const queue = [...kids], played = Object.fromEntries(kids.map((k) => [k, 0])), rotations = [];
  for (let t = a; t + minutes <= b; t += minutes) {
    const on = queue.splice(0, Math.min(queue.length, courts * perCourt));
    const groups = Array.from({ length: Math.ceil(on.length / perCourt) }, (_, i) => on.slice(i * perCourt, (i + 1) * perCourt));
    rotations.push({ at: clock(t), courts: groups, resting: [...queue] });
    for (const k of on) played[k] += minutes;
    queue.push(...on);
  }
  if (!rotations.length) return { error: `The session is shorter than one rotation (${minutes} minutes).` };
  const note = `${sport.charAt(0).toUpperCase() + sport.slice(1)} for the children${day ? ` ${day}` : ""}, ${clock(a)} to ${clock(b)}${where ? ` at ${where}` : ""}. Please pick up at ${clock(b)}.`;
  return { plan: { day, start: clock(a), end: clock(b), courts, perCourt, minutes, rotations, played, note } };
}

// ---- charity tournaments ----
export const LEVELS = [1, 2, 3, 4, 5];
// an entry: the level the player gives themself and what they pledge to the cause
export function entryOf(b) {
  const level = Math.round(+b.level || 3), pledge = Math.round(+b.pledge || 0);
  if (!LEVELS.includes(level)) return { error: "A level from 1 (new) to 5 (strong)." };
  if (!(pledge >= 0 && pledge <= 100000)) return { error: "A pledge from 0 to 100000." };
  return { entry: { level, pledge } };
}
// balanced doubles: the strongest with the newest, and so on in; an odd one out waits for a late entry or plays with
// the organiser. Then a round robin (the circle method), each round's matches on the courts, a round per time slot,
// more slots when there are more matches than courts.
export function draw(entrants, { courts = 2, start = "09:00", minutes = 20 } = {}) {
  const ps = [...entrants].sort((x, y) => y.level - x.level || x.name.localeCompare(y.name));
  if (ps.length < 4) return { error: "Four players at least, for two teams." };
  const t0 = hm(start); if (t0 == null) return { error: "Say when it starts (HH:MM)." };
  courts = Math.max(1, Math.min(12, Math.round(+courts) || 2)); minutes = Math.max(10, Math.min(60, Math.round(+minutes) || 20));
  const half = Math.floor(ps.length / 2), waiting = ps.length % 2 ? [ps[half]] : [];
  const rest = ps.filter((p) => !waiting.includes(p)), teams = [];
  for (let i = 0; i < rest.length / 2; i++) { const a = rest[i], b = rest[rest.length - 1 - i]; teams.push({ id: `T${i + 1}`, players: [a.name, b.name], level: a.level + b.level }); }
  const ring = teams.length % 2 ? [...teams, null] : [...teams], n = ring.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = ring[i], b = ring[n - 1 - i]; if (a && b) pairs.push([a.id, b.id]); }
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()); // the first stays, the rest turn
  }
  const matches = []; let slot = 0;
  for (const pairs of rounds) for (let i = 0; i < pairs.length; i += courts, slot++) pairs.slice(i, i + courts).forEach(([a, b], c) => matches.push({ at: clock(t0 + slot * minutes), court: c + 1, a, b }));
  return { draw: { teams, waiting: waiting.map((p) => p.name), matches, courts, minutes, start: clock(t0), end: clock(t0 + slot * minutes) } };
}
