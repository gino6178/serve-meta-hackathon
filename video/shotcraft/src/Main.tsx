// The film: Serve's demo, about two minutes. SHOTS is the one timeline; the sound cues are written against it (a shot's
// start plus an offset, never a bare frame), so moving a shot moves its sounds. The music is its own <Audio> behind
// the `bgm` prop, so the same timeline renders with and without it.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile } from 'remotion';
import { ColdOpen, COLD_OPEN_DURATION } from './serve/ColdOpen';
import { Wordmark, WORDMARK_DURATION } from './serve/Wordmark';
import { Stat, STAT_DURATION } from './serve/Stat';
import { PhoneHero, PHONE_HERO_DURATION } from './serve/PhoneHero';
import { LiveFrame, liveDuration } from './serve/LiveFrame';
import { LIVE } from './serve/live';
import { Models, MODELS_DURATION } from './serve/Models';
import { Safety, SAFETY_DURATION } from './serve/Safety';
import { WhoElse, WHO_ELSE_DURATION } from './serve/WhoElse';
import { LiveNumbers, LIVE_NUMBERS_DURATION } from './serve/LiveNumbers';
import { Outro, OUTRO_DURATION } from './serve/Outro';

const Live: React.FC = () => <LiveFrame segs={LIVE} />;
const OUTRO_HOLD = 45; // the lockup stays a beat and a half after it lands

const ORDER: [string, React.FC, number][] = [
  ['cold', ColdOpen, COLD_OPEN_DURATION],
  ['wordmark', Wordmark, WORDMARK_DURATION],
  ['stat', Stat, STAT_DURATION],
  ['phone', PhoneHero, PHONE_HERO_DURATION],
  ['live', Live, liveDuration(LIVE)],
  ['models', Models, MODELS_DURATION],
  ['safety', Safety, SAFETY_DURATION],
  ['who', WhoElse, WHO_ELSE_DURATION],
  ['numbers', LiveNumbers, LIVE_NUMBERS_DURATION],
  ['outro', Outro, OUTRO_DURATION],
];
export const SHOTS: Record<string, { from: number; dur: number }> = {};
{
  let at = 0;
  for (const [k, , d] of ORDER) { SHOTS[k] = { from: at, dur: d }; at += d; }
}
export const TOTAL = SHOTS.outro.from + OUTRO_DURATION + OUTRO_HOLD;

// where each live slice starts inside the live shot (frames), for the cues that belong to a slice
const liveAt = (i: number) => LIVE.slice(0, i).reduce((n, s) => n + Math.round(((s.to - s.from) * 30) / (s.rate ?? 1)), 0);

