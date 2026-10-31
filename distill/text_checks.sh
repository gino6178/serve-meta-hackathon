#!/usr/bin/env bash
# The end-to-end test and both red teams with the short-text 1B on the small tier, on copies of the gateway in the
# experiment folder, against an Ollama of their own (never the live one): Glimmer and the 1B on one server, as llm.js
# expects (LLM_URL serves both).
#   distill/text_checks.sh <experiment dir> <label> <small model> <sites>
# Logs go to <experiment dir>/checks/<label>/; the e2e runs in one copy, the red teams one after the other in another.
set -u
EXP="$1"; LABEL="$2"; SMALL="$3"; SITES="$4"
OUT="$EXP/checks/$LABEL"; mkdir -p "$OUT"
export PATH="${NODE_DIR:-$HOME/serve/node/bin}:$PATH" LLM_URL="${LLM_URL:-http://127.0.0.1:11460/v1}" LLM_MODEL=muse-glimmer LLM_SMALL_MODEL="$SMALL" LLM_SMALL_SITES="$SITES"
export GUARD_PYTHON="${GUARD_PYTHON:-/home/gino/serve/asr/env/bin/python}" GUARD_HF_CACHE="${GUARD_HF_CACHE:-/mnt/nas/shuttlecoach-meta/hf}" EMBED_URL="${EMBED_URL:-http://127.0.0.1:11434}"
for c in e2e rt; do rm -rf "$EXP/gw-$LABEL-$c"; mkdir -p "$EXP/gw-$LABEL-$c"; cp -r "$EXP/repo/agent" "$EXP/repo/web" "$EXP/repo/distill" "$EXP/gw-$LABEL-$c/"; done
echo "$(date +%T) $LABEL small=$SMALL sites=$SITES" > "$OUT/env.txt"
( cd "$EXP/gw-$LABEL-e2e/agent" && GW_PORT=18889 GRAPH_PORT=18896 timeout 2400 node test/e2e.mjs > "$OUT/e2e.log" 2>&1; echo "E2E_EXIT $?" >> "$OUT/e2e.log"; cp data/test-ledger.jsonl "$OUT/e2e_ledger.jsonl" 2>/dev/null ) &
( cd "$EXP/gw-$LABEL-rt/agent" && timeout 1800 node test/feed_redteam.mjs > "$OUT/feed_redteam.log" 2>&1; echo "FEED_RT_EXIT $?" >> "$OUT/feed_redteam.log"
  timeout 2400 node test/redteam.mjs > "$OUT/redteam.log" 2>&1; echo "RT_EXIT $?" >> "$OUT/redteam.log"; cp data/redteam.json data/redteam/ledger.jsonl "$OUT/" 2>/dev/null ) &
wait
echo CHECKS_DONE >> "$OUT/env.txt"
