# a04: the launcher fires one energy ball (radius 12, 200 u/s, 16 s life) and the ball bounces around room 5.
# combineball.mdl's idle loops 31 frames at 4 fps (7.5 s). The probe logs position, speed, the model's sequence and
# cycle, and the time left, to check the flight (constant speed, mirror bounces) and the model animation.
map testchmb_a_04
set showViewModel off
pose 60 200 30 0 0
lookat 60 318 61
fire energy_ball_launcher_lvl5 LaunchBall
eval window.__probe = () => { const g = window.game.game, b = g.balls[0]; if (!b) return null; const p = b.prop; return { pos: b.pos.map(v => +v.toFixed(1)), spd: +Math.hypot(...b.vel).toFixed(1), seq: p.seq, cycle: +((p.cycle || 0)).toFixed(4), left: +(b.die - window.game.io.time).toFixed(2) }; }; 1
step 100
record /workspace/portal-web-shots/anim/energy-ball-OUT.mp4 60 30
anim combineball
