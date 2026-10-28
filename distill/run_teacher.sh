#!/usr/bin/env bash
# The teacher runs, in order (on the A100 VM, against its own Ollama with Muse Glimmer):
#   test         500 judge cases from the eval club (seed 7, the members persona_eval/private_eval use), 3 answers each
#   train        3000 judge cases from another club (seed 11, 2000 members; half with their soft habits reworded), 1 answer
#   trainshared  600 more, shared calendars only (Serve's default; seed 13, half reworded), 1 answer
#   shared       300 judge cases from the eval club with shared calendars only, 2 answers each
#   val          300 judge cases from a third club (seed 19, half reworded), 2 answers each (for the confidence threshold)
#   demo         150 judge cases with the demo club's own members (their own words), 3 answers each
#   varied       300 judge cases from a fourth club (seed 23, all reworded), 2 answers each
# A step whose answers are all there is quick (teacher.mjs resumes, and asks again for any answer that never came).
set -u
cd "$(dirname "$0")/.."
PAR="${PAR:-96}"
node distill/teacher.mjs jev/data/test 7 500 7 3 "$PAR" 300 > jev/data/test.log 2>&1
JEV_VARIETY=0.5 node distill/teacher.mjs jev/data/train 11 3000 11 1 "$PAR" > jev/data/train.log 2>&1
JEV_VARIETY=0.5 JEV_SHARED=1 node distill/teacher.mjs jev/data/trainshared 13 600 13 1 "$PAR" > jev/data/trainshared.log 2>&1
JEV_SHARED=1 node distill/teacher.mjs jev/data/shared 8 300 7 2 "$PAR" 300 > jev/data/shared.log 2>&1
JEV_VARIETY=0.5 node distill/teacher.mjs jev/data/val 19 300 19 2 "$PAR" > jev/data/val.log 2>&1
JEV_DEMO=1 node distill/teacher.mjs jev/data/demo 5 150 5 3 "$PAR" > jev/data/demo.log 2>&1
JEV_VARIETY=1 node distill/teacher.mjs jev/data/varied 23 300 23 2 "$PAR" > jev/data/varied.log 2>&1
echo ALL_TEACHER_DONE
