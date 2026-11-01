// The v3.1 film (video/storyboard_zh_v3.md): the gap between personal agents, Serve as the place they negotiate, the
// real app on the local copy with the server's models, the open door for outside agents, the layers that make
// negotiating fast, what Meta's models taught us, the AI testers, safety, the close. SHOTS is the one timeline: each
// shot is as long as its narration needs (narration.json, Kokoro) plus a breath, and every sound cue and voice line is
// written against a shot's start, so moving a shot moves its sounds. bgm/voice/subs are props, as in the first film.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FONT } from '../demos/_fixtures/Polish';
import { LiveFrame, liveDuration, type Seg } from '../serve/LiveFrame';
import { Swarm } from '../serve/Swarm';
import { Safety, SAFETY_DURATION } from '../serve/Safety';
import { Outro, OUTRO_DURATION } from '../serve/Outro';
import { Island, ISLAND_MIN } from './Island';
import { WhatServe, WHAT_MIN } from './WhatServe';
import { TitleCard, TITLE_DURATION } from './TitleCard';
import { MetaStack, META_MIN } from './MetaStack';
import { A2ACallout } from './A2ACallout';
import { VoiPage, VOI_DURATION } from './VoiCallout';
import { Text1B, TEXT1B_MIN } from './Text1B';
import { OpenDoor, OPEN_DOOR_MIN } from './OpenDoor';
import { Reel, REEL_MIN } from './Reel';
import { Tiers, TIERS_MIN } from './Tiers';
import { Guard, GUARD_MIN } from './Guard';
import LINES from './narration.json';

const FPS = 30, LEAD = 5, TAIL = 12;
const VO = Object.fromEntries(LINES.map((l) => [l.key, l])) as Record<string, (typeof LINES)[number]>;
const voF = (k: string) => Math.ceil(VO[k].dur * FPS);
const fit = (k: string, min: number) => Math.max(min, LEAD + voF(k) + TAIL);

// the live block: the local copy (ask, link, gameon: scripts/record_live.mjs against the server's own models) and the
// first film's plan and Messenger recordings
export const LIVE3: Seg[] = [
  { src: 'v3/ask', from: 11.3, to: 19.5, caption: 'One sentence to your agent: "Badminton Tuesday evening, need 1"', model: 'Code reads the day and the nearest court · no model', zoom: { x: 0, y: 260, s: 1.32 } },
  { src: 'v3/ask', from: 19.5, to: 46.5, rate: 13.5, label: '', caption: 'Checked before anyone sees it', model: 'Llama Guard 3 · Prompt Guard 2', zoom: { x: 0, y: 260, s: 1.32, now: true } },
  { src: 'v3/ask', from: 46.5, to: 49.5, caption: 'Posted. Share the link to any group chat.', zoom: { x: 0, y: 260, s: 1.32, now: true } },
  { src: 'v3/link', from: 1.0, to: 11.5, rate: 2, label: '', caption: 'A friend with no account: the link opens, one sign-in, he is in', who: 'friend' },
  { src: 'v3/gameon', from: 2.6, to: 6.0, caption: '"Game on." The spot is taken: Leo', zoom: { x: 420, y: 280, s: 1.9 } },
  { kind: 'bumper', src: '', from: 0, to: 1.5, num: '2', title: 'Agents negotiate. You say yes once.', sub: "Every player's agent, over A2A v1.0", caption: 'A2A' },
  { src: 'plan', from: 4.5, to: 8.5, caption: 'One tap: let your agent plan the week', zoom: { x: 1560, y: 0, s: 1.22 } },
  { src: 'plan', from: 10.0, to: 104.0, rate: 16, label: '', caption: "Each member's agent answers: signed facts, never free text", model: 'Signed Agent Cards ✓ · our 1B, or Glimmer when unsure', zoom: { x: 1560, y: 864, s: 1.22 } },
  { src: 'plan', from: 104.0, to: 112.8, rate: 2.6, label: '', caption: 'Every agent agreed. Held for you; nothing is booked without your yes.' },
  { src: 'msgbook', from: 0.5, to: 9.0, rate: 1.13, label: '', caption: 'Your agent asks first, in Messenger: one tap, and it is booked', model: 'Muse Glimmer · your agent in Messenger' },
];
const segAt = (i: number) => LIVE3.slice(0, i).reduce((n, s) => n + Math.round(((s.to - s.from) * 30) / (s.rate ?? 1)), 0);
const SEG = { link: segAt(3), bumper: segAt(5), plan2: segAt(7), msg: segAt(9) };
const LIVE_DUR = liveDuration(LIVE3);

