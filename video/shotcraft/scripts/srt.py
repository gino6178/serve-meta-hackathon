"""Subtitles for upload (YouTube etc.), the same lines as the burned-in ones: python scripts/srt.py > out/serve-promo.en.srt"""
import json, os, re
lines = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'src', 'serve', 'narration.json'), encoding='utf8'))
def ts(t):
    ms = round(t * 1000); return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
n = 0
for l in lines:
    subs = []
    for s in l['subs']:  # a clause ending in ':' or ';' is shown with the one after it, as on screen
        if subs and re.search(r'[:;]$', subs[-1]['text']): subs[-1] = {'text': subs[-1]['text'] + ' ' + s['text'], 'start': subs[-1]['start'], 'end': s['end']}
        else: subs.append(dict(s))
    for i, s in enumerate(subs):
        end = subs[i + 1]['start'] if i + 1 < len(subs) else s['end'] + 0.4
        n += 1; print(f"{n}\n{ts(l['at'] + s['start'])} --> {ts(l['at'] + end)}\n{s['text']}\n")
