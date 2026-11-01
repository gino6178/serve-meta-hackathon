// The venue's own agent (agent/src/venues/agent.js), right after the Messenger booking: on the left the talk as it ran
// over A2A against NTU Gymnasium's agent on the local copy (each of the venue's quotes signed by its own key), on the
// right who pays what: each player's own limit, two who ticked "I'll cover more", and the split from members/split.js
// for NT$290 (Ana 84, Leo 50, Sam 72, Mia 84: no one past their limit). Timed to the venue line.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';

export const VENUE_MIN = 240;
const L = LOOKS.serve, GREEN = L.accent, AMBER = '#9a5b00';
const TALK: { v: boolean; t: string }[] = [
  { v: false, t: '4 players, Thu 14:00–15:30. Usually 17% full. NT$230?' },
  { v: true, t: 'List is NT$420. At a quiet time I can do NT$320.' },
  { v: false, t: 'Meet us at NT$270?' },
  { v: true, t: 'NT$300.' },
  { v: false, t: 'NT$280?' },
  { v: true, t: "NT$290, and that's as low as I go." },
  { v: false, t: 'NT$290 it is.' },
];
const PAY: { n: string; cap: number; share: number; cover?: boolean }[] = [
  { n: 'Ana', cap: 100, share: 84, cover: true }, { n: 'Leo', cap: 50, share: 50 }, { n: 'Sam', cap: 90, share: 72 }, { n: 'Mia', cap: 90, share: 84, cover: true },
];

export const VenueDeal: React.FC = () => {
  const f = useCurrentFrame(), right = ramp(f, 60, 16, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 10, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>THE VENUE'S OWN AGENT</div>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>It haggles the court. Each player decides what they pay.</div>
        </div>
        <div style={{ position: 'absolute', left: 110, top: 240, width: 860, padding: '26px 30px', borderRadius: 26, background: '#ffffff', boxShadow: softShadow(18), fontFamily: FONT.sans }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, color: L.ink2 }}><span>Ana's agent</span><span>NTU Gymnasium's agent</span></div>
          {TALK.map((x, i) => {
            const t = ramp(f, 6 + i * 16, 8, EASE.out);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: x.v ? 'flex-end' : 'flex-start', marginTop: 12, opacity: t, transform: `translateY(${mix(10, 0, t).toFixed(2)}px)` }}>
                <span style={{ maxWidth: 620, padding: '10px 18px', borderRadius: 18, fontSize: 25, lineHeight: 1.3, background: x.v ? '#fff7e6' : '#e9f3ec', color: L.ink }}>
                  {x.t}{x.v && <span style={{ marginLeft: 10, fontSize: 18, fontWeight: 750, color: AMBER }}>✓ signed</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', left: 1010, top: 240, width: 800, padding: '26px 32px', borderRadius: 26, background: '#ffffff', boxShadow: softShadow(18), fontFamily: FONT.sans,
          opacity: right, transform: `translateY(${mix(30, 0, right).toFixed(2)}px)` }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: L.ink }}>NT$290, split by everyone's own limit</div>
          <div style={{ fontSize: 21, color: L.ink2, marginTop: 4 }}>Two ticked "I'll cover more", so Leo stays inside his NT$50</div>
          {PAY.map((p, i) => {
            const g = ramp(f, 90 + i * 10, 24, EASE.out);
            return (
              <div key={p.n} style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 25 }}>
                  <span style={{ fontWeight: 700, color: L.ink }}>{p.n}{p.cover && <span style={{ marginLeft: 10, fontSize: 18, fontWeight: 700, color: GREEN }}>covers more</span>}</span>
                  <span style={{ color: L.ink2 }}><b style={{ color: p.cover ? GREEN : L.ink, fontSize: 30 }}>NT${Math.round(p.share * g)}</b> of NT${p.cap} most</span>
                </div>
                <div style={{ position: 'relative', height: 14, borderRadius: 7, background: '#f0f1f2', marginTop: 8 }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(p.share / 100) * 100 * g}%`, borderRadius: 7, background: p.cover ? GREEN : '#8a8a92' }} />
                  <div style={{ position: 'absolute', left: `${p.cap}%`, top: -4, bottom: -4, width: 3, background: L.ink }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 19, color: L.ink2, marginTop: 20, opacity: ramp(f, 150, 12, EASE.out) }}>Nothing is paid in Serve: it works out the price and the shares.</div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
