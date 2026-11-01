// What the agents send each other while the plan runs: a proposal is facts only, signed; each agent marks the times
// that work for its person; code takes the overlap and holds it for thirty minutes until everyone says yes. Laid over
// the live footage as one card, built up line by line.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { springAt } from '../demos/_fixtures/Look';

const GREEN = '#0a7f44', INK = '#0a0a0b', INK2 = '#5c5f66';
const JSON_LINES = ['{ "id": "t2",', '  "date": "Thu 29 Oct", "start": "19:00",', '  "venue": "Riverside", "court": 3,', '  "trip": 12 }'];
const SETS: [string, string[]][] = [["Ana's agent", ['t1', 't2', 't4']], ["Leo's agent", ['t2', 't3', 't4']], ["Kenji's agent", ['t2', 't4', 't5']]];
const TIMES = ['t1', 't2', 't3', 't4', 't5'];

export const A2ACallout: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const inT = ramp(f, 0, 16, EASE.snappy), out = ramp(f, dur - 12, 12, EASE.exit);
  const pick = ramp(f, 118, 10, EASE.out), held = springAt(f, 140, { damping: 12, stiffness: 180 });
  return (
    <div style={{ position: 'absolute', right: 70, top: 214, width: 640, padding: '26px 30px', borderRadius: 26, background: 'rgba(255,255,255,0.97)', boxShadow: softShadow(30, { color: '#0a1a10', strength: 1.2 }),
      fontFamily: FONT.sans, color: INK, opacity: inT * (1 - out), transform: `translateY(${mix(30, 0, inT).toFixed(2)}px)` }}>
      <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.12em', color: GREEN }}>A2A v1.0 · serve.proposal</div>
      <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 14, background: '#f5f5f6', fontFamily: FONT.mono, fontSize: 24, lineHeight: 1.45, whiteSpace: 'pre' }}>
        {JSON_LINES.map((l, i) => <div key={i} style={{ opacity: ramp(f, 10 + i * 8, 8, EASE.out) }}>{l}</div>)}
      </div>
      <div style={{ marginTop: 12, fontSize: 24, fontWeight: 650, color: GREEN, opacity: ramp(f, 46, 10, EASE.out) }}>✓ signed with Ed25519 · facts only, no free text</div>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SETS.map(([who, ok], k) => (
          <div key={who} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: ramp(f, 66 + k * 10, 10, EASE.out) }}>
            <div style={{ width: 170, fontSize: 22, fontWeight: 650 }}>{who}</div>
            {TIMES.map((t) => {
              const on = ok.includes(t), both = t === 't2' || t === 't4', win = t === 't2';
              const bg = !on ? '#e6e8e7' : win ? mix(0, 1, pick) > 0.5 ? GREEN : '#8cc5a6' : both ? '#8cc5a6' : '#b9dcc8';
              return <div key={t} style={{ width: 64, height: 40, borderRadius: 10, background: bg, color: on ? '#ffffff' : '#9a9ca3', fontSize: 20, fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t}</div>;
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, fontWeight: 700 }}>
        <span style={{ opacity: pick }}>Code picks the overlap: t2</span>
        <span style={{ padding: '8px 18px', borderRadius: 999, background: GREEN, color: '#ffffff', fontSize: 24, transform: `scale(${(0.5 + 0.5 * held).toFixed(4)})`, opacity: Math.min(1, held * 2) }}>held 30 min</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 19, color: INK2, opacity: ramp(f, 150, 12, EASE.out) }}>Illustrative times; the agents' answers in the footage are the demo club's simulated members.</div>
    </div>
  );
};
