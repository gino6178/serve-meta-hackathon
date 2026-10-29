// Safety, measured: from video-shotcraft's slam-entrance-moves (score-slam: the card hangs in front of the lens at
// 2.75x, blurred, then a six-frame ease-in slam to 0.965, and on the impact frame the ring, the shards, the sparks, a
// vertical-biased shake and a two-frame flash; the numbers land again 3 and 6 frames later). On Serve's light stage:
// no floodlights, the agent green for the ring; the card is the red-team result, the line under it the Rule of Two,
// and the unsafe messages that got through are said too.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, bezier, mix, ramp } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, springAt } from '../demos/_fixtures/Look';
import { BRAND, ShotcraftMark } from '../demos/_fixtures/Brand';

export const SAFETY_DURATION = 165;

const L = LOOKS.serve;
const GOLD = L.accent; // the ring and the underline: Serve green
const IMPACT = 15; // 落点帧
const SLAM0 = 9; // 砸落起点
const CW = 1180;
const CH = 400;
const CX = 960;
const CY = 480; // 卡片中心
const EASE_IN_QUAD = bezier(0.55, 0.085, 0.68, 0.53);

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// 碎片：多边形玻璃 / 金箔片，抛物线（先飞出再下坠）+ 自旋 + 翻面
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const ang = (i / 14) * Math.PI * 2 + (rnd(i + 3) - 0.5) * 0.5;
  return {
    ang, dist: 280 + rnd(i + 11) * 300, size: 22 + rnd(i + 23) * 26, spin: (rnd(i + 31) - 0.5) * 620,
    gold: i % 3 === 0, poly: [0, 1, 2, 3].map((k) => `${(50 + Math.cos(k * 1.7 + i) * (30 + rnd(i * 4 + k) * 20)).toFixed(0)}% ${(50 + Math.sin(k * 1.7 + i) * (30 + rnd(i * 5 + k) * 20)).toFixed(0)}%`).join(', '),
  };
});
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  ang: (i / 16) * Math.PI * 2 + (rnd(i + 61) - 0.5) * 0.4, dist: 360 + rnd(i + 71) * 320, len: 40 + rnd(i + 81) * 50,
}));

const Crest: React.FC<{ code: React.ReactNode; filled: boolean }> = ({ code, filled }) => (
  <div style={{
    width: 108, height: 108, borderRadius: 54, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: filled ? '#e7f3ec' : '#fbecea',
    border: 'none',
    font: `850 30px ${FONT.sans}`, letterSpacing: '0.02em', color: filled ? '#141416' : L.ink,
  }}>
    {code}
  </div>
);

