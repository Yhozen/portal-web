#!/bin/sh
# Plays every chamber in checks/reference/playthrough.json (tools/play/seq.sh) and compares with it: each must exit 0
# with no page errors, change to the same next map, and take about as long (the larger of tolSeconds and tolFraction).
# Run it with nothing else loading the machine: the planner has a wall-clock watchdog.
# usage: tools/play/check.sh SOCKET [MAP...]   (start the session first: node tools/portal-ctl.mjs serve SOCKET &)
sock=$1; shift; cd "$(dirname "$0")/../.."
ref=checks/reference/playthrough.json
maps=${*:-$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$ref','utf8')).maps).join(' '))")}
out=/tmp/play-check.txt
tools/play/seq.sh "$sock" $maps | tee "$out"
node - "$ref" "$out" <<'EOF'
const fs = require('fs'), [ref, out] = process.argv.slice(2), R = JSON.parse(fs.readFileSync(ref, 'utf8'));
let fail = 0;
for (const line of fs.readFileSync(out, 'utf8').split('\n').filter(Boolean)) {
  const [map] = line.split(' '), f = Object.fromEntries(line.split(' ').slice(1).map(kv => kv.split('='))), want = R.maps[map];
  const t = parseFloat(f.game_s), next = f.next && f.next !== 'null' ? f.next : 'unset', why = [];
  if (f.exit !== '0') why.push(`exit ${f.exit}`);
  // console and page errors only: a 404 for an optional file is not a failure (as in tools/run-checks.sh)
  const log = f.log && fs.existsSync(f.log) ? fs.readFileSync(f.log, 'utf8') : '', errs = (log.match(/"type":"(page)?error"/g) || []).length;
  if (errs) why.push(`${errs} page errors`);
  if (want) {
    if (next !== want.next) why.push(`next ${next}, want ${want.next}`);
    const tol = Math.max(R.tolSeconds, R.tolFraction * want.t);
    if (!(Math.abs(t - want.t) <= tol)) why.push(`${f.game_s} s, want ${want.t} ± ${tol.toFixed(1)}`);
  } else why.push('not in the reference');
  if (why.length) fail++;
  console.log(`${why.length ? 'FAIL' : 'PASS'} play-${map} ${why.join('; ') || `${t} s -> ${next}`}`);
}
console.log(`playthrough: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
EOF
