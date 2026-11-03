"""Join build/s0..s16.mp4, lay each scene's narration at the scene's own first frame, mix in the music bed under it,
and write Serve_v4.3.mp4."""
import json, subprocess, numpy as np
from scipy.io import wavfile
FPS = 30
js = open('stage/timings.js', encoding='utf-8').read()
WAV = json.loads(js.split('window.WAV=')[1].rstrip(';\n'))
dur = [2.0] + [0.15 + w + (2.2 if i == 15 else 0) for i, w in enumerate(WAV)]
frames = [round(d * FPS) for d in dur]
start = np.cumsum([0] + frames[:-1]) / FPS
total = sum(frames) / FPS
sr = 24000
v = np.zeros(int(total * sr) + sr, np.float32)
for i in range(1, 17):
    r, a = wavfile.read(f'audio/k{i}.wav')
    a = a.astype(np.float32) / (32767 if a.dtype == np.int16 else 1)
    o = int((start[i] + 0.15) * sr)
    v[o:o + len(a)] += a
wavfile.write('build/voice.wav', sr, (np.clip(v, -1, 1) * 32767).astype(np.int16))
open('build/list.txt', 'w').write(''.join(f"file 's{k}.mp4'\n" for k in range(17)))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'build/list.txt', '-c', 'copy', 'build/video_only.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/video_only.mp4', '-i', 'build/voice.wav', '-i', 'build/music.wav',
  '-filter_complex', '[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[vo1][vo2];[2:a]aresample=48000,volume=0.07[mu];[mu][vo1]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=400[duck];[duck][vo2]amix=inputs=2:normalize=0[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', f'{total:.3f}', '-movflags', '+faststart', 'Serve_v4.3.mp4'], check=True)
print(f'{total:.2f} s', frames)
