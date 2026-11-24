# a08's box_maker (fired by logic_auto on map spawn) makes both cubes of its point_template: the one on the rail platform and
# the one on the start room's grating roof. Measured in the original with ent_dump / ent_text (oracle-ctl): both exist after
# map load and after killing them and firing box_maker ForceSpawn, at (-83, -290, 193) and (-470, 218, 278).
map testchmb_a_08
step 30
assert (() => { const c = game.game.cubes.filter(c => c.alive).map(c => c.pos); const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 6; return c.length === 2 && c.some(p => near(p, [-83, -290])) && c.some(p => near(p, [-470, 218])); })()
