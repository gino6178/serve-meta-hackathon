// The gap, all drawn: four friends, each with a personal agent that knows their calendar and limits; the agents lock
// up and the links between them are cut (no place to talk); the friends slide aside and the group chat they are left
// with piles up. Timed to the island line: agents 0-5 s, no place to talk 5-7.5 s, the group chat after.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, springAt } from '../demos/_fixtures/Look';

export const ISLAND_MIN = 270;
const L = LOOKS.serve, GREEN = L.accent, RED = '#d1352b';
const PEOPLE = [{ n: 'Ana', c: '#f2c6a0' }, { n: 'Leo', c: '#b9d4f0' }, { n: 'Sam', c: '#c9e4c5' }, { n: 'Mia', c: '#ead0ec' }];
const PX = (i: number) => 360 + i * 400, PY = 640, AY = 360;
const AGENT_AT = 36, LOCK_AT = 140, CUT_AT = 155, CARD_AT = 175, CHAT_AT = 210;
const CHAT = ['Badminton this week?', 'Tue 8?', "can't, work", 'Wed?', 'Wed is fine', "I'm out Wed", 'Thu 7?', 'who books the court?', 'which court even', 'Leo?', 'Fri then??'];

const Person: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(), k = springAt(f, i * 6, { damping: 13, stiffness: 180 }), p = PEOPLE[i];
  return (
    <div style={{ position: 'absolute', left: PX(i) - 80, top: PY - 80, width: 160, textAlign: 'center', opacity: ramp(f, i * 6, 8, EASE.out), transform: `translateY(${mix(40, 0, k).toFixed(2)}px)` }}>
      <div style={{ width: 160, height: 160, borderRadius: 80, background: p.c, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: softShadow(12) }}>
        <svg width={86} height={86} viewBox="0 0 24 24" fill="none" stroke={L.ink} strokeWidth={1.6} strokeLinecap="round"><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></svg>
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: 34, fontWeight: 700, color: L.ink, marginTop: 14 }}>{p.n}</div>
    </div>
  );
};

