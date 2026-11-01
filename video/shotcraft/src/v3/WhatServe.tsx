// What Serve is, as one diagram: you and your agent on the left, the friends and their agents on the right, Serve in
// the middle as the place the agents negotiate (A2A v1.0 with signed Agent Cards, code for the hard rules and the
// hold, Llama Guard 3 and Prompt Guard 2 on every message). Signed facts travel both ways, Serve holds a game, you say
// yes once; then the log of what your agent sent opens, because you can read every message (the app's Agent chats:
// "What your agent said to theirs"). Timed to the intro line: 0-4.8 s, 4.8-10 s, 10 s on.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';

export const WHAT_MIN = 470;
const L = LOOKS.serve, GREEN = L.accent;
const ROW = 480, YOU = 170, MINE = 430, BOX = { x: 720, y: 230, w: 600, h: 480 }, THEIRS = 1470, FRIEND = 1730;
const FY = [340, 480, 620];
const NAMES = ['Leo', 'Sam', 'Mia'];
// the intro line: what Serve is 0-4.7 s, players / court / time / yes 4.7-11.6 s, credentials and the log after
const S2 = 120, NEAR = 125, COURT = 160, YES = 262, KEY = 292, LOG = 312;

const pop = (f: number, at: number) => ({ k: springAt(f, at, { damping: 12, stiffness: 190 }), o: ramp(f, at, 8, EASE.out) });
const Orb: React.FC<{ x: number; y: number; at: number; agent?: boolean; label: string; r?: number }> = ({ x, y, at, agent, label, r = 56 }) => {
  const f = useCurrentFrame(), { k, o } = pop(f, at);
  return (
    <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, textAlign: 'center', opacity: o, transform: `scale(${(0.4 + 0.6 * k).toFixed(4)})` }}>
      <div style={{ width: r * 2, height: r * 2, borderRadius: r, boxSizing: 'border-box', background: agent ? '#e9f3ec' : '#f2f2f3', border: agent ? `4px solid ${GREEN}` : '1px solid rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: softShadow(10) }}>
        {agent
          ? <svg width={r} height={r} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M10 16.5h4" /></svg>
          : <svg width={r} height={r} viewBox="0 0 24 24" fill="none" stroke={L.ink} strokeWidth={1.6} strokeLinecap="round"><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></svg>}
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 700, color: agent ? GREEN : L.ink, marginTop: 8, whiteSpace: 'nowrap', marginLeft: -60, marginRight: -60 }}>{label}</div>
    </div>
  );
};
// each agent's credential: a key that lands on its orb
const Key: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame(), k = springAt(f, at, { damping: 10, stiffness: 240 });
  return (
    <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: 22, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: softShadow(8), opacity: Math.min(1, k * 2), transform: `scale(${(0.3 + 0.7 * k).toFixed(4)})` }}>
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></svg>
    </div>
  );
};
const Wire: React.FC<{ x0: number; y0: number; x1: number; y1: number; at: number }> = ({ x0, y0, x1, y1, at }) => {
  const f = useCurrentFrame(), t = ramp(f, at, 16, EASE.out);
  return <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}><line x1={x0} y1={y0} x2={mix(x0, x1, t)} y2={mix(y0, y1, t)} stroke="rgba(10,127,68,0.35)" strokeWidth={4} strokeLinecap="round" /></svg>;
};
// a signed fact riding a wire
const Packet: React.FC<{ x0: number; y0: number; x1: number; y1: number; at: number; text: string }> = ({ x0, y0, x1, y1, at, text }) => {
  const f = useCurrentFrame(), t = ramp(f, at, 34, EASE.smooth), o = ramp(f, at, 5, EASE.out) * (1 - ramp(f, at + 30, 6, EASE.out));
  return (
    <div style={{ position: 'absolute', left: mix(x0, x1, t), top: mix(y0, y1, t), transform: 'translate(-50%, -50%)', opacity: o, padding: '7px 14px', borderRadius: 999, background: '#ffffff',
      border: `2px solid ${GREEN}`, fontFamily: FONT.sans, fontSize: 20, fontWeight: 700, color: GREEN, whiteSpace: 'nowrap', boxShadow: softShadow(8) }}>{text} ✓</div>
  );
};

