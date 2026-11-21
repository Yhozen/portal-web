# A held energy ball seen from three sides (a04, room 5). combineball.mdl's glow cards and dome face one way, so the
# ball has to keep that side on the viewer; from the side it showed a sliver. OUT is replaced for before/after.
map testchmb_a_04
set showViewModel off
fire energy_ball_launcher_lvl5 LaunchBall
step 2
eval window.__hold = () => { const b = window.game.game.balls[0]; b.pos = [60, 318, 61]; b.vel = [0, 0, 0]; b.die = 1e9; return 1; }; window.__hold()
pose 60 230 30 0 0
lookat 60 318 61
step 3
screenshot /workspace/portal-web-shots/anim/energy-ball-view1-OUT.png
pose -30 318 30 0 0
lookat 60 318 61
step 3
screenshot /workspace/portal-web-shots/anim/energy-ball-view2-OUT.png
pose 0 260 90 0 0
lookat 60 318 61
step 3
screenshot /workspace/portal-web-shots/anim/energy-ball-view3-OUT.png
