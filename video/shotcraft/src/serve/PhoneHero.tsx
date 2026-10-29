// Serve's phone hero, from video-shotcraft's radial-ripple-phone-chips (same motion: rings breathing out of phase,
// the screen scrolling at an even speed, two chips popping in one after the other, the wordmark rising last). The
// screen is two real screenshots of Serve (agent chats, then the agreed games); the rings and chips use Serve's tokens.
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, ramp } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, springAt, type } from '../demos/_fixtures/Look';
import { BRAND, ShotcraftMark } from '../demos/_fixtures/Brand';

export const PHONE_HERO_DURATION = 186; // 5600ms @30fps

const L = LOOKS.serve;
const DUR = PHONE_HERO_DURATION;
// 模板强调色：落地时按项目品牌色只换这一个变量（屏内封面 / 进度 / chip 图标都跟它走）
const ACCENT = L.accent; // Serve's agent green
const SANS = FONT.sans;

// 同心圆（外深内浅，从大到小叠放），相邻层相位差 1.7 rad
const RINGS = [
  { size: 2240, color: '#dcebe1' },
  { size: 1760, color: '#e5f1e9' },
  { size: 1280, color: '#eef6f1' },
  { size: 840, color: '#f6faf7' },
].map((r, i) => ({ ...r, phase: i * 1.7 }));

// 手机几何（画布像素）
const PW = 430;
const PH = 900;
const FRAME = 12; // 金属边框
const BLACK = 9; // 屏幕黑边
const PX = (1920 - PW) / 2;
const PY = (1080 - PH) / 2;
const CHIP_GAP = 64; // chip 与手机外缘的间距

// the screen: Serve's agent chats over the games every agent agreed (388 px wide, 1562 px tall)
const Feed: React.FC = () => <Img src={staticFile('shots/phone_stack.png')} style={{ width: 388, display: 'block' }} />;

