#!/bin/sh
# Run every checks/*.ctl in one persistent harness session and print one line per check.
# A check passes when portal-ctl exits 0 (every command ok) and the page reported no errors.
# usage: tools/run-checks.sh SOCKET [CHECK...]   (start the session first: node tools/portal-ctl.mjs serve SOCKET &)
sock=$1; shift; cd "$(dirname "$0")/.."
list=${*:-$(ls checks/*.ctl)}; pass=0; fail=0
for c in $list; do
  n=$(basename "$c" .ctl); s=$(date +%s)
  { echo errors; cat "$c"; echo errors; } | node tools/portal-ctl.mjs --attach "$sock" script - > "/tmp/check-$n.out" 2>&1; rc=$?
  # console errors and page errors only (404s for optional files and warnings are not failures)
  errs=$(awk '{ n += gsub(/"type":"(page)?error"/, ""); if ($0 ~ /"cmd":"map"/ && match($0, /"errors":[0-9]+/)) n += substr($0, RSTART + 9, RLENGTH - 9) } END { print n + 0 }' "/tmp/check-$n.out")
  if [ $rc -eq 0 ] && [ "${errs:-0}" = 0 ]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  echo "$r $n exit=$rc page_errors=${errs:-?} wall_s=$(( $(date +%s) - s ))"
done
# parity against the original: every checks/oracle/X.json that has measured numbers in checks/reference/X.json
if [ -z "$*" ]; then for f in checks/oracle/*.json; do n=$(basename "$f" .json); [ -f "checks/reference/$n.json" ] || continue; s=$(date +%s)
  node tools/parity.mjs check "$f" --attach "$sock" > "/tmp/check-parity-$n.out" 2>&1; rc=$?
  if [ $rc -eq 0 ]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  echo "$r parity-$n exit=$rc $(grep -c '^PASS' "/tmp/check-parity-$n.out")/$(grep -c -E '^(PASS|FAIL)' "/tmp/check-parity-$n.out") metrics wall_s=$(( $(date +%s) - s ))"; done; fi
echo "passed $pass failed $fail"
[ $fail -eq 0 ]
