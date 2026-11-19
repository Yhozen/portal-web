# a03, room 1, played for real: the ceiling launcher's ball drops through the fixed orange floor portal, comes out of
# a blue portal on the ceiling above the floor catcher and falls into it. The catcher's door is a passable
# func_tracktrain (spawnflags 8); it must not stop the ball. The probe logs the ball, the catcher trigger and the
# housing's sequence. Expected: the ball falls past z -93 into ball_trap_10, the housing plays "close", the lift opens.
map testchmb_a_03
set showViewModel off
pose -200 -60 -127 0 0
lookat 0 -127 256
fire portal_a_rm4 Open
step 2
shoot blue
lookat off
pose 150 -330 -100 0 0
lookat 0 -127 -60
eval window.__probe = () => { const g = window.game.game, io = window.game.io, h = io.byName.get('ball_trap_10_housing')[0], tr = io.byName.get('ball_trap_10')[0]; return { balls: g.balls.map(b => b.pos.map(v => v | 0)), trap: tr.enabled !== false, seq: h.prop && h.prop.model ? h.prop.model.skel.seqs[h.prop.seq].name : null, cycle: +((h.prop && h.prop.cycle) || 0).toFixed(2), lift: io.byName.get('lift_up_trigger_a')[0].enabled !== false }; }; 1
step 150
record /workspace/portal-web-shots/anim/catcher-ball-OUT.mp4 210 30
