# env_shake: a00's exit elevator (a00_01_elevator_shake: amplitude 4, frequency 2.5, duration 2, radius 500) starts
# 5 s after the player walks into a00-a01_trigger_elevator_move. The probe logs the view offset and roll per frame;
# they should stay within the 4-unit amplitude (1-unit roll), settle to zero by 2 s and the shake should then retire.
map testchmb_a_00
set showViewModel off
step 30
pose -384 -256 600 -5 0
noclip off
eval window.__probe = () => { const g = window.game.game; return { off: g.shakeOffset.map(v => +v.toFixed(2)), roll: +g.shakeRoll.toFixed(2), n: g.shakes.length }; }; 1
record /workspace/portal-web-shots/anim/shake-after.mp4 160 20
eval window.game.io.log.filter(l => /shake/.test(l))
