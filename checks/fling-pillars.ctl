# a06's fling pillars: three func_doors per pillar, each parented to the one below (bottom_bottom, bottom, top), all
# moving along yaw 180 and starting open, with brushes parented to the bottom and top doors. The map's logic cycles
# them (the bottom door's OnFullyOpen closes the top door, whose OnFullyClosed opens the bottom one). The probe logs
# every door's t and world x, and the brush pieces' x, for pillar 1. OUT is replaced for before/after.
map testchmb_a_06
set showViewModel off
pose 380 -420 520 0 90
lookat 380 64 470
eval window.__probe = () => { const io = window.game.io, n = s => io.byName.get(s)[0], o = {}; for (const s of ['bottom_bottom', 'bottom', 'top']) { const d = n('fling_pillar1_door_' + s + '_a2'); o[s] = [+d.t.toFixed(3), d.worldM ? +d.worldM[12].toFixed(1) : +d.pos[0].toFixed(1)]; } o.brushes = io.ents.filter(e => e.cls === 'func_brush' && /fling_pillar1_door_(bottom|top)_a2/.test(e.kv.parentname || '')).map(e => +e.pos[0].toFixed(1)); return o; }; 1
record /workspace/portal-web-shots/anim/fling-pillars-OUT.mp4 120 10
