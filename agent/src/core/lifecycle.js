// The data's lifecycle: every store Serve keeps, what kind of data it holds, how long it is kept, whether it is sealed
// at rest, and the jobs that keep it that way.
//   The registry (STORES): each store's file, its class (personal: about one person; activity: what people did
//   together, under pseudonyms; public: what everyone may read; operational: the server's own working state; cache:
//   facts fetched from elsewhere, safe to lose) and its retention (days, or kept while the person is a member, when
//   /forget and leaving delete it).
//   Purge (purge): idle conversations closed and old episodes dropped (memory/conversation.js, sweepOne for each person
//   whose key this gateway holds), and the lines of the append-only logs (model calls, traces) older than their
//   retention cut away.
//   Backups (backup): every .json and .jsonl under the data folder, in one file sealed with the "backup" key
//   (crypt.js), written to BACKUP_DIR and rotated to the newest BACKUP_KEEP (default 7). The keys folder, the agents'
//   private keys and every *.key file are never in a backup: a backup can only be opened on a machine that holds the
//   master key, which is kept apart from it (offline). A person forgotten after a backup stays forgotten in it: their
//   conversation was sealed with their own key, which is shredded.
//   Sealing (sealAll, at the start of each purge): a store still in the clear from before encryption was on is sealed.
//   Status (status): the registry with each store's size, age and whether it is sealed on disk, and the backups kept;
//   never a record's content. GET /api/data/lifecycle (the maintainer's token) shows it; POST runs purge and a backup.
// The gateway runs purge once a day (LIFECYCLE_HOURS, default 24; 0 turns it off), and a backup with it when
// BACKUP_DIR is set.
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import path from 'node:path';
import * as crypt from './crypt.js';
import * as dp from './dp.js';
import {readSealed, writeJSON, OPEN_STORE} from './jsonfile.js';
import {DAY} from './time.js';

const d = (env, def) => () => path.resolve(process.env[env] || def);
// [store, file, class, retention in days (null: while a member; Infinity: kept), what it holds]
export const STORES = [
  [
    'members',
    d('MEMBERS_FILE', 'data/members.json'),
    'personal',
    null,
    'accounts: name, sign-in, sports, limits',
  ],
  [
    'players',
    d('STORE_FILE', 'data/players.json'),
    'personal',
    null,
    'Messenger players: history (last 60 turns), calendar, body log',
  ],
  [
    'memory',
    d('MEMORY_FILE', 'data/memory.json'),
    'personal',
    null,
    'what each player told their agent (notes)',
  ],
  [
    'prefs',
    d('PREFS_FILE', 'data/prefs.json'),
    'personal',
    null,
    'dated preferences',
  ],
  [
    'beliefs',
    d('BELIEFS_FILE', 'data/beliefs.json'),
    'personal',
    null,
    'what the agent infers, with its evidence',
  ],
  [
    'conversations',
    d('CONV_DIR', 'data/conversations'),
    'personal',
    +(process.env.MEMORY_CONV_KEEP_DAYS || 90),
    'conversation memory, sealed per person',
  ],
  [
    'taste',
    d('TASTE_FILE', 'data/taste.json'),
    'personal',
    null,
    'what each member likes in the feed',
  ],
  [
    'asks',
    d('ASK_FILE', 'data/asks.json'),
    'personal',
    30,
    'questions the agent asked and their answers',
  ],
  [
    'autopilot',
    d('AUTOPILOT_FILE', 'data/autopilot.json'),
    'personal',
    null,
    "each member's Autopilot plan",
  ],
  [
    'huddles',
    d('HUDDLE_FILE', 'data/huddles.json'),
    'activity',
    null,
    'games the agents agreed',
  ],
  [
    'bookings',
    d('BOOKINGS_FILE', 'data/bookings.json'),
    'activity',
    null,
    'court bookings',
  ],
  [
    'negotiations',
    d('NEGOTIATIONS_FILE', 'data/negotiations.json'),
    'activity',
    90,
    'agent-to-agent talks',
  ],
  [
    'trust',
    d('TRUST_FILE', 'data/trust.json'),
    'activity',
    Infinity,
    'the hash chain: pseudonymous subjects only, never rewritten',
  ],
  [
    'venue_notes',
    d('VENUE_NOTES_FILE', 'data/venue_notes.json'),
    'activity',
    Infinity,
    'marks after a game (randomized response) and short notes',
  ],
  [
    'feed',
    d('FEED_FILE', 'data/feed.json'),
    'public',
    null,
    'posts, deleted with their author',
  ],
  [
    'clubs',
    d('CLUBS_FILE', 'data/clubs.json'),
    'public',
    null,
    'clubs and who runs them',
  ],
  [
    'venue_agents',
    d('VENUE_AGENTS_FILE', 'data/venue_agents.json'),
    'public',
    null,
    'venues that joined',
  ],
  [
    'ledger',
    d('LEDGER_FILE', 'data/ledger.jsonl'),
    'operational',
    +(process.env.LEDGER_KEEP_DAYS || 30),
    'model calls: site, model, tokens, time',
  ],
  [
    'traces',
    d('TRACE_FILE', 'data/traces.jsonl'),
    'operational',
    +(process.env.TRACE_KEEP_DAYS || 14),
    'request traces',
  ],
  [
    'places_cache',
    d('PLACES_FILE', 'data/places_cache.json'),
    'cache',
    30,
    'places looked up on maps',
  ],
];
const DATA = () => path.resolve(process.env.DATA_DIR || 'data');
const NEVER = rel =>
  /(^|[\\/])(keys|agent_keys)([\\/]|$)|\.key$|\.pem$|\.tmp$|\.bad-\d+$/.test(
    rel,
  );

