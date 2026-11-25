# Walking through portals must not pop the view or leave the player stuck (added 2026-11-25, after Gabriel got wedged in
# a00's orange portal and reported a jump between portals). tools/transit.js walks the player through the open pair with
# real input and measures: jump (the eye's move in one tick beyond its speed, a teleport mapped through the pair), solid
# (ticks inside something solid) and behind (ticks with the eye behind a portal's plane, not teleported).
# Layouts in testchmb_a_09's box room. Each fuzz is 150 seeded random walks: off-centre, at an angle, strafing, jumping,
# turning and backing up on the way. Before the fix (main at bf6b531) the two-wall layouts popped 35 units at every
# teleport and the wall-and-floor layout spent 1,991 ticks in solid over 300 walks.
map testchmb_a_09 gun=1
inject tools/transit.js

# two portals on one wall, at floor level
pose 776 -1000 256 0 0
lookat 776 -1280 312
step 1
shoot blue
lookat 1000 -1280 312
step 1
shoot orange
lookat off
assert window.game.game.gunPortals.every(p => p.open && p.linked)
# straight through: one teleport, the eye carries through and stays at standing height
eval window.__r = window.__transit({ pos: [776, -1150, 256], ang: [0, -90], ticks: 160, keys: [{ from: 0, to: 160, fwd: 1 }] })
assert window.__r.tp === 1 && window.__r.jump < 0.5 && window.__r.minView === 64 && window.__r.solid === 0
# at 45 degrees: this one came out wedged against the exit portal's rim and never walked away from the wall
eval window.__r = window.__transit({ pos: [700, -1200, 256], ang: [0, -45], ticks: 160, keys: [{ from: 0, to: 160, fwd: 1 }] })
assert window.__r.tp === 1 && window.__r.jump < 0.5 && window.__r.solid === 0 && window.__r.end[1] > -1200
# too far off-centre to fit (24 of the hole's 34): the wall beside the hole stays solid
eval window.__r = window.__transit({ pos: [800, -1150, 256], ang: [0, -90], ticks: 160, keys: [{ from: 0, to: 160, fwd: 1 }] })
assert window.__r.tp === 0 && window.__r.solid === 0 && window.__r.end[1] > -1265
eval window.__f = window.__transitFuzz({ seed: 1, n: 150, ticks: 200, keep: 3 })
assert window.__f.teleported > 40 && window.__f.solid === 0 && window.__f.behind === 0 && window.__f.jumpUpright < 1

# half inside the blue portal when orange closes: the hole goes with it, and the player is pushed out of the front of the
# wall and can walk away (they used to be left inside it for good; a00's blue portal moves on a timer)
eval window.__transit({ pos: [776, -1240, 256], ang: [0, -90], ticks: 1, keys: [] })
eval window.__r = (() => { const g = window.game, G = g.game, pl = g.pl, T = 1 / 66; let n = 0, solid = 0; while (pl.pos[1] > -1272 && n++ < 200) g.step(T, { fwd: 1, side: 0, jump: false, duck: false }); const inWall = pl.pos[1]; G.gunPortals[1].open = false; G.relinkMapPortals(); for (let i = 0; i < 200; i++) { g.step(T, { fwd: i < 60 ? 0 : -1, side: 0, jump: false, duck: false }); if (pl.trace(pl.pos, pl.pos).startsolid) solid++; } return { inWall, solid, end: pl.pos.map(v => +v.toFixed(1)) }; })()
assert window.__r.inWall < -1264 && window.__r.solid === 0 && window.__r.end[1] > -1150

# two walls at right angles
pose 900 -1130 256 0 0
lookat 640 -1130 312
step 1
shoot orange
lookat off
assert window.game.game.gunPortals.every(p => p.open && p.linked) && window.game.game.gunPortals[1].f[0] > 0.9
eval window.__f = window.__transitFuzz({ seed: 2, n: 150, ticks: 200, keep: 3 })
assert window.__f.teleported > 25 && window.__f.solid === 0 && window.__f.behind === 0 && window.__f.jumpUpright < 1

# a wall portal at floor level and one high on another wall (the player steps or drops out of the high one)
pose 776 -968 256 0 0
lookat 320 -968 474
step 1
shoot orange
lookat off
assert window.game.game.gunPortals.every(p => p.open && p.linked) && window.game.game.gunPortals[1].pos[2] > 400
eval window.__f = window.__transitFuzz({ seed: 3, n: 150, ticks: 200, keep: 3 })
assert window.__f.teleported > 10 && window.__f.solid === 0 && window.__f.behind === 0 && window.__f.jumpUpright < 1

# wall and floor: the hull turns over, so the original pops too (it ducks the player; checks/oracle/fling-wall.json).
# Never stuck, though. The size of the pop is printed, not asserted.
pose 900 -1000 320 89 0
step 1
shoot orange
assert window.game.game.gunPortals.every(p => p.open && p.linked) && window.game.game.gunPortals[1].f[2] > 0.9
eval window.__f = window.__transitFuzz({ seed: 4, n: 150, ticks: 200, keep: 3 })
assert window.__f.teleported > 40 && window.__f.solid === 0 && window.__f.behind === 0

# floor and floor
pose 700 -900 320 89 0
step 1
shoot blue
assert window.game.game.gunPortals.every(p => p.open && p.linked) && window.game.game.gunPortals[0].f[2] > 0.9
eval window.__f = window.__transitFuzz({ seed: 5, n: 150, ticks: 200, keep: 3 })
assert window.__f.teleported > 40 && window.__f.solid === 0 && window.__f.behind === 0
errors
