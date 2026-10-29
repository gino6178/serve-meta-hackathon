// Serve's brand parts for the demos (re-skinned from video-shotcraft's Brand.tsx): wherever a demo shows a logo, a
// name or a line, it comes from here. The mark is Serve's own (web/src/components/Mark.jsx): a flight arc in ink and
// the shuttle as a green dot. The wordmark is lower case "serve", 800 weight, tight tracking, as in the app's sidebar.
// The export names stay the demos' (ShotcraftMark, ShotcraftWordmark) so the copied demos need no other change.
import React from 'react';

export const BRAND = {
  name: 'serve',
  short: 'Serve',
  repo: 'github.com/gino6178/serve-meta-hackathon',
  amber: '#0a7f44', // the one accent: the app's agent green (the demos call it amber)
  ink: '#0a0a0b',
  paper: '#ffffff',
  slate: '#5c5f66',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const;

// the mark's two parts (viewBox 0 0 64 64): the arc, drawn as a stroke, and the shuttle
export const MARK_PATHS = {
  frame: 'M10 48 C 22 8, 42 8, 54 30',
  cut: 'M54 30 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
} as const;

// frameProgress 0→1 draws the arc along its length; cutProgress 0→1 grows the shuttle
export const ShotcraftMark: React.FC<{
  size?: number; tone?: 'dark' | 'light'; frameColor?: string; cutColor?: string;
  frameProgress?: number; cutProgress?: number; style?: React.CSSProperties;
}> = ({ size = 96, tone = 'light', frameColor, cutColor, frameProgress = 1, cutProgress = 1, style }) => {
  const fp = Math.max(0, Math.min(1, frameProgress));
  const cp = Math.max(0, Math.min(1, cutProgress));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', overflow: 'visible', ...style }}>
      {fp > 0 && <path d={MARK_PATHS.frame} fill="none" stroke={frameColor ?? (tone === 'dark' ? BRAND.paper : BRAND.ink)} strokeWidth={6.5} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fp} />}
      {cp > 0 && <circle cx={54} cy={30} r={6.2 * cp} fill={cutColor ?? BRAND.amber} />}
    </svg>
  );
};

export const ShotcraftWordmark: React.FC<{
  size?: number; tone?: 'dark' | 'light'; color?: string; mark?: boolean;
  markScale?: number; gap?: number; weight?: number; fontFamily?: string; style?: React.CSSProperties;
}> = ({ size = 48, tone = 'light', color, mark = true, markScale = 1.5, gap, weight, fontFamily, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: gap ?? size * 0.35, ...style }}>
    {mark && <ShotcraftMark size={size * markScale} tone={tone} />}
    <span style={{
      fontFamily: fontFamily ?? BRAND.font,
      fontSize: size, fontWeight: weight ?? 800, lineHeight: 1, letterSpacing: '-0.035em', whiteSpace: 'nowrap',
      color: color ?? (tone === 'dark' ? BRAND.paper : BRAND.ink),
    }}>{BRAND.name}</span>
  </div>
);

// Serve's lines: only what the product does and what was measured (the deck's numbers)
export const PITCH = {
  en: {
    motto: 'Play more. Manage less.',
    taglines: [
      'The agent that gets you playing, in any ball sport.',
      'One yes from you. Agents do the rest.',
      'Less screen time, more court time.',
    ],
    features: ['Agents agree your week', 'Your agent in Messenger', 'Game on', 'Clubs on a real map', 'A link anyone can join', 'Built on Muse Glimmer'],
    praise: [],
    works: 'Built on Muse Glimmer, Meta\'s open-weights model, on a GPU I own',
  },
  zh: {
    motto: 'Play more. Manage less.',
    taglines: [],
    features: [],
    praise: [],
    works: '',
  },
} as const;
