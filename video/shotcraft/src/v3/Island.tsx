// The gap, as a picture: the organiser's evening (the storyboard's chibi scene), with each friend's agent locked in its
// own bubble and the links between them cut. One camera move tells it: close on the organiser and her pile of
// questions, out to the four friends while their locks and the broken links land, then across to the empty court.
// Overlays sit in the illustration's own pixels, so they ride the camera.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { springAt } from '../demos/_fixtures/Look';

export const ISLAND_MIN = 330;
const IW = 1920, IH = 1280;
const RED = '#d1352b';
// the camera: a point of the illustration held at the frame's centre, and a scale, eased between keys
const KEYS = [
  { f: 0, x: 470, y: 820, s: 1.55 },
  { f: 70, x: 520, y: 760, s: 1.42 },
  { f: 150, x: 960, y: 560, s: 1.0 },
  { f: 250, x: 960, y: 560, s: 1.0 },
  { f: 320, x: 1450, y: 860, s: 1.3 },
];
const cam = (f: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && f > KEYS[i + 1].f) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = EASE.smooth(Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f))));
  const s = mix(a.s, b.s, t), x = mix(a.x, b.x, t), y = mix(a.y, b.y, t);
  const tx = Math.min(0, Math.max(1920 - IW * s, 960 - x * s)), ty = Math.min(0, Math.max(1080 - IH * s, 540 - y * s));
  return { s, tx, ty };
};
// each friend's agent: a lock at the bubble's lower right; the links between neighbours, cut
const LOCKS = [[336, 322], [809, 322], [1276, 322], [1715, 322]];
const LINKS = [[439, 576], [933, 1043], [1413, 1509]];
const LOCK_AT = 150, CUT_AT = 196, CARD_AT = 236;

const Lock: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame(), k = springAt(f, at, { damping: 11, stiffness: 190 }), o = ramp(f, at, 6, EASE.out);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 86, height: 86, borderRadius: 43, background: '#ffffff', border: `4px solid ${RED}`, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: softShadow(10), opacity: o, transform: `scale(${(0.4 + 0.6 * k).toFixed(4)})` }}>
      <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth={2.4} strokeLinecap="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
    </div>
  );
};
const Cut: React.FC<{ x0: number; x1: number; at: number }> = ({ x0, x1, at }) => {
  const f = useCurrentFrame(), draw = ramp(f, at, 14, EASE.out), x = ramp(f, at + 12, 8, EASE.overshoot), mid = (x0 + x1) / 2;
  return (
    <>
      <svg style={{ position: 'absolute', left: x0, top: 213, overflow: 'visible' }} width={x1 - x0} height={40}>
        <line x1={0} y1={20} x2={(x1 - x0) * draw} y2={20} stroke={RED} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left: mid - 32, top: 201, width: 64, height: 64, borderRadius: 32, background: '#ffffff', color: RED, fontFamily: FONT.sans,
        fontSize: 46, fontWeight: 800, lineHeight: '62px', textAlign: 'center', opacity: Math.min(1, x * 1.5), transform: `scale(${Math.max(0, x).toFixed(4)})` }}>✕</div>
    </>
  );
};

export const Island: React.FC = () => {
  const f = useCurrentFrame(), c = cam(f);
  const card = ramp(f, CARD_AT, 14, EASE.snappy), cardOut = ramp(f, 262, 14, EASE.exit);
  return (
    <AbsoluteFill style={{ background: '#fbf8f2', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: IW, height: IH, transformOrigin: '0 0', transform: `translate(${c.tx.toFixed(2)}px, ${c.ty.toFixed(2)}px) scale(${c.s.toFixed(4)})` }}>
        <Img src={staticFile('shots/v3/pain_scene.png')} style={{ width: IW, height: IH, display: 'block' }} />
        {LOCKS.map(([x, y], i) => <Lock key={i} x={x} y={y} at={LOCK_AT + i * 9} />)}
        {LINKS.map(([a, b], i) => <Cut key={i} x0={a} x1={b} at={CUT_AT + i * 8} />)}
      </div>
      <div style={{ position: 'absolute', right: 90, top: 470, padding: '18px 30px', borderRadius: 18, background: '#14241b', color: '#ffffff', fontFamily: FONT.sans,
        fontSize: 38, fontWeight: 650, letterSpacing: '-0.01em', boxShadow: softShadow(20), opacity: card * (1 - cardOut), transform: `translateY(${mix(24, 0, card).toFixed(2)}px)` }}>
        4 friends · 4 agents · <span style={{ color: '#ff8a80' }}>no place to talk</span>
      </div>
      <div style={{ position: 'absolute', left: 40, top: 30, fontFamily: FONT.sans, fontSize: 20, color: 'rgba(10,10,11,0.45)' }}>illustration: Muse Image</div>
    </AbsoluteFill>
  );
};
