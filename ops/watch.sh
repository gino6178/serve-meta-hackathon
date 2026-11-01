#!/usr/bin/env bash
# Keep the Meta entry's services up, every 30 s: start.sh and tenants.sh start only what is not listening (Muse Glimmer,
# Llama Guard, the gateway; the public site's proxy and its tunnel), and a gateway that listens but has not answered
# /api/status for three checks in a row is stopped, so the next round starts it again.
#   setsid -f ~/serve/watch.sh     start the watchdog
#   pkill -f serve/watch.sh        stop it (then ./start.sh stop to stop the services)
ROOT="$(cd "$(dirname "$0")" && pwd)"
miss=0
while true; do
  "$ROOT/start.sh" > /dev/null 2>&1
  "$ROOT/tenants.sh" > /dev/null 2>&1
  if curl -s -m 10 -o /dev/null http://127.0.0.1:8790/api/status; then miss=0; else miss=$((miss + 1)); fi
  if [ "$miss" -ge 3 ]; then fuser -k 8790/tcp > /dev/null 2>&1; miss=0; fi
  sleep 30
done
