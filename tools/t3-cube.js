(() => { const g=game.game; game.sim(8); const c=g.cubes[1]; const out=['cube '+c.pos.map(v=>v|0)];
game.pl.pos=[c.pos[0]+60,c.pos[1],128.1]; game.sim(0.2);
const e=game.pl.eye(); const d=[c.pos[0]-e[0],c.pos[1]-e[1],c.pos[2]-e[2]]; game.look(-Math.atan2(d[2],Math.hypot(d[0],d[1]))*180/Math.PI, Math.atan2(d[1],d[0])*180/Math.PI); g.use(); out.push('held '+!!g.held);
const B=[-512,-928];
for(let i=0;i<900;i++){ const dx=B[0]-game.pl.pos[0], dy=B[1]-game.pl.pos[1]; if(Math.hypot(dx,dy)<75)break; game.look(25,Math.atan2(dy,dx)*180/Math.PI); game.step(1/66,{fwd:1,side:0,jump:false,duck:false}); }
out.push('at '+game.pl.pos.map(v=>v|0)+' cube '+c.pos.map(v=>v|0));
g.use(); game.pl.pos=[-640,-900,128.1]; game.sim(2); out.push('dropped cube '+c.pos.map(v=>v|0));
const door=g.io.find('exit_door_left_a00')[0]; out.push('door t '+door.t.toFixed(2)+' state '+door.state);
out.push(g.io.log.filter(l=>/button|exit_door/.test(l)).slice(-8).join(';'));
game.pl.pos=[-640,-900,128.1]; game.look(5,180); game.sim(0.1);
return JSON.stringify(out); })()
