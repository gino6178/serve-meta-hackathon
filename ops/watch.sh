#!/usr/bin/env bash
# Keep the Meta entry's services up: run start.sh (which only starts what is not listening) every 30 s.
#   setsid -f ~/serve/watch.sh     start the watchdog
#   pkill -f serve/watch.sh        stop it (then ./start.sh stop to stop the services)
ROOT="$(cd "$(dirname "$0")" && pwd)"
while true; do
  "$ROOT/start.sh" > /dev/null 2>&1
  sleep 30
done
