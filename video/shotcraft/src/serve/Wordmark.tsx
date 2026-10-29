// "serve" drawn in, from video-shotcraft's letterspace-materialize (same rules: every letter's strokes start in the
// same frame and finish in the same frame, drawn continuously along pathLength; wide tracking; thin single-line
// glyphs from the demo's library; a hold of more than a second once the word stands). Serve's look instead of the dusk
// lake: a white court at first light, its lines faint, the stroke in ink; then the line under it.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { bezier, ramp, EASE, FONT, Grain } from '../demos/_fixtures/Polish';
import { LOOKS, TextReveal } from '../demos/_fixtures/Look';

const L = LOOKS.serve;
const GLYPHS: Record<string, { w: number; d: string }> = {
  v: { w: 42, d: 'M 4 22 L 21 59 L 38 22' },
  e: { w: 46, d: 'M 4.5 40.5 L 41.5 40.5 A 18.5 18.5 0 1 0 37.2 52.4' },
  s: { w: 39, d: 'M 32.6 27.5 C 26.4 21.3, 7.9 20.6, 6.2 28.9 C 4.6 36.4, 14.1 38.4, 19.7 39.8 C 25.8 41.2, 34.8 43.9, 33.1 51.5 C 31.4 59, 9.6 60.4, 4 52.8' },
  r: { w: 28, d: 'M 5 22 L 5 59 M 5 38 C 5 27, 13 22, 24 23' },
};
const WORD = 'serve';
const SCALE = 2.4;
const GLYPH_H = 64 * SCALE;
const TRACK = 58;
const START = 6;
const DUR = 44;
export const WORDMARK_DURATION = 96;
const strokeEase = bezier(0.5, 0, 0.3, 1);

const Word: React.FC<{ e: number }> = ({ e }) => (
  <div style={{ display: 'flex', gap: TRACK, alignItems: 'center' }}>
    {WORD.split('').map((ch, i) => {
      const g = GLYPHS[ch];
      return (
        <svg key={i} width={g.w * SCALE} height={GLYPH_H} viewBox={`0 0 ${g.w} 64`} style={{ overflow: 'visible', display: 'block' }}>
          {e > 0 && <path d={g.d} fill="none" stroke={L.ink} strokeWidth={6 / SCALE} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - e} />}
        </svg>
      );
    })}
  </div>
);

// a badminton court seen from the baseline, in perspective: only its lines, very faint
const Court: React.FC<{ s: number }> = ({ s }) => {
  const W = 1920, top = 620, bot = 1180, tl = 760, tr = 1160, bl = -40, br = 1960;
  const x = (a: number, b: number, t: number) => a + (b - a) * t;
  return (
    <svg width={W} height={1080} style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '50% 62%' }}>
      <g stroke="rgba(10,127,68,0.16)" strokeWidth={4} fill="none">
        <path d={`M ${tl} ${top} L ${tr} ${top} L ${br} ${bot} L ${bl} ${bot} Z`} />
        {[0.08, 0.92].map((t, i) => <path key={i} d={`M ${x(tl, tr, t)} ${top} L ${x(bl, br, t)} ${bot}`} />)}
        <path d={`M ${x(tl, tr, 0.5)} ${top} L ${x(bl, br, 0.5)} ${bot}`} />
        {[0.18, 0.42].map((t, i) => { const y = x(top, bot, t), a = x(tl, bl, t), b = x(tr, br, t); return <path key={i} d={`M ${a} ${y} L ${b} ${y}`} />; })}
      </g>
      <path d={`M ${x(tl, bl, 0.3)} ${x(top, bot, 0.3) - 70} L ${x(tr, br, 0.3)} ${x(top, bot, 0.3) - 70}`} stroke="rgba(10,10,11,0.10)" strokeWidth={3} />
    </svg>
  );
};

export const Wordmark: React.FC = () => {
  const f = useCurrentFrame();
  const e = ramp(f, START, DUR, strokeEase);
  const push = ramp(f, 0, WORDMARK_DURATION, EASE.smooth);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7faf8 55%, #edf4ef 100%)', overflow: 'hidden', fontFamily: FONT.sans }}>
      <Court s={1 + 0.03 * push} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380 - GLYPH_H / 2, height: GLYPH_H, display: 'flex', justifyContent: 'center' }}>
        <Word e={e} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontSize: 52, fontWeight: 650, letterSpacing: '-0.025em', color: L.ink2 }}>
        <TextReveal text="Play more. Manage less." by="word" variant="blur" start={START + DUR + 2} each={14} />
      </div>
      <Grain opacity={0.03} blend="soft-light" />
    </AbsoluteFill>
  );
};
