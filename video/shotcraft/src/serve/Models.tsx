// The Meta models that carry Serve, from video-shotcraft's card-stack (same motion: cards spring up from below one
// after another, faster and faster, the stack dips as each lands, a 2% squeeze, then the fan opens on a low-damping
// spring while the camera pulls back, and the centre card is drawn out with a ring and one sheen). Seven cards, the
// centre one Muse Glimmer; covers drawn in Serve's colours; the title says all fifteen are listed in the deck.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Sheen, Stage, TextReveal, alpha, springAt, stagger, type } from '../demos/_fixtures/Look';
import { BRAND, MARK_PATHS, ShotcraftMark } from '../demos/_fixtures/Brand';

export const MODELS_DURATION = 165; // 5000ms @30fps

const L = LOOKS.serve;
const N = 6;
const CW = 320;
const CH = 440;
const CX = 960;
const CY = 610; // 卡片中心
const ROT = 3.5; // 扇面每张偏转（°）
const TX = 262; // 扇面每张横移（px）
const FEATURED = 2;

type Kind = 'shield' | 'scan' | 'student' | 'hero' | 'memory' | 'voice' | 'image';
const CARDS: { title: string; meta: string; job: string; kind: Kind; tint: string }[] = [
  { title: 'Llama Guard 3', meta: 'SAFETY · CPU', job: 'Checks every message', kind: 'shield', tint: '#fbecea' },
  { title: 'Prompt Guard 2', meta: 'SAFETY · CPU', job: 'Screens reviews', kind: 'scan', tint: '#fbecea' },
  { title: 'Muse Glimmer', meta: 'EVERY AGENT · GPU', job: 'Plans, talks, decides', kind: 'hero', tint: L.accent },
  { title: 'Llama 3.2 1B', meta: 'STUDENT · CPU', job: 'Learned from Glimmer', kind: 'student', tint: '#e7f3ec' },
  { title: 'DRAMA', meta: 'MEMORY · CPU', job: 'Memory by meaning', kind: 'memory', tint: '#e8f0fb' },
  { title: 'Muse Voice', meta: 'VOICE · MODEL API', job: 'Talk to your agent', kind: 'voice', tint: '#e8f0fb' },
];

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// 入场：起跳帧按"越来越快"分布（EASE.out 映射 = 前面间隔大、后面间隔小）；spring 0→1（damping 13 = 一次可见回弹）
const START = Array.from({ length: N }, (_, i) => 2 + stagger(i, N, 40, EASE.out));
const inAt = (f: number, i: number) => (f < START[i] ? 0 : springAt(f, START[i], { damping: 13, stiffness: 150 }));
const DROP = 820; // 起点在画框下方

