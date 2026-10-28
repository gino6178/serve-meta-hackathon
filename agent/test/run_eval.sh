#!/usr/bin/env bash
# The Autopilot evaluation on the GPU server, detached; its rows go to /tmp/eval.log as each week finishes.
#   setsid -f ~/serve/agent/test/run_eval.sh
cd ~/serve/agent || exit 1
timeout 3600 ~/serve/node/bin/node test/autopilot_eval.mjs data/autopilot_eval.json 2>&1 | grep --line-buffered -v "^\[gateway\]" > /tmp/eval.log
echo EVAL_DONE >> /tmp/eval.log
