// A venue's own agent. A sports centre that rents courts has an A2A agent of its own, beside the players' agents: a
// signed Agent Card at /a2a/venues/<id>/.well-known/agent-card.json (a2a/server.js) and one skill, quote a court. The
// group's agent sends it a court ask (a data part of kind "serve.court-ask": the date, the start, how long, how many
// players, the same hour every week or not, the group's offer and the venue's last quote) and it answers with a quote
// (kind "serve.quote": the price for the courts, accepted or a counter, final or not), signed with the venue's own
// Ed25519 key, whose public half the card carries. The venue's rule is members/deals.js venueRule; no venue has joined
// Serve yet, so its list prices are samples and every quote says so.
//   The group's side (negotiate): it opens low by how much the group cares about price, moves toward the venue each
//   round and never offers past its budget (members/split.js most: what the players' own limits can cover). Every
//   quote is checked against the venue's key before it counts; the agent sends the venue's last quote back with its next
//   offer, and the venue checks its own signature on it, so neither side can make up an earlier price.
//   A venue's real agent, anywhere: its owner registers its card's address for the place (POST /api/venues/agents,
//   with the maintainer's approval: a venue can't claim another's courts), and Serve then talks to that agent over A2A
//   instead, checking its signed card and each signed quote the same way.
import path from 'node:path';
import crypto from 'node:crypto';
import * as D from '../members/deals.js';
import {signText, verifyText, publicOf, stable} from '../a2a/consent.js';
import {readJSON, writeJSON} from '../core/jsonfile.js';

export const ASK = 'serve.court-ask',
  QUOTE = 'serve.quote';
const C = D.CURRENCY;
const idOf = place => `venue-${place.id}`;
export const quoteKey = place => publicOf(idOf(place));
const text = q =>
  `serve-quote:${stable([q.venue, q.date, q.start, q.minutes, q.players, q.weekly, q.courts, q.price, q.accept, q.final, q.round])}`;
export const verifyQuote = (q, key) =>
  !!q && q.kind === QUOTE && verifyText(key, text(q), q.sig);

// the venue agent's answer to one ask: the rule's price, signed. A last quote that isn't its own, unchanged, is ignored.
export function answer(place, ask) {
  const key = quoteKey(place),
    mine =
      ask.last && ask.last.venue === place.id && verifyQuote(ask.last, key)
        ? ask.last.price
        : null;
  const r = D.venueRule(place, {
    date: ask.date,
    start: ask.start,
    minutes: ask.minutes || 90,
    players: ask.players || 4,
    weekly: !!ask.weekly,
    games: ask.games || [],
    offer: ask.offer ?? null,
    last: mine,
    round: ask.round || 0,
  });
  const q = {
    kind: QUOTE,
    venue: place.id,
    date: ask.date,
    start: ask.start,
    minutes: ask.minutes || 90,
    players: ask.players || 4,
    weekly: !!ask.weekly,
    courts: r.courts,
    price: r.price,
    accept: r.accept,
    final: r.final,
    round: ask.round || 0,
  };
  return {
    ...q,
    list: r.list,
    busy: +r.busy.toFixed(2),
    full: !!r.full,
    floorReached: !!r.floorReached,
    sample: !!place.sample,
    ...signText(idOf(place), text(q)),
  };
}

// outside venues' agents: { <place id>: { url, name, at } }, added with the maintainer's approval
const FILE = () =>
  path.resolve(process.env.VENUE_AGENTS_FILE || 'data/venue_agents.json');
export const registered = () => readJSON(FILE(), {});
export const remoteOf = placeId => registered()[placeId] || null;
export function register(placeId, url, name = null) {
  if (!/^osm:(node|way|relation)\/\d+$/.test(String(placeId || '')))
    return {error: 'place is a Serve place id, like osm:way/123456', code: 400};
  let u;
  try {
    u = new URL(url);
  } catch {
    return {
      error:
        "url is the venue agent's A2A address (its card is at <url>/.well-known/agent-card.json)",
      code: 400,
    };
  }
  if (u.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname))
    return {error: "a venue's agent must be on https", code: 400};
  const all = registered();
  all[placeId] = {
    url: u.href,
    name: name ? String(name).slice(0, 80) : null,
    at: Date.now(),
  };
  writeJSON(FILE(), all);
  return {ok: true, place: placeId, url: u.href};
}
export function unregister(placeId) {
  const all = registered();
  const had = !!all[placeId];
  delete all[placeId];
  writeJSON(FILE(), all);
  return {ok: had};
}

