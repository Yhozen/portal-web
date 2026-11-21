# a08 (chamber 13): the pellet catch starts func_tracktrain_lvl7, a rail platform carrying the chamber's only cube from
# x -58 to 423 at 50 units/s (3 s stop at each end). The cube rests on rail_cart_brush_lvl7 (a func_brush parented
# through the platform model and a func_door to the train) and should ride along. The probe logs train and cube.
map testchmb_a_08
set showViewModel off
pose 120 -20 170 20 270
lookat 180 -272 170
eval window.__probe = () => { const g = window.game.game, t = window.game.io.byName.get('func_tracktrain_lvl7')[0], c = g.cubes.filter(c => c.alive)[0]; return { train: t.pos.map(v => +v.toFixed(1)), cube: c.pos.map(v => +v.toFixed(1)), rel: [+(c.pos[0] - t.pos[0]).toFixed(1), +(c.pos[1] - t.pos[1]).toFixed(1)] }; }; 1
step 30
fire start_track_logic_lvl7 Trigger
record /workspace/portal-web-shots/anim/cube-on-train-OUT.mp4 140 10
