# a03's floor energy-ball catcher is an env_entity_maker template. When a ball reaches it, ball_trap_10 fires: the
# housing plays "close" (61 frames, 2 s) then "closed", and the caught ball (combineball.mdl, parented to the
# housing's ball_attachment by SetParentAttachment) is enabled. The ball should appear in the cradle and stay there
# while the arms close. The probe logs the housing sequence and cycle, the ball's visibility and its distance from
# the attachment.
map testchmb_a_03
set showViewModel off
step 2
pose 90 -200 -128 0 0
lookat 0 -128 -100
eval window.__probe = () => { const g = window.game.game, io = window.game.io, h = io.byName.get('ball_trap_10_housing')[0], b = io.byName.get('ball_trap_10_ball')[0], A = g.attachWorld(h.prop, 'ball_attachment'), M = b.prop.matrix; return { seq: h.prop.model.skel.seqs[h.prop.seq].name, cycle: +(h.prop.cycle || 0).toFixed(2), ball: b.prop.visible && !b.killed, off: A ? +Math.hypot(M[12] - A[12], M[13] - A[13], M[14] - A[14]).toFixed(2) : null }; }; 1
eval window.game.io.fire(window.game.io.byName.get('ball_trap_10')[0], 'ontrigger', null), 1
record /workspace/portal-web-shots/anim/catcher-OUT.mp4 110 33
