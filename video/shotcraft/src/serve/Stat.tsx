// The number, from video-shotcraft's blur-slide (same grammar: every word rises out of a blur on one shared progress,
// y, blur and opacity together; the eyebrow first, the headline word by word, the line under it overlapping the
// headline's tail, then a slow push-in hold). Serve's sans type and green instead of the paper serif.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { LOOKS, Stage, alpha } from '../demos/_fixtures/Look';
import { EASE, FONT, ramp } from '../demos/_fixtures/Polish';

export const STAT_DURATION = 150;
const L = LOOKS.serve;
const LEFT = 168;
type Word = { text: string; start: number; dur: number; style?: React.CSSProperties };

const Words: React.FC<{ words: Word[]; dy: number; blur: number; gap: string; style: React.CSSProperties }> = ({ words, dy, blur, gap, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap, whiteSpace: 'nowrap', ...style }}>
      {words.map((w, i) => {
        const p = ramp(frame, w.start, w.dur, EASE.out);
        return <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`, filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)`, ...w.style }}>{w.text}</span>;
      })}
    </div>
  );
};
const H1: Word[] = [
  { text: '40%', start: 10, dur: 24 },
  { text: '→', start: 16, dur: 24, style: { color: L.ink3 } },
  { text: '26%', start: 24, dur: 30, style: { color: L.accent } },
];
const H2: Word[] = 'of US adults play a sport at 18 to 21, then at 26 to 49'.split(' ').map((text, i) => ({ text, start: 36 + i * 2.4, dur: 20 }));
const H3: Word[] = 'What stops adults (Active NZ): other commitments, out of the habit, no one to play with.'.split(' ').map((text, i) => ({ text, start: 70 + i * 2.2, dur: 20 }));

export const Stat: React.FC = () => {
  const frame = useCurrentFrame();
  const push = 1 + 0.03 * ramp(frame, 0, STAT_DURATION - 1, EASE.smooth);
  const rule = ramp(frame, 0, 24, EASE.snappy);
  const kick = ramp(frame, 4, 18, EASE.out);
  const foot = ramp(frame, 96, 26, EASE.snappy);
  return (
    <Stage look={L} keyLight={{ x: 0.3, y: 0.18 }} fill={null} breathe={0.6} grain={0.04} vignette={0.08}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 40% 50% at 96% 100%, ${alpha(L.accent, 0.07)}, ${alpha(L.accent, 0)} 70%)` }} />
      <div style={{ position: 'absolute', left: LEFT, top: 140, width: 1920 - LEFT * 2, height: 1.5, background: alpha(L.ink, 0.18), transform: `scaleX(${rule.toFixed(4)})`, transformOrigin: '0 50%' }} />
      <div style={{ position: 'absolute', left: LEFT, top: 972, width: 1920 - LEFT * 2, height: 1.5, background: alpha(L.ink, 0.14), transform: `scaleX(${foot.toFixed(4)})`, transformOrigin: '100% 50%' }} />
      <div style={{ position: 'absolute', right: LEFT, top: 994, fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, letterSpacing: '0.1em', color: L.ink3, opacity: foot }}>
        US: NPR, RWJF AND HARVARD CHAN POLL, 2015 &middot; NZ: ACTIVE NZ SURVEY, 2023
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: `${LEFT}px 560px` }}>
        <div style={{
          position: 'absolute', left: LEFT, top: 268, display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT.sans, fontSize: 30, fontWeight: 700,
          letterSpacing: '0.16em', color: L.accent, opacity: kick, transform: `translateY(${((1 - kick) * 18).toFixed(2)}px)`, filter: kick >= 0.999 ? undefined : `blur(${((1 - kick) * 6).toFixed(2)}px)`,
        }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: L.accent, display: 'inline-block' }} />
          WHY PEOPLE STOP PLAYING
        </div>
        <Words words={H1} dy={64} blur={18} gap="0.28em" style={{ position: 'absolute', left: LEFT - 6, top: 330, fontFamily: FONT.sans, fontSize: 210, fontWeight: 760, lineHeight: 1, letterSpacing: '-0.045em', color: L.ink }} />
        <Words words={H2} dy={26} blur={9} gap="0.26em" style={{ position: 'absolute', left: LEFT, top: 600, fontFamily: FONT.sans, fontSize: 56, fontWeight: 600, letterSpacing: '-0.02em', color: L.ink, lineHeight: 1.2 }} />
        <Words words={H3} dy={22} blur={8} gap="0.26em" style={{ position: 'absolute', left: LEFT, top: 700, fontFamily: FONT.sans, fontSize: 40, fontWeight: 450, letterSpacing: '-0.012em', color: L.ink2, lineHeight: 1.2 }} />
      </div>
    </Stage>
  );
};
