# a00's second floor button (floor_button_door_a00, a func_door with movedir 90 0 0, speed 25, lip 0, and the
# button_top prop parented to it). A cube is dropped onto it: the box trigger opens the door, which should sink at a
# constant 25 units/s by its brush depth, carry the top with it, open the exit doors and play Portal.button_down.
# Then the cube is taken away and it rises again. The probe logs the door t, its z and the top's z.
map testchmb_a_00
set showViewModel off
pose -640 -1000 136 0 0
lookat -512 -928 140
eval window.__probe = () => { const io = window.game.io, d = io.byName.get('floor_button_door_a00')[0], t = io.ents.find(e => e.kv.parentname === 'floor_button_door_a00'), x = io.byName.get('exit_door_left_a00')[0]; return { t: +d.t.toFixed(3), z: +d.pos[2].toFixed(2), top: t.prop ? +t.prop.matrix[14].toFixed(2) : null, moving: !!d.moving, exit: x ? +(x.t ?? 0).toFixed(2) : null }; }; 1
eval (() => { const c = window.game.game.cubes.find(c => c.alive); c.pos = [-512, -928, 175]; c.vel = [0, 0, 0]; c.asleep = false; return c.ent.name; })()
record /workspace/portal-web-shots/anim/button-OUT-down.mp4 45 30
eval (() => { const c = window.game.game.cubes.find(c => c.alive); c.pos = [-700, -928, 160]; c.vel = [0, 0, 0]; c.asleep = false; return c.pos; })()
record /workspace/portal-web-shots/anim/button-OUT-up.mp4 45 30
