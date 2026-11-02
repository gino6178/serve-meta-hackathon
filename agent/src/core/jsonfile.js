// The gateway's JSON stores on disk. A write goes to a temporary file that is then renamed over the old one, so a
// crash mid-write (the resume test kills the gateway with SIGKILL) leaves the old file or the new one, never half of
// one. A file that still cannot be read (a disk fault, a hand edit) is moved aside as <file>.bad-<time> and the store
// starts empty, rather than the gateway failing to start.
// Sealed at rest (core/crypt.js): with DATA_ENCRYPT=on (or DATA_KEY) every store written here is AES-256-GCM sealed
// under its own key, except caches and evaluation output that hold nothing about a person (OPEN_STORE). A file still
// in plain JSON is read as it is and sealed on its next write, so turning encryption on needs no migration step. A
// sealed file that doesn't open throws: it is never moved aside, since that would start the store empty.
import fs from 'node:fs';
import path from 'node:path';
import * as crypt from './crypt.js';

export const OPEN_STORE =
  /(cache|_eval|eval_|summary|tokens|baseline|model|ledger|papers|probe|contention)/i;
export const storeOf = file => path.basename(file).replace(/\.json$/, '');
const sealsFile = file =>
  crypt.encryptOn() && !OPEN_STORE.test(path.basename(file));
// the JSON a store file holds, opened when it is sealed
export function parse(text, file) {
  const j = JSON.parse(text);
  return crypt.sealed(j) ? crypt.open(j, storeOf(file)) : j;
}
// a store file read as it is, throwing when it is missing or unreadable (readJSON's strict sibling)
export const readSealed = file => parse(fs.readFileSync(file, 'utf8'), file);
export function readJSON(file, empty) {
  if (!fs.existsSync(file)) return empty;
  const text = fs.readFileSync(file, 'utf8');
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    const aside = `${file}.bad-${Date.now()}`;
    try {
      fs.renameSync(file, aside);
    } catch {
      /* leave it */
    }
    console.error(
      `${path.basename(file)} could not be read (${e.message}); moved aside to ${path.basename(aside)}, starting empty`,
    );
    return empty;
  }
  // a sealed file that won't open means the wrong data key, not a broken file: stop, rather than start empty
  if (!crypt.sealed(j)) return j;
  try {
    return crypt.open(j, storeOf(file));
  } catch (e) {
    throw new Error(
      `${path.basename(file)} is sealed and does not open with this data key (${e.message}); check DATA_KEY / DATA_KEY_FILE`,
    );
  }
}
export function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(sealsFile(file) ? crypt.seal(obj, storeOf(file)) : obj),
  );
  fs.renameSync(tmp, file);
}

// A JSON store kept in memory, the pattern every store module shares: data() reads the file once (and again whenever
// its path changes, as the tests switch it), fill(d) adds what an older file lacks, save() writes it, set(v) replaces
// what is kept (a reset). empty() makes a fresh empty value each time, so two stores never share one object.
export function jsonStore(file, empty, fill = () => {}) {
  let db = null,
    from = null;
  const data = () => {
    const f = file();
    if (from !== f) {
      db = readJSON(f, empty());
      from = f;
      fill(db);
    }
    return db;
  };
  return {
    data,
    save: () => writeJSON(file(), data()),
    set: v => {
      from = file();
      return (db = v);
    },
  };
}
