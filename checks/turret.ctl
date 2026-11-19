# a11's training turret (416 -672 1, facing -x): the player stands in its cone and strafes; it should deploy, turn
# to the player and fire; then the player steps behind it, out of its cone, and it searches and retires. The probe logs state, sequence, poses and the
# angle between the muzzle (eyes attachment +x) and the line to the player.
map testchmb_a_11
pose 230 -672 1 0 0
noclip off
lookat 416 -672 40
eval window.__probe = () => { const g = window.game.game, c = g.cubes.find(c => c.turret && c.ent.name === 'training_turret'); if (!c || !c.prop.model) return null; const T = c.turret, pr = c.prop, m = pr.model, f = window.game.npc.attachFrame(m, T.eyes, pr.poses), W = pr.matrix, X = (v, w) => [0, 1, 2].map(k => W[k] * v[0] + W[4 + k] * v[1] + W[8 + k] * v[2] + w * W[12 + k]); const e = X(f.pos, 1), d = X(f.x, 0), p = g.player.pos, to = [p[0] - e[0], p[1] - e[1], p[2] + 36 - e[2]], n = Math.hypot(...to), dl = Math.hypot(...d); return { state: T.state, seq: m.skel.seqs[pr.seq].name, cycle: +(pr.cycle || 0).toFixed(2), poses: pr.poses.map(v => +v.toFixed(1)), err: +(Math.acos(Math.min(1, (d[0] * to[0] + d[1] * to[1] + d[2] * to[2]) / (n * dl))) * 180 / Math.PI).toFixed(1), shots: T.shots, up: +c.R[10].toFixed(2) }; }; 1
step 10
record /workspace/portal-web-shots/anim/turret-OUT-1.mp4 100 33 d
record /workspace/portal-web-shots/anim/turret-OUT-2.mp4 60 33
record /workspace/portal-web-shots/anim/turret-OUT-3.mp4 60 33 a
pose 520 -640 1 0 180
noclip off
record /workspace/portal-web-shots/anim/turret-OUT-4.mp4 260 33