// chip 图标
const ChipIcon: React.FC<{ kind: 'agents' | 'check' }> = ({ kind }) => (
  <div style={{ width: 60, height: 60, borderRadius: 30, flex: 'none', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.3)}` }}>
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'check' ? (
        <path d="M5 12.5 L10 17.5 L19 7" />
      ) : (
        <>
          <circle cx={8} cy={9} r={3} />
          <circle cx={16} cy={9} r={3} />
          <path d="M3 19 C4 15.5 6 14 8 14 C10 14 11 15 12 16 C13 15 14 14 16 14 C18 14 20 15.5 21 19" />
        </>
      )}
    </svg>
  </div>
);

export const PhoneHero: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / (DUR - 1);

  // 手机入场：从下方 90px 升起，投影随落位收紧
  const rise = ramp(f, 0, 26, EASE.snappy);
  const phoneY = (1 - rise) * 90;
  const phoneOp = Math.min(1, rise * 2.2);

  // feed 匀速自动滚动（t 0.08→0.98）
  const scrollP = Math.min(1, Math.max(0, (t - 0.08) / 0.9));
  const scrollY = -(1562 - 830) * scrollP; // to the agreed games and Book both

  // chip：spring pop + 从手机侧边外移，落位后才渐入悬浮
  const chip = (t0: number, ph: number, side: -1 | 1): React.CSSProperties => {
    const s = springAt(f, t0, { damping: 13, stiffness: 190 });
    const slide = ramp(f, t0, 20, EASE.snappy);
    const floatIn = ramp(f, t0 + 18, 24, EASE.smooth);
    const fl = Math.sin(t * Math.PI * 2 * 2 + ph) * 8 * floatIn;
    return {
      opacity: Math.min(1, Math.max(0, (f - t0) / 5)),
      transform: `translateX(${(side * (1 - slide) * -28).toFixed(2)}px) translateY(${fl.toFixed(2)}px) scale(${(0.8 + 0.2 * s).toFixed(4)})`,
      transformOrigin: side < 0 ? 'right center' : 'left center',
    };
  };
  const chipBase: React.CSSProperties = {
    position: 'absolute', display: 'flex', alignItems: 'center', gap: 20, padding: '14px 34px 14px 14px', borderRadius: 999,
    background: 'linear-gradient(180deg, #ffffff 0%, #f7f8f7 100%)', color: L.ink, whiteSpace: 'nowrap',
    ...type(36, 650), letterSpacing: '-0.02em',
    boxShadow: `inset 0 1px 0 #ffffff, 0 0 0 1px ${alpha(L.shadow, 0.06)}, 0 3px 6px ${alpha(L.shadow, 0.08)}, 0 26px 50px -16px ${alpha(L.shadow, 0.32)}`,
  };

    const wordmark = 100;

  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.4, y: 0.0 }} fill={null} vignette={0.12} grain={0.03}>
        {/* 同心圆：各层错相极缓呼吸；受光上沿 + 白色发丝外缘，像涟漪的反光 */}
        {RINGS.map(({ size, color, phase }, i) => (
          <div key={i} style={{
            position: 'absolute', left: 960 - size / 2, top: 540 - size / 2, width: size, height: size, borderRadius: '50%',
            background: `linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 40%), ${color}`,
            boxShadow: `inset 0 2px 0 rgba(255,255,255,0.85), 0 0 0 1.5px rgba(255,255,255,0.55), 0 -4px 22px rgba(255,255,255,0.4), 0 10px 40px ${alpha(L.shadow, 0.06 + i * 0.015)}`,
            transform: `scale(${(1 + 0.06 * Math.sin(t * Math.PI * 2 * 1.5 + phase)).toFixed(5)})`,
          }} />
        ))}
        {/* 中心暖白柔光：把视觉重心收到手机 */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 26% 44% at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)' }} />
      </Stage>

      {/* 手机（含投影、侧键）整体上升 */}
      <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH, transform: `translateY(${phoneY.toFixed(2)}px)`, opacity: phoneOp }}>
        {/* 落地投影：贴近实影 + 远处大柔影（随落位收紧） */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 70,
          boxShadow: `0 4px 10px ${alpha(L.shadow, 0.2)}, 0 ${40 + (1 - rise) * 30}px ${80 + (1 - rise) * 40}px -20px ${alpha(L.shadow, 0.42)}, 0 90px 140px -40px ${alpha(L.shadow, 0.25)}`,
        }} />
        {/* 侧键 */}
        {[{ side: -1, y: 190, h: 64 }, { side: -1, y: 272, h: 64 }, { side: 1, y: 230, h: 104 }].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', top: b.y, width: 5, height: b.h, borderRadius: 3,
            left: b.side < 0 ? -3.5 : PW - 1.5, background: 'linear-gradient(90deg, #7d8186, #c4c8cd, #7d8186)',
          }} />
        ))}
        {/* 暖钛边框 */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 70, padding: FRAME,
          background: 'linear-gradient(145deg, #d6d9dd 0%, #8f9399 30%, #c3c7cc 55%, #6f7378 80%, #b2b6bb 100%)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35), inset 0 0 0 3px rgba(30,34,40,0.25)',
        }}>
          {/* 黑边 */}
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 58, background: '#0d0b09', padding: BLACK, boxSizing: 'border-box' }}>
            {/* 屏幕 */}
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 50, background: '#ffffff', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 44, width: '100%', transform: `translateY(${scrollY.toFixed(2)}px)` }}>
                <Feed />
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 66, background: 'linear-gradient(180deg, #ffffff 60%, rgba(255,255,255,0))' }} />
              {/* 灵动岛 */}
              <div style={{ position: 'absolute', left: '50%', top: 14, width: 118, height: 34, marginLeft: -59, borderRadius: 17, background: '#0b0a09' }} />
              {/* home 条 */}
              <div style={{ position: 'absolute', left: '50%', bottom: 10, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: alpha(L.ink, 0.75) }} />
              {/* 玻璃斜反光（静态） */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(118deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.14) 44%, rgba(255,255,255,0) 56%)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 两侧 chip：左先右后，从手机侧边弹出 */}
      <div style={{ ...chipBase, top: 330, right: 1920 - PX + CHIP_GAP, ...chip(37, 0, -1) }}>
        <ChipIcon kind="agents" />
        Agents agree your week
      </div>
      <div style={{ ...chipBase, top: 610, left: PX + PW + CHIP_GAP, ...chip(67, 1.8, 1) }}>
        <ChipIcon kind="check" />
        One yes, and it's booked
      </div>

    </div>
  );
};