const Agent: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(), at = AGENT_AT + i * 10, k = springAt(f, at, { damping: 11, stiffness: 200 }), o = ramp(f, at, 8, EASE.out);
  const lock = springAt(f, LOCK_AT + i * 5, { damping: 11, stiffness: 220 }), chips = ramp(f, at + 18, 12, EASE.out);
  const tether = ramp(f, at - 6, 14, EASE.out);
  return (
    <>
      <svg style={{ position: 'absolute', left: PX(i) - 2, top: AY + 66, overflow: 'visible' }} width={4} height={PY - AY - 146}>
        <line x1={2} y1={0} x2={2} y2={(PY - AY - 146) * tether} stroke={GREEN} strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" opacity={0.5} />
      </svg>
      <div style={{ position: 'absolute', left: PX(i) - 66, top: AY - 66, width: 132, height: 132, borderRadius: 66, background: '#e9f3ec', border: `4px solid ${GREEN}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${(0.3 + 0.7 * k).toFixed(4)})`, boxShadow: softShadow(14) }}>
        <svg width={62} height={62} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M10 16.5h4" /></svg>
      </div>
      <div style={{ position: 'absolute', left: PX(i) - 150, top: AY + 80, width: 300, display: 'flex', justifyContent: 'center', gap: 10, fontFamily: FONT.sans, fontSize: 22, fontWeight: 650, color: GREEN, opacity: chips }}>
        <span style={{ padding: '5px 12px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(10,127,68,0.3)' }}>calendar</span>
        <span style={{ padding: '5px 12px', borderRadius: 999, background: '#ffffff', border: '1px solid rgba(10,127,68,0.3)' }}>limits</span>
      </div>
      <div style={{ position: 'absolute', left: PX(i) + 34, top: AY - 4, width: 64, height: 64, borderRadius: 32, background: '#ffffff', border: `4px solid ${RED}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: softShadow(8), opacity: ramp(f, LOCK_AT + i * 5, 6, EASE.out), transform: `scale(${(0.4 + 0.6 * lock).toFixed(4)})` }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth={2.6} strokeLinecap="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
      </div>
    </>
  );
};

const Cut: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(), at = CUT_AT + i * 7, x0 = PX(i) + 80, x1 = PX(i + 1) - 80, draw = ramp(f, at, 12, EASE.out), x = ramp(f, at + 10, 8, EASE.overshoot), mid = (x0 + x1) / 2;
  return (
    <>
      <svg style={{ position: 'absolute', left: x0, top: AY - 20, overflow: 'visible' }} width={x1 - x0} height={40}>
        <line x1={0} y1={20} x2={(x1 - x0) * draw} y2={20} stroke={RED} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" opacity={draw > 0 ? 1 : 0} />
      </svg>
      <div style={{ position: 'absolute', left: mid - 30, top: AY - 30, width: 60, height: 60, borderRadius: 30, background: '#ffffff', color: RED, fontFamily: FONT.sans, boxShadow: softShadow(8),
        fontSize: 42, fontWeight: 800, lineHeight: '58px', textAlign: 'center', opacity: Math.min(1, x * 1.5), transform: `scale(${Math.max(0, x).toFixed(4)})` }}>✕</div>
    </>
  );
};

const Chat: React.FC = () => {
  const f = useCurrentFrame() - CHAT_AT, k = springAt(f, 0, { damping: 15, stiffness: 140 });
  const n = Math.max(0, Math.min(CHAT.length, Math.floor((f - 8) / 6) + 1)), H = 66, VIS = 8;
  return (
    <div style={{ position: 'absolute', left: 1240, top: 150, width: 520, height: 760, borderRadius: 54, background: '#ffffff', border: '10px solid #1b1c1f', boxSizing: 'border-box', overflow: 'hidden',
      boxShadow: softShadow(30), fontFamily: FONT.sans, opacity: ramp(f, 0, 8, EASE.out), transform: `translateX(${mix(520, 0, k).toFixed(2)}px)` }}>
      <div style={{ padding: '30px 30px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 30, fontWeight: 750, color: L.ink }}>Badminton group (4)</div>
        <div style={{ fontSize: 20, color: L.ink2, marginTop: 4 }}>Ana, Leo, Sam, Mia</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, bottom: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 16, transform: `translateY(${(-Math.max(0, n - VIS) * H).toFixed(2)}px)` }}>
          {CHAT.slice(0, n).map((t, j) => (
            <div key={j} style={{ height: H, display: 'flex', justifyContent: j % 2 ? 'flex-end' : 'flex-start', padding: '0 24px' }}>
              <span style={{ alignSelf: 'center', padding: '12px 20px', borderRadius: 22, fontSize: 26, background: j % 2 ? '#e9f3ec' : '#f2f2f3', color: L.ink }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Island: React.FC = () => {
  const f = useCurrentFrame();
  const side = ramp(f, CHAT_AT, 26, EASE.smooth), card = ramp(f, CARD_AT, 14, EASE.snappy), cardOut = ramp(f, CHAT_AT, 12, EASE.exit);
  const late = ramp(f, CHAT_AT + 40, 14, EASE.snappy);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 70, fontFamily: FONT.sans, opacity: ramp(f, 4, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>THE GAP</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '960px 540px', transform: `translate(${mix(0, -330, side).toFixed(2)}px, ${mix(0, 30, side).toFixed(2)}px) scale(${mix(1, 0.72, side).toFixed(4)})` }}>
          {PEOPLE.map((_, i) => <Agent key={`a${i}`} i={i} />)}
          {[0, 1, 2].map((i) => <Cut key={`c${i}`} i={i} />)}
          {PEOPLE.map((_, i) => <Person key={`p${i}`} i={i} />)}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', opacity: card * (1 - cardOut), transform: `translateY(${mix(20, 0, card).toFixed(2)}px)` }}>
          <div style={{ padding: '18px 34px', borderRadius: 18, background: '#ffffff', boxShadow: softShadow(18), fontFamily: FONT.sans, fontSize: 42, fontWeight: 700, color: L.ink }}>
            4 friends · 4 agents · <span style={{ color: RED }}>no place to talk</span>
          </div>
        </div>
        {f >= CHAT_AT && <Chat />}
        <div style={{ position: 'absolute', left: 110, top: 150, fontFamily: FONT.sans, fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em', color: L.ink, opacity: late, transform: `translateY(${mix(16, 0, late).toFixed(2)}px)` }}>
          So one game still means <span style={{ color: RED }}>hours of group chat</span>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
