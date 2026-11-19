# The ending: relay_end_game_logic enables the Destructo_glados_body* props and plays their 54 s "go" sequence, which
# is stored in the models' .ani files (animation blocks). Records the whole thing from the chamber floor.
map escape_02
step 66
pose 9355 400 520 0 90
fire relay_end_game_logic Trigger
step 1
anim destructo
record /workspace/portal-web-shots/anim/destruction-OUT.mp4 1310 24
anim destructo
errors
