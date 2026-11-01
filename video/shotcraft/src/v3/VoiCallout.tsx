// The question worth most, as its own page right after the Messenger footage: when talks stall the agent asks the one
// yes-or-no question whose answer most raises the chance of a game. The bars are README §2 (20,000 simulated requests
// each, 8 players, 6 times; game found after one question then one talk). The messenger line runs on into this page.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';

export const VOI_DURATION = 150;
const L = LOOKS.serve, GREEN = L.accent;
const BARS: [string, number][] = [['No question', 40.7], ['A random question', 44.4], ['The likeliest pair', 48.2], ['The question worth most', 51.9]];

export const VoiPage: React.FC = () => {
  const f = useCurrentFrame(), card = ramp(f, 2, 14, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 10, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>YOUR AGENT ASKS FIRST</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>The one question worth the most</div>
          <div style={{ fontSize: 30, color: L.ink2, marginTop: 12 }}>Value of information: the yes-or-no question whose answer most raises the chance of a game</div>
        </div>
        <div style={{ position: 'absolute', left: 110, right: 110, top: 330, padding: '34px 44px', borderRadius: 26, background: '#ffffff', boxShadow: softShadow(18), fontFamily: FONT.sans,
          opacity: card, transform: `translateY(${mix(30, 0, card).toFixed(2)}px)` }}>
          <div style={{ fontSize: 26, color: L.ink2 }}>Games found · 20,000 simulated requests each · 8 players, 6 times</div>
          {BARS.map(([k, v], i) => {
            const g = ramp(f, 10 + i * 9, 30, EASE.out), win = i === BARS.length - 1;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 22 }}>
                <div style={{ width: 400, fontSize: 32, fontWeight: win ? 800 : 600, color: win ? GREEN : L.ink }}>{k}</div>
                <div style={{ width: 1000 * (v / 55) * g, height: 46, borderRadius: 10, background: win ? GREEN : '#c9ccd1' }} />
                <div style={{ fontSize: 44, fontWeight: 800, color: win ? GREEN : L.ink, fontVariantNumeric: 'tabular-nums' }}>{(v * g).toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