export const WhatServe: React.FC = () => {
  const f = useCurrentFrame();
  const box = pop(f, 46), held = ramp(f, 208, 12, EASE.snappy), yes = springAt(f, YES, { damping: 10, stiffness: 230 });
  const log = ramp(f, LOG, 18, EASE.snappy), dimRest = 1 - 0.3 * log;
  const rows = ['A2A v1.0 · signed Agent Cards', 'Code: hard rules, overlap, 30-min hold', 'Llama Guard 3 · Prompt Guard 2 check it all'];
  const near = ramp(f, NEAR, 14, EASE.snappy), court = ramp(f, COURT, 14, EASE.snappy);
  const midY = BOX.y + BOX.h / 2;
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>WHAT SERVE IS</div>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>Where personal agents negotiate real-world games</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: dimRest }}>
          <Wire x0={YOU + 56} y0={ROW} x1={MINE - 56} y1={ROW} at={24} />
          <Wire x0={MINE + 56} y0={ROW} x1={BOX.x} y1={midY} at={40} />
          {FY.map((y, i) => <Wire key={`w${i}`} x0={BOX.x + BOX.w} y0={midY} x1={THEIRS - 50} y1={y} at={56 + i * 6} />)}
          {FY.map((y, i) => <Wire key={`v${i}`} x0={THEIRS + 50} y0={y} x1={FRIEND - 50} y1={y} at={70 + i * 6} />)}
          <div style={{ position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: 30, background: '#ffffff', border: `3px solid ${GREEN}`, boxSizing: 'border-box',
            padding: '28px 32px', boxShadow: softShadow(26), fontFamily: FONT.sans, opacity: box.o, transform: `scale(${(0.85 + 0.15 * box.k).toFixed(4)})` }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', color: L.ink }}>serve</div>
            <div style={{ fontSize: 22, color: L.ink2, marginTop: 2 }}>the place the agents negotiate</div>
            {rows.map((t, i) => (
              <div key={t} style={{ marginTop: 14, padding: '12px 16px', borderRadius: 14, background: '#f5f5f6', fontSize: 23, fontWeight: 600, color: L.ink, opacity: ramp(f, 70 + i * 14, 10, EASE.out) }}>{t}</div>
            ))}
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 14, background: '#fff7e6', color: '#9a5b00', fontSize: 23, fontWeight: 700, opacity: court, transform: `translateY(${mix(10, 0, court).toFixed(2)}px)` }}>Best court between you: NTU Gymnasium</div>
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 14, background: '#e9f3ec', color: GREEN, fontSize: 24, fontWeight: 750, opacity: held, transform: `translateY(${mix(10, 0, held).toFixed(2)}px)` }}>Held: Thu 19:00 · NTU Gymnasium</div>
          </div>
          <Orb x={YOU} y={ROW} at={14} label="You" r={62} />
          <Orb x={MINE} y={ROW} at={28} agent label="Your agent" />
          {FY.map((y, i) => <Orb key={`t${i}`} x={THEIRS} y={y} at={60 + i * 6} agent r={46} label={`${NAMES[i]}'s agent`} />)}
          {FY.map((y, i) => <Orb key={`p${i}`} x={FRIEND} y={y} at={74 + i * 6} r={46} label={NAMES[i]} />)}
          <div style={{ position: 'absolute', left: THEIRS - 80, top: FY[0] - 118, width: 420, textAlign: 'center', fontFamily: FONT.sans, fontSize: 24, fontWeight: 750, color: GREEN, opacity: near, transform: `translateY(${mix(12, 0, near).toFixed(2)}px)` }}>
            <span style={{ padding: '8px 18px', borderRadius: 999, background: '#e9f3ec' }}>Nearby players found</span>
          </div>
          <Key x={MINE + 40} y={ROW - 40} at={KEY} />
          {FY.map((y, i) => <Key key={`key${i}`} x={THEIRS + 34} y={y - 34} at={KEY + 4 + i * 4} />)}
          <Packet x0={MINE + 40} y0={ROW} x1={BOX.x + 20} y1={midY} at={S2} text="free Thu 19–21" />
          {FY.map((y, i) => <Packet key={`k${i}`} x0={THEIRS - 40} y0={y} x1={BOX.x + BOX.w - 20} y1={midY} at={S2 + 18 + i * 10} text={['free Thu 19–21', 'max NT$150', 'free Thu 18–22'][i]} />)}
        </div>
        <div style={{ position: 'absolute', left: YOU - 110, top: ROW - 150, padding: '10px 20px', borderRadius: 999, background: GREEN, color: '#ffffff', fontFamily: FONT.sans, fontSize: 26, fontWeight: 750,
          opacity: Math.min(1, yes * 2), transform: `scale(${(0.5 + 0.5 * yes).toFixed(4)})`, transformOrigin: '50% 100%', whiteSpace: 'nowrap' }}>One yes from you</div>
        <div style={{ position: 'absolute', left: 60, top: 600, width: 640, padding: '22px 28px', borderRadius: 24, background: '#ffffff', border: `3px solid ${GREEN}`, boxSizing: 'border-box',
          boxShadow: softShadow(26), fontFamily: FONT.sans, opacity: log, transform: `translateY(${mix(40, 0, log).toFixed(2)}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 800, color: L.ink, whiteSpace: 'nowrap' }}>
            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
            Every message and reply: yours to read
          </div>
          {['→ Leo’s agent   free Thu 19–21 · signed', '← Leo’s agent   yes, Thu 19:00 · signed', '→ Sam’s agent   max NT$150 each · signed', '← Sam’s agent   yes · signed', '✓ your yes   signed, hash-chained'].map((t, i) => (
            <div key={t} style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 22, color: i % 2 || i === 4 ? GREEN : L.ink, fontWeight: i === 4 ? 700 : 400, whiteSpace: 'pre', opacity: ramp(f, LOG + 10 + i * 8, 8, EASE.out) }}>{t}</div>
          ))}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
