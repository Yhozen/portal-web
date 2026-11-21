# Model animation events: a01's elevator doors carry AE_CL_PLAYSOUND / AE_CL_STOPSOUND in their open and close
# sequences (0.633 s, 20 frames @30). The log should show each event once, at start + cycle × 0.633 s.
map testchmb_a_01
noclip off
fire a00-a01_elevator_door_model_open Trigger
step 120
fire a00-a01_elevator_door_model_close Trigger
step 120
eval window.game.game.animEventLog.map(e => [e.t, e.seq, +e.cycle.toFixed(4), e.ev, e.options])
