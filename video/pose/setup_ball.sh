#!/bin/bash
# The ball trackers for the highlight pipeline (ball.py): not ours, fetched here, never committed. Nothing here runs
# their code: it checks out pinned commits outside this repository and puts the weights in the NAS cache, checked
# against the SHA-256 we recorded.
#   badminton: TrackNetV5, Run-Lin Chang, Yu-Shuen Wang and Jiun-Long Huang, ICIP 2026,
#              https://github.com/gino6178/TrackNetV5 (the user's own earlier published work; no LICENSE file).
#              Its weights ship in the repository (releases/).
#   tennis, basketball: WASB, Tarashima, Haq, Wang and Tagawa (NTT), BMVC 2023, https://github.com/nttcom/WASB-SBDT
#              (MIT code; the weights' own licence is not stated, and they were trained on broadcast footage).
#              Weights from the Google Drive links in the repository's MODEL_ZOO.md (setup_weights.sh's names).
#   sh setup_ball.sh [code_dir] [weights_dir]
# Then for reel.py: BALL_TRACKING=1, and BALL_PYTHON (a Python with torch, numpy, opencv, pandas, parse, pycocotools,
# Pillow and tqdm). ops/start.sh sets BALL_PYTHON to orbit/venv/bin/python, which has them; the reel's own Python on
# the GPU server lacks pandas and pycocotools (parse 1.22.4 was added to it), and the root disk has no room for pandas.
set -e
CODE=${1:-$HOME/serve/orbit/third_party}
WEIGHTS=${2:-/mnt/nas/serve/weights}
V5=9116161772183e841bd1b51d6747c70f269b8b1c
WASB=923462cacdeb3353b84ddebdedb3f4b7a8553b0f

check() { echo "$1  $2" | sha256sum -c --status; }
mkdir -p "$CODE" "$WEIGHTS/tracknetv5" "$WEIGHTS/wasb"
[ -d "$CODE/TrackNetV5/.git" ] || git clone -q https://github.com/gino6178/TrackNetV5.git "$CODE/TrackNetV5"
git -C "$CODE/TrackNetV5" fetch -q origin && git -C "$CODE/TrackNetV5" checkout -q "$V5"
[ -d "$CODE/WASB-SBDT/.git" ] || git clone -q https://github.com/nttcom/WASB-SBDT.git "$CODE/WASB-SBDT"
git -C "$CODE/WASB-SBDT" fetch -q origin && git -C "$CODE/WASB-SBDT" checkout -q "$WASB"

for f in "TrackNetV5_best.pt cf9025285cdcd3089229a45a19ed8ed4075f6a4f459cbf99e450b1f968f7198d" \
         "TrackNetV5_Lite_best.pt c7ca025e5117d292f9efa60b3132d401434ca1afe26aba9353133ad2823e7a07"; do
  set -- $f
  check "$2" "$WEIGHTS/tracknetv5/$1" || cp "$CODE/TrackNetV5/releases/$1" "$WEIGHTS/tracknetv5/$1"
  check "$2" "$WEIGHTS/tracknetv5/$1" || { echo "checksum failed: $1"; exit 1; }
done
for f in "wasb_tennis_best.pth.tar 14AeyIOCQ2UaQmbZLNQJa1H_eSwxUXk7z 9d391239ab10c733f8e5bfadf16ab72838e7a8ebc88e8ae2038501c03d42b4bb" \
         "wasb_basketball_best.pth.tar 1nfECuSyJvPUmz3njZCdFERSQQbERt8FU 8d1ba9870d0a6ab37b06ab82bed593c6c09133e713810bac475d0c000bb7e948"; do
  set -- $f
  check "$3" "$WEIGHTS/wasb/$1" || python3 -m gdown --quiet "https://drive.google.com/uc?id=$2" -O "$WEIGHTS/wasb/$1"
  check "$3" "$WEIGHTS/wasb/$1" || { echo "checksum failed: $1"; exit 1; }
done
ls -la "$WEIGHTS/tracknetv5" "$WEIGHTS/wasb"
