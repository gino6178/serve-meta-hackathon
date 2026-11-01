// Our second model: a Llama 3.2 1B distilled for short text, against 446 attacks whose templates never appeared in
// training (README §5, submission/results/text1b.json). Two groups of bars, old 1B / our text 1B / Muse Glimmer, each
// landing as the text1b line names it.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';

export const TEXT1B_MIN = 300;
const L = LOOKS.serve, GREEN = L.accent, RED = '#d1352b';
const GROUPS: { h: string; of: number; at: number; rows: [string, number, string][] }[] = [
  { h: 'Hostile comments let through', of: 71, at: 116, rows: [['Old 1B', 65, RED], ['Our text 1B', 8, GREEN], ['Muse Glimmer', 0, '#8a8a92']] },
  { h: 'Poisoned reviews that turned a bad court "good"', of: 180, at: 209, rows: [['Old 1B', 98, RED], ['Our text 1B', 7, GREEN], ['Muse Glimmer', 5, '#8a8a92']] },
];

export const Text1B: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>OUR SECOND MODEL</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>A text 1B that holds against attacks it never saw</div>
          <div style={{ fontSize: 28, color: L.ink2, marginTop: 12, opacity: ramp(f, 24, 12, EASE.out) }}>Llama 3.2 1B + LoRA on 1,039 Muse Glimmer answers and 371 injected copies · tested on 446 unseen attacks</div>
        </div>
        {GROUPS.map((g, gi) => {
          const t = ramp(f, g.at - 10, 14, EASE.snappy);
          return (
            <div key={g.h} style={{ position: 'absolute', left: 110 + gi * 870, top: 330, width: 830, padding: '30px 36px', boxSizing: 'border-box', borderRadius: 26, background: '#ffffff', boxShadow: softShadow(18),
              fontFamily: FONT.sans, opacity: t, transform: `translateY(${mix(30, 0, t).toFixed(2)}px)` }}>
              <div style={{ fontSize: 30, fontWeight: 750, color: L.ink }}>{g.h}</div>
              <div style={{ fontSize: 22, color: L.ink2, marginTop: 4 }}>of {g.of}, lower is better</div>
              {g.rows.map(([who, v, c], i) => {
                const k = ramp(f, g.at + i * 10, 28, EASE.out);
                return (
                  <div key={who} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 24 }}>
                    <div style={{ width: 200, fontSize: 28, fontWeight: c === GREEN ? 800 : 600, color: c === GREEN ? GREEN : L.ink }}>{who}</div>
                    <div style={{ width: Math.max(4, 420 * (v / g.of) * k), height: 40, borderRadius: 9, background: c }} />
                    <div style={{ fontSize: 40, fontWeight: 800, color: c === GREEN ? GREEN : L.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v * k)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </Stage>
    </AbsoluteFill>
  );
};
