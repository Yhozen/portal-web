# Glass takes no portal. Measured in the original (tools/oracle-ctl.mjs, a08): shots at the start-room window in the
# main room's west wall and at the glass top of the cube's rail platform leave no portal. The port used to place one
# on both (on the window it sat over the 2-unit mullion with its corners on the glass).
map testchmb_a_08
assert (() => { const G = game.game, eye = [150, 0, 170], tg = [-262, 0, 170], d = tg.map((v, i) => v - eye[i]), n = Math.hypot(...d); G.shootPortal(0, { eye, f: d.map(v => v / n) }); return !G.gunPortals[0].open; })()
assert (() => { const G = game.game; G.shootPortal(1, { eye: [-60, -240, 364], f: [0, 0, -1] }); return !G.gunPortals[1].open; })()
# the floor next to the pit still takes one
assert (() => { const G = game.game; G.shootPortal(1, { eye: [-120, -160, 364], f: [0, 0, -1] }); const P = G.gunPortals[1]; return P.open && P.pos[2] < 1; })()
