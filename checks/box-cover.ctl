# Bone followers: box_dropper_cover's flaps hold a13's box until logic_drop_box opens them. The original, idle at the
# start (oracle-ctl, ent_text box, Nov 24 9:08 AM EST): the box rests at 2055.1, 203.0, 186.6 for at least 28 s. The
# port (bone followers from the model's mdlkeyvalue bone_followers and its .phy pieces) rests it at z 186.4.
# Its x/y differ (2038, 201 in the port): it lands on the flaps a little differently. Then the cover opens and it drops.
map testchmb_a_13
step 330
eval (() => { const b = game.game.cubes.find(c => c.alive && c.ent.name === 'box'); return b.pos.map(v => +v.toFixed(1)); })()
assert (() => { const b = game.game.cubes.find(c => c.alive && c.ent.name === 'box'); return Math.abs(b.pos[2] - 186.6) < 1.5; })()
eval game.game.io.send('logic_drop_box', 'trigger') || 1
step 200
eval (() => { const b = game.game.cubes.find(c => c.alive && c.ent.name === 'box'); return b.pos.map(v => +v.toFixed(1)); })()
assert (() => { const b = game.game.cubes.find(c => c.alive && c.ent.name === 'box'); return b.pos[2] < 60; })()