export const Models: React.FC = () => {
  const f = useCurrentFrame();
  // 落座下压：每张卡落座（≈起跳后 7f 越过终点）时整摞被压低 5px，sin 包络 9f
  const dip = START.reduce((d, s) => d + Math.sin(clamp01((f - s - 6) / 9) * Math.PI) * 5, 0);
  const squeeze = 1 - 0.02 * Math.sin(clamp01((f - 62) / 10) * Math.PI);
  const fan = f < 68 ? 0 : springAt(f, 68, { damping: 20, stiffness: 95 });
  // 相机：成摞段极缓推近 1→1.06（给"一摞"分量），展开同段拉远到 0.88，hold 段再极缓推进
  const camPush = mix(1, 1.06, ramp(f, 0, 64, EASE.smooth));
  const cam = mix(camPush, 0.88, ramp(f, 64, 42, EASE.smooth)) * mix(1, 1.017, ramp(f, 122, 28, EASE.smooth));
  const lift = ramp(f, 102, 18, EASE.overshoot);
  const ring = ramp(f, 104, 12, EASE.out);
  const sheen = ramp(f, 108, 22, EASE.smooth);

  return (
    <AbsoluteFill style={{ background: L.bg[1] }}>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.12 }} fill={null}>
        {/* 地面：一道极淡的桌面反光带 */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 860, height: 220, background: `linear-gradient(180deg, ${alpha('#ffffff', 0)} 0%, ${alpha('#ffffff', 0.5)} 40%, ${alpha('#ffffff', 0)} 100%)` }} />
      </Stage>

      {/* 眉题（画框装饰，不随相机） */}
      <div style={{ position: 'absolute', left: 120, top: 96, display: 'flex', alignItems: 'center', gap: 14, opacity: ramp(f, 0, 12, EASE.out) }}>
        <ShotcraftMark size={30} tone="light" />
        <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 22, letterSpacing: '0.06em', color: L.ink2 }}>{`${BRAND.name} · Meta models`}</div>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 96, fontFamily: FONT.sans, fontWeight: 600, fontSize: 22, letterSpacing: '0.12em', color: L.ink3, opacity: ramp(f, 4, 12, EASE.out) }}>
        {`${START.filter((s) => f >= s + 6).length} of 15`}
      </div>

      {/* 标题：中心卡抽出时升起 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center' }}>
        <div style={{ ...type(88, 700), color: L.ink }}>
          <TextReveal text="15 Meta models. Six carry Serve." by="word" variant="rise" start={106} each={18} gap={3} />
        </div>
      </div>

      <AbsoluteFill style={{ transform: `scale(${cam.toFixed(4)})`, transformOrigin: `${CX}px ${CY + 120}px` }}>
        {/* 地面接触影：成摞时集中、展开后随扇面变宽 */}
        <div style={{
          position: 'absolute', left: CX - mix(220, 760, fan) / 2, top: CY + CH / 2 - 30 + dip, width: mix(220, 760, fan), height: 70,
          borderRadius: '50%', background: `radial-gradient(ellipse at center, ${alpha(L.shadow, 0.28)} 0%, ${alpha(L.shadow, 0)} 70%)`,
          opacity: ramp(f, 6, 20, EASE.out),
        }} />
        <div style={{ position: 'absolute', inset: 0, perspective: '1800px' }}>
          {CARDS.map((c, i) => {
            const p = inAt(f, i);
            const y = (1 - p) * DROP;
            const vy = ((1 - inAt(f + 0.5, i)) - (1 - inAt(f - 0.5, i))) * DROP;
            const blurY = Math.min(10, Math.abs(vy) * 0.18);
            const k = i - (N - 1) / 2;
            // 成摞错位：确定性 ±3.2° / ±11px，像随手码齐的一摞；展开时理顺
            const jitR = (rand(i * 3 + 1) - 0.5) * 6.4;
            const jitX = (rand(i * 5 + 2) - 0.5) * 22;
            const tilt = (i % 2 ? 1 : -1) * 9 * (y / DROP); // 飞行中带交替倾角，随落座收敛
            const rot = mix(jitR + tilt, k * ROT, fan);
            const tx = mix(jitX, k * TX, fan);
            const tz = i * 2;
            const feat = i === FEATURED;
            const ly = feat ? -72 * lift : 0;
            const elev = 6 + (y / DROP) * 50 + (feat ? 26 * lift : 0);
            const visible = f >= START[i];
            if (!visible) return null;
            return (
              <div key={i} style={{
                position: 'absolute', left: CX - CW / 2, top: CY - CH / 2, width: CW, height: CH,
                transformOrigin: '50% 130%',
                transform: `translate3d(${tx.toFixed(2)}px, ${(y + dip + ly).toFixed(2)}px, ${tz}px) rotate(${rot.toFixed(3)}deg) scale(${squeeze.toFixed(4)})`,
                zIndex: feat && lift > 0.01 ? N + 1 : i,
              }}>
                {blurY > 0.4 && (
                  <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
                    <filter id={`cs-vb-${i}`} x="-10%" y="-30%" width="120%" height="160%">
                      <feGaussianBlur stdDeviation={`0 ${blurY.toFixed(2)}`} />
                    </filter>
                  </svg>
                )}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', background: L.surface,
                  border: `1px solid ${L.line}`, boxSizing: 'border-box',
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.9), ${softShadow(elev, { color: L.shadow, strength: 1.15 })}` +
                    (feat && ring > 0 ? `, 0 0 0 ${(3 * ring).toFixed(2)}px ${alpha(L.accent, 0.9 * ring)}` : ''),
                  filter: blurY > 0.4 ? `url(#cs-vb-${i})` : undefined,
                }}>
                  <CardFace c={c} i={i} />
                  {feat && <Sheen progress={sheen} strength={0.7} width={0.18} />}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <div style={{
        position: 'absolute', left: 0, right: 0, top: 268, textAlign: 'center', ...type(34, 450), color: L.ink2,
        opacity: ramp(f, 116, 14, EASE.out), transform: `translateY(${(1 - ramp(f, 116, 18, EASE.snappy)) * 16}px)`,
      }}>
        Muse Glimmer at the centre, on a GPU I own. All fifteen are in the deck.
      </div>
    </AbsoluteFill>
  );
};

// ───────────── 卡面：封面图 + 标题 + 元信息 ─────────────
const COVER_H = 256;
const CardFace: React.FC<{ c: (typeof CARDS)[number]; i: number }> = ({ c, i }) => {
  const hero = c.kind === 'hero';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 12, right: 12, top: 12, height: COVER_H, borderRadius: 14, overflow: 'hidden', background: c.tint }}>
        <Cover kind={c.kind} seed={i} />
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, top: COVER_H + 40 }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 18, letterSpacing: '0.1em', color: hero ? L.accent : L.ink3 }}>{c.meta}</div>
        <div style={{ ...type(32, 700), color: L.ink, marginTop: 10, whiteSpace: 'nowrap' }}>{c.title}</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 21, color: L.ink2, marginTop: 14, whiteSpace: 'nowrap' }}>{c.job}</div>
      </div>
    </div>
  );
};

