// The v4.3 film (the v4.3 storyboard): the problem and who Serve is for, then one game of Mia's from start to end on
// the real app (the local copy) and the court, A2A and Messenger pages in Taipei, then the layers that make it fast,
// the fifteen Meta models, federated clubs, the AI testers, safety and the club that evolves itself. It reuses the v3
// shots as they are and keeps every shot as long as its narration needs, with no pauses left in.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';
import { LiveFrame, liveDuration, type Seg } from '../serve/LiveFrame';
import { Swarm } from '../serve/Swarm';
import { Safety, SAFETY_DURATION } from '../serve/Safety';
import { Outro, OUTRO_DURATION } from '../serve/Outro';
import { Island } from '../v3/Island';
import { TitleCard, TITLE_DURATION } from '../v3/TitleCard';
import { ShotcraftMark } from '../demos/_fixtures/Brand';
import { WhatServe43 } from './WhatServe43';
import { OpenDoor } from '../v3/OpenDoor';
import { Reel, REEL_MIN } from '../v3/Reel';
import { Tiers } from '../v3/Tiers';
import LINES from '../v43_narration.json';

const FPS = 30, LEAD = 5, TAIL = 4;
const L = LOOKS.serve, GREEN = L.accent, RED = '#d1352b';
const VO = Object.fromEntries(LINES.map((l) => [l.key, l])) as Record<string, (typeof LINES)[number]>;
const voF = (k: string) => Math.ceil(VO[k].dur * FPS);
const fit = (k: string, min = 0) => Math.max(min, LEAD + voF(k) + TAIL);
const subAt = (k: string, i: number) => Math.round(VO[k].subs[Math.min(i, VO[k].subs.length - 1)].start * FPS) + LEAD;

