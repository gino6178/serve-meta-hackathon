#!/usr/bin/env bash
# The Messenger end-to-end test on the GPU server, detached; the log goes to /tmp/e2e.log and the conversation to
# data/pocket_transcript.json (the demo video's Messenger scene is built from it).
#   setsid -f ~/serve/agent/test/run_e2e.sh
cd ~/serve/agent || exit 1
timeout 1800 ~/serve/node/bin/node test/e2e.mjs data/pocket_transcript.json 2>&1 | grep --line-buffered -v "\[gateway\]" > /tmp/e2e.log
echo E2E_DONE >> /tmp/e2e.log
