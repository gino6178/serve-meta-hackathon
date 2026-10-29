#!/usr/bin/env bash
# Invited players on the web: the tenants proxy (agent/src/tenants/proxy.js) on 127.0.0.1:8796, in front of the club's
# gateway (:8790, start.sh) and each player's own gateway, and a Cloudflare tunnel that publishes it. It serves the
# public build of the web app from web/dist (built with VITE_AGENT_URL=/ and no token).
#   ~/serve/tenants.sh          start the proxy and the tunnel (prints the public address)
#   ~/serve/tenants.sh stop     stop both, and every player's gateway with the proxy
#   ~/serve/tenants.sh url      print the public address again
#   ~/serve/tenants.sh proxy    restart the proxy only (the tunnel, and so the address, stay)
set -o nounset
ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$ROOT/start.env" ]; then . "$ROOT/start.env"; fi
NODE_BIN="${NODE_BIN:-node}" CLOUDFLARED="${CLOUDFLARED:-$HOME/bin/cloudflared}"
LOG="$ROOT/tenants.log" TUNNEL_LOG="$ROOT/tenants-tunnel.log"
url() { grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1; }
if [ "${1:-}" = "url" ]; then url; exit 0; fi
if [ "${1:-}" = "proxy" ]; then pkill -f "[t]enants/proxy.js"; sleep 1; fi
if [ "${1:-}" = "stop" ]; then
  pkill -f "[t]enants/proxy.js"; pkill -f "[c]loudflared tunnel --no-autoupdate --url http://127.0.0.1:8796"
  echo "stopped the tenants proxy and its tunnel"; exit 0
fi
if ! ss -Hltn "sport = :8796" | grep -q .; then
  (
    cd "$ROOT/agent" || exit 1
    # what each player's gateway runs with: the same as the club's gateway in start.sh
    export LLM_URL=http://127.0.0.1:11435/v1 LLM_MODEL=muse-glimmer LLM_DEVICE="RTX 3090 (CUDA)" EMBED_URL=http://127.0.0.1:11434
    export LLM_FALLBACK="${LLM_FALLBACK:-on}" VOICE_TTS_PYTHON="${VOICE_TTS_PYTHON:-$HOME/shuttlecoach/tts/env/bin/python}" VOICE_TTS_MODELS="${VOICE_TTS_MODELS:-$HOME/shuttlecoach/tts/models}"
    export REEL_PYTHON="${REEL_PYTHON:-}" REEL_SCRIPT="$ROOT/pose/reel.py" REEL_GPU=0 REEL_HF_CACHE="${REEL_HF_CACHE:-}"
    export REEL_EFFECTS_SCRIPT="${REEL_EFFECTS_SCRIPT:-$ROOT/orbit/orbit.py}" REEL_EFFECTS_PYTHON="${REEL_EFFECTS_PYTHON:-$ROOT/orbit/venv/bin/python}"
    export ORBIT_MAPANYTHING="${ORBIT_MAPANYTHING:-$ROOT/orbit/weights/map-anything-apache}"
    export TENANT_ROOT="$ROOT/tenants" TENANT_WEB="$ROOT/web/dist" ASR_PYTHON="${ASR_PYTHON:-$ROOT/asr/env/bin/python}"
    setsid -f "$NODE_BIN" src/tenants/proxy.js >> "$LOG" 2>&1 < /dev/null
  )
  echo "tenants proxy starting on 127.0.0.1:8796; log: $LOG"
fi
if ! pgrep -f "[c]loudflared tunnel --no-autoupdate --url http://127.0.0.1:8796" > /dev/null; then
  : > "$TUNNEL_LOG"
  setsid -f "$CLOUDFLARED" tunnel --no-autoupdate --url http://127.0.0.1:8796 >> "$TUNNEL_LOG" 2>&1 < /dev/null
  for _ in $(seq 1 30); do [ -n "$(url)" ] && break; sleep 1; done
fi
echo "public address: $(url)"