// asks a venue's agent on another server, over A2A: its card checked by the client, the quote by the key in that card
async function askRemote(url, ask, contextId) {
  const client = await import('../a2a/client.js');
  const task = await client.send(
    url,
    {
      messageId: crypto.randomUUID(),
      contextId,
      role: 'ROLE_USER',
      parts: [{data: {kind: ASK, ...ask}, mediaType: 'application/json'}],
    },
    {signal: AbortSignal.timeout(15000)},
  );
  const q = client.dataOf(task, 'quote'),
    key = client
      .cardOf(url)
      ?.capabilities?.extensions?.find(e => e.params?.quoteKey)
      ?.params.quoteKey;
  return {q, key};
}

// the group's agent talks price with the venue's agent. Returns the deal (price, list, off, courts, lines, the signed
// quote) or { over: true } when the venue's lowest is past the budget, or { failed: true } when its agent didn't answer
// or its quote didn't check out.
export async function negotiate(
  place,
  {
    date,
    start,
    players = 4,
    minutes = 90,
    weekly = false,
    push = 0.5,
    games = [],
    group = 'Your group',
    budget = Infinity,
  } = {},
) {
  if (place.kind !== 'venue') return {free: true, price: 0, each: 0, lines: []};
  const remote = remoteOf(place.id),
    ctx = crypto.randomUUID(),
    lines = [];
  const us = group === 'Your' ? 'Your agent' : `${group}'s agent`,
    them = `${place.name}'s agent`;
  const venue = async ask => {
    if (!remote) return {q: answer(place, ask), key: quoteKey(place)};
    return askRemote(remote.url, ask, ctx);
  };
  const base = {
    date,
    start,
    minutes,
    players,
    weekly,
    games: remote ? undefined : games,
  };
  const d = new Date(`${date}T12:00:00`),
    end = (() => {
      const m = +start.slice(0, 2) * 60 + +start.slice(3, 5) + minutes;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    })();
  const when = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${start}`;
  let q,
    key,
    last = null;
  const call = async ask => {
    try {
      ({q, key} = await venue(ask));
    } catch (e) {
      lines.push({
        from: us,
        text: `${them} didn't answer (${String(e.message || e).slice(0, 60)}).`,
      });
      return false;
    }
    if (
      !key ||
      !verifyQuote(q, key) ||
      q.venue !== place.id ||
      q.date !== date ||
      q.start !== start
    ) {
      lines.push({
        from: us,
        text: `${them}'s quote didn't carry its signature, so it doesn't count.`,
      });
      return false;
    }
    last = q;
    return true;
  };
  // first: the venue's opening quote, which says how full the hour is and its list price
  if (!(await call({...base, offer: null, round: 0})))
    return {failed: true, lines};
  const list = q.list ?? q.price,
    pct = Math.round((q.busy ?? 0.5) * 100);
  const courtsWords = q.courts > 1 ? `${q.courts} courts` : 'a court',
    ask = `${players} players, ${courtsWords}, ${when}–${end}${weekly ? ', the same time every week' : ''}.`;
  const done = price => ({
    price,
    each: Math.ceil(price / players),
    list,
    off: list ? Math.round((1 - price / list) * 100) : 0,
    busy: q.busy ?? 0.5,
    courts: q.courts,
    lines,
    sample: !!q.sample,
    quote: last,
    signed: true,
    remote: !!remote,
  });
  const over = () => {
    lines.push({
      from: us,
      text: `That's past what our players' limits cover (${C}${budget} for the group). We'll look elsewhere.`,
    });
    return {over: true, lowest: q.price, lines};
  };
  if (q.full) {
    lines.push({from: us, text: `${ask} What's your best price?`});
    lines.push({
      from: them,
      text: `That hour is usually ${pct}% full, so it's the list price: ${C}${list}.`,
    });
    return q.price <= budget ? done(q.price) : over();
  }
  let ours = Math.min(
    budget,
    Math.round((list * (0.62 - 0.12 * push + 0.15 * (q.busy ?? 0.5))) / 10) *
      10,
  );
  lines.push({
    from: us,
    text: `${ask} It's usually ${pct < 50 ? 'only ' : ''}${pct}% full then. Would you take ${C}${ours}?`,
  });
  for (let r = 0; r < 3; r++) {
    if (!(await call({...base, offer: ours, last, round: r})))
      return {failed: true, lines};
    if (q.accept) {
      lines.push({from: them, text: `Deal at ${C}${q.price}.`});
      return done(q.price);
    }
    const low = q.floorReached
      ? `, and that's as low as I go for that time`
      : '';
    lines.push({
      from: them,
      text:
        r === 0
          ? `List is ${C}${list} for ${minutes} minutes. ${(q.busy ?? 0.5) < 0.5 ? 'At a quiet time' : 'At that time'} I can do ${C}${q.price}${low}.`
          : `${C}${q.price}${low}.`,
    });
    if (q.final) {
      if (q.price > budget) return over();
      lines.push({from: us, text: `${C}${q.price} it is.`});
      return done(q.price);
    }
    const next = Math.min(
      budget,
      Math.round((ours + (q.price - ours) * (0.35 + 0.3 * (1 - push))) / 10) *
        10,
    );
    if (next <= ours && ours >= budget) {
      // already at the budget, and the venue is still above it: one last word, then elsewhere
      lines.push({
        from: us,
        text: `${C}${budget} is the most our players can cover.`,
      });
      if (!(await call({...base, offer: budget, last, round: 2})))
        return {failed: true, lines};
      if (q.accept) {
        lines.push({from: them, text: `Deal at ${C}${q.price}.`});
        return done(q.price);
      }
      return over();
    }
    ours = next;
    lines.push({from: us, text: `Meet us at ${C}${ours}?`});
  }
  return q.price <= budget ? done(q.price) : over();
}

