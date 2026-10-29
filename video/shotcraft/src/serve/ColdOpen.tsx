// The cold open: a group chat trying to set up one game, from video-shotcraft's list-stack-press (same motion: each
// message flies up from 600 px with an alternating 2° tilt and a 1.06 → 1 settle, the settled stack is pressed down
// 6 px and springs back as the next one lands, a counter rolls one step per landing). The chat is drawn here (not a
// copy of any app's screen); the counter shows messages piling up and games booked staying at zero. Then the line.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FONT, SpeedBlur, softShadow, velocity } from '../demos/_fixtures/Polish';
import { LOOKS, TextReveal, alpha } from '../demos/_fixtures/Look';

const L = LOOKS.serve;
const MSGS = [
  { who: 'Leo', text: "Who's free this week?", me: false },
  { who: 'Kenji', text: 'Thu? No, work till 8', me: false },
  { who: 'Sam', text: 'Is the court even free?', me: false },
  { who: 'You', text: 'Sat 9 works for me', me: true },
  { who: 'Hana', text: 'Can we do 10 instead?', me: false },
  { who: 'Leo', text: "We're one short.", me: false },
];
const CUES = [8, 22, 36, 50, 64, 78];
const DUR = 22;
const FLY_EASE = Easing.bezier(0.45, 0.05, 0.25, 1.12);
const TILTS = [2, -2, 2, -2, 2, -2];
const ROW = 122;
const COL_X = 560; // the chat column
const TOP = 190;
export const COLD_OPEN_DURATION = 190;

const flyT = (i: number, f: number) => interpolate(f, [CUES[i], CUES[i] + DUR], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: FLY_EASE });
const flyY = (i: number, f: number) => 600 * (1 - flyT(i, f));
const ROLL_EASE = Easing.bezier(0.25, 0.8, 0.25, 1);
const rollAt = (f: number) => CUES.reduce((p, c) => p + interpolate(f, [c + DUR, c + DUR + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ROLL_EASE }), 0);
const DIGITS = '0123456789';
const Roll: React.FC<{ pos: number; color: string; blur: number }> = ({ pos, color, blur }) => (
  <span style={{ display: 'inline-flex', overflow: 'hidden', height: 116, verticalAlign: 'bottom' }}>
    <span style={{ display: 'block', transform: `translateY(${-pos * 116}px)`, filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      {DIGITS.split('').map((d) => <span key={d} style={{ display: 'block', fontFamily: FONT.sans, fontWeight: 600, fontSize: 104, letterSpacing: '-0.04em', lineHeight: '116px', color, fontVariantNumeric: 'tabular-nums' }}>{d}</span>)}
    </span>
  </span>
);

export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const rollPos = rollAt(f), rollV = Math.abs(velocity(rollAt, f));
  const press = (i: number) => {
    let p = 0;
    for (let j = i + 1; j < CUES.length; j++) p = Math.max(p, interpolate(f, [CUES[j], CUES[j] + 4, CUES[j] + 8], [0, 6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) }));
    return p;
  };
  const ant = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  // the line: after the last message has settled and the counter has stopped
  const LINE = 116;
  const dim = interpolate(f, [LINE - 6, LINE + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f7f6 100%)', fontFamily: FONT.sans }}>
      {/* the chat's header */}
      <div style={{ position: 'absolute', left: COL_X, top: 74, opacity: dim, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: '#e8eee9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: L.accent }}>SB</div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, color: L.ink, letterSpacing: '-0.02em' }}>Saturday badminton</div>
          <div style={{ fontSize: 22, color: L.ink3 }}>Leo, Kenji, Sam, Hana, you</div>
        </div>
      </div>
      <div style={{ opacity: dim }}>
        {MSGS.map((m, i) => {
          const t = flyT(i, f);
          if (t <= 0) return null;
          const settled = t >= 0.999;
          const dy = flyY(i, f) + (settled ? press(i) : 0);
          const elev = settled ? 3 - press(i) * 0.3 : 3 + 50 * (1 - t);
          const vy = settled ? 0 : velocity((x) => flyY(i, x), f);
          const bubble = (
            <div style={{
              position: 'absolute', top: TOP + i * ROW, ...(m.me ? { right: 1920 - COL_X - 800 } : { left: COL_X }),
              transform: `translateY(${dy.toFixed(3)}px) rotate(${(TILTS[i] * (1 - t)).toFixed(4)}deg) scale(${(1.06 - 0.06 * t).toFixed(5)})`,
              transformOrigin: m.me ? 'right center' : 'left center',
            }}>
              {!m.me && <div style={{ fontSize: 24, color: L.ink3, margin: '0 0 6px 18px' }}>{m.who}</div>}
              <div style={{
                padding: '18px 28px', borderRadius: 26, fontSize: 34, letterSpacing: '-0.015em', whiteSpace: 'nowrap',
                background: m.me ? L.accent : '#ffffff', color: m.me ? '#fff' : L.ink,
                boxShadow: `0 0 0 1px ${m.me ? 'transparent' : 'rgba(0,0,0,0.07)'}, ${softShadow(elev, { color: '#0a1a10', strength: 1.0 })}`,
              }}>{m.text}</div>
            </div>
          );
          return Math.abs(vy) > 1 ? <SpeedBlur key={i} vx={0} vy={vy} amount={0.22} max={14}>{bubble}</SpeedBlur> : <React.Fragment key={i}>{bubble}</React.Fragment>;
        })}
      </div>

      {/* the counter: messages pile up, games booked stays at 0 */}
      <div style={{ position: 'absolute', top: 120, right: 150, textAlign: 'right', opacity: (0.3 + 0.7 * ant) * dim, transform: `scale(${0.96 + 0.04 * ant})`, transformOrigin: 'top right' }}>
        <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '0.18em', color: L.ink3, textTransform: 'uppercase' }}>Messages</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Roll pos={rollPos} color={L.ink} blur={Math.min(6, rollV * 30)} /></div>
        <div style={{ height: 1, background: L.line, margin: '10px 0 12px auto', width: 240 }} />
        <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '0.18em', color: '#d1352b', textTransform: 'uppercase' }}>Games booked: 0</div>
      </div>

      {/* the line */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 410, textAlign: 'center', color: L.ink }}>
        <div style={{ fontSize: 84, fontWeight: 760, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
          <TextReveal text="People don't quit the game." by="word" variant="blur" start={LINE} each={16} />
        </div>
        <div style={{ fontSize: 84, fontWeight: 760, letterSpacing: '-0.035em', lineHeight: 1.1, color: L.accent }}>
          <TextReveal text="They quit organizing it." by="word" variant="blur" start={LINE + 22} each={16} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${alpha('#ffffff', 0)} 60%, ${alpha('#0a1a10', 0.05)} 100%)` }} />
    </AbsoluteFill>
  );
};
