(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v|0), C = AP.centre, E = AP.ent;
const lg = (k, v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + JSON.stringify(v));
lg('start', P() + ' hasGun ' + G.hasGun);
const gun = E('portalgun'); lg('to gun', AP.gotoRetry(gun.origin, 40, 40, 1));
lg('gun?', G.hasGun + ' guns ' + G.guns.length + ' pos ' + P());
const m = C(E('a01-middletrigger_elevator_move')); lg('to mid elevator', AP.gotoRetry([m[0], m[1], m[2] - 40], 30, 40, 1));
AP.wait(40, () => { const b = E('a01-middleelevator_body'); return b.pos[2] > 600 && !b.speedNow; }); AP.wait(2); lg('up', P());
lg('section2 trigger', AP.gotoRetry([-448, -16, 650], 40, 10, 1)); AP.wait(3);
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' -> ' + (p.linked && p.linked.name)).join(' ; '));
const ex = C(E('trigger_exit_rm2a')); const exF = AP.floorUnder(E('trigger_exit_rm2a')); lg('exit floor', exF.map(v=>v|0)); { const o = G.portals.find(p => p.name === 'portal_fixed_a01_1'); lg('orange f', o.f); const sv = [...game.pl.pos]; game.pl.pos = [o.pos[0] + o.f[0] * 40, o.pos[1] + o.f[1] * 40, o.pos[2] - 20]; const fl = game.pl.trace(game.pl.pos, [game.pl.pos[0], game.pl.pos[1], game.pl.pos[2] - 400]); lg('floor below orange', fl.end.map(v=>v|0) + ' frac ' + fl.fraction); game.pl.pos = fl.end; const pp = AP.plan(exF, 40); lg('plan from orange', {ok: pp.ok, n: pp.expanded, bb: pp.bb, closest: pp.closest}); game.pl.pos = sv; }
let r = AP.goto(exF, 40); lg('exit direct', r.ok || r.why); if (!r.ok) lg('into orange room', AP.portalSolve([-700, 900, 576], 60, 0)); lg('at', P()); if (!r.ok && !false) lg('exit via portal', AP.portalSolve(exF, 40, 0, { vantage: true, spacing: 200, pitches: [-15, 0, 15, 30] })); lg('at', P());
lg('to elevator', AP.gotoRetry(AP.floorUnder(E('a01-a02_trigger_elevator_move')), 30, 20, 1)); AP.wait(40, () => window.changedTo); lg('changedTo', window.changedTo + ' pos ' + P());
out.push(AP.LOG.slice(-8).join('\n'));
out.push('open: ' + G.portals.filter(p => p.open).map(p => p.name + '@' + p.pos.map(v=>v|0) + ' -> ' + (p.linked && p.linked.name)).join(' ; '));
return out.join('\n'); })()
