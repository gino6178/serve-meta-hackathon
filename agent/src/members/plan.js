// The planner for a signed-in member: what they ask for ("badminton tmrw evening", 週六早上羽球) read into a search, then
// the courts near their own rough area (the map, deals.js), the times their own limits allow, and the people in their
// clubs whose agents' limits fit each time. Nothing is asked or booked here: each option carries the body for
// POST /api/huddle/start, where the agents ask. People nearby who aren't in their clubs are never counted or named here
// (huddle.js: nobody learns how many are open to being asked near a point); an option says when they'd be asked too.
import * as T from './taste.js';
import * as D from './deals.js';
import * as C from './clubs.js';
import * as H from './huddle.js';
import {readIntent} from '../club/play.js';

const MAX_OPTIONS = 3;
const toMin = s => +s.slice(0, 2) * 60 + +s.slice(3);
const hm = m =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const atMs = (date, start) => {
  const d = T.dateOf(date);
  d.setHours(+start.slice(0, 2), +start.slice(3), 0, 0);
  return d.getTime();
};
const clashes = (busy, ms) => busy.some(x => Math.abs(x - ms) < H.CLASH);

export async function plan(me, {text = '', onStep, now = new Date()} = {}) {
  const t0 = Date.now(),
    zh = /[㐀-鿿]/.test(text),
    steps = [];
  const tell = s => {
    steps.push(s);
    onStep?.({type: 'step', ...s});
  };
  const done = (message, extra = {}) => ({
    real: true,
    options: [],
    invites: {},
    ...extra,
    message,
    steps,
    seconds: +((Date.now() - t0) / 1000).toFixed(1),
  });
  const mine = C.mine(me),
    people = H.people(me).people;
  onStep?.({type: 'working', step: 'Reading your request on Muse Glimmer'});
  const it = await readIntent(
    String(text).slice(0, 300),
    people.map(p => ({id: p.id, name: p.name})),
    now,
  );
  const intent = it.intent;
  tell({
    step: 'Read your request',
    tool: 'read_request',
    detail:
      it.by === 'model'
        ? 'Muse Glimmer turned it into a search'
        : 'read with simple rules (the model was unavailable)',
    intent,
    seconds: it.timing?.seconds,
  });
  if (intent.far)
    return done(
      zh
        ? '我只能安排未來 14 天內的球局。請選這兩週內的一天，或接近那天時再問我。'
        : 'I can only plan games up to 14 days ahead. Pick a day in the next two weeks, or ask me again nearer the time.',
      {intent},
    );
  const t = T.get(me);
  if (!t.home)
    return done(
      zh
        ? '請先在 Huddle 頁分享你的大概位置，我才能找你附近的球場。'
        : 'Share your rough area on the Huddle page first, so I can look for courts near you.',
      {intent},
    );
  // the sport named in the words, else the member's own first sport (readIntent says badminton when none is named)
  const named = /badminton|羽/i.test(text) || intent.sport !== 'badminton';
  const sport = named ? intent.sport : t.sports[0] || intent.sport;
  const need =
    intent.format === 'singles'
      ? 2
      : intent.format === 'doubles'
        ? Math.max(4, D.gameOf(sport))
        : D.gameOf(sport);
  onStep?.({type: 'working', step: `Looking up ${sport} courts near you`});
  let places = await D.placesNear(t.home, sport, {venues: 4, courts: 4});
  if (!places.length)
    return done(
      D.loading(t.home, sport)
        ? D.LOOKING_NOTE
        : D.lookupFailed(t.home, sport)
          ? zh
            ? '球場地圖目前沒有回應，十分鐘後再試。'
            : "The map of courts isn't answering right now. Try again in ten minutes."
          : zh
            ? `你附近的地圖上找不到${sport}球場。`
            : `I found no ${sport} courts near you on the map.`,
      {intent},
    );
  // an indoor game in a hall when there is one (huddle.js does the same)
  if (H.INDOOR.includes(sport) && places.some(p => p.kind === 'venue'))
    places = places.filter(p => p.kind === 'venue');
  const kmOf = (home, p) => (home ? +T.km(home, p).toFixed(1) : null);
  tell({
    step: 'Opened the map',
    tool: 'open_map',
    detail: `${places.length} ${sport} place${places.length === 1 ? '' : 's'} near your area (areas only, never addresses)`,
    places: places.map(p => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      km: kmOf(t.home, p),
    })),
  });
  // the people in their clubs who play the sport (or haven't said which they play)
  const club = people
    .map(p => ({...p, t: T.get(p.id)}))
    .filter(p => !p.t.sports?.length || p.t.sports.includes(sport));
  const dates = intent.days.length
    ? intent.days
    : Array.from({length: 7}, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        return T.ymd(d);
      });
  const minutes = intent.minutes || 90,
    hostBusy = H.busyOf(me),
    ruled = {},
    opts = [];
  let looked = 0;
  for (const date of dates)
    for (const start of H.STARTS) {
      if (intent.from && start < intent.from) continue;
      if (intent.to && toMin(start) + minutes > toMin(intent.to)) continue;
      const ms = atMs(date, start);
      if (ms - now.getTime() < 3 * 3600e3) continue; // (as the agents: at least three hours from now)
      if (clashes(hostBusy, ms)) {
        ruled.busy = (ruled.busy || 0) + 1;
        continue;
      }
      for (const place of places) {
        if (!H.opensFor(place, start)) continue;
        looked++;
        const each = D.bestEach(place, date, start, need),
          busy = D.busy(place, date, start);
        const hn = T.hardNo(t, {
          date,
          start,
          minutes,
          km: kmOf(t.home, place),
          each,
        });
        if (hn) {
          ruled[hn] = (ruled[hn] || 0) + 1;
          continue;
        }
        // who in their clubs fits then: their own limits (times, distance, price) and no game of their own at that time
        const fit = club
          .filter(
            p =>
              !T.hardNo(p.t, {
                date,
                start,
                minutes,
                km: kmOf(p.t.home, place),
                each,
              }) && !clashes(H.busyOf(p.id), ms),
          )
          .map(p => ({
            p,
            w: T.worth(p.t, {
              date,
              start,
              km: kmOf(p.t.home, place),
              each,
              busy,
            }),
            asked: intent.with.includes(p.id),
          }))
          .sort((a, b) => b.asked - a.asked || b.w - a.w);
        const mine0 = T.worth(t, {
          date,
          start,
          km: kmOf(t.home, place),
          each,
          busy,
        });
        const team = fit.slice(0, need - 1);
        opts.push({
          date,
          start,
          place,
          each,
          team,
          full: team.length >= need - 1,
          asked: team.filter(x => x.asked).length,
          score:
            mine0 +
            (team.length ? team.reduce((s, x) => s + x.w, 0) / team.length : 0),
        });
      }
    }
  const ruledMost = Object.entries(ruled).sort((a, b) => b[1] - a[1])[0]?.[0];
  tell({
    step: 'Checked the times',
    tool: 'search_courts',
    detail: `${looked} court times at ${places.length} place${places.length === 1 ? '' : 's'} over ${dates.length} day${dates.length > 1 ? 's' : ''} that fit your own limits${ruledMost ? ` (most others ruled out by ${{busy: 'a game you already have', time: 'your times', place: 'your distance limit', price: 'your price limit'}[ruledMost] || ruledMost})` : ''}`,
  });
  if (!opts.length)
    return done(
      zh
        ? '沒有符合你的時間和限制的球場時段。換一天，或把時間放寬一點試試。'
        : intent.days.length || intent.from
          ? 'No court time near you fits those days and times, at least three hours from now, within your own limits. Try another day or a wider time.'
          : 'No court time near you fits your own limits this week. Widen your times or distance on the Huddle page.',
      {intent},
    );
  // the best few: a full game first, then the people they named, then what the time is worth to everyone; one per time
  opts.sort(
    (a, b) => b.full - a.full || b.asked - a.asked || b.score - a.score,
  );
  const picked = [];
  for (const o of opts) {
    if (picked.some(x => x.date === o.date && x.start === o.start)) continue;
    picked.push(o);
    if (picked.length === MAX_OPTIONS) break;
  }
  const sportClub = mine.find(c => c.sport === sport) || null;
  const options = picked.map(o => {
    const short = o.team.length < need - 1;
    return {
      id: `${o.date}T${o.start}@${o.place.id}`,
      date: o.date,
      day: T.dayText(o.date),
      start: o.start,
      end: hm(toMin(o.start) + minutes),
      sport,
      need,
      venue: {
        id: o.place.id,
        name: o.place.name,
        kind: o.place.kind,
        km: kmOf(t.home, o.place),
      },
      each: o.each,
      partners: o.team.map(x => ({
        id: x.p.id,
        name: x.p.name,
        ...(x.asked ? {asked: true} : {}),
      })),
      ...(short ? {short: need - 1 - o.team.length} : {}),
      // the body for POST /api/huddle/start: the agents ask these people for this time and place (and, when the club
      // can't fill it, people nearby who are open to being asked)
      huddle: {
        sport,
        need,
        pin: {date: o.date, start: o.start, place: o.place.id},
        ...(o.team.length ? {invite: o.team.map(x => x.p.id)} : {}),
        ...(short
          ? {nearby: true}
          : sportClub &&
              o.team.every(x => sportClub.members.some(m => m.id === x.p.id))
            ? {club: sportClub.id}
            : {}),
      },
    };
  });
  const b0 = options[0];
  tell({
    step: 'Found people who fit',
    tool: 'find_players',
    detail: b0.partners.length
      ? `${b0.partners.map(p => p.name).join(', ')} from your clubs fit ${b0.day} ${b0.start} by their agents' limits`
      : club.length
        ? 'nobody in your clubs fits those times by their limits; people nearby who are open to being asked would be asked'
        : 'nobody in your clubs plays this yet; people nearby who are open to being asked would be asked',
  });
  const who = b0.partners.map(p => p.name);
  const message = zh
    ? `${b0.day} ${b0.start}–${b0.end}，${b0.venue.name}${b0.venue.km != null ? `（離你約 ${b0.venue.km} 公里）` : ''}${b0.each ? `，每人約 NT$${b0.each}` : ''}。${who.length ? `${who.join('、')} 的時間和限制都符合。` : ''}${b0.short ? `還差 ${b0.short} 人，也會問附近願意被詢問的人。` : ''}還沒有問任何人，也沒有預約：選一個，代理人才會去問。`
    : `${b0.day} ${b0.start}–${b0.end} at ${b0.venue.name}${b0.venue.km != null ? ` (about ${b0.venue.km} km from you)` : ''}${b0.each ? `, about NT$${b0.each} each` : ''}.${who.length ? ` ${who.join(', ')} fit${who.length === 1 ? 's' : ''} it by their limits.` : ''}${b0.short ? ` ${b0.short} more needed: people nearby who are open to being asked are asked too.` : ''} Nobody has been asked and nothing is booked: pick one and the agents ask (POST /api/huddle/start with its huddle body).`;
  return done(message, {intent, options});
}