const Live: React.FC = () => (
  <AbsoluteFill>
    <LiveFrame segs={LIVE3} />
    <Sequence from={SEG.plan2 + 6} durationInFrames={SEG.msg - SEG.plan2 - 6}><A2ACallout dur={SEG.msg - SEG.plan2 - 6} /></Sequence>
  </AbsoluteFill>
);
// over the community loop: Serve evolves itself, and the anytime-valid test behind its rollbacks (README §7)
const Evolves: React.FC<{ statAt: number }> = ({ statAt }) => {
  const f = useCurrentFrame(), t = interpolate(f, [4, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), s = interpolate(f, [statAt, statAt + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', right: 80, top: 166, width: 620, padding: '16px 24px', borderRadius: 20, background: '#ffffff', boxShadow: '0 14px 40px rgba(10,26,16,0.14)', fontFamily: FONT.sans,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, opacity: t, transform: `translateY(${(20 * (1 - t)).toFixed(2)}px)` }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 750, letterSpacing: '0.12em', color: '#0a7f44' }}>A SELF-EVOLVING COMMUNITY</div>
        <div style={{ fontSize: 20, color: '#5c5f66', marginTop: 4 }}>False rollbacks of harmless changes</div>
      </div>
      <div style={{ fontSize: 46, fontWeight: 800, color: '#0a7f44', letterSpacing: '-0.02em', whiteSpace: 'nowrap', opacity: s, transform: `scale(${(0.85 + 0.15 * s).toFixed(4)})` }}>22% → 0.6%</div>
    </div>
  );
};
const LOOP = 180; // the first film's community loop, 6 s of it
const SafetyLoop: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={SAFETY_DURATION}><Safety lift={56} sub="Untrusted input, private data, the power to act: Meta's Agents Rule of Two." /></Sequence>
    <Sequence from={SAFETY_DURATION}><OffthreadVideo src={staticFile('clips/v3/loop.mp4')} startFrom={30} muted style={{ width: 1920, height: 1080 }} /></Sequence>
    <Sequence from={SAFETY_DURATION}><Evolves statAt={326 - SAFETY_DURATION} /></Sequence>
  </AbsoluteFill>
);
const OUTRO_HOLD = 30;
const OutroHeld: React.FC = () => {
  const p = { line1: 'Built Oct 27 – Nov 4, 2026 · github.com/gino6178/serve-meta-hackathon', line2: 'Try it: play.theminimallab.com' };
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={OUTRO_DURATION}><Outro {...p} /></Sequence>
      <Sequence from={OUTRO_DURATION}><Freeze frame={OUTRO_DURATION - 1}><Outro {...p} /></Freeze></Sequence>
    </AbsoluteFill>
  );
};
const SwarmV3: React.FC = () => <Swarm agents={177} logged={17432} counts={false} light close="28 rounds of testing, the way people and outside agents would use it. Every fault fixed." />;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ORDER: [string, React.FC<any>, number][] = [
  ['cover', TitleCard, TITLE_DURATION],
  ['island', Island, fit('island', ISLAND_MIN)],
  ['intro', WhatServe, fit('intro', WHAT_MIN)],
  ['live', Live, LIVE_DUR],
  ['voi', VoiPage, VOI_DURATION],
  ['door', OpenDoor, fit('door', OPEN_DOOR_MIN)],
  ['reel', Reel, fit('reel', REEL_MIN)],
  ['tiers', Tiers, fit('tiers', TIERS_MIN)],
  ['text1b', Text1B, fit('text1b', TEXT1B_MIN)],
  ['meta', MetaStack, fit('meta', META_MIN)],
  ['guard', Guard, fit('guard', GUARD_MIN)],
  ['swarm', SwarmV3, fit('swarm', 420)],
  ['safety', SafetyLoop, fit('safety', SAFETY_DURATION + LOOP)],
  ['outro', OutroHeld, OUTRO_DURATION + OUTRO_HOLD],
];
export const SHOTS3: Record<string, { from: number; dur: number }> = {};
{
  let at = 0;
  for (const [k, , d] of ORDER) { SHOTS3[k] = { from: at, dur: d }; at += d; }
}
export const TOTAL3 = SHOTS3.outro.from + SHOTS3.outro.dur;

