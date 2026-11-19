# Falling onto a floor portal keeps the speed (a fling). In a08's main room: orange on the floor at (-115, 94), blue on
# the floor at (-58, -149). Drop the player from 300 units above orange: they hit the hole at about 600 u/s and should
# leave blue going up at the same speed. Before the fix the floor behind the hole stopped the hull first and the
# player sank through and came out at about 60-200 u/s.
map testchmb_a_08
set showViewModel off
step 30
pose -60 60 0 0 0
noclip off
lookat -115 94 0
step 2
shoot orange
lookat -58 -149 0
step 2
shoot blue
lookat off
pose -115 94 300 60 -90
noclip off
eval window.__probe = () => { const p = window.game.pl; return { pos: p.pos.map(v => +v.toFixed(1)), vz: +p.vel[2].toFixed(1), tp: window.game.game.stats.teleports }; }; 1
record /workspace/portal-web-shots/anim/floor-fling-after.mp4 60 30
state
