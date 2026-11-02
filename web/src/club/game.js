import {stored, store} from '../storage.js';
// The club state of yours (your posts, cheers, results, invites, what the club sees, the Autopilot's goal), kept in this browser. Pages that show it listen for
// "serve:game", which fires when an agent task or a share changes it from somewhere else.
export const GAME = 'serve.game.v1';
export const readGame = () => stored(GAME, {});
// a page saving its own state: no event, so it does not hear itself
export const saveGame = s => {
  store(GAME, s);
};
export function patchGame(fn) {
  const s = fn(readGame());
  saveGame(s);
  dispatchEvent(new Event('serve:game'));
  return s;
}
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
    day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
