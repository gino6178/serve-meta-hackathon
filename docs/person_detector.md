# The person detector in the highlight reel

`video/pose/reel.py` finds the people in an uploaded video before anything else: a detector gives the person boxes on
every second frame, and the IoU tracker after it picks you (the largest track that lasts) and the other player.
The detector is now swappable; everything after it is untouched.

| `PERSON_DETECTOR` | Model | Licence | Status |
|---|---|---|---|
| `detr` (**default**) | [facebook/detr-resnet-50](https://huggingface.co/facebook/detr-resnet-50), revision `no_timm` | Apache 2.0 | What the reel has always used, measured on the server. Its code repository (facebookresearch/detr) is archived; the Transformers port is what we use. |
| `rtdetr` (opt-in) | [PekingU/rtdetr_v2_r50vd](https://huggingface.co/PekingU/rtdetr_v2_r50vd) (RT-DETRv2, ResNet-50) through `AutoModelForObjectDetection` | Apache 2.0 (Hugging Face licence tag, checked 2026-10-30) | Code path written, **not yet run anywhere** |

Other settings:
- `PERSON_DETECTOR_MODEL`: another checkpoint of the RT-DETR family, e.g. `PekingU/rtdetr_r50vd` (RT-DETR v1, also
  Apache 2.0 on Hugging Face). Only read with `rtdetr`.
- `PERSON_THRESHOLD`: the score a box needs (default 0.8, as before). Any other `PERSON_DETECTOR` value stops the reel
  with a message.

**The contract.** Both detectors go through the image processor's `post_process_object_detection` with the same
threshold and the reel's frame size, and keep the boxes whose label is COCO's `person`. The result is the same shape
as before: per frame, `[[x0, y0, x1, y1], ...]` in the reel's pixels.

**Why DETR stays the default.** RT-DETR could not be run here: the machine this change was made on has no
`transformers` installed (`python -c "import torch, transformers"` fails), and the GPU server was not to be used, so
no frames were compared. One thing to check when it runs: DETR's scores are a softmax over classes and RT-DETR's are
per-class sigmoids, so the same 0.8 need not keep the same people. Before making `rtdetr` the default:
1. Run both on the three sample clips (`web/public/media/samples/`) with the same frames, e.g. `ffmpeg -i
   singles_point_01.mp4 -vf "select=not(mod(n\,30))" -vsync 0 f_%03d.png`, and compare per frame the number of
   person boxes, the IoU of matched boxes, and the time per batch of 8.
2. Check the reel's tracks: the same "you" and "other" on each clip, and the "Found you" step's frame count.
3. If RT-DETR keeps spectators or drops far players at 0.8, set `PERSON_THRESHOLD` from step 1 and record it here.

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
