#!/bin/sh
# Real-traversal playthrough: autopilot (A* over player-hull traces, input-only walking) + a per-map script.
# usage: tools/play/run.sh testchmb_a_00 [shot.png]
m=$1; out=${2:-/tmp/play-$m.png}; cd "$(dirname "$0")/../.."
node tools/shot.mjs "$out" "map=$m&nochange=1" 500 "$(cat tools/autopilot.js); $(cat tools/play/$m.js)"
