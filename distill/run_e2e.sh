#!/usr/bin/env bash
# The end-to-end evals with the student tier on and off, on the GPU server, from this branch's own copy of the agent
# (~/serve/jev/repo/agent, started with an empty data/). Muse Glimmer is a cloud A100 test endpoint by
# default (the same model, digest de878ce33ad8, http://127.0.0.1:11445, shared, 8 at once); the student is the worker
# on this server's CPU (distill/serve.sh, port 11447). On the 3090 (LLM_URL with port 11435) each eval holds the GPU lock
# (/tmp/serve-gpu.lock) and waits for other evals on it.
#   distill/run_e2e.sh <label> <student: on|off> [autopilot persona private ...]
set -u
LABEL="$1"; TIER="$2"; shift 2; WHICH="${*:-autopilot persona private}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd ~/serve/jev/repo/agent
export PATH=$HOME/.local/bin:$PATH
export EVAL_A2A=1 A2A_ROUTE=on LLM_URL="${LLM_URL:-http://127.0.0.1:11445/v1}"
case "$LLM_URL" in *11435*) export LLM_SLOTS=4; LOCK="flock /tmp/serve-gpu.lock bash $HERE/locked.sh";; *) export LLM_SLOTS="${LLM_SLOTS:-8}" EMBED_URL="${EMBED_URL:-${LLM_URL%/v1}}"; LOCK="";; esac
if [ "$TIER" = on ]; then export A2A_STUDENT=on A2A_STUDENT_URL="${A2A_STUDENT_URL:-http://127.0.0.1:11447}"; else export A2A_STUDENT=off; fi
mkdir -p data
echo "$(date +%FT%T) $LABEL student=$TIER LLM_URL=$LLM_URL LLM_SLOTS=$LLM_SLOTS sure=${A2A_STUDENT_SURE:-default}"
for e in $WHICH; do
  case $e in
    autopilot) LEDGER_FILE=data/eval-ledger-$LABEL.jsonl $LOCK node test/autopilot_eval.mjs "data/autopilot_eval_$LABEL.json" > "data/autopilot_$LABEL.log" 2>&1 ;;
    persona) PERSONA_ARMS=code LEDGER_FILE=data/persona-ledger-$LABEL.jsonl $LOCK node test/persona_eval.mjs "data/persona_eval_$LABEL.json" > "data/persona_$LABEL.log" 2>&1 ;;
    private) LEDGER_FILE=data/private-ledger-$LABEL.jsonl $LOCK node test/private_eval.mjs "data/private_eval_$LABEL.json" > "data/private_$LABEL.log" 2>&1 ;;
  esac
  echo "$(date +%FT%T) $e done"
done
echo "$(date +%FT%T) E2E_DONE $LABEL"
