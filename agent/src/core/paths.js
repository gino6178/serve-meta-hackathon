// Where the demo's made-up data is (web/public/data: club.json, venues.json), for every module that reads it.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DEMO_DATA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../web/public/data',
);
export const demoFile = name => path.join(DEMO_DATA, name);
export const readVenues = () =>
  JSON.parse(fs.readFileSync(demoFile('venues.json'), 'utf8'));
