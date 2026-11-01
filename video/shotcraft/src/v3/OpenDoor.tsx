// The open door: any person's agent, from anywhere, comes in through /llms.txt with its own Ed25519 key, and over that
// key its person's limits only get tighter. A terminal types the three calls (the routes and the 403 are the real
// ones: members/api.js), then the friends' test lands beside it as a card. Typewriter grammar: each command types,
// its answer appears whole.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';

export const OPEN_DOOR_MIN = 390;
const L = LOOKS.serve;
const DIM = '#6b7a72', TXT = '#14241b', OK = '#0a7f44', BAD = '#d1352b';
type Line = { at: number; text: string; color: string; type?: number; big?: boolean; gap?: number };
const LINES: Line[] = [
  { at: 4, text: "any person's agent, from anywhere", color: DIM },
  { at: 14, text: '$ curl play.theminimallab.com/llms.txt', color: TXT, type: 30, gap: 14 },
  { at: 50, text: '  a six-call quick start for agents', color: DIM },
  { at: 68, text: '$ POST /api/members/agents', color: TXT, type: 24, gap: 14 },
  { at: 98, text: '  its own Ed25519 public key, approved by its person', color: DIM },
  { at: 112, text: '200  agent registered', color: OK },
  { at: 136, text: '$ POST /api/agent-channel/huddle/limits', color: TXT, type: 30, gap: 14 },
  { at: 172, text: '  signed: {"maxEach": 400}    (her limit: NT$150)', color: DIM },
  { at: 214, text: '403 · needs: person', color: BAD, big: true, gap: 10 },
  { at: 250, text: "✓ over an agent key, limits only get tighter", color: OK, gap: 18 },
];

const Row: React.FC<{ l: Line }> = ({ l }) => {
  const f = useCurrentFrame();
  if (f < l.at) return <div style={{ height: l.big ? 52 : 38, marginTop: l.gap ?? 0 }} />;
  const n = l.type ? Math.floor(l.text.length * Math.min(1, (f - l.at) / l.type)) : l.text.length;
  const caret = l.type && f - l.at < l.type + 8 && Math.floor(f / 8) % 2 === 0;
  const k = l.big ? springAt(f, l.at, { damping: 9, stiffness: 260 }) : 1;
  return (
    <div style={{ marginTop: l.gap ?? 0, color: l.color, fontSize: l.big ? 46 : 30, fontWeight: l.big ? 800 : 500, lineHeight: l.big ? '52px' : '38px', whiteSpace: 'pre',
      transform: l.big ? `translateX(${(Math.sin((f - l.at) * 1.7) * 9 * (1 - Math.min(1, (f - l.at) / 14))).toFixed(2)}px) scale(${(0.85 + 0.15 * k).toFixed(4)})` : undefined, transformOrigin: '0 50%',
      opacity: l.type ? 1 : ramp(f, l.at, 6, EASE.out) }}>
      {l.text.slice(0, n)}{caret ? '▌' : ''}
    </div>
  );
};

const Stat: React.FC<{ big: string; label: string; at: number }> = ({ big, label, at }) => {
  const f = useCurrentFrame(), t = ramp(f, at, 14, EASE.snappy);
  return (
    <div style={{ opacity: t, transform: `translateY(${mix(18, 0, t).toFixed(2)}px)`, marginTop: 26 }}>
      <div style={{ fontSize: 76, fontWeight: 800, color: L.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 26, color: L.ink, marginTop: 6 }}>{label}</div>
    </div>
  );
};

export const OpenDoor: React.FC = () => {
  const f = useCurrentFrame();
  const term = ramp(f, 0, 16, EASE.snappy), card = ramp(f, 250, 18, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.3, y: 0.1 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 70, top: 46, padding: '8px 18px', borderRadius: 10, background: '#e9f3ec', color: '#0a7f44', fontFamily: FONT.sans, fontSize: 26, fontWeight: 650, opacity: term }}>
          Bring your own agent · the open door
        </div>
        <div style={{ position: 'absolute', left: 70, top: 120, width: 1200, height: 760, borderRadius: 26, background: '#f6f8f7', border: '1px solid rgba(0,0,0,0.08)', padding: '40px 48px', boxSizing: 'border-box',
          fontFamily: FONT.mono, boxShadow: softShadow(22), opacity: term, transform: `translateY(${mix(30, 0, term).toFixed(2)}px)` }}>
          {LINES.map((l, i) => <Row key={i} l={l} />)}
        </div>
        <div style={{ position: 'absolute', left: 1320, top: 120, width: 530, height: 760, borderRadius: 26, background: '#ffffff', padding: '36px 40px', boxSizing: 'border-box',
          fontFamily: FONT.sans, boxShadow: softShadow(24), opacity: card, transform: `translateX(${mix(60, 0, card).toFixed(2)}px)` }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: L.ink2, letterSpacing: '0.06em' }}>TESTED WITH FRIENDS</div>
          <Stat big="10+" label="friends tried it" at={262} />
          <Stat big="2 of 3" label="invites became games" at={290} />
          <Stat big="3 days" label="from invite to the games" at={318} />
          <div style={{ fontSize: 26, fontStyle: 'italic', color: L.ink2, marginTop: 38, lineHeight: 1.35, opacity: ramp(f, 345, 14, EASE.out) }}>“You just talk to the agent.”<br /><span style={{ fontSize: 20, fontStyle: 'normal' }}>a player</span></div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
