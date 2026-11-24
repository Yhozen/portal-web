# a11's two knock-over kicks against the original. In the original (host_timescale 0.25 sheets of the training turret,
# 0.085 s apart), either env_physexplosion leaves the turret standing for about 0.3 s, past 60 degrees by about 0.6 s
# and on its side by 0.7 s. The kick is the SDK's 300 kg·in/s per damage point on turret_01's 100 kg (71 in/s here),
# and the body is the .phy's tripod, so the feet catch and it goes over sideways. Ticks are 1/66 s.
map testchmb_a_11
noclip
pose 310 -590 1 0 0
eval window.__up = () => +window.game.game.cubes.find(c => c.ent.name === 'training_turret').R[10].toFixed(2); 1
fire phys_knock_over_turret2 Explode
step 20
assert window.__up() > 0.9
step 20
assert window.__up() > 0.5
step 26
assert window.__up() < 0.5
map testchmb_a_11
noclip
pose 310 -590 1 0 0
eval window.__up = () => +window.game.game.cubes.find(c => c.ent.name === 'training_turret').R[10].toFixed(2); 1
fire phys_knock_over_turret1 Explode
step 20
assert window.__up() > 0.9
step 20
assert window.__up() > 0.5
step 26
assert window.__up() < 0.5
