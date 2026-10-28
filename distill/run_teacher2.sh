#!/usr/bin/env bash
# The second teacher pass (on the A100 VM), after the first students showed what was missing:
#   asked   1500 judge cases where the player asked for a time that breaks one of the member's hard rules (shared
#           calendars, the asked time first: distill/cases.mjs askedCases), from the training club's generator (seed 11,
#           its first 10,000 members: two cases at most per member), 1 answer
#   then the held-out sets again, which also asks again for any answer that never came (shared, val, demo, varied)
set -u
cd "$(dirname "$0")/.."
PAR="${PAR:-96}"
JEV_ASKED=1 JEV_VARIETY=0.5 node distill/teacher.mjs jev/data/asked 31 1500 11 1 "$PAR" 10000 > jev/data/asked.log 2>&1
JEV_SHARED=1 node distill/teacher.mjs jev/data/shared 8 300 7 2 "$PAR" 300 > jev/data/shared.log 2>&1
JEV_VARIETY=0.5 node distill/teacher.mjs jev/data/val 19 300 19 2 "$PAR" > jev/data/val.log 2>&1
JEV_DEMO=1 node distill/teacher.mjs jev/data/demo 5 150 5 3 "$PAR" > jev/data/demo.log 2>&1
JEV_VARIETY=1 node distill/teacher.mjs jev/data/varied 23 300 23 2 "$PAR" > jev/data/varied.log 2>&1
echo ALL_TEACHER2_DONE
