#!/usr/bin/env bash
# The decision model's worker on the GPU server's CPU (no GPU): port 11447, models in ~/serve/jev/models.
# The CPU is shared (the 3090's Glimmer keeps part of its model on it, and the CPU guards run there), so the worker
# keeps to 8 threads at the lowest priority (nice 19). Safe to run again: a worker already listening is left alone.
# The gateway uses it with A2A_JEV=1 (JEV_URL=http://127.0.0.1:11447 is the default).
#   ~/serve/jev/code/serve.sh [gguf name] [threads, default 8] [options' order: time|listed, as trained]
set -u
J=~/serve/jev
G="${1:-serve-jev-1b-v3-Q4_K_M.gguf}"; T="${2:-8}"; O="${3:-time}"
ss -ltn | grep -q ":11447 " && { echo "decision worker already on :11447"; exit 0; }
cd "$J" && setsid -f nice -n 19 env CUDA_VISIBLE_DEVICES="" "$J/env/bin/python" code/worker.py --gguf "models/$G" --tokenizer models/official-3B --port 11447 --threads "$T" --order "$O" >> "$J/worker.log" 2>&1 < /dev/null
for i in $(seq 1 60); do curl -s -m 2 127.0.0.1:11447/health && { echo; exit 0; }; sleep 1; done
echo "the worker did not come up: $J/worker.log"; exit 1
