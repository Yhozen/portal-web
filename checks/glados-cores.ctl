# GLaDOS's personality cores hang from her body: logic_auto sends SetParentAttachment ball_01..ball_04 at map spawn, so
# each core should sit on its attachment and swing with her idle (151 frames, 5 s). The probe logs, per core, the
# distance from the core's origin to its attachment and how far the attachment has moved since the first frame.
map escape_02
set showViewModel off
step 2
pose 9390 880 560 0 90
lookat 9390 1170 690
eval window.__probe = () => { const g = window.game.game, io = window.game.io, body = io.byName.get('glados_body')[0], out = {}; for (const [n, a] of [['dummy_core_prop', 'ball_01'], ['brain_core_sphere_4', 'ball_02'], ['brain_core_sphere_2', 'ball_03'], ['brain_core_sphere_3', 'ball_04']]) { const c = io.byName.get(n)[0], A = g.attachWorld ? g.attachWorld(body.prop, a) : null, M = c.prop.matrix; if (!A) { out[n] = [M[12], M[13], M[14]].map(Math.round); continue; } window.__a0 ??= {}; const z = window.__a0[n] ??= [A[12], A[13], A[14]]; out[n] = { off: +Math.hypot(M[12] - A[12], M[13] - A[13], M[14] - A[14]).toFixed(2), swing: +Math.hypot(A[12] - z[0], A[13] - z[1], A[14] - z[2]).toFixed(1) }; } return out; }; 1
record /workspace/portal-web-shots/anim/glados-cores-OUT.mp4 165 33
