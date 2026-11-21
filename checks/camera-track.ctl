# a00's first security camera (cam1_tca00, east wall) following the player, who strafes across the room below it while
# looking at it. The probe logs, per frame, the angle between the camera's lens axis and the line to the player's eye.
map testchmb_a_00
pose -450 -128 129 0 0
noclip off
lookat -256 -128 300
eval window.__probe = () => { const g = window.game, e = g.game.cameras[0], m = e.prop.model, t = g.npc.aimTable(m), W = g.game.entWorld(e), L = g.npc.lensAt(m, t.att, e.prop.poses[0], e.prop.poses[1]); const X = (v, w) => [W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + w * W[12], W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + w * W[13], W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + w * W[14]]; const d = X(L.dir, 0), p = X(L.pos, 1), eye = g.pl.eye(), to = [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]], n = Math.hypot(...to); return { poses: e.prop.poses.map(v => +v.toFixed(1)), err_deg: +(Math.acos(Math.max(-1, Math.min(1, (d[0] * to[0] + d[1] * to[1] + d[2] * to[2]) / n))) * 180 / Math.PI).toFixed(1), sees: !!e.camSees }; }; 1
record /workspace/portal-web-shots/anim/camera-track.mp4 90 33 d
record /workspace/portal-web-shots/anim/camera-track-back.mp4 120 33 a