type Cue = { from: number; src: string; volume: number; dur?: number; note: string };
export const SFX: Cue[] = [
  // cold open: one pop per message landing (cue + 22 in ColdOpen), stepping down; the line arrives with a swoosh
  ...[30, 44, 58, 72, 86, 100].map((o, i) => ({ from: SHOTS.cold.from + o, src: 'pop', volume: 0.6 - i * 0.04, note: `message ${i + 1} lands` })),
  { from: SHOTS.cold.from + 114, src: 'swoosh-quick', volume: 0.35, note: 'the line rises' },
  // the wordmark: a soft entry, and the shimmer when every stroke closes (14 + 52)
  { from: SHOTS.wordmark.from, src: 'transition-soft', volume: 0.4, note: 'into the wordmark' },
  { from: SHOTS.wordmark.from + 64, src: 'sparkle', volume: 0.45, dur: 60, note: 'serve is written' },
  { from: SHOTS.stat.from + 8, src: 'swoosh-quick', volume: 0.3, note: '40% rises' },
  // the phone rises, the chips pop (37, 67)
  { from: SHOTS.phone.from, src: 'whoosh-big', volume: 0.35, note: 'the phone rises' },
  { from: SHOTS.phone.from + 37, src: 'pop', volume: 0.35, note: 'left chip' },
  { from: SHOTS.phone.from + 67, src: 'pop', volume: 0.32, note: 'right chip' },
  // the live frame: the band snaps in, typing under the first slice, a click on each flip (slice 5 → Leo, slice 6 → back)
  { from: SHOTS.live.from, src: 'transition-snap', volume: 0.45, note: 'the frame grows' },
  { from: SHOTS.live.from + 20, src: 'keyboard', volume: 0.28, dur: 150, note: 'typing the request' },
  { from: SHOTS.live.from + liveAt(5), src: 'switch-click-quick', volume: 0.5, note: "flip to Leo's phone" },
  { from: SHOTS.live.from + liveAt(6), src: 'switch-click-quick', volume: 0.5, note: 'flip back: Game on' },
  { from: SHOTS.live.from + liveAt(7), src: 'swoosh-quick', volume: 0.28, note: 'into the planner' },
  { from: SHOTS.live.from + liveAt(11), src: 'swoosh-quick', volume: 0.28, note: 'into clubs' },
  // the models: soft entry, the fan opens (68), the centre card is drawn out (102)
  { from: SHOTS.models.from, src: 'transition-soft', volume: 0.38, note: 'out of the live frame' },
  { from: SHOTS.models.from + 68, src: 'whoosh-fast', volume: 0.35, note: 'the fan opens' },
  { from: SHOTS.models.from + 102, src: 'transition-snap', volume: 0.4, note: 'Glimmer lifts' },
  // safety: the slam (impact frame 15) — the first of the film's two big hits
  { from: SHOTS.safety.from + 9, src: 'whoosh-fast', volume: 0.3, note: 'the card falls' },
  { from: SHOTS.safety.from + 15 - 17, src: 'impact-deep-whoosh', volume: 0.6, dur: 90, note: 'the card lands (the sample peaks 17 frames in)' },
  // built for: one swoosh per reel step (t 0.14, 0.32, 0.50, 0.68 of 180 frames)
  ...[25, 57, 90, 122].map((o, i) => ({ from: SHOTS.who.from + o, src: 'swoosh-quick', volume: 0.42, note: `reel step ${i + 1}` })),
  // live numbers: a swoosh as each card turns (22 + 4, staggered 12)
  ...[26, 38, 50].map((o, i) => ({ from: SHOTS.numbers.from + o, src: 'swoosh-quick', volume: 0.3, note: `card ${i + 1} flips` })),
  // the close: riser into the collapse, impact on the brake (t 0.28 of 132), shimmer after — the second big hit
  { from: SHOTS.outro.from + 6, src: 'whoosh-big', volume: 0.4, note: 'the ring collapses' },
  { from: SHOTS.outro.from + 37 - 17, src: 'impact-deep-whoosh', volume: 0.55, dur: 90, note: 'the mark lands (peak 17 frames in)' },
  { from: SHOTS.outro.from + 46, src: 'sparkle', volume: 0.35, dur: 70, note: 'after the landing' },
];

export const ServePromo: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => (
  <AbsoluteFill style={{ background: '#ffffff' }}>
    {ORDER.map(([k, C]) => (
      <Sequence key={k} from={SHOTS[k].from} durationInFrames={SHOTS[k].dur + (k === 'outro' ? OUTRO_HOLD : 0)}>
        {k === 'outro' ? (
          <>
            <Sequence durationInFrames={OUTRO_DURATION}><C /></Sequence>
            <Sequence from={OUTRO_DURATION}><Freeze frame={OUTRO_DURATION - 1}><C /></Freeze></Sequence>
          </>
        ) : <C />}
      </Sequence>
    ))}
    {bgm && (
      <Audio src={staticFile('audio/bgm-tech-house.mp3')}
        volume={(f) => interpolate(f, [0, 30, TOTAL - 75, TOTAL], [0, 0.24, 0.24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    )}
    {SFX.map((s, i) => (
      <Sequence key={i} from={Math.max(0, s.from)} durationInFrames={s.dur ?? 60}>
        <Audio src={staticFile(`audio/${s.src}.mp3`)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
