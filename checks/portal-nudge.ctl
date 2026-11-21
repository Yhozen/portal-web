# a07's launcher room: the pellet hits the south wall at x -638, z 320, where the concrete ends 30 units to the right
# (x about -606) and a no-portal metal strip begins. A portal centred on the shot doesn't fit; the game slides it
# along the wall until it does. Expected: placed a few units left of -638 (still covering the pellet's path),
# and "no fit" only where nothing nearby fits. OUT is replaced for before/after.
map testchmb_a_07
set showViewModel off
noclip off
step 140
pose -647 -165 128 0 -90
lookat -638 -512 320
step 2
shoot blue
step 3
lookat off
pose -638 -330 300 0 -90
screenshot /workspace/portal-web-shots/anim/portal-nudge-OUT.png
eval (() => { const p = window.game.game.gunPortals[0]; return { open: p.open, pos: p.pos.map(v => +v.toFixed(1)), why: window.game.io.log.filter(l => /portal 0 failed/.test(l)).slice(-1) }; })()
