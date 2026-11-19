# a10's first pillar lift, ridden: lower it (the room's entry trigger opens both doors), stand on the platform, then let the ride trigger raise
# it (lift_trigger_a closes both doors on touch). The player should rise with the platform by 248 units at 30 then 15
# units/s and stay on it. The probe logs the platform brush z and the player's feet z.
map testchmb_a_10
set showViewModel off
# the room's entry trigger_once (64 960 0) opens every lift; walk into it first so it doesn't fire on the lift too
pose 64 960 -40 0 0
noclip off
step 600
pose -128 704 -240 0 0
noclip off
eval window.__probe = () => { const io = window.game.io, b = io.byName.get('lift_brush_a10_1')[0], g = window.game.game; return { brush: +b.pos[2].toFixed(1), feet: +g.player.pos[2].toFixed(1), onground: !!g.player.onGround }; }; 1
record /workspace/portal-web-shots/anim/lift-ride-OUT.mp4 100 10
