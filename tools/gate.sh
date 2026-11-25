#!/bin/sh
# The one command to run before a deploy: build the engine, run every check (tools/run-checks.sh) and every playthrough
# (tools/play/check.sh) in a fresh harness session, and record the engine hash they passed on in .gate/passed.
# `pnpm deploy` in web/ refuses an engine whose hash is not recorded there (GATE=skip overrides it, on purpose only).
# Nothing else may load the machine while it runs (the playthrough planner has a wall-clock watchdog); about 1 hour.
# Needs the game files: PORTAL_DIR (and CHROME). usage: tools/gate.sh [--no-play]
cd "$(dirname "$0")/.." || exit 2
[ -n "$PORTAL_DIR" ] || { echo "gate: set PORTAL_DIR to the game files" >&2; exit 2; }
hash=$(node tools/engine-hash.mjs)
./build.sh --log-level=warning || exit 1
sock=/tmp/gate-$$.sock; log=/tmp/gate-$$.serve.log
node tools/portal-ctl.mjs --no-build serve "$sock" > "$log" 2>&1 & srv=$!
trap 'kill $srv 2>/dev/null; rm -f "$sock"' EXIT INT TERM
i=0; until [ -S "$sock" ]; do i=$((i+1)); [ $i -gt 120 ] && { echo "gate: harness did not start (see $log)" >&2; exit 1; }; sleep 1; done
tools/run-checks.sh "$sock" || { echo "gate: FAILED in the checks"; exit 1; }
if [ "$1" != "--no-play" ]; then tools/play/check.sh "$sock" || { echo "gate: FAILED in the playthroughs"; exit 1; }; fi
[ "$(node tools/engine-hash.mjs)" = "$hash" ] || { echo "gate: src/ changed while the gate ran; run it again" >&2; exit 1; }
mkdir -p .gate && echo "$hash $(date -u +%Y-%m-%dT%H:%M:%SZ) ${1:-full} $(git rev-parse --short HEAD)" >> .gate/passed
echo "gate: passed, engine $hash"
