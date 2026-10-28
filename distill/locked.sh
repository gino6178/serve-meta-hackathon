#!/usr/bin/env bash
# (run under flock /tmp/serve-gpu.lock) wait until no other eval on the 3090's Glimmer (port 11435, the default
# LLM_URL) runs from another folder, then run "$@". Evals pointed elsewhere (LLM_URL without 11435) do not count.
mine="$(pwd -P)"
others() {
  for p in $(pgrep -f "test/[a-z_]*eval[a-z_]*\.mjs"); do
    grep -qa "guard_eval" /proc/$p/cmdline 2>/dev/null && continue
    [ "$(readlink -f /proc/$p/cwd 2>/dev/null)" = "$mine" ] && continue
    url=$(tr '\0' '\n' < /proc/$p/environ 2>/dev/null | sed -n 's/^LLM_URL=//p')
    [ -n "$url" ] && ! echo "$url" | grep -q ":11435" && continue
    echo "$p"
  done
}
while [ -n "$(others)" ]; do sleep 20; done
echo "$(date +%FT%T) start: $*"
"$@"; rc=$?
echo "$(date +%FT%T) end (exit $rc): $*"
exit $rc
