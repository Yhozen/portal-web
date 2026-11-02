window.LOOK = (from, at) => { game.pl.pos = from; const e = game.pl.eye(), d = [at[0]-e[0], at[1]-e[1], at[2]-e[2]]; game.pl.ang = [-Math.atan2(d[2], Math.hypot(d[0], d[1]))*180/Math.PI, Math.atan2(d[1], d[0])*180/Math.PI, 0]; game.pl.vel = [0,0,0]; };
window.FIRE = (n, i, p) => game.io.send(n, i, p || '');
window.NOFADE = () => { const h = game.game.hud; h.fade = 0; h.fadeTarget = 0; h.fadeHoldUntil = 0; };
