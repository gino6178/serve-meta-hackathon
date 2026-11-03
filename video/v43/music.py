"""A light background bed for the video, made from plain synth notes (no samples): plucked arpeggios over
I-V-vi-IV in C, a soft bass and a quiet tick. python music.py seconds out.wav"""
import sys, numpy as np
from scipy.io import wavfile
T, out = float(sys.argv[1]), sys.argv[2]
sr, bpm = 44100, 104
beat = 60 / bpm
n = int(T * sr)
mix = np.zeros(n)
def note(f, t0, d, amp, decay, harm=(1, .35, .12)):
    i0 = int(t0 * sr); m = min(n - i0, int(d * sr))
    if m <= 0: return
    t = np.arange(m) / sr
    w = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in zip((1, 2, 3), harm))
    env = np.exp(-t * decay) * np.minimum(1, t / .004)
    mix[i0:i0 + m] += amp * w * env
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]
bass = [36, 43, 45, 41]
pat = [0, 2, 1, 3, 2, 1, 3, 2]
bar = 4 * beat
t = 0.0; b = 0
while t < T:
    c = chords[b % 4]
    for i, p in enumerate(pat):
        note(hz(c[p] + 12), t + i * beat / 2, .6, .10, 6.5)
    for i in range(4):
        note(hz(bass[b % 4]), t + i * beat, beat * .95, .16, 3.0, (1, .2, .05))
    for i in range(8):
        i0 = int((t + i * beat / 2 + beat / 4) * sr); m = min(n - i0, int(.03 * sr))
        if m > 0: mix[i0:i0 + m] += .025 * np.random.randn(m) * np.exp(-np.arange(m) / sr * 160)
    t += bar; b += 1
mix = np.convolve(mix, np.ones(6) / 6, mode='same')
fi, fo = int(1.5 * sr), int(3.5 * sr)
mix[:fi] *= np.linspace(0, 1, fi); mix[-fo:] *= np.linspace(1, 0, fo)
mix /= np.abs(mix).max() + 1e-9
wavfile.write(out, sr, (np.stack([mix, mix], 1) * .8 * 32767).astype(np.int16))