// where each line starts: a shot's start plus the lead, or a live slice's start
const S = SHOTS3;
const START: Record<string, number> = {
  island: S.island.from + LEAD + 10, intro: S.intro.from + LEAD, sentence: S.live.from + 14, sentence2: S.live.from + SEG.link + 6,
  a2a: S.live.from + SEG.bumper + 12, messenger: S.live.from + SEG.msg + 4, door: S.door.from + LEAD, reel: S.reel.from + LEAD,
  tiers: S.tiers.from + LEAD, text1b: S.text1b.from + LEAD, meta: S.meta.from + LEAD, guard: S.guard.from + LEAD, swarm: S.swarm.from + LEAD + 20, safety: S.safety.from + LEAD, outro: S.outro.from + 40,
};

type Cue = { from: number; src: string; volume: number; dur?: number; note: string };
export const SFX3: Cue[] = [
  ...[0, 1, 2, 3].map((i) => ({ from: S.island.from + 140 + i * 5, src: 'pop', volume: 0.5 - i * 0.04, note: `lock ${i + 1}` })),
  ...[0, 1, 2].map((i) => ({ from: S.island.from + 165 + i * 7, src: 'switch-click-quick', volume: 0.35, note: `link ${i + 1} cut` })),
  { from: S.island.from + 175, src: 'swoosh-quick', volume: 0.3, note: 'no place to talk' },
  { from: S.island.from + 210, src: 'whoosh-fast', volume: 0.3, note: 'the group chat' },
  { from: S.intro.from, src: 'transition-soft', volume: 0.4, note: 'what Serve is' },
  { from: S.intro.from + 46, src: 'swoosh-quick', volume: 0.32, note: 'the Serve box' },
  { from: S.intro.from + 120, src: 'pop', volume: 0.3, note: 'signed facts travel' },
  { from: S.intro.from + 160, src: 'pop', volume: 0.32, note: 'the best court' },
  { from: S.intro.from + 208, src: 'pop', volume: 0.36, note: 'held' },
  { from: S.intro.from + 262, src: 'switch-click-quick', volume: 0.4, note: 'one yes' },
  ...[0, 1, 2, 3].map((i) => ({ from: S.intro.from + 292 + i * 4, src: 'pop', volume: 0.24, note: `key ${i + 1}` })),
  { from: S.intro.from + 312, src: 'swoosh-quick', volume: 0.34, note: 'every message and reply' },
  { from: S.live.from, src: 'transition-snap', volume: 0.42, note: 'the frame grows' },
  { from: S.live.from + 18, src: 'keyboard', volume: 0.26, dur: 30, note: 'the sentence typed' },
  { from: S.live.from + SEG.link, src: 'switch-click-quick', volume: 0.5, note: "to the friend's phone" },
  { from: S.live.from + segAt(4), src: 'switch-click-quick', volume: 0.45, note: 'Game on' },
  { from: S.live.from + SEG.bumper + 4, src: 'swoosh-quick', volume: 0.38, note: 'A2A card' },
  { from: S.live.from + SEG.plan2 + 6, src: 'swoosh-quick', volume: 0.3, note: 'the proposal card' },
  { from: S.live.from + SEG.plan2 + 146, src: 'pop', volume: 0.38, note: 'held 30 min' },
  { from: S.live.from + SEG.msg, src: 'switch-click-quick', volume: 0.45, note: 'into Messenger' },
  ...[14, 68, 136].map((o, i) => ({ from: S.door.from + o, src: 'keyboard', volume: 0.24, dur: 30, note: `command ${i + 1} typed` })),
  { from: S.door.from + 214, src: 'switch-click-quick', volume: 0.55, note: '403 lands' },
  { from: S.door.from + 250, src: 'swoosh-quick', volume: 0.35, note: 'the friends card' },
  { from: S.reel.from, src: 'transition-soft', volume: 0.38, note: 'into the reel' },
  { from: S.reel.from + 100, src: 'whoosh-fast', volume: 0.3, note: 'the clip' },
  { from: S.cover.from + 12, src: 'whoosh-fast', volume: 0.3, note: 'the mark draws' },
  ...[110, 182, 264, 323].map((o, i) => ({ from: S.tiers.from + o, src: 'swoosh-quick', volume: 0.3, note: `tier ${i + 1}` })),
  { from: S.text1b.from, src: 'transition-soft', volume: 0.34, note: 'the text 1B' },
  ...[116, 209].map((o, i) => ({ from: S.text1b.from + o - 10, src: 'swoosh-quick', volume: 0.3, note: `attack group ${i + 1}` })),
  { from: S.voi.from, src: 'swoosh-quick', volume: 0.34, note: 'the question worth most' },
  { from: S.safety.from + 326, src: 'pop', volume: 0.36, note: 'false rollbacks' },
  { from: S.meta.from, src: 'transition-soft', volume: 0.34, note: 'built on Meta' },
  ...[0, 1, 2, 3].map((i) => ({ from: S.meta.from + 14 + i * 26, src: 'swoosh-quick', volume: 0.26, note: `column ${i + 1}` })),
  { from: S.guard.from + 170, src: 'pop', volume: 0.45, note: 'refused' },
  { from: S.guard.from + 236, src: 'sparkle', volume: 0.32, dur: 60, note: 'fixed' },
  { from: S.swarm.from, src: 'transition-soft', volume: 0.35, note: 'into the swarm' },
  { from: S.safety.from + 9, src: 'whoosh-fast', volume: 0.3, note: 'the card falls' },
  { from: S.safety.from + 15 - 17, src: 'impact-deep-whoosh', volume: 0.6, dur: 90, note: 'big hit 1 (peak 17 frames in)' },
  { from: S.safety.from + SAFETY_DURATION, src: 'swoosh-quick', volume: 0.32, note: 'the community loop' },
  { from: S.outro.from + 6, src: 'whoosh-big', volume: 0.4, note: 'the ring collapses' },
  { from: S.outro.from + 37 - 17, src: 'impact-deep-whoosh', volume: 0.55, dur: 90, note: 'big hit 2' },
  { from: S.outro.from + 46, src: 'sparkle', volume: 0.35, dur: 70, note: 'after the landing' },
];

