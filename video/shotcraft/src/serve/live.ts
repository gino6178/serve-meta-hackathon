// The live segment's slices: clip, seconds in the clip, speed, and what the caption says. Speed-ups are written on
// screen by LiveFrame. Clips were recorded by scripts/record_live.mjs (test accounts on this machine, the real gateway
// code, Muse Glimmer and Llama Guard on the GPU server).
import type { Seg } from './LiveFrame';

export const LIVE: Seg[] = [
  { src: 'ask', from: 2.0, to: 12.5, rate: 1.4, caption: 'Tell your agent: "Saturday morning singles, need 1"' },
  { src: 'ask', from: 12.5, to: 32.4, rate: 10, caption: 'Muse Glimmer reads it on my own GPU' },
  { src: 'ask', from: 32.4, to: 35.6, caption: 'It drafts the invite: day, time, nearest court' },
  { src: 'ask', from: 35.6, to: 48.9, rate: 8, caption: 'Llama Guard checks it before anyone sees it' },
  { src: 'ask', from: 48.9, to: 52.0, caption: 'Posted. Share the link to any group chat.' },
  { src: 'link', from: 1.5, to: 15.5, rate: 1.4, caption: 'Leo has no account: the link opens, one sign-in joins', who: 'friend' },
  { src: 'gameon', from: 4.5, to: 11.0, caption: 'Last spot taken: "Game on", wherever you are', zoom: { x: 1548, y: 845, s: 2 } },
  { src: 'plan', from: 4.5, to: 10.0, caption: 'Or let your agent plan the week: one tap' },
  { src: 'plan', from: 10.0, to: 104.0, rate: 16, caption: "Glimmer plans; the demo club's simulated members' agents answer" },
  { src: 'plan', from: 104.0, to: 112.8, caption: 'Every agent agreed. Nothing is booked without your yes.' },
  { src: 'plan', from: 119.0, to: 127.0, caption: 'What the agents said to each other, word for word' },
  { src: 'club', from: 3.5, to: 7.0, caption: 'Clubs on a real map, near wherever you are' },
  { src: 'club', from: 7.0, to: 27.0, rate: 3, caption: 'Start your own: a name, a sport, a place on the map' },
  { src: 'club', from: 27.0, to: 33.0, rate: 2, caption: 'Start your own: a name, a sport, a place on the map' },
  { src: 'club', from: 33.0, to: 37.5, caption: 'Open to anyone nearby; their games show up here' },
];
