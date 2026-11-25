# +use reach, after CBasePlayer::FindUseEntity (public SDK 2013 baseplayer_shared.cpp): PLAYER_USE_RADIUS 80 from the eye
# to the hit, height counted from the player's own body. Measured in the original (oracle-ctl, sv_debug_player_use 1 and
# ent_text, Nov 24 7:45 to 8:00 AM EST) on a02's box_2 at 953.2, 778.6, 468.4, the player on its floor, distances
# from the box centre to the player horizontally:
#   looking at the centre, standing: 98 grabs (green cross, held mass 1 kg), 104, 112, 120 don't (red cross)
#   looking at the centre, ducked:   90 and 98 grab, 104 doesn't
#   standing, pitch 4.2 (looking just over its top): 98 and 104 grab
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 98, b.pos[1], 448]; p.vel = [0, 0, 0]; const e = p.eye(); p.ang = [-Math.atan2(b.pos[2] - e[2], 98) * 180 / Math.PI, 0, 0]; G.use(); return !!G.held; })()
assert !!game.game.held
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 104, b.pos[1], 448]; p.vel = [0, 0, 0]; const e = p.eye(); p.ang = [-Math.atan2(b.pos[2] - e[2], 104) * 180 / Math.PI, 0, 0]; G.use(); return !!G.held; })()
assert !game.game.held
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 120, b.pos[1], 448]; p.vel = [0, 0, 0]; const e = p.eye(); p.ang = [-Math.atan2(b.pos[2] - e[2], 120) * 180 / Math.PI, 0, 0]; G.use(); return !!G.held; })()
assert !game.game.held
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 98, b.pos[1], 448]; p.vel = [0, 0, 0]; p.ducked = true; p.viewOffset = 28; const e = p.eye(); p.ang = [-Math.atan2(b.pos[2] - e[2], 98) * 180 / Math.PI, 0, 0]; G.use(); return !!G.held; })()
assert !!game.game.held
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 104, b.pos[1], 448]; p.vel = [0, 0, 0]; p.ducked = true; p.viewOffset = 28; const e = p.eye(); p.ang = [-Math.atan2(b.pos[2] - e[2], 104) * 180 / Math.PI, 0, 0]; G.use(); return !!G.held; })()
assert !game.game.held
map testchmb_a_02
step 60
eval (() => { const G = game.game, p = game.pl, b = G.cubes.find(c => c.alive && Math.hypot(c.pos[0] - 953, c.pos[1] - 779) < 6); p.pos = [b.pos[0] - 104, b.pos[1], 448]; p.vel = [0, 0, 0]; const e = p.eye(); p.ang = [4.2, 0, 0]; G.use(); return !!G.held; })()
assert !!game.game.held
