(() => { const g=game.game; game.sim(12); const out=[g.portals.filter(p=>p.open).map(p=>p.name+(p.linked?'->'+p.linked.name:'')).join(',')];
game.pl.pos=[-591,-360,161]; game.look(0,270);
for (let i=0;i<300 && !g.stats.teleports;i++) game.step(1/66,{fwd:1,side:0,jump:false,duck:false});
out.push('tele '+g.stats.teleports+' pos '+game.pl.pos.map(v=>v|0)+' ang '+game.pl.ang.map(v=>v|0));
for (let i=0;i<60;i++) game.step(1/66,{fwd:1,side:0,jump:false,duck:false});
out.push('then '+game.pl.pos.map(v=>v|0)); game.look(0, game.pl.ang[1]+180); game.sim(0.05);
return JSON.stringify(out); })()
