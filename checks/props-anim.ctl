# Map-driven prop animations, each recorded with a probe of the prop's sequence and cycle:
# 1. a00 box dropper: logic_drop_box opens the cover (box_dropper_cover "open", 20 frames, 0.633 s) and drops a cube.
# 2. a01 portal-gun pedestal: walking onto it fires trigger_open_holder, pedestal_center plays "open" (71 frames, 2.33 s).
# 3. a03 ceiling ball launcher: each spawned ball plays "close" (30 frames, 0.967 s) on ball_spawner_prop_rm4.
map testchmb_a_00
set showViewModel off
pose -830 -1200 150 0 90
lookat -830 -1054 250
eval window.__probe = () => { const io = window.game.io, c = io.byName.get('box_dropper_model_cover')[0].prop, d = io.byName.get('box_dropper_model')[0].prop, s = p => p.model.skel.seqs[p.seq].name + '@' + (p.cycle || 0).toFixed(2); return { cover: s(c), dropper: s(d), cube: window.game.game.cubes.filter(k => k.alive && !k.turret).map(k => k.pos.map(Math.round).join(' ')) }; }; 1
fire logic_drop_box Trigger
record /workspace/portal-web-shots/anim/dropper-OUT.mp4 90 30
map testchmb_a_01
set showViewModel off
pose 96 40 -100 0 90
lookat 96 160 -90
eval window.__probe = () => { const p = window.game.io.byName.get('pedistal_center_lvl2')[0].prop; return { center: p.model.skel.seqs[p.seq].name + '@' + (p.cycle || 0).toFixed(2) }; }; 1
fire pedistal_center_lvl2 SetAnimation open
record /workspace/portal-web-shots/anim/pedestal-OUT.mp4 90 30
