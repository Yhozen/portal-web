# Turret bullets against the original (a11, standing 200 units in front of training_turret, ent_dump !player every tick):
# health drops every 7 ticks, first hit to dead in 1.79 s and 1.68 s, and the player is shoved back into the wall
# behind. Damage is on with ?damage=1 only for now (game.damage), so this check turns it on itself. The spread is
# random, so the window is wide: dead between 1.3 and 2.3 s after the first hit, hit at least 12 times, and shoved
# back from x 214 to the wall (the hull stops at x 144, 70 units back; the original went 72).
map testchmb_a_11
noclip off
eval (() => { const W = window.game, G = W.game; G.damage = true; W.pl.pos = [214, -672, 0]; W.pl.vel = [0, 0, 0]; const t = G.cubes.find(c => c.ent.name === 'training_turret'); let first = -1, hits = 0, last = G.health; for (let i = 0; i < 66 * 8 && !G.dead; i++) { W.pl.ang = [0, 0, 0]; W.step(1 / 66, { fwd: 0, side: 0, jump: false, duck: false }); if (G.health < last) { hits++; if (first < 0) first = G.io.time; } last = G.health; } window.__dmg = { dead: G.dead, first: +first.toFixed(2), died: +G.io.time.toFixed(2), span: +(G.io.time - first).toFixed(2), hits, state: t.turret.state, pos: W.pl.pos.map(v => Math.round(v)) }; return window.__dmg; })()
assert window.__dmg.dead && window.__dmg.span > 1.3 && window.__dmg.span < 2.3 && window.__dmg.hits >= 12 && window.__dmg.pos[0] < 160