// what is on disk for a store: size, last write, sealed or not (from its first bytes; nothing is opened)
// a folder (one file per person) counts its files, and is sealed when every file is
function peek(file) {
  try {
    if (fs.statSync(file).isDirectory()) {
      const each = fs
        .readdirSync(file)
        .filter(f => f.endsWith('.json'))
        .map(f => peek(path.join(file, f)))
        .filter(Boolean);
      return {
        files: each.length,
        bytes: each.reduce((a, x) => a + x.bytes, 0),
        modified:
          each
            .map(x => x.modified)
            .sort()
            .at(-1) || null,
        sealed: each.length > 0 && each.every(x => x.sealed),
      };
    }
    const st = fs.statSync(file),
      fd = fs.openSync(file, 'r'),
      b = Buffer.alloc(64);
    fs.readSync(fd, b, 0, 64, 0);
    fs.closeSync(fd);
    return {
      bytes: st.size,
      modified: new Date(st.mtimeMs).toISOString(),
      sealed: b.toString('utf8').includes('"$enc":"serve/v1"'),
    };
  } catch {
    return null;
  }
}
export function status() {
  const stores = STORES.map(([store, file, cls, keep, holds]) => ({
    store,
    file: path.relative(process.cwd(), file()),
    class: cls,
    keepDays:
      keep === null ? 'while a member' : keep === Infinity ? 'kept' : keep,
    holds,
    ...(peek(file()) || {missing: true}),
  }));
  const personal = stores.filter(s => s.class === 'personal' && !s.missing);
  return {
    encryption: crypt.encryptOn()
      ? {
          on: true,
          keyId: crypt.masterKey() ? crypt.kidOf(crypt.masterKey()) : null,
          people: crypt.keyringSize(),
        }
      : {on: false},
    dp: dp.on()
      ? {
          on: true,
          epsMark: dp.EPS_MARK(),
          epsCount: dp.EPS_COUNT(),
          minGroup: dp.MIN_GROUP(),
        }
      : {on: false},
    personalSealed: `${personal.filter(s => s.sealed).length} of ${personal.length}`,
    stores,
    backups: backups(),
  };
}

// a .jsonl log, its lines older than `days` cut away (a line without a time is kept)
const timeOf = j => {
  const t = j.at ?? j.t ?? j.ts ?? j.time ?? j.start;
  return typeof t === 'number' ? t : t ? Date.parse(t) : NaN;
};
export function trimLog(file, days, now = Date.now()) {
  if (!fs.existsSync(file)) return 0;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const keep = lines.filter(l => {
    try {
      const t = timeOf(JSON.parse(l));
      return !(t < now - days * DAY);
    } catch {
      return true;
    }
  });
  if (keep.length === lines.length) return 0;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, keep.map(l => `${l}\n`).join(''));
  fs.renameSync(tmp, file);
  return lines.length - keep.length;
}

