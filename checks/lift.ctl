# a10's first pillar lift: two stacked func_doors moving down at 15 units/s each (the top one, 128 units, is
# parented to the bottom one's brush, 120 units), with the platform brush and lift_platform.mdl parented on top.
# Opening both should lower the platform by 248 units, at 30 units/s while both move and 15 once the bottom one has
# stopped after 8 s, with the model riding the brush exactly. The probe logs both doors and the platform pieces.
map testchmb_a_10
set showViewModel off
pose 250 704 -300 0 180
lookat -128 704 -150
eval window.__probe = () => { const io = window.game.io, n = s => io.byName.get(s)[0], m = n('model_tracktrain_platform_a10_1'), b = n('lift_brush_a10_1'), tp = n('lift_pillar_door_top_a'), bt = n('lift_pillar_door_bottom_a'); return { top: +tp.t.toFixed(3), bot: +bt.t.toFixed(3), topz: +tp.pos[2].toFixed(2), botz: +bt.pos[2].toFixed(2), brush: +b.pos[2].toFixed(2), model: m.prop ? +m.prop.matrix[14].toFixed(2) : null }; }; 1
fire lift_pillar_door_top_a Open
fire lift_pillar_door_bottom_a Open
record /workspace/portal-web-shots/anim/lift-OUT.mp4 100 10