export const Safety: React.FC = () => {
  const frame = useCurrentFrame();

  // —— 卡片：0–9 悬停蓄力（2.75→2.6、上提），9–15 加速砸落到 0.965，15 起弹簧回 1 ——
  const hover = ramp(frame, 0, SLAM0, EASE.smooth);
  const drop = ramp(frame, SLAM0, IMPACT - SLAM0, EASE_IN_QUAD);
  const preScale = mix(2.75, 2.6, hover);
  const settle = springAt(frame, IMPACT, { damping: 14, stiffness: 260 });
  const scale = frame < IMPACT ? mix(preScale, 0.965, drop) : mix(0.965, 1, settle);
  const rot = mix(5, 0, drop);
  const dy = frame < IMPACT ? mix(-40 - 30 * hover, 0, drop) : 0;
  const cardOp = ramp(frame, 0, 6, EASE.out) * mix(0.6, 1, drop); // 悬停期半透，背后泛光灯亮起看得见
  const height01 = Math.min(1, Math.max(0, (scale - 1) / 1.75));
  const dof = height01 * 10; // 离镜头越近越虚
  const cardShadow =
    `0 ${(2 + height01 * 14).toFixed(1)}px ${(6 + height01 * 24).toFixed(1)}px ${alpha(L.shadow, 0.18 - height01 * 0.08)}, ` +
    `0 ${(40 + height01 * 80).toFixed(1)}px ${(90 + height01 * 120).toFixed(1)}px -20px ${alpha(L.shadow, 0.32 - height01 * 0.1)}, ` +
    `inset 0 1px 0 #ffffff, 0 0 0 1px rgba(0,0,0,0.07)`;

  // —— 震屏：落点帧起 5f，18px 指数衰减，偏竖向（第一帧向下砸）——
  let shakeX = 0;
  let shakeY = 0;
  if (frame >= IMPACT && frame < IMPACT + 5) {
    const t = frame - IMPACT;
    const amp = 18 * Math.exp(-t * 0.85);
    shakeX = amp * 0.4 * (rnd(frame * 7 + 1) * 2 - 1);
    shakeY = amp * (t === 0 ? 1 : rnd(frame * 13 + 2) * 2 - 1);
  }
  const flash = frame >= IMPACT && frame < IMPACT + 3 ? [0.22, 0.12, 0.04][frame - IMPACT] : 0;

  // —— 冲击环：扩散 out-cubic，消散走线性帧时间（解耦，否则刚扩开就淡没）——
  const ringT = ramp(frame, IMPACT, 16, EASE.snappy);
  const ringLin = ramp(frame, IMPACT, 16, EASE.linear);
  const ringOn = frame >= IMPACT && frame < IMPACT + 16;
  const ringD = mix(120, 1500, ringT);
  const ringOp = ringLin < 0.6 ? mix(1, 0.65, ringLin / 0.6) : mix(0.65, 0, (ringLin - 0.6) / 0.4);
  const ringW = mix(9, 1.5, ringT);

  // —— 碎片 20f / 火花 10f ——
  const shT = ramp(frame, IMPACT, 20, EASE.out);
  const shLin = ramp(frame, IMPACT, 20, EASE.linear);
  const shOn = frame >= IMPACT && frame < IMPACT + 20;
  const spT = ramp(frame, IMPACT, 10, bezier(0.1, 0.9, 0.2, 1));
  const spLin = ramp(frame, IMPACT, 10, EASE.linear);
  const spOn = frame >= IMPACT && frame < IMPACT + 10;

  // —— 跟随：比分数字二次落地、FULL TIME 签、胜方金线 ——
  const digitPop = (start: number) => (frame < start ? 0 : springAt(frame, start, { damping: 13, stiffness: 300 }));
  const d1 = digitPop(IMPACT + 3);
  const d2 = digitPop(IMPACT + 6);
  const tag = ramp(frame, IMPACT + 9, 12, EASE.snappy);
  const underline = ramp(frame, IMPACT + 13, 14, EASE.snappy);

  const push = 1 + 0.02 * ramp(frame, IMPACT, 120, EASE.swift);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.0 }} fill={null} intensity={1.0} vignette={0.08} grain={0.03} />

      <div style={{ position: 'absolute', inset: -40, transform: `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(2)}px)` }}>
        <div style={{ position: 'absolute', inset: 40, transform: `scale(${push.toFixed(5)})` }}>
          {/* 冲击环：柔辉（金）+ 白芯细环 */}
          {ringOn && (
            <>
              <div style={{
                position: 'absolute', left: CX - ringD / 2, top: CY - ringD / 2, width: ringD, height: ringD, borderRadius: '50%', opacity: ringOp,
                boxShadow: `0 0 ${(30 + ringT * 40).toFixed(0)}px ${(6 + ringT * 8).toFixed(0)}px ${alpha(GOLD, 0.35)}, inset 0 0 ${(30 + ringT * 40).toFixed(0)}px ${alpha(GOLD, 0.22)}`,
              }} />
              <div style={{
                position: 'absolute', left: CX - ringD / 2, top: CY - ringD / 2, width: ringD, height: ringD, borderRadius: '50%', opacity: ringOp,
                border: `${ringW.toFixed(2)}px solid ${alpha(GOLD, 0.85)}`, boxSizing: 'border-box',
              }} />
            </>
          )}

          {/* 火花：沿径向拉长的细亮线 */}
          {spOn && SPARKS.map((s, i) => {
            const r = 160 + s.dist * spT;
            const len = s.len * (1 - spLin) + 6;
            return (
              <div key={i} style={{
                position: 'absolute', left: CX + Math.cos(s.ang) * r - len / 2, top: CY + Math.sin(s.ang) * r * 0.8 - 2, width: len, height: 4, borderRadius: 2,
                background: `linear-gradient(90deg, ${alpha(GOLD, 0)}, ${GOLD})`, transform: `rotate(${((s.ang * 180) / Math.PI).toFixed(1)}deg)`,
                opacity: 1 - spLin, boxShadow: `0 0 10px ${alpha(GOLD, 0.8)}`,
              }} />
            );
          })}

          {/* 比分卡 */}
          <div style={{
            position: 'absolute', left: CX - CW / 2, top: CY - CH / 2, width: CW, height: CH, borderRadius: 34,
            background: '#ffffff', boxShadow: cardShadow, opacity: cardOp,
            transform: `translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
            filter: dof > 0.4 ? `blur(${dof.toFixed(2)}px)` : undefined, fontFamily: FONT.sans, color: L.ink,
          }}>
            {/* 顶缘金色发丝光 */}
            <div style={{ position: 'absolute', left: 120, right: 120, top: 0, height: 2, background: `linear-gradient(90deg, ${alpha(GOLD, 0)}, ${alpha(GOLD, 0.8)}, ${alpha(GOLD, 0)})` }} />
            {/* FULL TIME 签：从卡顶滑出 */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: -26, display: 'flex', justifyContent: 'center', overflow: 'hidden', height: 60 }}>
              <div style={{
                height: 52, padding: '0 24px', borderRadius: 26, background: GOLD, display: 'flex', alignItems: 'center',
                font: `800 24px ${FONT.sans}`, letterSpacing: '0.12em', color: '#ffffff', transform: `translateY(${mix(64, 0, tag).toFixed(2)}px)`,
                boxShadow: `0 10px 30px -10px ${alpha(GOLD, 0.8)}`,
              }}>
                RED TEAM · MEASURED
              </div>
            </div>
            {/* 主队 */}
            <div style={{ position: 'absolute', left: 70, top: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 220 }}>
              <Crest code={<svg width={54} height={54} viewBox="0 0 24 24" fill="none" stroke="#d1352b" strokeWidth={2.2} strokeLinejoin="round"><path d="M12 2.5 L20 5.5 V11.5 C20 16.5 16.5 20 12 21.5 C7.5 20 4 16.5 4 11.5 V5.5 Z" /><path d="M9 9 L15 15 M15 9 L9 15" strokeLinecap="round" /></svg>} filled={false} />
              <div style={{ font: `700 38px ${FONT.sans}`, letterSpacing: '-0.03em', color: L.ink2 }}>Attacks</div>
            </div>
            {/* 客队 */}
            <div style={{ position: 'absolute', right: 70, top: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 220 }}>
              <Crest code={<ShotcraftMark size={60} tone="light" />} filled />
              <div style={{ font: `700 38px ${FONT.sans}`, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>Stopped</div>
            </div>
            {/* 比分 */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 58, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 56, font: `800 200px ${FONT.sans}`, letterSpacing: '-0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ position: 'relative', transform: `scale(${mix(1.16, 1, d1).toFixed(4)})` }}>
                93
                <div style={{ position: 'absolute', left: 6, right: 6, bottom: -6, height: 8, borderRadius: 4, background: GOLD, transformOrigin: '0 50%', transform: `scaleX(${underline.toFixed(4)})`, boxShadow: `0 0 18px ${alpha(GOLD, 0.6)}` }} />
              </div>
              <div style={{ font: `300 160px ${FONT.sans}`, color: L.ink3 }}>/</div>
              <div style={{ transform: `scale(${mix(1.16, 1, d2).toFixed(4)})`, color: GOLD }}>93</div>
            </div>
            {/* 赛事信息行 */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', font: `650 22px ${FONT.sans}`, letterSpacing: '0.12em', color: L.ink3 }}>
              INJECTED INSTRUCTIONS · POISONED REVIEWS · FORGED AGENT CARDS
            </div>
          </div>

          {/* 碎片（画在卡上方，像从撞击面崩出） */}
          {shOn && SHARDS.map((d, i) => {
            const dx = Math.cos(d.ang) * d.dist * shT;
            const dyy = Math.sin(d.ang) * d.dist * 0.75 * shT + 260 * shLin * shLin; // 先飞出再下坠
            const s = d.size * (1 - 0.55 * shLin);
            const flip = Math.abs(Math.cos(shLin * Math.PI * 1.6 + i));
            return (
              <div key={i} style={{
                position: 'absolute', left: CX + Math.cos(d.ang) * 300 + dx - s / 2, top: CY + Math.sin(d.ang) * 120 + dyy - s / 2, width: s, height: s,
                clipPath: `polygon(${d.poly})`,
                background: d.gold ? `linear-gradient(135deg, #0a5c32, ${GOLD} 45%, #9fe3bf 55%, #0a6b3a)` : `linear-gradient(135deg, #ffffff, ${alpha('#c9ccd4', 0.9)})`,
                opacity: shLin < 0.7 ? 1 : 1 - (shLin - 0.7) / 0.3,
                transform: `rotate(${(d.spin * shT).toFixed(1)}deg) scaleY(${Math.max(0.15, flip).toFixed(3)})`,
                filter: i % 4 === 0 ? 'blur(2px)' : undefined,
              }} />
            );
          })}

          {/* 标题 + 副句 */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: CY + CH / 2 + 92, textAlign: 'center', font: `800 76px ${FONT.sans}`, letterSpacing: '-0.04em', color: L.ink, lineHeight: 1 }}>
            <TextReveal text="No agent holds all" by="word" variant="rise" start={36} each={16} gap={4} />
            <span style={{ color: GOLD }}>
              <TextReveal text=" three at once." by="word" variant="rise" start={48} each={16} gap={4} />
            </span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: CY + CH / 2 + 200, textAlign: 'center', font: `500 32px ${FONT.sans}`, color: L.ink2, letterSpacing: '-0.01em', opacity: ramp(frame, 52, 14, EASE.out), transform: `translateY(${mix(12, 0, ramp(frame, 52, 16, EASE.out)).toFixed(2)}px)` }}>
            Untrusted input, private data, the power to act: Meta's Agents Rule of Two. Unsafe messages: 37 of 42 refused.<br />A prober pins down 32.4% of your week, not 97.6%: a disclosure budget.
          </div>
        </div>
      </div>

      {/* 落点白闪 */}
      {flash > 0 && <div style={{ position: 'absolute', inset: 0, background: '#ffffff', opacity: flash * 2 }} />}
    </AbsoluteFill>
  );
};
