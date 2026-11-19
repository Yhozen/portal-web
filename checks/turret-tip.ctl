# a11's knock-over demonstration: walking into trigger_knock_over_turret1 fires env_physexplosion at the training
# turret. It should tip (up · z under 0.5), fire OnTipped once, thrash and shoot for 2–2.5 s, close and die.
map testchmb_a_11
# the camera stands off to the side in noclip so the turret stays in view as it falls (the player's spot sees it go behind the pillar)
pose 310 -590 1 0 0
set showViewModel off
lookat 410 -600 16
eval window.__probe = () => { const c = window.game.game.cubes.find(c => c.turret && c.ent.name === 'training_turret'); const pr = c.prop; return { state: c.turret.state, seq: pr.model.skel.seqs[pr.seq].name, up: +c.R[10].toFixed(2), shots: c.turret.shots, pos: c.pos.map(v => Math.round(v)) }; }; 1
fire phys_knock_over_turret1 Explode
record /workspace/portal-web-shots/anim/turret-tip-OUT.mp4 200 33
eval window.game.io.log.filter(l => /pushed|tipped|knock/.test(l))
