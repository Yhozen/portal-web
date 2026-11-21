# a02, the middle cleanser (a02-middle_trigger_fryer_rm2 at x 694): with a portal open, walking through it should fizzle
# the portals and play v_portalgun's fizzle (16 frames at 30 fps, 0.5 s, snap), then fade back to idle.
# The probe logs the viewmodel's sequence, cycle and fades, and whether any gun portal is open.
map testchmb_a_02 gun=1
noclip off
look 0 0
step 1
sleep 1
step 70
shoot blue
step 40
pose 600 192 0 0 0
noclip off
eval window.__probe = () => { const g = window.game.game, v = g.vm; return v?.model ? { seq: v.model.skel.seqs[v.seq].name, cycle: +(v.cycle || 0).toFixed(3), fades: (v.fades || []).map(f => v.model.skel.seqs[f.seq].name + ':' + f.weight.toFixed(2)).join(' '), open: g.gunPortals.some(p => p.open), x: +g.player.pos[0].toFixed(0) } : null; }; 1
record /workspace/portal-web-shots/anim/viewmodel-fizzle-OUT.mp4 50 33 w
