# a08's box_maker (fired by logic_auto on map spawn) makes both cubes of its point_template: the one on the rail platform and
# the one on the start room's grating roof. Measured in the original with ent_dump / ent_text (oracle-ctl): both exist after
# map load and after killing them and firing box_maker ForceSpawn, at (-83, -290, 193) and (-470, 218, 278).
map testchmb_a_08
step 30
assert (() => { const c = game.game.cubes.filter(c => c.alive).map(c => c.pos); const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 6; return c.length === 2 && c.some(p => near(p, [-83, -290])) && c.some(p => near(p, [-470, 218])); })()
# a09's box_maker sits on its template's origin and puts the single cube where the template cube is, on the top step
# (ent_text in the original: 1083.2, -771.2, 500.4); it has to stay there, not slide off.
map testchmb_a_09
step 200
assert (() => { const c = game.game.cubes.filter(c => c.alive).map(c => c.pos); return c.length === 1 && Math.hypot(c[0][0] - 1083, c[0][1] + 771) < 6 && Math.abs(c[0][2] - 500.4) < 1.5; })()
# a02's second maker puts box_2 at the template cube's offset from the template, moved to the maker: ent_text in the
# original reads 953.2, 778.6, 468.4 for the copy from entity_box_maker_a02_01 once it has settled (re-read at 6:35 AM EST
# on Nov 24; the earlier 460.4 was read before it came to rest). The port's 20.25 cube rests at 468.3 on the z-448 floor.
map testchmb_a_02
step 60
assert game.game.cubes.some(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6 && Math.abs(c.pos[2] - 468.4) < 2)
# Cube size: metal_box.mdl's hull is ±20.25 (it was a fixed ±12, so cubes sat 8 units into floors). ent_text in the
# original: a11's floor boxes by the duck vent and at the radio rest at z 20.4 and 20.4 on the z-0 floor.
map testchmb_a_11
step 300
assert (() => { const b = game.game.cubes.filter(c => c.alive && !c.turret && Math.hypot(c.pos[0] + 394, c.pos[1] - 708) < 8); return b.length === 1 && Math.abs(b[0].pos[2] - 20.4) < 1; })()
