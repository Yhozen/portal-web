(() => { const g=game.game; game.sim(8); game.pl.pos=[-650,-850,129]; game.sim(0.3); const out=[];
game.look(0,0); g.shootPortal(0); game.look(0,270); g.shootPortal(1);
game.look(0,0); for (let i=0;i<40;i++){ game.step(1/66,{fwd:1,side:0,jump:false,duck:false}); }
out.push('before '+game.pl.pos.map(v=>v|0)+' tele '+g.stats.teleports);
for (let i=0;i<200 && !g.stats.teleports;i++){ game.step(1/66,{fwd:1,side:0,jump:false,duck:false}); }
out.push('after '+game.pl.pos.map(v=>v|0)+' vel '+game.pl.vel.map(v=>v|0)+' ang '+game.pl.ang.map(v=>v|0)+' tele '+g.stats.teleports);
game.sim(0.5); out.push('later '+game.pl.pos.map(v=>v|0)+' onG '+game.pl.onGround);
return JSON.stringify(out); })()
