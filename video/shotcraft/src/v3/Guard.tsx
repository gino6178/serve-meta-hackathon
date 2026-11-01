// Two things running Meta's models taught us, both measured: Muse Glimmer reasons even with thinking switched off (84%
// of the tokens over 2,755 logged calls), and Llama Guard 3 once refused a club named "Serve test round 27" as violence
// on the live site (S9, then S1). The fix keeps the guard: S9 needs a weapon word, S1 alone goes to the club's standard.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';

export const GUARD_MIN = 340;
const L = LOOKS.serve, GREEN = L.accent, RED = '#d1352b';

const Panel: React.FC<{ x: number; at: number; children: React.ReactNode }> = ({ x, at, children }) => {
  const f = useCurrentFrame(), t = ramp(f, at, 16, EASE.snappy);
  return (
    <div style={{ position: 'absolute', left: x, top: 150, width: 820, height: 760, borderRadius: 28, background: '#ffffff', padding: '40px 46px', boxSizing: 'border-box',
      boxShadow: softShadow(22), fontFamily: FONT.sans, opacity: t, transform: `translateY(${mix(40, 0, t).toFixed(2)}px)` }}>{children}</div>
  );
};

export const Guard: React.FC = () => {
  const f = useCurrentFrame();
  const pct = ramp(f, 44, 50, EASE.out), refuse = springAt(f, 196, { damping: 11, stiffness: 220 }), fixed = ramp(f, 270, 14, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 52, fontFamily: FONT.sans, fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN, opacity: ramp(f, 0, 12, EASE.out) }}>WHAT RUNNING META'S MODELS TAUGHT ME</div>
        <Panel x={110} at={24}>
          <div style={{ fontSize: 26, color: L.ink2 }}>Muse Glimmer, 2,755 calls logged</div>
          <div style={{ fontSize: 190, fontWeight: 800, letterSpacing: '-0.05em', color: GREEN, lineHeight: 1, marginTop: 40 }}>{Math.round(84 * pct)}%</div>
          <div style={{ fontSize: 36, fontWeight: 650, color: L.ink, marginTop: 12 }}>of its tokens were reasoning</div>
          <div style={{ height: 40, borderRadius: 10, background: '#e9f3ec', marginTop: 44, overflow: 'hidden' }}><div style={{ height: '100%', width: `${84 * pct}%`, background: GREEN }} /></div>
          <div style={{ fontSize: 28, color: L.ink2, marginTop: 40, lineHeight: 1.35, opacity: ramp(f, 100, 14, EASE.out) }}>Thinking switched off? It still reasoned, in a hidden channel. Every call now gives it room to.</div>
        </Panel>
        <Panel x={990} at={120}>
          <div style={{ fontSize: 26, color: L.ink2 }}>Llama Guard 3, on the live site</div>
          <div style={{ marginTop: 34, border: '2px solid #dcdce0', borderRadius: 16, padding: '22px 26px' }}>
            <div style={{ fontSize: 22, color: L.ink2 }}>New club</div>
            <div style={{ fontSize: 40, fontWeight: 650, color: L.ink, marginTop: 6 }}>Serve test round 27</div>
          </div>
          <div style={{ marginTop: 26, borderRadius: 16, padding: '20px 26px', background: '#fbeae8', color: RED, fontSize: 32, fontWeight: 700, opacity: Math.min(1, refuse * 2), transform: `scale(${(0.8 + 0.2 * refuse).toFixed(4)})`, transformOrigin: '0 50%' }}>
            ✕ Refused: read as violence (S9, then S1)
          </div>
          <div style={{ fontSize: 26, color: L.ink2, marginTop: 26, lineHeight: 1.35, opacity: ramp(f, 236, 14, EASE.out) }}>Now S9 needs a weapon word, and S1 alone goes to the club's own standard.</div>
          <div style={{ marginTop: 26, borderRadius: 16, padding: '20px 26px', background: '#e9f3ec', color: GREEN, fontSize: 32, fontWeight: 700, opacity: fixed, transform: `translateY(${mix(16, 0, fixed).toFixed(2)}px)` }}>
            ✓ Club created · feed red team still 13 of 13
          </div>
        </Panel>
      </Stage>
    </AbsoluteFill>
  );
};
