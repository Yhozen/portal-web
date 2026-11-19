# Smoke test: from each map's spawn, let the game run 20 s of ticks with real physics and logic.
# Expect no page errors, the player still inside the map (eye_cluster >= 0) and the intro elevator done.
map testchmb_a_08
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_08.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_09
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_09.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_10
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_10.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_11
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_11.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_13
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_13.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_14
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_14.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map testchmb_a_15
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/testchmb_a_15.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map escape_00
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/escape_00.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map escape_01
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/escape_01.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
map escape_02
noclip off
step 1320
state
screenshot /tmp/portal-checks/smoke/escape_02.png
eval ({ balls: window.game.io.ents.filter(e => /energy_ball/.test(e.cls || '') && !e.killed).length, ents: window.game.io.ents.length, glados_or_hints: window.game.game.hud.hint || null })
errors
