// The live numbers, from video-shotcraft's card-flip-reveal (same motion: each card leans back 10 degrees, flips
// through 194 on an accelerating curve and springs back to 180, a narrow light crossing the edge as it turns, the
// number settling 1.08 to 1 and its label 4 frames later; a mirrored floor). Front: what was counted; back: the count,
// from the live site on 29 October. No before/after bars: there is nothing to compare these with yet.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, bezier, mix, ramp } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, springAt, type } from '../demos/_fixtures/Look';
import { BRAND } from '../demos/_fixtures/Brand';

export const LIVE_NUMBERS_DURATION = 180;

const L = LOOKS.graphite; // the fronts stay dark, so each flip turns a question into a white answer
const GOLD = '#3fbf7f'; // Serve green, lifted for the dark fronts
const GREEN = '#0a7f44';
const CW = 480;
const CH = 620;
const GAP = 48;
const X0 = (1920 - (CW * 3 + GAP * 2)) / 2; // 192
const Y = 330;
const FLIP0 = 22;
const STAGGER = 12;
const PRE = 4; // 预备帧
const FLIP = 16; // 翻转帧
const PEAK_DEG = 194;

const flipEase = bezier(0.55, 0, 0.3, 1);

// 卡 i 在帧 f 的翻转角：0 → −10（预备）→ 194（加速翻转）→ 180（弹簧落定）
const angleAt = (f: number, i: number) => {
  const s = FLIP0 + i * STAGGER;
  if (f < s + PRE) return -10 * ramp(f, s, PRE, EASE.out);
  if (f < s + PRE + FLIP) return mix(-10, PEAK_DEG, ramp(f, s + PRE, FLIP, flipEase));
  return PEAK_DEG - (PEAK_DEG - 180) * springAt(f, s + PRE + FLIP, { damping: 15, stiffness: 190 });
};

const FEATURES = [
  { name: 'Players', desc: 'People who joined the live site', value: '8', label: 'people, me included', icon: 'people' },
  { name: 'Clubs', desc: 'Clubs players started themselves', value: '2', label: 'clubs on the map', icon: 'map' },
  { name: 'Games', desc: 'Games posted, people who joined', value: '8', label: 'joins, 3 of 4 games filled', icon: 'ball' },
];

// ───────────── 正面 UI（暗色、大字） ─────────────
const FrontUI: React.FC<{ i: number; frame: number }> = ({ i }) => {
  const k = FEATURES[i].icon;
  return (
    <svg width={400} height={220} viewBox="0 0 400 220" fill="none" stroke={L.ink2} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
      {k === 'people' && <><circle cx={140} cy={80} r={34} /><circle cx={260} cy={80} r={34} /><path d="M70 196 C80 150 110 132 140 132 C170 132 190 146 200 160 C210 146 230 132 260 132 C290 132 320 150 330 196" /></>}
      {k === 'map' && <><path d="M60 50 L150 24 L250 50 L340 24 V170 L250 196 L150 170 L60 196 Z" /><path d="M150 24 V170 M250 50 V196" stroke={L.ink3} /><circle cx={200} cy={100} r={16} fill={GOLD} stroke="none" /></>}
      {k === 'ball' && <><circle cx={200} cy={110} r={84} /><path d="M140 52 C176 92 176 128 140 168 M260 52 C224 92 224 128 260 168" stroke={L.ink3} /><circle cx={300} cy={40} r={14} fill={GOLD} stroke="none" /></>}
    </svg>
  );
};

// 受光着色：面偏离正面越多越暗；60–120° 区间一道随角度从左扫到右的窄受光（只在侧棱最薄附近）
const FaceLight: React.FC<{ angle: number; dark: boolean }> = ({ angle, dark }) => {
  const c = Math.abs(Math.cos((angle * Math.PI) / 180));
  const shade = (1 - c) * (dark ? 0.55 : 0.4);
  const band = Math.max(0, 1 - Math.abs(angle - 90) / 34);
  const pos = mix(-20, 120, Math.min(1, Math.max(0, (angle - 56) / 68)));
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: shade }} />
      {band > 0.01 && (
        <div style={{
          position: 'absolute', inset: 0, opacity: band * (dark ? 0.5 : 0.35),
          background: `linear-gradient(100deg, rgba(255,255,255,0) ${pos - 12}%, rgba(255,255,255,0.9) ${pos}%, rgba(255,255,255,0) ${pos + 12}%)`,
        }} />
      )}
    </>
  );
};