// ---- who it is for -----------------------------------------------------------------------------------------------
const ICON = {
  players: <><circle cx="9" cy="5.5" r="2.6" /><path d="M4.5 21v-5.2c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.3V21" /><ellipse cx="18" cy="7" rx="2.6" ry="3.4" transform="rotate(30 18 7)" /><path d="M16.5 10l-2.6 4.4" /></>,
  clubs: <><circle cx="8" cy="7" r="2.6" /><circle cx="16" cy="7" r="2.6" /><path d="M3 20v-3.6C3 14 5.2 12.4 8 12.4s5 1.6 5 4V20" /><path d="M11 20v-3.6c0-2.4 2.2-4 5-4s5 1.6 5 4V20" /></>,
  builders: <><rect x="3" y="4" width="18" height="14" rx="2.5" /><path d="M9 9l-2.5 2.5L9 14M15 9l2.5 2.5L15 14M12.8 8.2l-1.6 6.6" /><path d="M8 21h8" /></>,
};
const WHO = [
  { h: 'Casual players & organizers', p: 'They want to play every week, but always end up organizing it.', icon: ICON.players, tags: ['habits learned', 'one yes'], frac: 0.02 },
  { h: 'Clubs', p: 'They need to fill courts and spots, week after week.', icon: ICON.clubs, tags: ['fill a spot', 'waitlists'], frac: 0.36 },
  { h: 'Agent builders', p: 'Their personal agents need an open place to negotiate.', icon: ICON.builders, tags: ['llms.txt', 'A2A', 'MCP'], frac: 0.62 },
];
const WhoFor: React.FC = () => {
  const f = useCurrentFrame(), s2 = VO.who.subs[1], at = (x: number) => LEAD + Math.round((s2.start + (s2.end - s2.start) * x) * FPS);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>WHO IT IS FOR</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>Three groups, one missing place</div>
        </div>
        <div style={{ position: 'absolute', left: 110, right: 110, top: 250, display: 'flex', gap: 34, fontFamily: FONT.sans }}>
          {WHO.map((c) => {
            const t = ramp(f, at(c.frac), 14, EASE.snappy), k = springAt(f, at(c.frac), { damping: 13, stiffness: 170 });
            return (
              <div key={c.h} style={{ flex: 1, borderRadius: 28, background: '#ffffff', padding: 40, boxShadow: softShadow(16), opacity: t, transform: `translateY(${mix(46, 0, k).toFixed(2)}px)` }}>
                <div style={{ width: 128, height: 128, borderRadius: 64, background: '#e9f3ec', border: `4px solid ${GREEN}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${(0.7 + 0.3 * k).toFixed(4)})` }}>
                  <svg width={66} height={66} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', color: L.ink, marginTop: 26 }}>{c.h}</div>
                <div style={{ fontSize: 26, color: L.ink2, marginTop: 10, lineHeight: 1.35 }}>{c.p}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>{c.tags.map((g) => <span key={g} style={{ padding: '6px 14px', borderRadius: 999, background: '#f2f4f3', color: L.ink2, fontSize: 20, fontWeight: 650 }}>{g}</span>)}</div>
              </div>
            );
          })}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

// ---- the brand beat: what Serve is, in one line ----------------------------------------------------------------------
const Brand: React.FC = () => {
  const f = useCurrentFrame(), up = (at: number) => { const t = ramp(f, at, 14, EASE.snappy); return { opacity: t, transform: `translateY(${mix(22, 0, t).toFixed(2)}px)` }; };
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.1 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
          <ShotcraftMark size={120} frameProgress={ramp(f, 0, 16, EASE.out)} cutProgress={ramp(f, 14, 10, EASE.overshoot)} />
          <div style={{ ...up(4), fontFamily: FONT.sans, fontSize: 150, fontWeight: 800, letterSpacing: '-0.05em', color: L.ink, lineHeight: 1 }}>serve</div>
        </div>
        <div style={{ ...up(12), position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontFamily: FONT.sans, fontSize: 84, fontWeight: 800, letterSpacing: '-0.035em', color: GREEN }}>A self-evolving agent platform</div>
        <div style={{ ...up(22), position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center', fontFamily: FONT.sans, fontSize: 36, fontWeight: 500, color: L.ink2 }}>Where personal agents negotiate real-world games, and the platform improves itself.</div>
      </Stage>
    </AbsoluteFill>
  );
};

// ---- the fifteen Meta models, each column landing as its line is said ----------------------------------------------
type Where = 'GPU' | 'CPU' | 'API' | '';
const TAG: Record<Where, { t: string; c: string; b: string }> = {
  GPU: { t: 'RTX 3090', c: '#0a7f44', b: '#e9f3ec' }, CPU: { t: 'CPU', c: '#5c5f66', b: '#f2f2f3' }, API: { t: 'Model API', c: '#1f6fd6', b: '#e8f0fb' }, '': { t: '', c: '', b: '' },
};
const COLS: { h: string; sub: number; items: [string, Where, string?][] }[] = [
  { h: 'Agents', sub: 1.0, items: [['Muse Glimmer', 'GPU', 'every agent'], ['Llama 3.2 1B ×2', 'CPU', 'distilled by me'], ['Muse Spark 1.3', 'API', 'long calls, fallback']] },
  { h: 'Safety', sub: 1.3, items: [['Llama Guard 3', 'CPU'], ['Prompt Guard 2', 'CPU'], ['LlamaFirewall CodeShield', ''], ['Agents Rule of Two', '']] },
  { h: 'Voice and memory', sub: 1.52, items: [['Omnilingual ASR', 'CPU', 'voice notes'], ['Muse Voice Transcribe', 'API', 'live voice'], ['DRAMA', 'CPU', 'memory by meaning'], ['Messenger Platform', '']] },
  { h: 'Clips and vision', sub: 1.68, items: [['Sapiens2', 'GPU'], ['SAM 2.1', 'GPU'], ['MapAnything', 'GPU'], ['DETR', 'GPU'], ['SAM 3.1', 'API'], ['Muse Wonder', 'API'], ['Muse Image', 'API']] },
];
const MetaStack43: React.FC = () => {
  const f = useCurrentFrame();
  const colAt = (x: number) => { const i = Math.floor(x), s = VO.meta.subs[Math.min(i, VO.meta.subs.length - 1)]; return LEAD + Math.round((s.start + (s.end - s.start) * (x - i)) * FPS); };
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>BUILT ON META</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>15 Meta models, each with a job</div>
        </div>
        <div style={{ position: 'absolute', left: 110, right: 110, top: 236, display: 'flex', gap: 26, fontFamily: FONT.sans }}>
          {COLS.map((c) => {
            const at = colAt(c.sub), t = ramp(f, at, 14, EASE.snappy);
            return (
              <div key={c.h} style={{ flex: 1, borderRadius: 24, background: '#ffffff', padding: '24px 24px 14px', boxShadow: softShadow(16), opacity: t, transform: `translateY(${mix(36, 0, t).toFixed(2)}px)` }}>
                <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.1em', color: L.ink2, textTransform: 'uppercase' }}>{c.h}</div>
                {c.items.map(([name, w, note], i) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderTop: i ? '1px solid rgba(0,0,0,0.06)' : 'none', marginTop: i ? 0 : 10, opacity: ramp(f, at + 6 + i * 4, 8, EASE.out) }}>
                    <div>
                      <div style={{ fontSize: 27, fontWeight: 700, color: L.ink, whiteSpace: 'nowrap' }}>{name}</div>
                      {note && <div style={{ fontSize: 19, color: L.ink2, marginTop: 2 }}>{note}</div>}
                    </div>
                    {w && <span style={{ flex: 'none', padding: '5px 12px', borderRadius: 999, fontSize: 18, fontWeight: 700, color: TAG[w].c, background: TAG[w].b }}>{TAG[w].t}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

// ---- federated clubs and the disclosure budget ----------------------------------------------------------------------
const NODES = [{ n: 'Club A', x: 170, y: 120 }, { n: 'Club B', x: 590, y: 120 }, { n: 'Club C', x: 380, y: 330 }];
const Federated: React.FC = () => {
  const f = useCurrentFrame();
  const s2 = subAt('fed', 1), sb = VO.fed.subs[1], s3 = LEAD + Math.round((sb.start + (sb.end - sb.start) * 0.68) * FPS), endF = LEAD + Math.round(VO.fed.dur * FPS);
  const barA = ramp(f, s3 - 4, 20, EASE.snappy), barB = ramp(f, s3 + 22, 20, EASE.snappy);
  const card = (at: number): React.CSSProperties => ({ borderRadius: 28, background: '#ffffff', boxShadow: softShadow(16), opacity: ramp(f, at, 12, EASE.out), transform: `translateY(${mix(36, 0, ramp(f, at, 14, EASE.snappy)).toFixed(2)}px)` });
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>ACROSS CLUBS, PRIVATE BY DESIGN</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>Clubs talk across servers. Your week stays yours.</div>
        </div>
        {/* left: three clubs, each on its own server, found by its card and pinned by its key */}
        <div style={{ position: 'absolute', left: 110, top: 250, width: 820, height: 640, padding: 32, fontFamily: FONT.sans, ...card(4) }}>
          <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.1em', color: L.ink2 }}>FEDERATED A2A</div>
          <svg width={760} height={470} style={{ position: 'absolute', left: 30, top: 80, overflow: 'visible' }}>
            {[[0, 1], [0, 2], [1, 2]].map(([a, b], i) => {
              const d = ramp(f, 26 + i * 8, 14, EASE.out), A = NODES[a], B = NODES[b];
              return <line key={i} x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * d} y2={A.y + (B.y - A.y) * d} stroke={f > 60 ? GREEN : '#b8bdc4'} strokeWidth={5} strokeDasharray="12 10" strokeLinecap="round" />;
            })}
          </svg>
          {NODES.map((n, i) => {
            const k = springAt(f, 8 + i * 6, { damping: 12, stiffness: 190 });
            return (
              <div key={n.n} style={{ position: 'absolute', left: 30 + n.x - 105, top: 80 + n.y - 62, width: 210, height: 124, borderRadius: 22, background: '#ffffff', border: `4px solid ${GREEN}`, boxSizing: 'border-box',
                textAlign: 'center', paddingTop: 16, boxShadow: softShadow(10), opacity: ramp(f, 8 + i * 6, 8, EASE.out), transform: `scale(${(0.6 + 0.4 * k).toFixed(4)})` }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: L.ink }}>{n.n}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 17, color: L.ink2, marginTop: 4 }}>/a2a/club.json</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, marginTop: 2 }}>key pinned</div>
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: 32, right: 32, bottom: 30, display: 'flex', gap: 18, alignItems: 'stretch' }}>
            <div style={{ flex: 1, borderRadius: 18, background: '#f3f7f4', padding: '16px 20px', fontSize: 23, lineHeight: 1.4, color: L.ink, opacity: ramp(f, 66, 10, EASE.out) }}>
              Every request between clubs is signed. A rotated key is signed by the old one; a forged hand-over is refused.
            </div>
            <div style={{ width: 250, borderRadius: 18, background: 'linear-gradient(135deg,#0a7f44,#0d5e36)', color: '#ffffff', padding: '14px 18px', opacity: ramp(f, 84, 10, EASE.out),
              transform: `scale(${(0.9 + 0.1 * springAt(f, 84, { damping: 12, stiffness: 180 })).toFixed(4)})` }}>
              <div style={{ fontSize: 13, fontWeight: 750, letterSpacing: '0.16em', opacity: 0.85 }}>INTER-CLUB CHALLENGE</div>
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, marginTop: 8, letterSpacing: '-0.02em' }}>NOOR <span style={{ color: '#ffd84d' }}>vs</span> YOU</div>
              <div style={{ fontSize: 17, marginTop: 8 }}>Loser buys the shuttles</div>
            </div>
          </div>
        </div>
        {/* right: how much of a week a probing agent can pin down */}
        <div style={{ position: 'absolute', left: 980, right: 110, top: 250, height: 640, padding: 32, fontFamily: FONT.sans, ...card(s2 - 6) }}>
          <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.1em', color: L.ink2 }}>DISCLOSURE BUDGET</div>
          <div style={{ fontSize: 26, color: L.ink2, marginTop: 6 }}>How much of your week a probing agent can pin down</div>
          {[{ v: 97.6, l: 'Without a budget', c: '#f2b8b5', tc: RED, t: barA }, { v: 32.4, l: 'With the disclosure budget', c: GREEN, tc: GREEN, t: barB }].map((b, i) => (
            <div key={b.l} style={{ marginTop: i ? 34 : 60 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: L.ink }}>{b.l}</div>
                <div style={{ fontSize: 54, fontWeight: 800, color: b.tc, letterSpacing: '-0.02em', opacity: b.t }}>{(b.v * b.t).toFixed(1)}%</div>
              </div>
              <div style={{ height: 40, borderRadius: 12, background: '#f1f3f5', marginTop: 12, overflow: 'hidden' }}>
                <div style={{ height: 40, width: `${b.v * b.t}%`, borderRadius: 12, background: b.c }} />
              </div>
            </div>
          ))}
          <div style={{ position: 'absolute', left: 32, right: 32, bottom: 30, fontSize: 22, color: L.ink2, opacity: ramp(f, Math.min(endF - 20, s3 + 50), 10, EASE.out) }}>
            Each agent answers repeated offers less precisely, so offers can't map the calendar behind them.
          </div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

// ---- the walk-through: the real app on the local copy, and the Taipei pages in the same frame -----------------------
export const LIVE43: Seg[] = [
  { src: 'v3/ask', from: 12.0, to: 17.5, caption: 'One sentence to her agent: "Badminton Tuesday evening, need 1"', zoom: { x: 0, y: 260, s: 1.32 } },
  { src: 'v3/ask', from: 19.5, to: 46.5, rate: 18, label: '', caption: 'Checked before anyone sees it', model: 'Llama Guard 3 · Prompt Guard 2', zoom: { x: 0, y: 260, s: 1.32, now: true } },
  { src: 'v3/ask', from: 46.5, to: 48.5, caption: 'Posted. Share the link to any group chat.', zoom: { x: 0, y: 260, s: 1.32, now: true } },
  { src: 'v43/courts', from: 0, to: 10.93, caption: 'The best court near her: map, forecast, reviews, everyone\'s trip', model: 'Muse Glimmer judges courts · Prompt Guard 2 screens reviews' },
  { src: 'v43/a2a', from: 0, to: 13.43, caption: 'The agents agree over A2A: signed facts, never free text', model: 'A2A v1.0 · signed Agent Cards' },
  { src: 'v3/link', from: 1.0, to: 11.5, rate: 3.5, label: '', caption: 'Leo has no account: the link opens, one sign-in, he is in', who: 'friend' },
  { src: 'v3/gameon', from: 2.6, to: 5.2, caption: '"Game on." The spot is taken: Leo', zoom: { x: 420, y: 280, s: 1.9 } },
  { src: 'v43/messenger', from: 0, to: 12.42, caption: 'Next time, her agent asks first, in Messenger', model: 'Meta DRAMA memory · Messenger Send API' },
];
const segAt = (i: number) => LIVE43.slice(0, i).reduce((n, s) => n + Math.round(((s.to - s.from) * 30) / (s.rate ?? 1)), 0);
const LIVE_DUR = liveDuration(LIVE43);
const Live: React.FC = () => <LiveFrame segs={LIVE43} />;

// ---- safety, then the community loop (as in v3) ---------------------------------------------------------------------
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
const SafetyLoop: React.FC = () => {
  const stat = subAt('safety', 3) - 6; // when the false rollbacks line starts
  const into = Math.min(SAFETY_DURATION, subAt('safety', 1) + 4);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={into}><Safety lift={56} sub="Untrusted input, private data, the power to act: Meta's Agents Rule of Two." /></Sequence>
      <Sequence from={into}><OffthreadVideo src={staticFile('clips/v3/loop.mp4')} startFrom={30} muted style={{ width: 1920, height: 1080 }} /></Sequence>
      <Sequence from={into}><Evolves statAt={stat - into} /></Sequence>
    </AbsoluteFill>
  );
};
const OUTRO_HOLD = 6;
const OutroHeld: React.FC = () => {
  const p = { line1: 'Built Oct 27 – Nov 4, 2026 · github.com/gino6178/serve-meta-hackathon', line2: 'Try it: play.theminimallab.com' };
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={OUTRO_DURATION}><Outro {...p} /></Sequence>
      <Sequence from={OUTRO_DURATION}><Freeze frame={OUTRO_DURATION - 1}><Outro {...p} /></Freeze></Sequence>
    </AbsoluteFill>
  );
};
const Swarm43: React.FC = () => <Swarm agents={177} logged={17432} counts={false} light close="28 rounds of testing, the way people and outside agents would use it. Every fault fixed." />;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ORDER: [string, React.FC<any>, number][] = [
  ['cover', TitleCard, TITLE_DURATION],
  ['island', Island, fit('island')],
  ['who', WhoFor, fit('who')],
  ['brand', Brand, fit('brand', 75)],
  ['intro', WhatServe43, fit('intro', 175)],
  ['live', Live, LIVE_DUR],
  ['door', OpenDoor, fit('door')],
  ['reel', Reel, fit('reel', REEL_MIN)],
  ['tiers', Tiers, fit('tiers', 500)],
  ['meta', MetaStack43, fit('meta')],
  ['fed', Federated, fit('fed')],
  ['swarm', Swarm43, fit('swarm', 330)],
  ['safety', SafetyLoop, fit('safety', SAFETY_DURATION + 150)],
  ['outro', OutroHeld, OUTRO_DURATION + OUTRO_HOLD],
];
export const SHOTS43: Record<string, { from: number; dur: number }> = {};
{
  let at = 0;
  for (const [k, , d] of ORDER) { SHOTS43[k] = { from: at, dur: d }; at += d; }
}
export const TOTAL43 = SHOTS43.outro.from + SHOTS43.outro.dur;
const S = SHOTS43;
const START: Record<string, number> = {
  island: S.island.from + LEAD, who: S.who.from + LEAD, brand: S.brand.from + LEAD, intro: S.intro.from + LEAD,
  sentence: S.live.from + 14, courts: S.live.from + segAt(3) + 5, a2a: S.live.from + segAt(4) + 5, sentence2: S.live.from + segAt(5) + 6, messenger: S.live.from + segAt(7) + 5,
  door: S.door.from + LEAD, reel: S.reel.from + LEAD, tiers: S.tiers.from + LEAD, meta: S.meta.from + LEAD, fed: S.fed.from + LEAD, swarm: S.swarm.from + LEAD,
  safety: S.safety.from + LEAD, outro: S.outro.from + 40,
};

type Cue = { from: number; src: string; volume: number; dur?: number };
const SFX43: Cue[] = [
  { from: S.cover.from + 12, src: 'whoosh-fast', volume: 0.3 },
  ...[0, 1, 2, 3].map((i) => ({ from: S.island.from + 140 + i * 5, src: 'ui-message-pop', volume: 0.5 - i * 0.04 })),
  ...[0, 1, 2].map((i) => ({ from: S.island.from + 165 + i * 7, src: 'switch-click-quick', volume: 0.35 })),
  { from: S.island.from + 210, src: 'whoosh-fast', volume: 0.3 },
  { from: S.who.from, src: 'transition-soft', volume: 0.35 },
  { from: S.brand.from + 4, src: 'whoosh-fast', volume: 0.3 },
  { from: S.intro.from, src: 'transition-soft', volume: 0.4 },
  { from: S.intro.from + 196, src: 'switch-click-quick', volume: 0.4 },
  { from: S.live.from, src: 'transition-snap', volume: 0.42 },
  { from: S.live.from + 18, src: 'typewriter-digital', volume: 0.26, dur: 30 },
  { from: S.live.from + segAt(3), src: 'switch-click-quick', volume: 0.4 },
  { from: S.live.from + segAt(4), src: 'switch-click-quick', volume: 0.4 },
  { from: S.live.from + segAt(5), src: 'switch-click-quick', volume: 0.5 },
  { from: S.live.from + segAt(6), src: 'switch-click-quick', volume: 0.45 },
  { from: S.live.from + segAt(7), src: 'switch-click-quick', volume: 0.45 },
  ...[14, 68, 136].map((o) => ({ from: S.door.from + o, src: 'typewriter-digital', volume: 0.24, dur: 30 })),
  { from: S.door.from + 214, src: 'switch-click-quick', volume: 0.55 },
  { from: S.reel.from, src: 'transition-soft', volume: 0.38 },
  ...[110, 182, 264, 323].map((o) => ({ from: S.tiers.from + o, src: 'swoosh-quick', volume: 0.3 })),
  { from: S.meta.from, src: 'transition-soft', volume: 0.34 },
  { from: S.fed.from, src: 'transition-soft', volume: 0.34 },
  { from: S.swarm.from, src: 'transition-soft', volume: 0.35 },
  { from: S.safety.from + 9, src: 'whoosh-fast', volume: 0.3 },
  { from: S.safety.from - 2, src: 'impact-deep-whoosh', volume: 0.6, dur: 90 },
  { from: S.outro.from + 6, src: 'air-whoosh-powerful', volume: 0.4 },
  { from: S.outro.from + 20, src: 'impact-deep-whoosh', volume: 0.55, dur: 90 },
  { from: S.outro.from + 46, src: 'shimmer-sparkle-sweep', volume: 0.35, dur: 70 },
];

// the narration and its subtitles (merged at a colon, held until the next sentence)
const merged = (subs: { text: string; start: number; end: number }[]) => subs.reduce<typeof subs>((out, s) => {
  const last = out[out.length - 1];
  if (last && /[:;]$/.test(last.text) && (last.text + s.text).length < 110) out[out.length - 1] = { text: `${last.text} ${s.text}`, start: last.start, end: s.end };
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

export const ServeV43: React.FC<{ bgm?: boolean; voice?: boolean; subs?: boolean }> = ({ bgm = true, voice = true, subs = true }) => (
  <AbsoluteFill style={{ background: '#ffffff' }}>
    {ORDER.map(([k, C, d]) => <Sequence key={k} from={S[k].from} durationInFrames={d}><C dur={d} /></Sequence>)}
    {bgm && (
      <Audio src={staticFile('audio/house-vibez.mp3')} loop
        volume={(f) => interpolate(f, [0, 30, TOTAL43 - 75, TOTAL43], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (voice ? 0.13 - 0.08 * speaking(f) : 0.13)} />
    )}
    {voice && LINES.map((l, i) => (
      <Sequence key={`v${l.key}`} from={START[l.key]} durationInFrames={voF(l.key) + 6}><Audio src={staticFile(`narration/v43/n${i}.wav`)} /></Sequence>
    ))}
    {subs && SUBS.map((s, i) => (
      <Sequence key={`s${i}`} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
        <Sub text={s.text} dur={Math.max(1, s.to - s.from)} bottom={s.from >= S.live.from && s.from < S.live.from + S.live.dur ? 136 : 44} />
      </Sequence>
    ))}
    {SFX43.map((s, i) => (
      <Sequence key={i} from={Math.max(0, s.from)} durationInFrames={s.dur ?? 60}><Audio src={staticFile(`audio/${s.src}.mp3`)} volume={s.volume} /></Sequence>
    ))}
  </AbsoluteFill>
);
