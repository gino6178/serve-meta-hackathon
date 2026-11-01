// Use of Meta's tooling, on one page: the fifteen Meta models Serve runs, grouped by job, each tagged with where it runs
// (our RTX 3090, the server's CPU, or the Meta Model API), plus the Meta frameworks and platform. The list is the
// README's "Meta models used and where each runs". Columns land one by one while the meta line plays.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp, softShadow } from '../demos/_fixtures/Polish';
import { LOOKS, Stage } from '../demos/_fixtures/Look';

export const META_MIN = 270;
const L = LOOKS.serve, GREEN = L.accent;
type Where = 'GPU' | 'CPU' | 'API' | '';
const TAG: Record<Where, { t: string; c: string; b: string }> = {
  GPU: { t: 'RTX 3090', c: '#0a7f44', b: '#e9f3ec' }, CPU: { t: 'CPU', c: '#5c5f66', b: '#f2f2f3' }, API: { t: 'Model API', c: '#1f6fd6', b: '#e8f0fb' }, '': { t: '', c: '', b: '' },
};
const COLS: { h: string; items: [string, Where, string?][] }[] = [
  { h: 'Agents', items: [['Muse Glimmer', 'GPU', 'every agent'], ['Llama 3.2 1B ×2', 'CPU', 'distilled by us'], ['Muse Spark 1.3', 'API', 'long calls, fallback']] },
  { h: 'Safety', items: [['Llama Guard 3', 'CPU'], ['Prompt Guard 2', 'CPU'], ['LlamaFirewall CodeShield', ''], ['Agents Rule of Two', '']] },
  { h: 'Voice and memory', items: [['Omnilingual ASR', 'CPU', 'voice notes'], ['Muse Voice Transcribe', 'API', 'live voice'], ['DRAMA', 'CPU', 'memory by meaning'], ['Messenger Platform', '']] },
  { h: 'Clips and vision', items: [['Sapiens2', 'GPU'], ['SAM 2.1', 'GPU'], ['MapAnything', 'GPU'], ['DETR', 'GPU'], ['SAM 3.1', 'API'], ['Muse Wonder', 'API'], ['Muse Image', 'API']] },
];

export const MetaStack: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.05 }} fill={null} grain={0.03} vignette={0.08}>
        <div style={{ position: 'absolute', left: 110, top: 64, fontFamily: FONT.sans, opacity: ramp(f, 0, 12, EASE.out) }}>
          <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: '0.14em', color: GREEN }}>BUILT ON META</div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', color: L.ink, marginTop: 6 }}>15 Meta models, each with a job</div>
        </div>
        <div style={{ position: 'absolute', left: 110, right: 110, top: 236, display: 'flex', gap: 26, fontFamily: FONT.sans }}>
          {COLS.map((c, ci) => {
            const at = 14 + ci * 26, t = ramp(f, at, 14, EASE.snappy);
            return (
              <div key={c.h} style={{ flex: 1, borderRadius: 24, background: '#ffffff', padding: '24px 24px 14px', boxShadow: softShadow(16), opacity: t, transform: `translateY(${mix(36, 0, t).toFixed(2)}px)` }}>
                <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '0.1em', color: L.ink2, textTransform: 'uppercase' }}>{c.h}</div>
                {c.items.map(([name, w, note], i) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderTop: i ? '1px solid rgba(0,0,0,0.06)' : 'none', marginTop: i ? 0 : 10, opacity: ramp(f, at + 6 + i * 4, 8, EASE.out) }}>
                    <div>
                      <div style={{ fontSize: 27, fontWeight: 700, color: L.ink, whiteSpace: 'nowrap' }}>{name}</div>
                      {note && <div style={{ fontSize: 19, color: L.ink2, marginTop: 2 }}>{note}</div>}
                    </div>
                    {w && <span style={{ flex: 'none', padding: '5px 12px', borderRadius: 999, fontSize: 18, fontWeight: 700, color: TAG[w].c, background: TAG[w].b }}>{TAG[w].t}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
