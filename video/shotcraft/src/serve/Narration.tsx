// The English narration and its burned-in subtitles. narration.json comes from scripts/tts_lines.py (Kokoro, one
// sentence at a time): each line's start in the film and each sentence's time inside it. A subtitle stays up until
// the next sentence starts, or a short beat after its own end, so it never flickers between sentences.
import React from 'react';
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FONT } from '../demos/_fixtures/Polish';
import LINES from './narration.json';

const FPS = 30;
// the voice pauses at a colon, the subtitle does not: a clause ending in ':' or ';' is shown with the one after it
const merged = (subs: { text: string; start: number; end: number }[]) => subs.reduce<typeof subs>((out, s) => {
  const last = out[out.length - 1];
  if (last && /[:;]$/.test(last.text)) out[out.length - 1] = { text: `${last.text} ${s.text}`, start: last.start, end: s.end };
  else out.push({ ...s });
  return out;
}, []);
export const SUBS = LINES.flatMap((l) => {
  const subs = merged(l.subs);
  return subs.map((s, i) => {
    const next = subs[i + 1];
    return { text: s.text, from: Math.round((l.at + s.start) * FPS), to: Math.round((l.at + (next ? next.start : s.end + 0.4)) * FPS) };
  });
});
// how much a line is speaking (for ducking the music under it)
const on = (f: number) => LINES.some((l) => f >= l.at * FPS - 6 && f <= (l.at + l.dur) * FPS + 6);
// 0..1, eased over 16 frames either side, so the music slides down and back up instead of stepping
export const speaking = (f: number) => { let n = 0; for (let d = -8; d <= 8; d++) n += on(f + d) ? 1 : 0; return n / 17; };

const Sub: React.FC<{ text: string; dur: number; bottom: number }> = ({ text, dur, bottom }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, dur - 4, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ maxWidth: 1480, padding: '10px 26px', borderRadius: 14, background: 'rgba(10,10,11,0.78)', color: '#ffffff',
        fontFamily: FONT.sans, fontSize: 38, fontWeight: 600, lineHeight: 1.28, textAlign: 'center', letterSpacing: '-0.01em' }}>
        {text}
      </div>
    </div>
  );
};

// inside the live frame the subtitle sits just above the caption band; elsewhere it sits low, clear of the shot
export const Narration: React.FC<{ voice: boolean; subs: boolean; live: [number, number] }> = ({ voice, subs, live }) => (
  <>
    {voice && LINES.map((l, i) => (
      <Sequence key={`v${i}`} from={Math.round(l.at * FPS)} durationInFrames={Math.ceil(l.dur * FPS) + 6}>
        <Audio src={staticFile(`narration/n${i}.wav`)} volume={1} />
      </Sequence>
    ))}
    {subs && SUBS.map((s, i) => (
      <Sequence key={`s${i}`} from={s.from} durationInFrames={s.to - s.from}>
        <Sub text={s.text} dur={s.to - s.from} bottom={s.from >= live[0] && s.from < live[1] ? 136 : 44} />
      </Sequence>
    ))}
  </>
);
