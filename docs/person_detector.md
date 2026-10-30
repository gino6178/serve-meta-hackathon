# The person detector in the highlight reel

`video/pose/reel.py` finds the people in an uploaded video before anything else: a detector gives the person boxes on
every second frame, and the IoU tracker after it picks you (the largest track that lasts) and the other player.
The detector is now swappable; everything after it is untouched.

| `PERSON_DETECTOR` | Model | Licence | Status |
|---|---|---|---|
| `rtdetr` (**default** since 2026-10-30) | [PekingU/rtdetr_v2_r50vd](https://huggingface.co/PekingU/rtdetr_v2_r50vd) (RT-DETRv2, ResNet-50) through `AutoModelForObjectDetection` | Apache 2.0 (Hugging Face licence tag, checked 2026-10-30) | Measured on the server 2026-10-30 (below): better on the three sample clips at 0.8, and the default |
| `detr` (selectable) | [facebook/detr-resnet-50](https://huggingface.co/facebook/detr-resnet-50), revision `no_timm` | Apache 2.0 | What the reel used until 2026-10-30. Its code repository (facebookresearch/detr) is archived; the Transformers port is what we use. |

Other settings:
- `PERSON_DETECTOR_MODEL`: the RT-DETR checkpoint, a local folder or a Hugging Face id (e.g. `PekingU/rtdetr_r50vd`,
  RT-DETR v1, also Apache 2.0). Only read with `rtdetr`. Unset, the reel uses the server's stable copy,
  `/mnt/nas/serve-models/rtdetr_v2_r50vd` (`RTDETR_LOCAL` moves it), when that folder has a `config.json`, and
  otherwise the Hugging Face id `PekingU/rtdetr_v2_r50vd`, downloaded into the HF cache.
- **The weights on the GPU server** are in `/mnt/nas/serve-models/rtdetr_v2_r50vd` (config, preprocessor config,
  README and `model.safetensors`, 172 MB, SHA-256 `3331d977…541d88d71`), copied from the test download in
  `/mnt/nas/serve-test-logs/hf/`. They are a folder of their own on the NAS, not in the shared HF cache, so no other
  model's cache is touched, and nothing goes on the server's root disk (which is nearly full).
- `PERSON_THRESHOLD`: the score a box needs (default 0.8, as before). Any other `PERSON_DETECTOR` value stops the reel
  with a message.

**The contract.** Both detectors go through the image processor's `post_process_object_detection` with the same
threshold and the reel's frame size, and keep the boxes whose label is COCO's `person`. The result is the same shape
as before: per frame, `[[x0, y0, x1, y1], ...]` in the reel's pixels.

**Why RT-DETR became the default.** It was measured on the server (next section) and did better on all three sample
clips at 0.8; it is the default since 2026-10-30, with DETR one setting away (`PERSON_DETECTOR=detr`). DETR's scores
are a softmax over classes and RT-DETR's are per-class sigmoids, so the same 0.8 need not keep the same people; the
checks that were done before the switch, and that are worth repeating on new footage:
1. Run both on the three sample clips (`web/public/media/samples/`) with the same frames, e.g. `ffmpeg -i
   singles_point_01.mp4 -vf "select=not(mod(n\,30))" -vsync 0 f_%03d.png`, and compare per frame the number of
   person boxes, the IoU of matched boxes, and the time per batch of 8.
2. Check the reel's tracks: the same "you" and "other" on each clip, and the "Found you" step's frame count.
3. If RT-DETR keeps spectators or drops far players at 0.8, set `PERSON_THRESHOLD` from step 1 and record it here.

## Measured (2026-10-30, GPU server, GPU 0, nice 19)

`video/pose/reel.py` as deployed (`~/serve/video/pose`, same bytes as this repository), run the way the gateway runs it
(`REEL_PYTHON`, `HF_HUB_CACHE` from `start.env`), on the three CC BY sample clips (1280×720, 30 fps; the reel works at
960×540 on every second frame). RT-DETR is `PekingU/rtdetr_v2_r50vd`, passed as a local copy through
`PERSON_DETECTOR_MODEL`. Logs, JSON and contact sheets: `/mnt/nas/serve-test-logs/video/`.

**Person boxes per frame** (mean over the reel's frames; in brackets, the boxes big enough for the tracker, ≥0.4% of
the frame). Every clip has spectators in view, so most boxes are not players.

| Clip (frames read) | DETR 0.8 | RT-DETR 0.8 | RT-DETR 0.7 | RT-DETR 0.6 | RT-DETR 0.5 |
|---|---|---|---|---|---|
| singles_point_01 (361) | 15.2 (9.5) | 4.6 (4.4) | 7.4 (6.3) | 9.9 (7.5) | 13.8 (9.0) |
| doubles_rally_01 (330) | 18.9 (17.3) | 3.8 (3.8) | 10.2 (10.2) | 13.3 (13.0) | 15.1 (14.4) |
| singles_rally_01 (330) | 20.4 (14.8) | 4.0 (4.0) | 10.3 (8.1) | 14.7 (11.8) | 18.4 (13.9) |

Where both find the same person the boxes agree (median IoU 0.88–0.92). RT-DETR at 0.8 has a frame with fewer than
two big boxes 5 times on singles_point and 12 times on singles_rally; at 0.7 and below, never.

**The tracks and the moment** (players checked by eye on contact sheets at three frames per clip):

| Clip | DETR 0.8 | RT-DETR 0.8 | RT-DETR 0.5–0.7 |
|---|---|---|---|
| singles_point_01 | you: the player in pink. other: a bystander by the wall (the opponent is never tracked). Moment 5.9 s | Same you (393/393 frames agree), same other, same moment 5.9 s | Same you and moment; at 0.5–0.6 the other is a seated official instead |
| doubles_rally_01 | you: near player. other: a seated spectator. Moment 14.73 s | Same you (363/363), **other: your partner** (226 of 368 frames). Same moment | Same you and moment; the other is the seated spectator again |
| singles_rally_01 | **you: a spectator in the front row**; no smash found, the reel uses the whole clip | **you: the player in blue**; smash at 2.97 s. The other is a spectator (the far player is never tracked) | Same as 0.8 |

**Time.** The detector alone, per batch of 8 frames: DETR 0.38–0.40 s, RT-DETR 0.19–0.22 s (about 2× faster).
The whole reel (models loading, Sapiens2 and SAM 2.1 included), wall time:

| Clip | DETR | RT-DETR 0.8 | 0.7 | 0.6 | 0.5 |
|---|---|---|---|---|---|
| singles_point_01 | 153 s | 146 s | 153 s | 153 s | 168 s |
| doubles_rally_01 | 209 s | 166 s | 192 s | 191 s | 180 s |
| singles_rally_01 | 168 s | 139 s | 195 s | 192 s | 185 s |

The same DETR run twice gave the same frames and moment.

**Verdict.** On these three clips RT-DETR at 0.8 is better: it fixes the one clip where DETR picked a spectator as
"you" (and so found no smash), it picks the real partner as the other player in doubles, it keeps the same "you" and
moment on the other two clips, and it is faster. Keep 0.8 for RT-DETR: 0.5–0.7 bring back the seated spectators as the
other player and gain nothing for "you". Its weak point is fewer boxes per frame (the partner is missing on 142 of
368 frames in doubles, and a few frames have under two big boxes). Three clips from two venues is a small sample, so
the recommendation was to make `rtdetr` the default after one more clip with a far player in view. It was made the
default on 2026-10-30 without that clip (the decision was taken on these three), so a clip with a far player is
still worth running.

### The rally clip in the same session (`BALL_TRACKING=1 RALLY_CLIP=1`, DETR unless noted)

What it took to run, none of it in the deployed setup at the time (all fixed on 2026-10-30, next section):
- `~/serve/video/pose` has only `reel.py` and `ball.py`; `ball.py` imports `exists.py`, so the shuttle is "not tracked"
  (`No module named 'exists'`). Run from a NAS copy with this repository's `exists.py`.
- The reel's Python (`isaac`) has no `parse`, which TrackNetV5 imports; `BALL_PYTHON=~/serve/orbit/venv/bin/python`
  works. `start.sh` does not set `BALL_PYTHON`.
- TrackNetV5 ran out of GPU memory inside the reel (the reel process still holds 13.6 GB of cached model memory on the
  24 GB card). Adding `torch.cuda.empty_cache()` before step 5 (test copy only) fixed it; each ball run took 290–325 s.
- The gateway's `REEL_SCRIPT` is `~/serve/pose/reel.py`, an older copy without `PERSON_DETECTOR` or `RALLY_CLIP`.

Clips against the frames (rally times by eye, from contact sheets every 0.5–2 s):

| Clip | Moment | `clip` in–out | Rally by eye | Verdict |
|---|---|---|---|---|
| singles_point_01 (phone follows the player) | 5.9 s | 5.1–9.7 s | about 3–19 s | Moment inside; out far too early: a 1.5 s gap in the track (9.3–10.8 s) ends the stretch. Several "on" points are not the shuttle |
| doubles_rally_01 | 14.7 s | 12.4–21.7 s | play from about 3 s to about 21 s | Out right (rally end 21.3 s). In late: gaps over 1 s at 9–10.5 s and 11.6–12.7 s |
| singles_rally_01, DETR | none | no clip (no smash, see above) | 0–15 s | Correctly omitted |
| singles_rally_01, RT-DETR 0.8 | 3.0 s | 0.0–15.7 s | 0–15 s (the player is off court by 16.5 s) | Right |

Without `RALLY_CLIP` the output is unchanged: on each clip the `BALL_TRACKING=1` run and the
`BALL_TRACKING=1 RALLY_CLIP=1` run are identical once `clip` is removed, the run without the flag has no `clip` key,
and the frames match the run without ball tracking (the moment moves only where the ball's hit is meant to move it:
doubles 14.73 s to 14.67 s).

## Deployed and measured again (2026-10-30/31, GPU server, GPU 0, nice 19)

**What changed on the server.**
- **The gateway runs `~/serve/video/pose/reel.py`.** The cause was `ops/start.sh` (and `tenants.sh`), which set
  `REEL_SCRIPT="$ROOT/pose/reel.py"`. They now default it to `$ROOT/video/pose/reel.py` (`REEL_SCRIPT` in the
  environment still overrides), and `agent/src/media/reel.js` falls back to the checkout's `video/pose/reel.py` when
  `REEL_SCRIPT` is unset. The live gateway's environment was checked after the restart. The old `~/serve/pose/` is left
  in place, unused. The tenants proxy was not restarted, so players' own gateways keep the old path until
  `tenants.sh proxy` is run.
- **`~/serve/video/pose` is the whole repository folder** (`exists.py`, `orbit*.py`, `labels/`, ...), the same bytes as
  this commit. The two files that were there before are backed up in
  `/mnt/nas/serve-test-logs/backup-video-20261030-2351/`, with `start.sh`, `tenants.sh`, `start.env` and the agent files.
- **The ball tracker's Python.** `parse` 1.22.4 is now installed in the reel's environment (`isaac`, 21 kB). That is
  not enough: TrackNetV5 also needs `pandas` and `pycocotools`, which `isaac` lacks, and the root disk has no room for
  `pandas`. So `start.sh` now sets `BALL_PYTHON` to `~/serve/orbit/venv/bin/python`, which has all of them, and
  `start.env` sets `BALL_WEIGHTS=/mnt/nas/shuttlecoach-meta/weights` (`ball.py`'s default, `/mnt/nas/serve/weights`,
  does not exist on this server).
- **GPU memory.** With `BALL_TRACKING=1` the reel deletes its detector, Sapiens2 and SAM 2.1 and empties the CUDA cache
  before the tracker's process starts. The ball now runs inside the deployed reel: no out-of-memory error on any clip.
- **RT-DETR is the default**, from `/mnt/nas/serve-models/rtdetr_v2_r50vd`. `BALL_TRACKING` and `RALLY_CLIP` stay off
  in the gateway.

**Measured.** `~/serve/video/pose/reel.py` with no detector settings, run the way the gateway runs it (`start.env`,
`REEL_PYTHON`, `HF_HUB_CACHE`, `BALL_PYTHON` as `start.sh` sets it), on the three sample clips. Logs and JSON:
`/mnt/nas/serve-test-logs/video2/`.

| Clip | Default run | Same as the last session's RT-DETR 0.8 run (checked by eye) | Wall time | With `BALL_TRACKING=1 RALLY_CLIP=1` |
|---|---|---|---|---|
| singles_point_01 | you: the player in pink; moment 5.9 s | identical frames (399 for you, 95 for the other) | 137 s | 324 s; 257 shuttle frames; clip 0.0–23.7 s |
| doubles_rally_01 | you: near player; other: your partner; moment 14.73 s | identical (368 / 226) | 147 s | 297 s; moment moves to the ball's hit, 14.67 s; clip 2.0–21.7 s |
| singles_rally_01 | you: the player in blue; moment 2.97 s | identical (252 / 244) | 133 s | 273 s; clip 0.0–21.3 s |

The default run gives the right player on all three clips, and the frames are identical to the earlier opt-in run.
That also confirms the NAS copy of the weights is the checkpoint measured before. With the ball, the frames are
identical to the run without it. For the rally clips, see `docs/ball_tracking.md`.

## Licence checks still to do

- **Sapiens2** (`facebook/sapiens2-pose-0.4b`, pose in every reel) is under Meta's own Sapiens licence, not an
  open-source one. Read its terms for commercial use before Serve is offered commercially, and record the answer
  here and in `CREDITS.md`.
- **TrackNetV3** (`qaz812345/TrackNetV3`): `docs/ball_tracking.md` lists it as MIT, but whether that covers the
  checkpoints (hosted on Google Drive, trained on the badminton dataset of the TrackNet authors) is unclear. It is not
  used (TrackNetV5 replaced it, and its zip sits unused in the NAS cache); confirm before it is ever used, or delete
  the zip.
- RT-DETRv2: the Apache 2.0 tag is from the Hugging Face model page; the weights were trained on COCO, whose images
  carry their own Flickr licences. Same situation as DETR.
