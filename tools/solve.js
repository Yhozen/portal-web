(async () => { const G = game.game, io = G.io, out = []; const M = new URLSearchParams(location.search).get('map'); const tag = M.replace('testchmb_','').replace('escape_','e');
const ORD=['testchmb_a_00','testchmb_a_01','testchmb_a_02','testchmb_a_03','testchmb_a_04','testchmb_a_05','testchmb_a_06','testchmb_a_07','testchmb_a_08','testchmb_a_09','testchmb_a_10','testchmb_a_11','testchmb_a_13','testchmb_a_14','testchmb_a_15','escape_00','escape_01','escape_02'];
game.sim(10);
const btns = io.ents.filter(e => e.cls === 'trigger_multiple' && /button/i.test(e.name) && /box/i.test(e.name));
const center = e => e.bmins ? [(e.bmins[0]+e.bmaxs[0])/2, (e.bmins[1]+e.bmaxs[1])/2, e.bmins[2]] : e.pos;
const used = new Set();
for (const b of btns) { const flt = b.kv.filtername ? io.find(b.kv.filtername, null, b)[0] : null; const ok = c => c.alive && !used.has(c) && (!flt || G.passFilter(flt, c.ent)); let c = G.cubes.filter(ok)[0];
  if (!c) { for (const e of io.ents) if (e.cls === 'point_template' && /box/i.test(e.name)) io.deliver(e, 'forcespawn', '', null, e); game.sim(0.2); c = G.cubes.filter(ok)[0]; }
  if (!c) { out.push('no cube for ' + b.name); continue; } used.add(c); const p = center(b); c.pos = [p[0], p[1], p[2] + 14]; c.vel = [0,0,0]; c.asleep = false; out.push('cube->' + b.name + ' @' + p.map(v=>v|0)); }
game.sim(3);
out.push('doors ' + io.ents.filter(e => e.cls === 'func_door' && /exit/i.test(e.name)).map(e => e.name + ':' + e.state).join(','));
const lc = s => (s||'').toLowerCase(); const outs = e => [...e.outputs.values()].flat(); const clx = io.ents.filter(e => e.cls === 'trigger_changelevel' && ORD.indexOf(lc(e.kv.map)) > ORD.indexOf(lc(M))); const cls = clx.map(e => e.name);
const pts = io.ents.filter(e => e.cls === 'path_track' && outs(e).some(o => clx.some(c => lc(c.name) === lc(o.target))));
const trains = io.ents.filter(t => t.cls === 'func_tracktrain' && pts.some(pt => { let n = lc(t.kv.target), k = 0; while (n && k++ < 20) { if (n === lc(pt.name)) return true; const x = io.ents.find(q => q.cls === 'path_track' && lc(q.name) === n); n = x ? lc(x.kv.target) : ''; } return false; }));
const starters = io.ents.filter(t => /^trigger_(once|multiple)$/.test(t.cls) && outs(t).some(o => trains.some(tr => lc(tr.name) === lc(o.target)) && /startforward|resume/.test(lc(o.input))));
const el = starters.filter(t => /elevator/.test(lc(t.name))); const pre1 = starters.filter(t => !el.includes(t));
const landed = new URLSearchParams(location.search).get('landmark') || ''; out.push('cl ' + cls.join(','));
out.push('elev ' + el.map(e=>e.name).join(','));
const sc = new Set(io.ents.filter(e => e.cls === 'logic_choreographed_scene' && /success|exit|complete|done/i.test(e.name)).map(e => e.name.toLowerCase()));
for (const t of io.ents.filter(e => /^trigger_(once|multiple)$/.test(e.cls) && e.enabled !== false && [...e.outputs.values()].some(v => v.some(o => sc.has(o.target.toLowerCase()))))) { const p = center(t); game.pl.pos = [p[0], p[1], p[2] + 2]; game.pl.vel=[0,0,0]; game.sim(0.5); out.push('touched ' + (t.name || t.cls) + ' @' + p.map(v=>v|0)); }
const elx = el;
for (const e of elx) { for (const t of pre1) { if (t.kv.startdisabled === '1' || t.enabled === false) { const p0 = center(t); out.push('skip disabled ' + t.name); continue; } const p = center(t); game.pl.pos = [p[0], p[1], p[2] + 2]; game.pl.vel=[0,0,0]; game.sim(10); out.push('called elevator via ' + (t.name || t.cls) + ' @' + p.map(v=>v|0)); }

 const p = center(e); game.pl.pos = [p[0], p[1], p[2] + 2]; game.pl.vel = [0,0,0]; for (let i = 0; i < 45 && !window.changedTo; i++) game.sim(1); if (window.changedTo) break; }
if (!window.changedTo) for (const c of clx.filter(c => !(+(c.kv.spawnflags||0) & 2) && c.bmins)) { const p = center(c); game.pl.pos = [p[0], p[1], p[2] + 8]; game.pl.vel = [0,0,0]; game.sim(1); out.push('walked into touch changelevel ' + (c.name||'') + ' @' + p.map(v=>v|0)); if (window.changedTo) break; }
out.push('changedTo ' + window.changedTo);
out.push(io.log.filter(l => /changelevel|fail|error/i.test(l)).slice(-4).join(' ; '));
out.push(io.log.filter(l=>/a0\d-a0\d|elevator/.test(l)).slice(-12).join('\n')); return out.join('\n'); })()
