# First-person portal gun (v_portalgun.mdl): draw when first held, a shot per colour, picking up and dropping the
# a02 cube, moved in front of the spawn. OUT is replaced with a name for the before/after files.
map testchmb_a_02 gun=1
noclip off
look 0 0
step 1
sleep 1
eval window.__probe = () => { const v = window.game.game.vm; return v?.model ? { seq: v.model.skel.seqs[v.seq].name, cycle: +(v.cycle || 0).toFixed(3), fades: (v.fades || []).map(f => v.model.skel.seqs[f.seq].name + ":" + f.weight.toFixed(2)).join(" ") } : null; }; 1
record /workspace/portal-web-shots/anim/viewmodel-OUT-1.mp4 45 33
shoot blue
record /workspace/portal-web-shots/anim/viewmodel-OUT-2.mp4 25 33
look 0 -30
shoot orange
record /workspace/portal-web-shots/anim/viewmodel-OUT-3.mp4 30 33
eval (() => { const c = window.game.game.cubes.find(c => c.alive && c.ent.name === 'box'); c.pos = [-850, 192, 20]; c.vel = [0, 0, 0]; c.asleep = false; return c.pos; })()
lookat -850 192 10
step 40
use
record /workspace/portal-web-shots/anim/viewmodel-OUT-4.mp4 40 33
use
record /workspace/portal-web-shots/anim/viewmodel-OUT-5.mp4 40 33
eval window.game.game.vm && ({ seq: window.game.game.vm.model.skel.seqs[window.game.game.vm.seq].name, cycle: +window.game.game.vm.cycle.toFixed(3) })