// the venue agent's card: who it is, its one skill, and its quote key (an extension's params, inside the signed card)
export const EXT_PATH = '/a2a/ext/quote/v1';
export function cardFor(place, base, root) {
  return {
    name: `${place.name}'s agent`,
    description:
      `Rents courts at ${place.name}: answers a court ask (a data part of kind "${ASK}") with a quote signed by this venue's own key, accepted or a counter. ${place.sample ? "This venue hasn't joined Serve: its prices are samples, set by Serve's rule for an empty hour versus a full one." : ''}`.trim(),
    supportedInterfaces: [
      {
        url: `${base}/`,
        protocolBinding: 'JSONRPC',
        tenant: '',
        protocolVersion: '1.0',
      },
    ],
    provider: {
      organization: place.sample ? 'Serve (a sample venue agent)' : place.name,
      url: `${root}/a2a/venues`,
    },
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
      extensions: [
        {
          uri: `${root}${EXT_PATH}`,
          description:
            'Quotes are signed with Ed25519; quoteKey is the public key (JWK x).',
          required: false,
          params: {quoteKey: quoteKey(place)},
        },
      ],
    },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'quote-court',
        name: 'Quote a court',
        description: `Answers "${ASK}" with "${QUOTE}": the price for the courts the group needs, accepted when the offer reaches the venue's floor, else a counter.`,
        tags: ['venue', 'pricing', 'negotiation'],
        examples: [
          '4 players, badminton, Thu 14:00 for 90 minutes, offer NT$220',
        ],
        inputModes: ['application/json'],
        outputModes: ['application/json'],
        securityRequirements: [],
      },
    ],
    documentationUrl: `${root}/llms.txt`,
    signatures: [],
  };
}
export const describeExt = () => ({
  name: 'serve.quote',
  version: 1,
  description:
    "A venue agent's quote, signed with Ed25519 over serve-quote:<stable JSON of venue, date, start, minutes, players, weekly, courts, price, accept, final, round>. The key is params.quoteKey in the venue's signed Agent Card.",
});