// the narration and its subtitles (merged at a colon, held until the next sentence)
const merged = (subs: { text: string; start: number; end: number }[]) => subs.reduce<typeof subs>((out, s) => {
  const last = out[out.length - 1];
  if (last && /[:;]$/.test(last.text)) out[out.length - 1] = { text: `${last.text} ${s.text}`, start: last.start, end: s.end };
  else out.push({ ...s });
  return out;
}, []);
const SUBS = LINES.flatMap((l) => {
  const subs = merged(l.subs), at = START[l.key];
  return subs.map((s, i) => { const next = subs[i + 1]; return { text: s.text, from: at + Math.round(s.start * FPS), to: at + Math.round((next ? next.start : s.end + 0.4) * FPS) }; });
});
const on = (f: number) => LINES.some((l) => f >= START[l.key] - 6 && f <= START[l.key] + voF(l.key) + 6);
const speaking = (f: number) => { let n = 0; for (let d = -8; d <= 8; d++) n += on(f + d) ? 1 : 0; return n / 17; };
const Sub: React.FC<{ text: string; dur: number; bottom: number }> = ({ text, dur, bottom }) => {
  const f = useCurrentFrame(), o = interpolate(f, [0, 4, dur - 4, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ maxWidth: 1480, padding: '10px 26px', borderRadius: 14, background: 'rgba(10,10,11,0.78)', color: '#ffffff', fontFamily: FONT.sans, fontSize: 38, fontWeight: 600, lineHeight: 1.28, textAlign: 'center', letterSpacing: '-0.01em' }}>{text}</div>
    </div>
  );
};

export const ServeV3: React.FC<{ bgm?: boolean; voice?: boolean; subs?: boolean }> = ({ bgm = true, voice = true, subs = true }) => (
  <AbsoluteFill style={{ background: '#ffffff' }}>
    {ORDER.map(([k, C, d]) => <Sequence key={k} from={S[k].from} durationInFrames={d}><C dur={d} /></Sequence>)}
    {bgm && (
      <Audio src={staticFile('audio/bgm-tech-house.mp3')} loop
        volume={(f) => interpolate(f, [0, 30, TOTAL3 - 75, TOTAL3], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (voice ? 0.13 - 0.08 * speaking(f) : 0.13)} />
    )}
    {voice && LINES.map((l, i) => (
      <Sequence key={`v${l.key}`} from={START[l.key]} durationInFrames={voF(l.key) + 6}><Audio src={staticFile(`narration/v3/n${i}.wav`)} /></Sequence>
    ))}
    {subs && SUBS.map((s, i) => (
      <Sequence key={`s${i}`} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
        <Sub text={s.text} dur={Math.max(1, s.to - s.from)} bottom={s.from >= S.live.from && s.from < S.live.from + S.live.dur ? 136 : 44} />
      </Sequence>
    ))}
    {SFX3.map((s, i) => (
      <Sequence key={i} from={Math.max(0, s.from)} durationInFrames={s.dur ?? 60}><Audio src={staticFile(`audio/${s.src}.mp3`)} volume={s.volume} /></Sequence>
    ))}
  </AbsoluteFill>
);
