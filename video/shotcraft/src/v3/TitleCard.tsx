// The cover, on white: what this is submitted to, then the mark draws itself, the name and the motto rise, and one line
// says what Serve is. Held long enough to read before the gap begins.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';
import { ShotcraftMark } from '../demos/_fixtures/Brand';

export const TITLE_DURATION = 96;
const L = LOOKS.serve, GREEN = L.accent;
const CHIPS = ['Meta Global AI Developer Hackathon 2026', 'Indie Developer', 'Build for Your World', 'Oct 27 – Nov 4'];

const Rise: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame(), t = ramp(f, at, 14, EASE.snappy);
  return <div style={{ opacity: t, transform: `translateY(${mix(22, 0, t).toFixed(2)}px)`, ...style }}>{children}</div>;
};

export const TitleCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.1 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 14, fontFamily: FONT.sans }}>
          {CHIPS.map((c, i) => (
            <Rise key={c} at={2 + i * 3}>
              <span style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 999, fontSize: 26, fontWeight: 650, color: i ? L.ink2 : GREEN, background: i ? '#f5f5f6' : '#e9f3ec' }}>{i ? c : `Submitted to ${c}`}</span>
            </Rise>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34 }}>
          <ShotcraftMark size={150} frameProgress={ramp(f, 10, 22, EASE.out)} cutProgress={ramp(f, 30, 10, EASE.overshoot)} />
          <Rise at={18}><div style={{ fontFamily: FONT.sans, fontSize: 190, fontWeight: 800, letterSpacing: '-0.05em', color: L.ink, lineHeight: 1 }}>serve</div></Rise>
        </div>
        <Rise at={34} style={{ position: 'absolute', left: 0, right: 0, top: 540, textAlign: 'center', fontFamily: FONT.sans, fontSize: 64, fontWeight: 800, letterSpacing: '-0.02em', color: GREEN }}>Play more. Manage less.</Rise>
        <Rise at={46} style={{ position: 'absolute', left: 0, right: 0, top: 650, textAlign: 'center', fontFamily: FONT.sans, fontSize: 40, fontWeight: 500, color: L.ink2 }}>
          The platform where personal AI agents negotiate real-world games.<br />You say yes once.
        </Rise>
      </Stage>
    </AbsoluteFill>
  );
};
