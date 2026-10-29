// "Built for ___", from video-shotcraft's vertical-word-roll-blur-cycle (same motion: a three-row reel, each step
// 0.7 outQuint + 0.3 outBack, vertical-only blur on the rows beside the centre, a squash toward the reel's edges, the
// centre word dyed the accent as it settles). Serve's words: the groups its club kinds serve, then any ball sport.
import React from 'react';
import { DesignStage, E, seg, useT } from '../demos/_fixtures/Motion';
import { Backdrop, FONT, Grain } from '../demos/_fixtures/Polish';

export const WHO_ELSE_DURATION = 180; // 5000ms @30fps

const ROW = 44;
const WORDS = ['your club', 'a school club', 'older adults', 'a charity cup', 'any ball sport'];
// four steps, about 0.55 s each, a beat to read every word
const STEPS = [0.14, 0.32, 0.5, 0.68];

const ACCENT = '#0a7f44';
const ACCENT_DIM = '#B9B9BE';
const INK = '#0a0a0b';
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// 十六进制颜色按 k 混合（与原 effect.js 的 mixHex 等价）
const mixHex = (a: string, b: string, k: number) => {
  k = clamp01(k);
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// 滚轮进度 p：每步 0.7·outQuint + 0.3·outBack（前快后极慢 + 轻微过冲回落）
const reelAt = (t: number) => {
  let p = 0;
  for (const s of STEPS) {
    const u = seg(t, s, s + 0.11);
    p += 0.7 * E.outQuint(u) + 0.3 * E.outBack(u);
  }
  return p;
};
const DT = 0.5 / (WHO_ELSE_DURATION - 1); // 半帧对应的 t

export const WhoElse: React.FC = () => {
  const t = useT();
  const p = reelAt(t);
  // 滚轮速度（行/帧）→ 纵向运动模糊（设计 px），静止时为 0
  const speed = Math.abs(reelAt(t + DT) - reelAt(t - DT));
  const motionBlur = Math.min(4, speed * ROW * 0.22);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
    <DesignStage bg="#ffffff">
      <Backdrop tone="light" light={{ x: 0.5, y: 0.3 }} accent={ACCENT} vignette={0.12} grain={0} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.sans,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            // 结束整组淡出
            opacity: 1,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: INK,
              letterSpacing: -0.5,
            }}
          >
            Built for
          </div>
          {/* 三行高的视窗，滚轮列在其中滑动，中心行 = 第二行；上下沿柔边渐隐 */}
          <div
            style={{
              position: 'relative',
              height: ROW * 3,
              width: 190,
              overflow: 'hidden',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)',
              maskImage: 'linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translateY(${ROW - p * ROW}px)`,
              }}
            >
              {WORDS.map((w, i) => {
                const d = Math.abs(i - p);
                // 相邻行纵向 blur：距中心 1 行内线性 0→3px，更远 3→5px；转动时叠运动模糊
                const blur = (d < 1 ? 3 * d : 3 + 2 * Math.min(d - 1, 1)) + motionBlur;
                const op = d < 1 ? 1 - 0.65 * d : Math.max(0.1, 0.35 - 0.23 * (d - 1));
                // 滚筒曲面：离中心越远越扁（最多 14%）
                const squash = 1 - 0.14 * Math.min(1, d / 1.4);
                const fid = `vroll-${i}`;
                return (
                  <div key={w} style={{ position: 'relative', height: ROW }}>
                    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
                      <filter id={fid} x="-10%" y="-120%" width="120%" height="340%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`} />
                      </filter>
                    </svg>
                    <div
                      style={{
                        height: ROW,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 30,
                        fontWeight: 800,
                        letterSpacing: -0.5,
                        whiteSpace: 'nowrap', // 末词 "Every Shot" 带空格，禁止折行
                        filter: blur > 0.05 ? `url(#${fid})` : undefined,
                        opacity: op,
                        transform: `scaleY(${squash.toFixed(4)})`,
                        // 落定染色：中心词灰→强调色（d 越小越彩）
                        color: mixHex(ACCENT_DIM, ACCENT, clamp01(1 - d * 2.4)),
                      }}
                    >
                      {w}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 196, textAlign: 'center', fontFamily: FONT.sans, fontSize: 10, fontWeight: 500, color: '#5c5f66', opacity: seg(t, 0.06, 0.16) }}>
        A club can run children's sessions, gentle games or a charity cup, with the rules in code.
      </div>
    </DesignStage>
    {/* 颗粒放在设计坐标容器外，按成片像素取样，不随 4× 放大变粗 */}
    <Grain opacity={0.05} />
    </div>
  );
};
