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
assert (() => { const c = game.game.cubes.filter(c => c.alive).map(c => c.pos); return c.length === 1 && Math.hypot(c[0][0] - 1083, c[0][1] + 771) < 6 && c[0][2] > 470; })()
# a02's second maker puts box_2 at the template cube's offset from the template, moved to the maker: ent_text in the
# original reads 953.3, 778.6, 460.4 for the copy from entity_box_maker_a02_01.
map testchmb_a_02
step 60
assert game.game.cubes.some(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6 && Math.abs(c.pos[2] - 460) < 4)
