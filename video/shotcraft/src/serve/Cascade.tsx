// The fine-tune and the cascade, from video-shotcraft's blur-slide grammar (each block rises out of a blur on one
// shared progress, left to right, the result last and largest, then a slow push-in hold). The numbers are the deck's:
// Glimmer's reasoning share and full-answer time, the student trained here, its agreement and the calls it saves.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { LOOKS, Stage, alpha } from '../demos/_fixtures/Look';
import { EASE, FONT, ramp } from '../demos/_fixtures/Polish';

export const CASCADE_DURATION = 225;
const L = LOOKS.serve;
const rise = (f: number, start: number, dy = 40, blur = 14) => {
  const p = ramp(f, start, 22, EASE.out);
  return { opacity: p, transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`, filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)` };
};
const Col: React.FC<{ f: number; at: number; x: number; kick: string; name: string; big: string; small: string; color: string; bg: string }> = ({ f, at, x, kick, name, big, small, color, bg }) => (
  <div style={{ position: 'absolute', left: x, top: 330, width: 470, height: 360, borderRadius: 30, background: bg, padding: '34px 36px', boxSizing: 'border-box', ...rise(f, at) }}>
    <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.12em', color }}>{kick}</div>
    <div style={{ fontSize: 40, fontWeight: 780, letterSpacing: '-0.03em', color: L.ink, marginTop: 12 }}>{name}</div>
    <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: '-0.05em', color, marginTop: 18, lineHeight: 1 }}>{big}</div>
    <div style={{ fontSize: 28, fontWeight: 500, color: L.ink2, marginTop: 16, lineHeight: 1.25 }}>{small}</div>
  </div>
);
const Arrow: React.FC<{ f: number; at: number; x: number }> = ({ f, at, x }) => {
  const p = ramp(f, at, 16, EASE.snappy);
  return (
    <svg width={110} height={60} style={{ position: 'absolute', left: x, top: 480 }}>
      <path d="M8 30 H96 M76 12 L98 30 L76 48" fill="none" stroke={L.ink3} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

export const Cascade: React.FC = () => {
  const f = useCurrentFrame();
  const push = 1 + 0.025 * ramp(f, 0, CASCADE_DURATION - 1, EASE.smooth);
  return (
    <Stage look={L} keyLight={{ x: 0.5, y: 0.1 }} fill={null} breathe={0.6} grain={0.03} vignette={0.08}>
      <div style={{ position: 'absolute', inset: 0, fontFamily: FONT.sans, transform: `scale(${push.toFixed(5)})`, transformOrigin: '50% 55%' }}>
        <div style={{ position: 'absolute', left: 150, top: 120, ...rise(f, 2, 18, 6) }}>
          <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: '0.16em', color: L.accent }}>TECHNICAL DEPTH · A MODEL I FINE-TUNED</div>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.04em', color: L.ink, marginTop: 14 }}>When the student is sure, Glimmer can rest.</div>
        </div>
        <Col f={f} at={20} x={150} kick="THE TEACHER" name="Muse Glimmer" big="40 s" small="a full answer; 84% of its tokens are reasoning" color={L.ink} bg="#f5f5f6" />
        <Arrow f={f} at={42} x={636} />
        <Col f={f} at={48} x={760} kick="FINE-TUNED HERE" name="Llama 3.2 1B" big="0.9 s" small="on the CPU; LoRA on 4,868 of Glimmer's choices" color={L.accent} bg="#e7f3ec" />
        <Arrow f={f} at={70} x={1246} />
        <Col f={f} at={76} x={1370} kick="THE CASCADE" name="Sure? It answers" big="89.5%" small="agreement with Glimmer (Glimmer with itself: 88.8%)" color={L.accent} bg="#e7f3ec" />
        <div style={{ position: 'absolute', left: 150, right: 150, top: 740, textAlign: 'center', fontSize: 40, fontWeight: 650, letterSpacing: '-0.02em', color: L.ink, ...rise(f, 104, 20, 8) }}>
          54–67% fewer Glimmer answers in simulated talks, no rule broken
        </div>
        <div style={{ position: 'absolute', left: 150, right: 150, top: 800, textAlign: 'center', fontSize: 26, fontWeight: 500, color: L.ink3, ...rise(f, 118, 12, 6) }}>
          Not sure, or the student is busy? Muse Glimmer answers. Code checks every rule either way.
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 50% 40% at 50% 100%, ${alpha(L.accent, 0.06)}, ${alpha(L.accent, 0)} 70%)` }} />
    </Stage>
  );
};
