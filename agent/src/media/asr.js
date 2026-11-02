// Voice notes to text, on this server: Meta's Omnilingual ASR in a Python worker (agent/src/media/asr_worker.py) that stays
// loaded while notes come in and stops after ASR_IDLE_MIN minutes without one. The audio (a Messenger voice clip is
// MP4/AAC; the app records WebM/Opus) is turned into 16 kHz mono WAV by ffmpeg first. Audio and the WAV are deleted
// once read; only the words are kept, and the player sees them ("I heard: ...") before anything is filed.
//   ASR_PYTHON  the worker's Python (default ~/serve/asr/env/bin/python)
//   ASR_MODEL   the model card (default omniASR_CTC_1B), ASR_DEVICE cpu (default) or cuda
//   ASR_DENOISE off skips the light denoiser ffmpeg runs on the app's clips (docs/web_features.md has what it changes)
import {execFile} from 'node:child_process';
import {pyWorker} from '../core/worker.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {record} from '../core/ledger.js';

const PY =
  process.env.ASR_PYTHON || path.join(os.homedir(), 'serve/asr/env/bin/python');
const WORKER = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  './asr_worker.py',
);
const IDLE = +(process.env.ASR_IDLE_MIN || 10) * 60000,
  MAX_SECONDS = 120;
let idle = null;
// the worker (core/worker.js): it says {"ready": true} once the model is loaded, then answers each clip by its id
const omni = pyWorker({
  name: 'the speech worker',
  byId: true,
  readyLine: true,
  stderr: 'ignore', // the model's own logging
  spec: () => ({python: PY, args: [WORKER], env: {PYTHONUNBUFFERED: '1'}}),
});
export const available = () => fs.existsSync(PY) && fs.existsSync(WORKER);
const start = () => omni.start();
// a light denoiser (a high-pass, then non-local means) before the model, for the app's clips: through the app in
// Chrome it took the words wrong on our six test requests from 19% to 13.5%, and with pink noise about 21 dB under the
// voice from 46% to 10%, for about 0.25 s of CPU per 3 s of audio. Messenger's voice notes go without it (on the e2e's
// clean note it heard "right" as "rihp")
const DENOISE = ['-af', 'highpass=f=90,anlmdn=s=0.0015'];
const ffmpeg = (src, dst, denoise) =>
  new Promise((ok, fail) =>
    execFile(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-i',
        src,
        '-t',
        String(MAX_SECONDS),
        ...(denoise ? DENOISE : []),
        '-ac',
        '1',
        '-ar',
        '16000',
        '-f',
        'wav',
        dst,
      ],
      {timeout: 60000},
      e =>
        e
          ? fail(
              new Error(
                `could not read the audio (${e.message.split('\n')[0]})`,
              ),
            )
          : ok(),
    ),
  );
const rest = () => {
  clearTimeout(idle);
  idle = setTimeout(() => omni.stop(), IDLE);
};

// load the model ahead of a clip (the app asks when its mic opens, so the first clip does not wait the ~9 s the model
// takes to load); false when there is no model on this server
export function warm() {
  if (!available()) return false;
  start().then(rest, () => {});
  return true;
}

// audio bytes -> { text, seconds }. Each one is a row in the token ledger (site, the model, the seconds it took and
// how long the audio was; no words), like the guards' checks. denoise: the light denoiser first (ASR_DENOISE=off: never)
export async function transcribe(
  bytes,
  {lang = null, site = 'asr', denoise = false} = {},
) {
  denoise &&= process.env.ASR_DENOISE !== 'off';
  if (!available())
    throw new Error('speech to text is not set up on this server');
  const id = crypto.randomUUID(),
    src = path.join(os.tmpdir(), `serve-voice-${id}`),
    wav = `${src}.wav`,
    t0 = Date.now();
  fs.writeFileSync(src, bytes);
  try {
    await ffmpeg(src, wav, denoise);
    const audioSeconds = +(
      Math.max(0, fs.statSync(wav).size - 44) / 32000
    ).toFixed(2); // 16 kHz, 16-bit mono
    await start();
    clearTimeout(idle);
    // a clip the worker never answers fails after ASR_TIMEOUT_S (300 s), rather than waiting forever
    const r = await omni.call(
      {path: wav, lang},
      {timeoutMs: +(process.env.ASR_TIMEOUT_S || 300) * 1000},
    );
    if (r.error) throw new Error(r.error);
    record({
      site,
      model: process.env.ASR_MODEL || 'omniASR_CTC_1B',
      prompt: 0,
      cached: 0,
      output: 0,
      reasoning: 0,
      seconds: r.seconds,
      total: +((Date.now() - t0) / 1000).toFixed(2),
      audioSeconds,
      lang,
      denoised: denoise,
      marker: true,
    });
    return {text: r.text, seconds: r.seconds, audioSeconds};
  } finally {
    fs.rmSync(src, {force: true});
    fs.rmSync(wav, {force: true});
    rest();
  }
}
