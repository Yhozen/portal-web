(() => { const G = game.game, io = game.io, out = []; const outs = e => [...e.outputs].flatMap(([k, l]) => l.map(o => k + '>' + o.target + '.' + o.input + (o.param ? '(' + o.param + ')' : '') + (o.delay ? '@' + o.delay : '')));
const c = e => e.bmins ? [0,1,2].map(i => ((e.bmins[i]+e.bmaxs[i])/2)|0) : e.origin.map(v => v|0);
out.push('player ' + game.pl.pos.map(v=>v|0));
for (const e of io.ents) { if (!/^(trigger_(once|multiple|changelevel|portal_cleanser|hurt|teleport)|func_door|prop_portal|weapon_portalgun|prop_physics|func_tracktrain|logic_auto|env_portal_path_track|prop_energy_ball|point_energy_ball_launcher|npc_portal_turret_floor|func_button|prop_floor_button)/.test(e.cls)) continue;
  out.push(e.cls + ':' + (e.name || '-') + '@' + c(e) + (e.enabled === false ? ' DISABLED' : '') + ' ' + outs(e).join(', ').slice(0, 260)); }
out.push('cubes ' + G.cubes.map(q => (q.ent.name || '-') + '@' + q.pos.map(v => v|0)).join(' '));
return out.join('\n'); })()
