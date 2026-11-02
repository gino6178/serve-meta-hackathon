// What players say about a place after they played there. A few hours after a game the agents agreed, each player's own
// agent asks them, once, how the place was: the courts, the lights, the air and whether the price was fair (good, ok or
// bad), and a short note if they like. Only a player of a game agreed at that place can answer, so a note can't come
// from someone who never went. The marks go on the trust chain (members/trust.js, kind "venue": the place and the marks,
// under the player's pseudonymous subject, never the note), so a venue's record can't be quietly changed afterwards. A
// note is checked by Llama Guard 3 and Prompt Guard 2 before anyone else sees it, and it never carries a link. The
// venue's report (report.js) shows the counts and the latest notes.
//   Differential privacy (core/dp.js): each mark goes through randomized response before it is kept, here or on the
//   chain, so Serve never holds what one player really answered (the note keeps the ε it was randomized with, rr). A
//   venue's counts are debiased back, the number of players who rated it gets Laplace noise, and the counts are shown
//   only once at least DP_MIN_GROUP players rated it.
//   data/venue_notes.json (VENUE_NOTES_FILE): { notes: [{ place, name, game, by, at, marks, note }], done: { <member>: [game ids] } }
import path from 'node:path';
import {readJSON, writeJSON} from '../core/jsonfile.js';
import * as Tr from '../members/trust.js';
import * as guard from '../safety/guard.js';
import * as dp from '../core/dp.js';

export const MARKS = ['courts', 'light', 'air', 'price'],
  VALUES = ['good', 'ok', 'bad'];
const FILE = () =>
  path.resolve(process.env.VENUE_NOTES_FILE || 'data/venue_notes.json');
let db = null,
  from = null;
const data = () => {
  if (from !== FILE()) {
    db = readJSON(FILE(), {});
    db.notes ||= [];
    db.done ||= {};
    from = FILE();
  }
  return db;
};
const save = () => writeJSON(FILE(), data());

export const answered = (me, game) => (data().done[me] || []).includes(game);

// a note another player may read: short, no link, address or handle, and past both guards (with a guard down, it waits
// as unchecked and is not shown)
export async function checkNote(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  if (!t) return {note: null};
  if (/https?:|www\.|\S+@\S+|\.(com|net|org|io|me|ly|tw)\b|@\w/i.test(t))
    return {
      note: null,
      why: "a note can't carry a link, an address or a handle",
    };
  const [inj] = await guard.injected([t]);
  if (inj?.injected)
    return {note: null, why: 'the note reads as instructions to a model'};
  const g = await guard.screen([{role: 'user', content: t}], {
    site: 'venues.note',
    record: false,
  });
  if (g.safe == null) return {note: t, held: true};
  if (guard.replaces(g, t))
    return {note: null, why: "the note didn't pass the safety check"};
  return {note: t};
}

// the player's answer for one game: marks (some or all of MARKS, each good, ok or bad), a note, or skip
export async function add(
  me,
  game,
  {marks = {}, note = '', skip = false} = {},
  now = Date.now(),
) {
  if (answered(me, game.id))
    return {error: 'You already said how that place was.', code: 409};
  const given = Object.entries(marks || {}).filter(
    ([k, v]) => MARKS.includes(k) && VALUES.includes(v),
  );
  const eps = dp.on() ? dp.EPS_MARK() : null,
    m = Object.fromEntries(
      given.map(([k, v]) => [k, eps ? dp.randomize(v, VALUES, eps) : v]),
    );
  if (!skip && !Object.keys(m).length && !String(note || '').trim())
    return {
      error: `Say at least one of ${MARKS.join(', ')} (good, ok or bad), or skip.`,
      code: 400,
    };
  (data().done[me] ||= []).push(game.id);
  if (skip) {
    save();
    return {
      ok: true,
      skipped: true,
      line: "Skipped: your agent won't ask about that game again.",
    };
  }
  const n = await checkNote(note);
  const e = {
    place: game.place,
    name: game.where,
    game: game.id,
    by: Tr.subject(me),
    at: now,
    marks: m,
    ...(eps ? {rr: eps} : {}),
    ...(n.note ? {note: n.note} : {}),
    ...(n.held ? {held: true} : {}),
  };
  data().notes.push(e);
  save();
  if (Object.keys(m).length) Tr.venueNote(me, game.place, m, now);
  return {
    ok: true,
    line: `Thanks: it's in ${game.where}'s record for the next group.${n.why ? ` The note was left out: ${n.why}.` : ''}`,
    chain: Object.keys(m).length > 0,
  };
}

// a place's record: how many players rated it after a game, the count of each mark, and the latest notes. Randomized
// marks are debiased by the ε they were randomized with; marks kept as given (DP off when they were left) count as they are.
export function of(placeId) {
  const list = data().notes.filter(x => x.place === placeId),
    notes = list
      .filter(x => x.note && !x.held)
      .slice(-3)
      .reverse()
      .map(x => ({note: x.note, at: x.at}));
  const count = (rows, k) =>
    Object.fromEntries(
      VALUES.map(v => [v, rows.filter(x => x.marks?.[k] === v).length]),
    );
  if (!dp.on())
    return {
      n: list.length,
      marks: Object.fromEntries(MARKS.map(k => [k, count(list, k)])),
      notes,
    };
  const n = dp.noisyCount(list.length, `venue-notes|${placeId}`);
  // the threshold reads the noisy count, so the moment the record appears doesn't give the exact number away
  // (and no notes either: under the threshold a note and its time could point at the one player who left it)
  if (!dp.enough(n)) return {n: 0, marks: {}, notes: [], few: true};
  const byEps = list.reduce(
    (g, x) => g.set(x.rr || 0, [...(g.get(x.rr || 0) || []), x]),
    new Map(),
  );
  const marks = Object.fromEntries(
    MARKS.map(k => {
      const sum = Object.fromEntries(VALUES.map(v => [v, 0]));
      for (const [eps, rows] of byEps) {
        const c = eps ? dp.debias(count(rows, k), VALUES, eps) : count(rows, k);
        for (const v of VALUES) sum[v] += c[v];
      }
      return [k, sum];
    }),
  );
  return {n, marks, notes, dp: {eps: dp.EPS_MARK(), minGroup: dp.MIN_GROUP()}};
}
