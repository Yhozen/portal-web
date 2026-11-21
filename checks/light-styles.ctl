# Named lights switch their light style. a00's exit elevator shaft has two lights (a00-a01_elevator_lights, style 33,
# initially dark) that the elevator's path_track turns on as it passes and off at the top. Look at the shaft wall,
# then turn them on and off: the lit frame should differ only around the shaft, and off should match the first frame.
map testchmb_a_00
set showViewModel off
pose -384 -256 880 10 0
screenshot /tmp/portal-checks/light-styles-off.png
fire a00-a01_elevator_lights TurnOn
step 1
screenshot /tmp/portal-checks/light-styles-on.png
fire a00-a01_elevator_lights TurnOff
step 1
screenshot /tmp/portal-checks/light-styles-off2.png
diff /tmp/portal-checks/light-styles-off.png /tmp/portal-checks/light-styles-on.png
diff /tmp/portal-checks/light-styles-off.png /tmp/portal-checks/light-styles-off2.png
eval window.game.io.log.filter(l => /light style/.test(l))
