// The agent swarm: every tile is one AI tester's real session on Serve, replayed side by side from the request logs of
// the testing rounds (public/swarm/sessions.json, built from submission/agent_trial*/requests.jsonl). Each tile plays
// its own requests in order, compressed to the same window, so a 40-minute session and a 5-minute one finish together.
// Green is a request Serve answered; amber is one Serve refused on purpose (a limit, a clash, a permission). The
// numbers on screen are the real ones: 153 test reports, 16,713 logged requests.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';

export const SWARM_DURATION = 480;

const L = LOOKS.graphite;
const GREEN = '#3fbf7f';
const AMBER = '#e4c58a';
const RED = '#ff6b6b';
const AGENTS = 153; // test reports written, one per AI tester
const LOGGED = 16713; // requests in all the round logs

type Step = [number, string, string, number];
type Session = { round: number; who: string; label: string; n: number; steps: Step[] };

const COLS = 14;
const TW = 128;
const TH = 68;
const GAP = 6;
const X0 = (1920 - (COLS * TW + (COLS - 1) * GAP)) / 2;
const Y0 = 184;
const PLAY0 = 40; // the replay starts
const PLAY = 330; // and runs this many frames
const END = PLAY0 + PLAY + 10; // the closing line comes in

const color = (s: number) => (s >= 500 ? RED : s >= 400 ? AMBER : GREEN);
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const Tile: React.FC<{ s: Session; i: number; frame: number; dim: number }> = ({ s, i, frame, dim }) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  // tiles come in as a wave from the middle of the grid
  const dist = Math.hypot(col - (COLS - 1) / 2, row - 5);
  const inT = ramp(frame, dist * 2.4, 14, EASE.out);
  // how many of its requests this tile has played by now
  const shown = Math.max(0, Math.min(s.n, Math.floor(((frame - PLAY0) / PLAY) * s.n)));
  const last = s.steps.slice(Math.max(0, shown - 4), shown);
  const live = shown > 0 && shown < s.n;
  const pulse = live ? 0.5 + 0.5 * Math.sin((frame + i * 7) / 3) : 0;
  return (
    <div style={{
      position: 'absolute', left: X0 + col * (TW + GAP), top: Y0 + row * (TH + GAP), width: TW, height: TH,
      background: L.surface, border: `1px solid ${live ? `rgba(63,191,127,${0.18 + 0.25 * pulse})` : L.line}`, borderRadius: 6,
      opacity: inT * (1 - dim * 0.86), transform: `scale(${mix(0.9, 1, inT)})`, overflow: 'hidden', padding: '5px 6px', boxSizing: 'border-box',
      fontFamily: FONT.mono, color: L.ink2,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, color: L.ink, letterSpacing: '0.01em' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 86 }}>{/^new/i.test(s.label) ? 'new agent' : s.label}</span>
        <span style={{ color: L.ink3, fontWeight: 500 }}>R{s.round}</span>
      </div>
      {last.map((x, k) => (
        <div key={shown - last.length + k} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 8.5, lineHeight: '11px', whiteSpace: 'nowrap', overflow: 'hidden', opacity: 0.45 + 0.55 * ((k + 1) / last.length) }}>
          <i style={{ width: 5, height: 5, borderRadius: 3, background: color(x[3]), flex: 'none' }} />
          <span style={{ color: L.ink3 }}>{x[1] === 'POST' ? 'POST' : 'GET '}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x[2]}</span>
        </div>
      ))}
    </div>
  );
};

export const Swarm: React.FC = () => {
  const frame = useCurrentFrame();
  const [data, setData] = useState<{ sessions: Session[]; total: number } | null>(null);
  const [handle] = useState(() => delayRender('swarm sessions'));
  useEffect(() => { fetch(staticFile('swarm/sessions.json')).then((r) => r.json()).then((j) => { setData(j); continueRender(handle); }); }, [handle]);
  if (!data) return null;
  const S = data.sessions;
  const played = S.reduce((sum, s) => sum + Math.max(0, Math.min(s.n, Math.floor(((frame - PLAY0) / PLAY) * s.n))), 0);
  const refused = S.reduce((sum, s) => { const k = Math.max(0, Math.min(s.n, Math.floor(((frame - PLAY0) / PLAY) * s.n))); let r = 0; for (let j = 0; j < k; j++) if (s.steps[j][3] >= 400 && s.steps[j][3] < 500) r++; return sum + r; }, 0);
  const dim = ramp(frame, END, 26, EASE.smooth);
  const headIn = ramp(frame, 6, 22, EASE.out);
  const agentsShown = Math.round(AGENTS * ramp(frame, 20, 90, EASE.out));
  const endIn = ramp(frame, END + 8, 24, EASE.out);
  return (
    <AbsoluteFill>
      <Stage look={L} vignette={0.5} grain={0.04}>
        {/* the header: what the tiles are, and the counts as they run */}
        <div style={{ position: 'absolute', left: X0, right: X0, top: 62, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', opacity: headIn * (1 - dim), fontFamily: FONT.sans }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.12em', color: GREEN }}>REAL TESTING · REPLAYED FROM THE LOGS</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: L.ink, letterSpacing: '-0.02em', marginTop: 6 }}>Every tile is one AI agent using Serve</div>
          </div>
          <div style={{ display: 'flex', gap: 44, textAlign: 'right' }}>
            {[[fmt(agentsShown), 'AI test agents'], [fmt(played), 'requests replayed'], [fmt(refused), 'refused on purpose']].map(([v, k]) => (
              <div key={k}><div style={{ fontSize: 40, fontWeight: 700, color: L.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</div><div style={{ fontSize: 14, color: L.ink2, marginTop: 2 }}>{k}</div></div>
            ))}
          </div>
        </div>
        {S.map((s, i) => <Tile key={i} s={s} i={i} frame={frame} dim={dim} />)}
        <div style={{ position: 'absolute', left: X0, top: Y0 + 11 * (TH + GAP) + 6, display: 'flex', gap: 22, fontFamily: FONT.sans, fontSize: 14, color: L.ink2, opacity: headIn * (1 - dim) }}>
          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: GREEN, marginRight: 7 }} />answered</span>
          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: AMBER, marginRight: 7 }} />refused on purpose: a limit, a clash, a permission</span>
          <span style={{ color: L.ink3 }}>{S.length} of the sessions shown, each in its own order and its own pace, side by side</span>
        </div>
        {/* the closing line: the real totals */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.sans, opacity: endIn, transform: `translateY(${mix(18, 0, endIn)}px)` }}>
          <div style={{ fontSize: 112, fontWeight: 800, color: L.ink, letterSpacing: '-0.045em', lineHeight: 1 }}>{AGENTS} AI agents.</div>
          <div style={{ fontSize: 112, fontWeight: 800, color: GREEN, letterSpacing: '-0.045em', lineHeight: 1.05 }}>{fmt(LOGGED)} real requests.</div>
          <div style={{ fontSize: 30, color: L.ink2, marginTop: 34 }}>25 rounds of testing. Every bug fixed, until a round came back clean.</div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
