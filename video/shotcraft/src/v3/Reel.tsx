// The bonus after the game: the app's own highlight page as it was recorded (time stops, the camera turns, Sapiens2's
// skeleton beside it), a slow push towards the phone; then the clip itself with the words beside it.
import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../demos/_fixtures/Polish';
import { AutoClip } from '../serve/AutoClip';

const PAGE = 80; // the first 3.3 s of highlight_orbit_page.mp4
const CLIP = 132;
export const REEL_MIN = PAGE + CLIP;
const WORDS = { kicker: 'BONUS, AFTER THE GAME', title: 'A clip to share with your friends', sub: 'Time stops, the camera turns. Shared only after your yes.', models: 'Sapiens2 · SAM 2.1 · MapAnything, on my GPU', note: 'For sharing, never for coaching or scoring.' };

const Page: React.FC = () => {
  const f = useCurrentFrame(), s = 1 + 0.28 * ramp(f, 20, PAGE - 20, EASE.smooth);
  return (
    <AbsoluteFill style={{ background: '#ffffff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s.toFixed(4)})`, transformOrigin: '1460px 520px' }}>
        <OffthreadVideo src={staticFile('clips/v3/highlight_orbit_page.mp4')} muted style={{ width: 1920, height: 1080 }} />
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ dur: number }> = ({ dur }) => (
  <AbsoluteFill>
    <Sequence durationInFrames={PAGE}><Page /></Sequence>
    <Sequence from={PAGE} durationInFrames={CLIP}><AutoClip words={WORDS} /></Sequence>
    <Sequence from={PAGE + CLIP} durationInFrames={Math.max(1, dur - PAGE - CLIP)}><Freeze frame={CLIP - 1}><AutoClip words={WORDS} /></Freeze></Sequence>
  </AbsoluteFill>
);
