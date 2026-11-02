// The club feed's own store, on this server only: posts (the reading agent's papers, members' highlights their agent
// drafted, people's notes and photos), their likes, comments and reports, drafts waiting for a yes, the reading agent's
// list of papers it has already looked at and its run log, and each player's recent actions for the rate limits.
//   data/feed.json         (FEED_FILE overrides)
//   data/feed_media/<id>   photos, clips and cover frames (FEED_MEDIA_DIR overrides)
// It is a jsonStore (core/jsonfile.js): a write goes to a temporary file and is renamed over the old one, a file that
// cannot be read is moved aside, and one sealed with another data key stops the gateway rather than start empty.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {jsonStore} from '../core/jsonfile.js';

export const file = () =>
  path.resolve(process.env.FEED_FILE || 'data/feed.json');
export const mediaDir = () =>
  path.resolve(
    process.env.FEED_MEDIA_DIR || path.join(path.dirname(file()), 'feed_media'),
  );
const blank = () => ({
  version: 1,
  posts: [],
  drafts: [],
  uploads: [],
  papers: {seen: {}, runs: [], turn: 0},
  rate: {},
  seeded: false,
});

// the feed as it is now (read again when FEED_FILE points somewhere else, as the tests do); an older file gets what it lacks
const store = jsonStore(file, blank, d => {
  for (const [k, v] of Object.entries(blank())) d[k] ??= v;
  d.papers = {...blank().papers, ...d.papers};
});
export const data = store.data,
  save = store.save;
// change the feed and keep it
export function change(fn) {
  const r = fn(data());
  save();
  return r;
}
// start from nothing (tests)
export function reset() {
  store.set(blank());
  save();
  fs.rmSync(mediaDir(), {recursive: true, force: true});
}

export const newId = prefix =>
  `${prefix}${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;

// ---- media: kept as files, named by an id the feed made, with the type it was checked to be ----
export const MEDIA_ID = /^m[a-z0-9]{10,24}$/;
const EXT = {'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/webm': 'webm'};
export function putMedia(bytes, type) {
  if (!EXT[type]) throw new Error(`a ${type} file is not kept`);
  const id = newId('m');
  fs.mkdirSync(mediaDir(), {recursive: true});
  fs.writeFileSync(path.join(mediaDir(), `${id}.${EXT[type]}`), bytes);
  return {id, type, bytes: bytes.length};
}
export function mediaFile(id, type) {
  if (!MEDIA_ID.test(String(id)) || !EXT[type]) return null;
  const f = path.join(mediaDir(), `${id}.${EXT[type]}`);
  return fs.existsSync(f) ? f : null;
}
export function dropMedia(m) {
  for (const x of [m, m?.poster].filter(Boolean)) {
    const f = mediaFile(x.id, x.type);
    if (f) fs.rmSync(f, {force: true});
  }
}
