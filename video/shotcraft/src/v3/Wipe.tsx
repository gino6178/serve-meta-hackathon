// From the tangle to the court: the before-and-after scene with a green line sweeping left to right. Ahead of the line
// the court is still grey and soft; behind it, it comes to life. A slow push keeps it moving while the line travels.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, mix, ramp } from '../demos/_fixtures/Polish';

export const WIPE_DURATION = 120;
const GREEN = '#0a7f44';

export const Wipe: React.FC = () => {
  const f = useCurrentFrame();
  const x = mix(-40, 1960, ramp(f, 14, 70, EASE.smooth)), push = 1 + 0.06 * ramp(f, 0, WIPE_DURATION, EASE.linear);
  const img = (filter?: string) => (
    <Img src={staticFile('shots/v3/pain_before_after.png')} style={{ position: 'absolute', left: 0, top: -100, width: 1920, height: 1280, filter, transform: `scale(${push.toFixed(4)})`, transformOrigin: '50% 50%' }} />
  );
  return (
    <AbsoluteFill style={{ background: '#ffffff', overflow: 'hidden' }}>
      {img()}
      <div style={{ position: 'absolute', left: Math.max(0, x), top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -Math.max(0, x), top: 0, width: 1920, height: 1080 }}>{img('grayscale(1) blur(3px) brightness(1.06)')}</div>
      </div>
      <svg style={{ position: 'absolute', left: x - 6, top: 0 }} width={12} height={1080}>
        <line x1={6} y1={0} x2={6} y2={1080} stroke={GREEN} strokeWidth={7} strokeDasharray="22 14" strokeDashoffset={-f * 3} />
      </svg>
    </AbsoluteFill>
  );
};
