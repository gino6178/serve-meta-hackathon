// The live segment: real recordings of Serve in a brand frame, from video-shotcraft's brand-frame-snap (same grammar:
// a thick band grows first and holds the screen, the window springs down into it, the band flips colour in one frame
// with a short radial flash and a damped bounce). Serve green is the player's own phone; blue is a friend's (Leo, who
// has no account). The window plays the recordings as segments: each a slice of a clip at a speed, with what it shows
// in a caption, and any speed-up written on screen.
import React from 'react';
import { OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, SpeedBlur, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../demos/_fixtures/Look';
import { BRAND, ShotcraftMark } from '../demos/_fixtures/Brand';

const L = LOOKS.serve;
export const GREEN = '#0a7f44';
export const BLUE = '#1f6fd6';
const BAND = 60;
const BAND_B = 112; // the bottom band carries the caption, so it never covers the app
const WIN_W = 1560;
const WIN_H = 864;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// a slice: a clip at a speed (the default), an act's title card, or two clips side by side (each cropped to what
// matters). model names the Meta model at work, shown in the top band; mark draws a highlight box (window px).
type Box = { x: number; y: number; w: number; h: number };
type Side = { src: string; from: number; crop: Box; tint: string; who: string };
export type Seg = {
  src: string; from: number; to: number; rate?: number; caption: string; who?: 'you' | 'friend'; label?: string;
  zoom?: { x: number; y: number; s: number; now?: boolean }; mark?: Box; model?: string;
  kind?: 'clip' | 'bumper' | 'split'; num?: string; title?: string; sub?: string; left?: Side; right?: Side;
};
const lenOf = (s: Seg) => Math.round(((s.to - s.from) * 30) / (s.rate ?? 1));
export const liveDuration = (segs: Seg[]) => segs.reduce((n, s) => n + lenOf(s), 0);

// what the window shows: the clip from `from` seconds at `rate`, cut hard to the next slice; a zoom eases in on a
// point (window px) when what the slice is about is small on screen
const Clip: React.FC<{ s: Seg }> = ({ s }) => {
  const f = useCurrentFrame();
  const z = s.zoom ? (s.zoom.now ? 1 : ramp(f, 10, 16, EASE.smooth)) : 0; // `now`: already in, carried on from the slice before
  const sc = s.zoom ? 1 + (s.zoom.s - 1) * z : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${sc.toFixed(4)})`, transformOrigin: s.zoom ? `${s.zoom.x}px ${s.zoom.y}px` : '50% 50%' }}>
      <OffthreadVideo src={staticFile(`clips/${s.src}.mp4`)} startFrom={Math.round(s.from * 30)} playbackRate={s.rate ?? 1} muted
        style={{ position: 'absolute', inset: 0, width: WIN_W, height: WIN_H, objectFit: 'cover' }} />
      {s.mark && <Mark b={s.mark} />}
    </div>
  );
};
// an act's title card, inside the window: the number, the title, one line under it
const Bumper: React.FC<{ s: Seg }> = ({ s }) => {
  const f = useCurrentFrame();
  const a = ramp(f, 0, 10, EASE.snappy), t = ramp(f, 4, 14, EASE.out);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#ffffff', display: 'flex', alignItems: 'center', paddingLeft: 170, gap: 50, fontFamily: FONT.sans }}>
      <div style={{ width: 170, height: 170, borderRadius: 85, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96, fontWeight: 800, transform: `scale(${(0.7 + 0.3 * springAt(f, 0, { damping: 12, stiffness: 200 })).toFixed(4)})`, opacity: a }}>{s.num}</div>
      <div style={{ opacity: t, transform: `translateY(${((1 - t) * 18).toFixed(2)}px)` }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, lineHeight: 1.05 }}>{s.title}</div>
        <div style={{ fontSize: 40, fontWeight: 500, color: L.ink2, marginTop: 14 }}>{s.sub}</div>
      </div>
    </div>
  );
};
// two clips side by side, each cropped to the part that matters and scaled to fill its half
const Half: React.FC<{ h: Side; x: number }> = ({ h, x }) => {
  const W = WIN_W / 2 - 6, sc = Math.min(W / h.crop.w, WIN_H / h.crop.h);
  return (
    <div style={{ position: 'absolute', left: x, top: 0, width: W, height: WIN_H, overflow: 'hidden', background: '#ffffff' }}>
      <div style={{ position: 'absolute', left: (W - h.crop.w * sc) / 2 - h.crop.x * sc, top: (WIN_H - h.crop.h * sc) / 2 - h.crop.y * sc, width: WIN_W, height: WIN_H, transform: `scale(${sc.toFixed(4)})`, transformOrigin: '0 0' }}>
        <OffthreadVideo src={staticFile(`clips/${h.src}.mp4`)} startFrom={Math.round(h.from * 30)} muted style={{ position: 'absolute', inset: 0, width: WIN_W, height: WIN_H, objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', left: 24, top: 22, padding: '8px 18px', borderRadius: 999, background: h.tint, color: '#fff', fontFamily: FONT.sans, fontSize: 26, fontWeight: 800, letterSpacing: '0.06em' }}>{h.who}</div>
    </div>
  );
};
const Split: React.FC<{ s: Seg }> = ({ s }) => (
  <div style={{ position: 'absolute', inset: 0, background: L.line }}>
    {s.left && <Half h={s.left} x={0} />}
    {s.right && <Half h={s.right} x={WIN_W / 2 + 6} />}
  </div>
);
// a highlight box that draws in after the zoom has landed, in window px (it rides the zoom)
const Mark: React.FC<{ b: Box }> = ({ b }) => {
  const f = useCurrentFrame();
  const t = ramp(f, 26, 10, EASE.snappy);
  return <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: 18, border: '5px solid #f2b705', boxShadow: '0 0 0 9999px rgba(255,255,255,0)', background: 'rgba(242,183,5,0.10)', opacity: t, transform: `scale(${(1.06 - 0.06 * t).toFixed(4)})` }} />;
};
const Window: React.FC<{ segs: Seg[] }> = ({ segs }) => {
  let at = 0;
  return (
    <>
      {segs.map((s, i) => {
        const d = lenOf(s), start = at;
        at += d;
        return (
          <Sequence key={i} from={start} durationInFrames={d} layout="none">
            {s.kind === 'bumper' ? <Bumper s={s} /> : s.kind === 'split' ? <Split s={s} /> : <Clip s={s} />}
          </Sequence>
        );
      })}
    </>
  );
};
// the model at work, in the top band's centre
const ModelPill: React.FC<{ segs: Seg[]; h: number }> = ({ segs, h }) => {
  let at = 0;
  return (
    <>
      {segs.map((s, i) => {
        const d = lenOf(s), start = at;
        at += d;
        return s.model ? (
          <Sequence key={i} from={start} durationInFrames={d} layout="none">
            <PillIn text={s.model} h={h} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
const PillIn: React.FC<{ text: string; h: number }> = ({ text, h }) => {
  const f = useCurrentFrame();
  const t = ramp(f, 0, 10, EASE.snappy);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px', borderRadius: 999, background: '#ffffff', color: L.ink, fontFamily: FONT.sans, fontSize: 26, fontWeight: 750, letterSpacing: '-0.01em', opacity: t, transform: `translateY(${((1 - t) * -10).toFixed(2)}px)` }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: GREEN, boxShadow: `0 0 0 4px ${alpha(GREEN, 0.22)}` }} />
        {text}
      </div>
    </div>
  );
};
// the bottom band's words for the slice on screen
const BandCaption: React.FC<{ segs: Seg[] }> = ({ segs }) => {
  let at = 0;
  return (
    <>
      {segs.map((s, i) => {
        const d = lenOf(s), start = at;
        at += d;
        return <Sequence key={i} from={start} durationInFrames={d} layout="none"><Caption text={s.caption} label={s.label} rate={s.rate ?? 1} /></Sequence>;
      })}
    </>
  );
};

// a card in the app's own style (white, hairline, the agent's green dot) naming what is on screen; speed-ups on the right
const Caption: React.FC<{ text: string; label?: string; rate: number }> = ({ text, label, rate }) => {
  const f = useCurrentFrame();
  const inT = ramp(f, 2, 12, EASE.snappy);
  const speed = rate > 1.05 ? label ?? `${Number.isInteger(rate) ? rate : rate.toFixed(1)}× speed` : null;
  return (
    <div style={{ position: 'absolute', left: 66, right: 66, bottom: 0, height: BAND_B, display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{
        flex: 1, minWidth: 0, fontFamily: FONT.sans, fontSize: 46, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', opacity: inT, transform: `translateY(${((1 - inT) * 12).toFixed(2)}px)`,
      }}>{text}</div>
      {speed && (
        <div style={{
          flex: 'none', padding: '8px 20px', borderRadius: 999, background: '#ffffff', color: L.ink,
          fontFamily: FONT.sans, fontSize: 30, fontWeight: 800, letterSpacing: '0.01em', opacity: inT,
        }}>{speed}</div>
      )}
    </div>
  );
};

export const LiveFrame: React.FC<{ segs: Seg[] }> = ({ segs }) => {
  const f = useCurrentFrame();
  // the frame's colour for this frame: whose phone the segment is
  let at = 0, who: 'you' | 'friend' = 'you', flipAt = -100;
  for (const s of segs) {
    const d = lenOf(s), w = s.who ?? 'you';
    if (f >= at) { if (w !== who && at > 0) flipAt = at; who = w; }
    at += d;
  }
  const color = who === 'friend' ? BLUE : GREEN;

  // the band first: 0 → 60 px (snappy, a frame shows by frame 2)
  const grow = ramp(f, -1, 19, EASE.snappy);
  const since = f - flipAt;
  const flash = since >= 0 && since < 3 ? 0.6 - since * 0.2 : 0;
  const bounce = since >= 0 && since < 40 ? Math.exp(-since * 0.24) * Math.cos(since * 0.95) * 12 : 0;
  const inner = Math.max(0, BAND * grow + bounce);
  const innerB = Math.max(0, BAND_B * grow + bounce);

  // the window springs down into the frame: y 660 → 0, tilted 18° → 0, scale 0.88 → 1
  const dropAt = (fr: number) => springAt(fr, 10, { damping: 15, stiffness: 115 });
  const yAt = (fr: number) => mix(660, 0, dropAt(fr));
  const d = dropAt(f);
  const vy = f >= 10 ? yAt(f + 0.5) - yAt(f - 0.5) : 0;
  const punch = since >= 0 && since < 30 ? Math.exp(-since * 0.35) * Math.sin(Math.min(Math.PI, since * 0.9) + 0.0001) * 0.012 : 0;
  const labelIn = ramp(f, 6, 14, EASE.snappy);

  return (
    <div style={{ width: 1920, height: 1080, background: '#0a0f0c', position: 'relative', overflow: 'hidden', fontFamily: FONT.sans }}>
      <div style={{ position: 'absolute', left: inner, top: inner, right: inner, bottom: innerB, overflow: 'hidden', borderRadius: 22 }}>
        <Stage look={L} keyLight={{ x: 0.5, y: 0.0 }} fill={null} vignette={0.07} intensity={1.1}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 40% at 50% 104%, ${alpha(color, 0.14)} 0%, ${alpha(color, 0)} 70%)` }} />
        </Stage>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + punch})`, transformOrigin: '50% 52%' }}>
          <SpeedBlur vx={0} vy={vy} amount={0.28} max={14}>
            <div style={{ position: 'absolute', inset: 0, perspective: 2400, perspectiveOrigin: '50% 30%' }}>
              <div style={{
                position: 'absolute', left: '50%', top: '50%', width: WIN_W, height: WIN_H, marginLeft: -WIN_W / 2, marginTop: -WIN_H / 2,
                transform: `translateY(${yAt(f).toFixed(2)}px) rotateX(${mix(18, 0, d).toFixed(2)}deg) scale(${mix(0.88, 1, d).toFixed(4)})`,
                transformOrigin: '50% 100%', opacity: clamp01(d * 5), borderRadius: 18, overflow: 'hidden', background: '#ffffff',
                boxShadow: `0 0 0 1px rgba(0,0,0,0.10), ${softShadow(mix(70, 22, clamp01(d)), { color: '#0a1a10', strength: 1.2 })}`,
              }}>
                <Window segs={segs} />
              </div>
            </div>
          </SpeedBlur>
        </div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none', boxShadow: 'inset 0 0 0 1px rgba(10,16,12,0.10), inset 0 4px 14px rgba(10,16,12,0.16)' }} />
      </div>

      {/* the band: four solid strips; a flip is a new background in one frame */}
      {([
        { left: 0, top: 0, right: 0, height: inner },
        { left: 0, bottom: 0, right: 0, height: innerB },
        { left: 0, top: 0, bottom: 0, width: inner },
        { right: 0, top: 0, bottom: 0, width: inner },
      ] as React.CSSProperties[]).map((pos, i) => <div key={i} style={{ position: 'absolute', background: color, ...pos }} />)}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.10) 100%)',
        clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${inner}px ${inner}px,${inner}px calc(100% - ${innerB}px),calc(100% - ${inner}px) calc(100% - ${innerB}px),calc(100% - ${inner}px) ${inner}px,${inner}px ${inner}px)`,
      }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <path fillRule="evenodd" fill={color}
          d={`M${inner} ${inner}H${1920 - inner}V${1080 - innerB}H${inner}Z M${inner} ${inner + 22}A22 22 0 0 1 ${inner + 22} ${inner}H${1920 - inner - 22}A22 22 0 0 1 ${1920 - inner} ${inner + 22}V${1080 - innerB - 22}A22 22 0 0 1 ${1920 - inner - 22} ${1080 - innerB}H${inner + 22}A22 22 0 0 1 ${inner} ${1080 - innerB - 22}Z`} />
      </svg>

      {/* band labels: whose phone on the left (changes on the flip frame), the mark and name on the right */}
      <div style={{
        position: 'absolute', left: 66, top: 0, height: inner, display: 'flex', alignItems: 'center', gap: 14,
        fontWeight: 800, fontSize: 28, letterSpacing: '0.16em', color: '#fff', whiteSpace: 'nowrap',
        opacity: labelIn, transform: `translateY(${((1 - labelIn) * 16).toFixed(2)}px)`,
      }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.25)' }} />
        {who === 'friend' ? "LIVE · LEO'S PHONE, NO ACCOUNT" : 'LIVE · BUILT OCT 28 – NOV 4'}
      </div>
      <div style={{
        position: 'absolute', right: 66, top: 0, height: inner, display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: BRAND.font, fontWeight: 800, fontSize: 32, letterSpacing: '-0.035em', color: '#fff', whiteSpace: 'nowrap',
        opacity: labelIn * 0.95, transform: `translateY(${((1 - labelIn) * 16).toFixed(2)}px)`,
      }}>
        <ShotcraftMark size={40} frameColor="#ffffff" cutColor="#ffffff" />
        {BRAND.name}
      </div>
      <div style={{ opacity: labelIn }}><BandCaption segs={segs} /><ModelPill segs={segs} h={inner} /></div>
      {flash > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: flash, background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,1) 100%)' }} />
      )}
    </div>
  );
};
