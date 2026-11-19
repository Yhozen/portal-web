# Prop animations started by map logic, checked with pose dumps against the model data (mdl-info):
# round_elevator_doors open/close (20 frames at 30 fps, 0.633 s each), bed_cover_reference opening (30 frames, 0.967 s),
# combine_ball_launcher open/close (30 frames, 0.967 s), light_rail_endcap movedown (50 frames, 1.633 s).
# Each poses reply gives the sequence spans, cycles per second (1/duration expected) and the biggest per-tick bone move.
map testchmb_a_01
fire a01-middleelevator_door_model SetAnimation open
poses /tmp/pa-door-open.jsonl 66 a01-middleelevator_door_model
fire a01-middleelevator_door_model SetAnimation close
poses /tmp/pa-door-close.jsonl 66 a01-middleelevator_door_model
map testchmb_a_00
fire bed_cover SetAnimation opening
poses /tmp/pa-bed-opening.jsonl 80 bed_cover
map testchmb_a_04
fire ball_spawner_prop_rm5 SetAnimation open
poses /tmp/pa-launcher-open.jsonl 80 ball_spawner_prop_rm5
fire ball_spawner_prop_rm5 SetAnimation close
poses /tmp/pa-launcher-close.jsonl 80 ball_spawner_prop_rm5
fire lift_holder1 SetAnimation movedown
poses /tmp/pa-endcap-movedown.jsonl 130 lift_holder1
