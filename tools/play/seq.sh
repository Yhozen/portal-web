#!/bin/sh
# Sequential playthrough in one persistent harness session: each chamber script in turn, one line per chamber.
# usage: tools/play/seq.sh SOCKET [MAP...]   (start the session first: node tools/portal-ctl.mjs serve SOCKET &)
sock=$1; shift; cd "$(dirname "$0")/../.."
maps=${*:-"testchmb_a_00 testchmb_a_01 testchmb_a_02 testchmb_a_03 testchmb_a_04 testchmb_a_05 testchmb_a_06 testchmb_a_07 testchmb_a_08"}
for m in $maps; do
  node tools/play/ctl.mjs "$m" > "/tmp/play-$m.ctl"; s=$(date +%s)
  node tools/portal-ctl.mjs --attach "$sock" script "/tmp/play-$m.ctl" > "/tmp/play-$m.out"; rc=$?
  next=$(grep -o '"changedTo":[^,]*' "/tmp/play-$m.out" | tail -1 | cut -d: -f2 | tr -d '"')
  t=$(grep -o '"changedTo":[^}]*' "/tmp/play-$m.out" | tail -1 | grep -o '"t":[0-9.]*' | cut -d: -f2)
  err=$(grep '"cmd":"errors"' "/tmp/play-$m.out" | grep -o '"count":[0-9]*' | cut -d: -f2)
  echo "$m exit=$rc next=$next game_s=$t wall_s=$(( $(date +%s) - s )) page_errors=${err:-?} log=/tmp/play-$m.out"
done
