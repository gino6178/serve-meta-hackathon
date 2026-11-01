// Why the layers: four agents negotiating cannot each wait forty seconds a step. So code keeps the hard rules, a 28 KB
// classifier settles most ordinary choices, our distilled Llama 3.2 1B answers when it is sure, and Muse Glimmer takes
// only what is left. Cards rise one by one as the narration reaches them, their numbers count in, and the agreement
// bars close it: the 1B against Glimmer, Glimmer against itself (500 held-out cases, submission/results/).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';

export const TIERS_MIN = 640;
const L = LOOKS.serve, GREEN = L.accent;
type Tier = { k: string; name: string; what: string; big: string; foot: string; at: number; hi?: boolean; ink?: string };
const TIERS: Tier[] = [
  { k: 'LAYER 0', name: 'Code', what: 'every hard rule: free times, clashes, trips', big: '7 ms', foot: "the game's card (median)", at: 150 },
  { k: 'TINY LAYER', name: '28 KB classifier', what: 'small networks on facts code holds', big: '0.06 ms', foot: 'settles 6 in 10 ordinary choices', at: 240 },
  { k: 'OUR MODEL', name: 'Llama 3.2 1B', what: 'distilled from 4,868 Muse Glimmer choices', big: '0.9 s', foot: 'on a CPU, when at least 0.6 sure', at: 344, hi: true },
  { k: 'ONLY WHAT IS LEFT', name: 'Muse Glimmer 30B', what: 'on the RTX 3090, stopped early when sure', big: '20–40 s', foot: 'streamed step by step', at: 413, ink: L.ink },
];

const Card: React.FC<{ t: Tier; x: number }> = ({ t, x }) => {
  const f = useCurrentFrame(), k = springAt(f, t.at, { damping: 14, stiffness: 170 }), o = ramp(f, t.at, 10, EASE.out);
  return (
    <div style={{ position: 'absolute', left: x, top: 250, width: 410, height: 360, borderRadius: 26, padding: '30px 30px', boxSizing: 'border-box', background: t.hi ? '#e9f3ec' : '#ffffff',
      border: t.hi ? `4px solid ${GREEN}` : '1px solid rgba(0,0,0,0.08)', boxShadow: softShadow(t.hi ? 26 : 14), fontFamily: FONT.sans, opacity: o, transform: `translateY(${mix(60, 0, k).toFixed(2)}px)` }}>
      <div style={{ fontSize: 20, fontWeight: 750, letterSpacing: '0.12em', color: L.ink2 }}>{t.k}</div>
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: L.ink, marginTop: 8 }}>{t.name}</div>
      <div style={{ fontSize: 24, color: L.ink2, marginTop: 10, height: 64, lineHeight: 1.3 }}>{t.what}</div>
      <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: '-0.04em', color: t.ink ?? GREEN, marginTop: 18, lineHeight: 1 }}>{t.big}</div>
      <div style={{ fontSize: 22, color: L.ink2, marginTop: 10 }}>{t.foot}</div>
    </div>
  );
};

const Bar: React.FC<{ who: string; v: number; color: string; at: number; y: number }> = ({ who, v, color, at, y }) => {
  const f = useCurrentFrame(), g = ramp(f, at, 40, EASE.out), W = 1140;
  return (
    <div style={{ position: 'absolute', left: 110, top: y, display: 'flex', alignItems: 'center', gap: 26, fontFamily: FONT.sans, opacity: ramp(f, at - 6, 8, EASE.out) }}>
      <div style={{ width: 330, fontSize: 32, fontWeight: 700, color: L.ink }}>{who}</div>
      <div style={{ width: W * (v / 100) * g, height: 46, borderRadius: 10, background: color }} />
      <div style={{ fontSize: 46, fontWeight: 800, color: color === GREEN ? GREEN : L.ink, fontVariantNumeric: 'tabular-nums' }}>{(v * g).toFixed(1)}%</div>
    </div>
  );
};

export const Tiers: React.FC = () => {
  const f = useCurrentFrame();
  // the problem first: four agents, forty seconds a step
  const pIn = ramp(f, 0, 14, EASE.snappy), pOut = ramp(f, 104, 14, EASE.exit);
  const head = ramp(f, 112, 14, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.sans, opacity: pIn * (1 - pOut) }}>
          <div style={{ display: 'flex', gap: 60 }}>
            {[0, 1, 2, 3].map((i) => {
              const p = Math.min(1, Math.max(0, (f - 10 - i * 4) / 120));
              return (
                <div key={i} style={{ width: 180, height: 180, position: 'relative' }}>
                  <svg width={180} height={180} viewBox="0 0 180 180"><circle cx={90} cy={90} r={78} fill="none" stroke="#e6e8e7" strokeWidth={14} /><circle cx={90} cy={90} r={78} fill="none" stroke="#d1352b" strokeWidth={14} strokeDasharray={490} strokeDashoffset={490 * (1 - p * 0.3)} transform="rotate(-90 90 90)" strokeLinecap="round" /></svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: L.ink }}>40 s</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 60 }}>Four agents, forty seconds a step: <span style={{ color: '#d1352b' }}>too slow</span></div>
        </div>
        <div style={{ position: 'absolute', left: 110, top: 110, fontFamily: FONT.sans, opacity: head }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>A TIERED DECISION ENGINE</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>Most decisions never reach the big model</div>
        </div>
        {TIERS.map((t, i) => <Card key={t.k} t={t} x={110 + i * 440} />)}
        <div style={{ position: 'absolute', left: 110, top: 668, fontFamily: FONT.sans, fontSize: 28, fontWeight: 650, color: L.ink2, opacity: ramp(f, 461, 12, EASE.out) }}>Agreement with Glimmer's full answer, 500 held-out cases</div>
        <Bar who="Our 1B" v={89.5} color={GREEN} at={473} y={724} />
        <Bar who="Glimmer, with itself" v={88.8} color="#8a8a92" at={493} y={800} />
      </Stage>
    </AbsoluteFill>
  );
};
