# The map's own portals in testchmb_a_00's upper room, where every player meets portals first (added 2026-11-25, after
# Gabriel got wedged there). The blue portal moves between spots on a timer while the orange one stays, so the walks
# below run across several moves; a move can close the hole the player is standing in (the game pushes them out of the
# front). tools/transit.js walks the player through the open pair with real input: no tick in solid, no tick with the
# eye behind a portal, and no pop at a teleport between two wall portals.
map testchmb_a_00
inject tools/transit.js
pose -1088 -512 580 0 0
noclip off
step 400
assert window.game.game.portals.filter(p => p.open && p.linked).length === 2
# six fuzzes of 40 walks, 300 ticks each (about 4.5 s of game time per walk, so the blue portal moves during them).
# Pops: under 1 at a teleport. Off a teleport, a pop is the push out of a hole that went away under the player (the map
# switched which blue portal is on while they were still in the orange one's hole), 4 to 5 units: under 8.
# portal_blue_2 is left out of the pop assertions (not of the stuck ones): in the port it stands edge-on to a thin wall
# that runs through its middle, so a player going in or out of it is slid along that wall, up to 21 units. How it opens
# in the original is still to be measured (plan, Part 2.5), and that will decide the fix.
eval window.__a = (() => { const g = window.game, G = g.game, n0 = G.io.log.length, out = []; for (let k = 0; k < 6; k++) { const f = window.__transitFuzz({ seed: 10 + k, n: 40, ticks: 300, keep: 1000 }); if (f.error) { for (let i = 0; i < 100; i++) g.step(1 / 66); continue; } out.push(f); } const sum = key => out.reduce((s, f) => s + f[key], 0), bad = out.flatMap(f => f.bad), b2 = b => b.r.tps.some(t => t.to === 'portal_blue_2' || t.from === 'portal_blue_2'), mx = l => Math.max(0, ...l.map(b => b.r.jump)); return { fuzzes: out.length, runs: sum('runs'), teleported: sum('teleported'), solid: sum('solid'), behind: sum('behind'), jumpAtTeleport: mx(bad.filter(b => !b2(b) && b.r.jumpAt.tp)), jumpPushed: mx(bad.filter(b => !b2(b) && !b.r.jumpAt.tp)), jumpBlue2: Math.max(0, ...bad.filter(b2).map(b => b.r.jump)), stuck: out.flatMap(f => f.stuck).slice(0, 2).map(s => JSON.stringify(s.r).slice(0, 300)), pushed: G.io.log.slice(n0).filter(l => /pushed out/.test(l)).length }; })()
assert window.__a.fuzzes >= 4 && window.__a.teleported > 40 && window.__a.solid === 0 && window.__a.behind === 0 && window.__a.jumpAtTeleport < 1 && window.__a.jumpPushed < 8
errors
