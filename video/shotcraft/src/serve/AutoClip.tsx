// The auto-cut clip: what Serve makes from a player's own video, a clip to share with the club (DETR finds the
// players, Sapiens2 the moment, SAM 2.1 cuts the player out, MapAnything turns the camera). Presented as social
// sharing, with the line the deck uses: not a coach, not a sports analyzer. A slow push on the clip, the words beside.
import React from 'react';
import { OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { LOOKS, Stage } from '../demos/_fixtures/Look';
import { EASE, FONT, ramp, softShadow } from '../demos/_fixtures/Polish';

export const AUTO_CLIP_DURATION = 150;
const L = LOOKS.serve;

export const AutoClip: React.FC = () => {
  const f = useCurrentFrame();
  const inT = ramp(f, 0, 18, EASE.snappy), txt = ramp(f, 10, 20, EASE.out);
  return (
    <Stage look={L} keyLight={{ x: 0.4, y: 0.1 }} fill={null} grain={0.03} vignette={0.08}>
      <div style={{ position: 'absolute', left: 110, top: 200, width: 1056, height: 594, borderRadius: 28, overflow: 'hidden', boxShadow: softShadow(28, { color: '#0a1a10', strength: 1.1 }), opacity: inT, transform: `translateY(${((1 - inT) * 40).toFixed(2)}px) scale(${(1 + 0.03 * ramp(f, 0, AUTO_CLIP_DURATION, EASE.smooth)).toFixed(4)})` }}>
        <OffthreadVideo src={staticFile('clips/smash_loop.mp4')} muted playbackRate={0.8} style={{ width: 1056, height: 594, objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', left: 110, top: 812, fontFamily: FONT.sans, fontSize: 20, color: L.ink3, opacity: inT }}>CC BY 3.0 · Badminton klub Ljubljana · shown at 0.8×</div>
      <div style={{ position: 'absolute', left: 1240, top: 240, width: 560, fontFamily: FONT.sans, opacity: txt, transform: `translateY(${((1 - txt) * 20).toFixed(2)}px)` }}>
        <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: L.accent }}>BEYOND TEXT</div>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, lineHeight: 1.05, marginTop: 14 }}>Your video, auto-cut into a clip to share</div>
        <div style={{ fontSize: 30, fontWeight: 500, color: L.ink2, marginTop: 24, lineHeight: 1.3 }}>Time stops, the camera turns. Posted to your club only after your yes.</div>
        <div style={{ fontSize: 24, fontWeight: 650, color: L.ink3, marginTop: 30 }}>DETR · Sapiens2 · SAM 2.1 · MapAnything</div>
        <div style={{ fontSize: 24, fontWeight: 650, color: L.ink3, marginTop: 8 }}>Not a coach, not a sports analyzer.</div>
      </div>
    </Stage>
  );
};
