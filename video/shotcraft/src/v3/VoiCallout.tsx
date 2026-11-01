// The question worth most, laid over the Messenger footage: when talks stall the agent asks the one yes-or-no question
// whose answer most raises the chance of a game. The bars are README §2 (20,000 simulated requests each, 8 players, 6
// times; game found after one question then one talk). Timed to the messenger line: card at 2.4 s, bars at 8.1 s.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';

const GREEN = '#0a7f44', INK = '#0a0a0b', INK2 = '#5c5f66';
const BARS: [string, number][] = [['No question', 40.7], ['A random question', 44.4], ['The likeliest pair', 48.2], ['The question worth most', 51.9]];

export const VoiCallout: React.FC<{ dur: number; cardAt: number; barsAt: number }> = ({ dur, cardAt, barsAt }) => {
  const f = useCurrentFrame();
  const inT = ramp(f, cardAt, 16, EASE.snappy), out = ramp(f, dur - 12, 12, EASE.exit);
  return (
    <div style={{ position: 'absolute', right: 70, top: 190, width: 660, padding: '26px 30px', borderRadius: 26, background: 'rgba(255,255,255,0.97)', boxShadow: softShadow(30, { color: '#0a1a10', strength: 1.2 }),
      fontFamily: FONT.sans, color: INK, opacity: inT * (1 - out), transform: `translateY(${mix(30, 0, inT).toFixed(2)}px)` }}>
      <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: '0.12em', color: GREEN }}>YOUR AGENT ASKS FIRST</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.15 }}>The one question worth the most</div>
      <div style={{ fontSize: 21, color: INK2, marginTop: 8, lineHeight: 1.35 }}>Value of information: the yes-or-no question whose answer most raises the chance of a game</div>
      <div style={{ marginTop: 18 }}>
        {BARS.map(([k, v], i) => {
          const g = ramp(f, barsAt + i * 8, 26, EASE.out), win = i === BARS.length - 1;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, opacity: ramp(f, barsAt + i * 8 - 4, 6, EASE.out) }}>
              <div style={{ width: 230, fontSize: 21, fontWeight: win ? 750 : 550, color: win ? GREEN : INK }}>{k}</div>
              <div style={{ width: 290 * (v / 55) * g, height: 26, borderRadius: 7, background: win ? GREEN : '#c9ccd1' }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: win ? GREEN : INK, fontVariantNumeric: 'tabular-nums' }}>{(v * g).toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 17, color: INK2, marginTop: 14, opacity: ramp(f, barsAt + 40, 10, EASE.out) }}>Games found · 20,000 simulated requests each · 8 players, 6 times</div>
    </div>
  );
};
