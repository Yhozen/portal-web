# GLaDOS's body switching sequences: idle -> hit (what relay_brain_hit_effects sends) -> back to the default idle when
# hit ends. Without cross-fades both switches pop. Records the switch, then dumps the body's bones per tick across it.
map escape_02
step 200
set animFades FADES
pose 9355 400 560 -2 90
fire glados_body SetAnimation hit
record /workspace/portal-web-shots/anim/glados-hit-OUT.mp4 140 33
map escape_02
step 200
set animFades FADES
fire glados_body SetAnimation hit
poses /workspace/portal-web-shots/anim/glados-hit-OUT-poses.jsonl 280 ^glados_body\s