const FlipCard: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const angle = angleAt(frame, i);
  const f = FEATURES[i];
  const s = FLIP0 + i * STAGGER;
  const lift = Math.max(0, Math.sin((Math.min(180, Math.max(0, angle)) * Math.PI) / 180));
  const land = s + PRE + FLIP;
  const num = springAt(frame, land - 2, { damping: 18, stiffness: 160 });
  const lab = ramp(frame, land + 2, 14, EASE.snappy);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1600 }}>
      <div style={{
        position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
        transform: `translateZ(${(lift * 60).toFixed(2)}px) rotateY(${angle.toFixed(3)}deg)`,
      }}>
        {/* 正面：暗色功能卡 */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 34, overflow: 'hidden',
          background: `linear-gradient(180deg, #1d1e22 0%, ${L.surface} 48%, #111214 100%)`,
          boxShadow: `inset 0 0 0 1.5px ${alpha('#ffffff', 0.09)}, inset 0 2px 0 ${alpha('#ffffff', 0.08)}`,
          fontFamily: FONT.sans,
        }}>
          <div style={{ position: 'absolute', left: 40, top: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: GOLD, boxShadow: '0 0 0 5px rgba(63,191,127,0.25)' }} />
            <div style={{ ...type(22, 700, { caps: true }), color: L.ink2, letterSpacing: '0.16em' }}>Live · 29 Oct</div>
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 112 }}>
            <FrontUI i={i} frame={frame} />
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, bottom: 40 }}>
            <div style={{ ...type(52, 750), color: L.ink }}>{f.name}</div>
            <div style={{ ...type(28, 450), color: L.ink2, marginTop: 10 }}>{f.desc}</div>
          </div>
          <FaceLight angle={angle} dark />
        </div>
        {/* 背面：瓷白结论卡 */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 34, overflow: 'hidden',
          background: 'linear-gradient(180deg, #ffffff 0%, #f3f6f4 100%)',
          boxShadow: `inset 0 0 0 1.5px rgba(0,0,0,0.06), inset 0 2px 0 rgba(255,255,255,0.9)`,
          fontFamily: FONT.sans, color: '#0d0d0f',
        }}>
          <div style={{ position: 'absolute', left: 40, top: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: GREEN }} />
            <div style={{ ...type(22, 700, { caps: true }), color: '#6b6a66', letterSpacing: '0.16em' }}>{f.name}</div>
          </div>
          <div style={{ position: 'absolute', left: 36, right: 30, bottom: 140 }}>
            <div style={{
              ...type(260, 800), letterSpacing: '-0.06em', lineHeight: 0.9, color: GREEN, whiteSpace: 'nowrap',
              transform: `scale(${mix(1.08, 1, num).toFixed(4)})`, transformOrigin: 'left bottom',
            }}>{f.value}</div>
          </div>
          <div style={{
            position: 'absolute', left: 40, right: 40, bottom: 48, ...type(34, 550), color: '#3d3c39',
            opacity: lab, transform: `translateY(${((1 - lab) * 14).toFixed(2)}px)`,
          }}>{f.label}</div>
          <FaceLight angle={180 - angle} dark={false} />
        </div>
      </div>
    </div>
  );
};

export const LiveNumbers: React.FC = () => {
  const frame = useCurrentFrame();
  const push = 1 + 0.03 * ramp(frame, 0, 150, EASE.smooth);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.5, y: -0.05 }} fill={{ x: 0.5, y: 1.1 }} horizon={0.88} intensity={0.9}>
        {/* 镜面地板：地平线以下略亮的反射面 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: Y + CH, bottom: 0,
          background: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0)} 60%)`,
          borderTop: `1px solid ${alpha('#ffffff', 0.06)}`,
        }} />
      </Stage>
      <AbsoluteFill style={{ transform: `scale(${push.toFixed(4)})`, transformOrigin: '50% 60%' }}>
        {/* 标题 */}
        <div style={{ position: 'absolute', left: X0, top: 118, fontFamily: FONT.sans }}>
          <div style={{ ...type(26, 700, { caps: true }), color: GOLD, letterSpacing: '0.18em' }}>
            <TextReveal text={`${BRAND.name} · real players`} by="word" variant="blur" start={0} each={14} gap={2} />
          </div>
          <div style={{ ...type(84, 760), color: L.ink, marginTop: 18 }}>
            <TextReveal text="Live since 29 October." by="word" variant="rise" start={2} each={18} gap={2.5} />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <React.Fragment key={i}>
            {/* 倒影：同一张卡竖直镜像，遮罩渐隐 */}
            <div style={{
              position: 'absolute', left: X0 + i * (CW + GAP), top: Y + CH + 6, width: CW, height: CH,
              transform: 'scaleY(-1)', transformOrigin: 'center', opacity: 0.22,
              WebkitMaskImage: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 26%)',
              maskImage: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 26%)',
            }}>
              <FlipCard i={i} frame={frame} />
            </div>
            {/* 接地影 */}
            <div style={{
              position: 'absolute', left: X0 + i * (CW + GAP) + 30, width: CW - 60, top: Y + CH - 18, height: 36, borderRadius: '50%',
              background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.7), rgba(0,0,0,0) 70%)',
              transform: `scaleX(${Math.max(0.12, Math.abs(Math.cos((angleAt(frame, i) * Math.PI) / 180))).toFixed(3)})`,
            }} />
            <div style={{ position: 'absolute', left: X0 + i * (CW + GAP), top: Y, width: CW, height: CH }}>
              <FlipCard i={i} frame={frame} />
            </div>
          </React.Fragment>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