const Cover: React.FC<{ kind: Kind; seed: number }> = ({ kind, seed }) => {
  const W = 296, H = COVER_H;
  const A = L.accent, B = L.accent2, R = '#d1352b', INK = L.ink;
  switch (kind) {
    case 'shield':
    case 'scan':
      return (
        <svg width={W} height={H}>
          <path d="M148 50 L206 72 V128 C206 166 180 192 148 206 C116 192 90 166 90 128 V72 Z" fill="#ffffff" stroke={R} strokeWidth={6} strokeLinejoin="round" />
          {kind === 'shield'
            ? <path d="M122 128 L142 148 L176 110" fill="none" stroke={R} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            : [0, 1, 2].map((k) => <line key={k} x1={116} x2={180 - k * 14} y1={110 + k * 22} y2={110 + k * 22} stroke={alpha(R, 0.75)} strokeWidth={7} strokeLinecap="round" />)}
        </svg>
      );
    case 'student':
      return (
        <svg width={W} height={H}>
          <rect x={40} y={56} width={216} height={36} rx={18} fill={alpha(INK, 0.1)} />
          <rect x={40} y={56} width={216 * 0.895} height={36} rx={18} fill={A} />
          <text x={52} y={81} fontFamily={FONT.sans} fontSize={20} fontWeight={700} fill="#fff">89.5% agree</text>
          <text x={40} y={170} fontFamily={FONT.sans} fontSize={64} fontWeight={800} fill={INK} letterSpacing="-0.04em">0.9 s</text>
          <text x={40} y={206} fontFamily={FONT.sans} fontSize={20} fontWeight={500} fill={L.ink2}>a decision, on the CPU</text>
        </svg>
      );
    case 'hero':
      return (
        <svg width={W} height={H}>
          <defs>
            <radialGradient id="ms-hero" cx="80%" cy="10%" r="100%">
              <stop offset="0" stopColor="#3fbf7f" />
              <stop offset="1" stopColor={A} />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#ms-hero)" />
          {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={250} cy={40} r={60 + k * 44} fill="none" stroke="#ffffff" strokeOpacity={0.22 - k * 0.035} strokeWidth={2} />)}
          <g transform="translate(18 120) scale(1.6)">
            <path d={MARK_PATHS.frame} fill="none" stroke="#ffffff" strokeWidth={6.5} strokeLinecap="round" />
            <circle cx={54} cy={30} r={6.2} fill="#ffffff" />
          </g>
          <text x={24} y={234} fontFamily={FONT.sans} fontSize={28} fontWeight={650} fill="#ffffff" fillOpacity={0.9} letterSpacing="-0.02em">Open weights</text>
        </svg>
      );
    case 'memory':
      return (
        <svg width={W} height={H}>
          {Array.from({ length: 14 }, (_, k) => {
            const x = 40 + rand(seed * 7 + k) * 216, y = 40 + rand(seed * 11 + k) * 176;
            return <circle key={k} cx={x} cy={y} r={k === 5 ? 13 : 8} fill={k === 5 ? B : alpha(INK, 0.18)} />;
          })}
          <circle cx={148} cy={128} r={60} fill="none" stroke={B} strokeWidth={3} strokeDasharray="6 7" />
        </svg>
      );
    case 'voice':
      return (
        <svg width={W} height={H}>
          {Array.from({ length: 18 }, (_, k) => {
            const h = 20 + Math.abs(Math.sin(k * 1.37) * Math.cos(k * 0.53)) * 130;
            return <rect key={k} x={36 + k * 13} y={128 - h / 2} width={7} height={h} rx={3.5} fill={k > 6 && k < 12 ? B : alpha(INK, 0.22)} />;
          })}
        </svg>
      );
    case 'image':
    default:
      return (
        <svg width={W} height={H}>
          <rect x={70} y={30} width={156} height={196} rx={14} fill={INK} />
          <text x={88} y={86} fontFamily={FONT.sans} fontSize={15} fontWeight={700} fill={A} letterSpacing="0.1em">REMATCH</text>
          <text x={88} y={122} fontFamily={FONT.sans} fontSize={30} fontWeight={800} fill="#fff">NOOR</text>
          <text x={88} y={152} fontFamily={FONT.sans} fontSize={18} fontWeight={600} fill={alpha('#ffffff', 0.7)}>vs YOU</text>
          <circle cx={190} cy={196} r={16} fill={A} />
        </svg>
      );
  }
};