// a store still in the clear (written before encryption was turned on) sealed now rather than at its next write.
// Run in the gateway, between its own synchronous writes, so it never races one.
export function sealAll() {
  if (!crypt.encryptOn()) return 0;
  let n = 0;
  for (const [, file] of STORES) {
    const f = file();
    if (
      !f.endsWith('.json') ||
      OPEN_STORE.test(path.basename(f)) ||
      peek(f)?.sealed !== false
    )
      continue;
    try {
      writeJSON(f, readSealed(f));
      n++;
    } catch {
      /* unreadable: left for readJSON to move aside */
    }
  }
  return n;
}

// the daily purge; `people` are the ids whose sealed conversations this gateway may open and sweep
export async function purge({now = Date.now(), people = []} = {}) {
  const sealed = sealAll();
  const conv = await import('../memory/conversation.js');
  const c = conv.sweep(now);
  for (const id of people) {
    const r = await conv.sweepOne(id, now);
    c.closed += r.closed;
    c.dropped += r.dropped;
  }
  const logs = {};
  for (const [store, file, cls, keep] of STORES)
    if (file().endsWith('.jsonl') && Number.isFinite(keep))
      logs[store] = trimLog(file(), keep, now);
  return {
    at: new Date(now).toISOString(),
    sealed,
    conversations: {closed: c.closed, episodesDropped: c.dropped},
    logLinesCut: logs,
  };
}

// ---- backups ----
const DIR = () =>
  process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : null;
const KEEP = () => +(process.env.BACKUP_KEEP || 7),
  MAX_BYTES = 200e6;
export function backups() {
  const dir = DIR();
  if (!dir || !fs.existsSync(dir)) return {dir, kept: []};
  return {
    dir,
    kept: fs
      .readdirSync(dir)
      .filter(f => /^serve-data-.*\.sealed\.json$/.test(f))
      .sort()
      .map(f => ({file: f, bytes: fs.statSync(path.join(dir, f)).size})),
  };
}
function filesUnder(root, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), {withFileTypes: true})) {
    const r = path.join(rel, e.name);
    if (NEVER(r)) continue;
    if (e.isDirectory()) out.push(...filesUnder(root, r));
    else if (/\.jsonl?$/.test(e.name)) out.push(r);
  }
  return out;
}
export function backup({now = Date.now(), dir = DIR()} = {}) {
  if (!dir) return {error: 'BACKUP_DIR is not set'};
  if (!crypt.masterKey())
    return {
      error: 'no data key: a backup is only written sealed (DATA_ENCRYPT=on)',
    };
  const root = DATA(),
    files = {};
  let bytes = 0;
  for (const rel of fs.existsSync(root) ? filesUnder(root) : []) {
    const b = fs.readFileSync(path.join(root, rel));
    if ((bytes += b.length) > MAX_BYTES)
      return {
        error: `the data is over ${MAX_BYTES / 1e6} MB; back it up another way`,
      };
    files[rel.split(path.sep).join('/')] = b.toString('base64');
  }
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const name = `serve-data-${new Date(now).toISOString().replace(/[:.]/g, '-')}.sealed.json`;
  const env = crypt.seal({at: now, files}, 'backup');
  fs.writeFileSync(path.join(dir, name), JSON.stringify(env), {mode: 0o600});
  const all = backups().kept,
    gone = all.slice(0, Math.max(0, all.length - KEEP()));
  for (const g of gone) fs.rmSync(path.join(dir, g.file));
  return {
    file: name,
    files: Object.keys(files).length,
    bytes,
    rotatedOut: gone.length,
    kid: env.kid,
  };
}
// the same backup in a process of its own, so reading and sealing the whole data folder never stalls the gateway
export const backupInChild = () =>
  new Promise(resolve =>
    execFile(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const L = await import(${JSON.stringify(new URL(import.meta.url).href)}); process.stdout.write(JSON.stringify(L.backup()));`,
      ],
      {maxBuffer: 1 << 20, timeout: 10 * 60e3},
      (err, out) => {
        try {
          resolve(JSON.parse(out));
        } catch {
          resolve({error: String(err?.message || 'the backup did not finish')});
        }
      },
    ),
  );
// a backup opened into a folder of its own (never over the live data): for a restore drill, or a restore by hand
export function restore(file, to) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')),
    b = crypt.open(j, 'backup');
  for (const [rel, data] of Object.entries(b.files)) {
    if (rel.includes('..') || path.isAbsolute(rel)) continue;
    const out = path.join(to, rel);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, Buffer.from(data, 'base64'));
  }
  return {at: new Date(b.at).toISOString(), files: Object.keys(b.files).length};
}
