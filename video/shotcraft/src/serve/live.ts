// The live segment's slices, in three acts: clip, seconds in the clip, speed, the caption, and the Meta model at
// work. Speed-ups are written on screen by LiveFrame. Clips: scripts/record_live.mjs (test accounts on this machine,
// the real gateway code, Muse Glimmer and Llama Guard on the GPU server); msgbook and courts come from the first
// film's recordings (Messenger: real replies from the end-to-end test; courts: the real search and Glimmer's verdicts).
import type { Seg } from './LiveFrame';

export const LIVE: Seg[] = [
  { kind: 'bumper', src: '', from: 0, to: 1.5, num: '1', title: 'Cold start: no account needed', sub: 'One sentence to your agent, one link to your friends', caption: 'Act 1' },
  { src: 'ask', from: 2.0, to: 12.5, rate: 1.4, caption: 'Tell your agent: "Saturday morning singles, need 1"' },
  { src: 'ask', from: 12.5, to: 32.4, rate: 10, caption: 'It reads the request on my own GPU', model: 'Muse Glimmer \u00b7 RTX 3090' },
  { src: 'ask', from: 32.4, to: 35.6, caption: 'It drafts the invite: day, time, nearest court', model: 'Muse Glimmer drafts' },
  { src: 'ask', from: 35.6, to: 48.9, rate: 8, caption: 'Checked before anyone sees it', model: 'Llama Guard 3 \u00b7 safe' },
  { src: 'ask', from: 48.9, to: 52.0, caption: 'Posted. Share the link to any group chat.' },
  { src: 'link', from: 1.5, to: 11.0, rate: 1.4, caption: 'Leo has no account: the link opens, one sign-in joins', who: 'friend' },
  {
    kind: 'split', src: '', from: 0, to: 4.0, caption: 'Leo joins, and Mia hears "Game on" at once',
    left: { src: 'link', from: 11.0, crop: { x: 300, y: 0, w: 780, h: 864 }, tint: '#1f6fd6', who: 'LEO \u00b7 NO ACCOUNT' },
    right: { src: 'gameon', from: 4.0, crop: { x: 900, y: 360, w: 660, h: 504 }, tint: '#0a7f44', who: 'MIA' },
  },
  { src: 'gameon', from: 8.0, to: 11.0, caption: 'Last spot taken: "Game on", wherever you are', zoom: { x: 1548, y: 845, s: 2 } },

  { kind: 'bumper', src: '', from: 0, to: 1.5, num: '2', title: 'Agents negotiate. You say yes once.', sub: "Your agent talks to each friend's agent over A2A", caption: 'Act 2' },
  { src: 'plan', from: 4.5, to: 10.0, caption: 'Or let your agent plan the week: one tap' },
  { src: 'plan', from: 10.0, to: 104.0, rate: 16, caption: "Glimmer plans; the demo club's simulated members' agents answer", model: 'Signed Agent Cards \u2713 \u00b7 1B student, or Glimmer when unsure' },
  { src: 'plan', from: 104.0, to: 112.8, caption: 'Every agent agreed. Nothing is booked without your yes.' },
  { src: 'msgbook', from: 1.0, to: 9.0, rate: 1.5, caption: 'Or in Messenger: one yes, and it is booked (end-to-end test)', model: 'Muse Glimmer \u00b7 your agent in Messenger' },
  { src: 'plan', from: 125.6, to: 131.3, caption: "A real counter-offer: Hana's agent proposes Saturday", zoom: { x: 1000, y: 470, s: 1.55 }, mark: { x: 600, y: 410, w: 750, h: 104 } },

  { kind: 'bumper', src: '', from: 0, to: 1.5, num: '3', title: 'Real courts, checked reviews, clubs', sub: 'OpenStreetMap, the forecast, and reviews screened first', caption: 'Act 3' },
  { src: 'courts', from: 2.5, to: 6.0, caption: 'Courts near you, in any ball sport' },
  { src: 'courts', from: 6.0, to: 56.0, rate: 14, caption: 'Reviews screened, then every court judged', model: 'Prompt Guard 2 \u00b7 then Muse Glimmer judges' },
  { src: 'courts', from: 56.5, to: 61.5, caption: 'Every reason cites the map, a review or the forecast' },
  { src: 'club', from: 3.5, to: 7.0, caption: 'Clubs on a real map, near wherever you are' },
  { src: 'club', from: 7.0, to: 33.0, rate: 4, caption: 'Start your own: a name, a sport, a place on the map' },
  { src: 'club', from: 33.0, to: 37.5, caption: 'Open to anyone nearby; their games show up here' },
];
