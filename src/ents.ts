// Entity I/O system (outputs -> inputs with delays), modelled on the documented Source "Inputs and Outputs"
// behaviour (Valve Developer Wiki). Only the entity classes the first chambers need are implemented.
import type { V3 } from './math.ts';
import { parseV3 } from './math.ts';

export interface Output { target: string; input: string; param: string; delay: number; times: number; }
export class Ent {
  kv: Record<string, string>; cls: string; name: string; origin: V3; angles: V3; outputs = new Map<string, Output[]>(); killed = false; enabled = true; [k: string]: any;
  constructor(kv: Record<string, string>) {
    this.kv = kv; this.cls = kv.classname; this.name = (kv.targetname || '').toLowerCase(); this.origin = parseV3(kv.origin); this.angles = parseV3(kv.angles);
    for (const [k, v] of Object.entries(kv)) {
      if (!/^on|^out/i.test(k)) continue;
      for (const raw of v.split('\u001e')) {
        const p = raw.split(raw.includes('\u001b') ? '\u001b' : ','); if (p.length < 2) continue;
        const list = this.outputs.get(k) || []; list.push({ target: p[0].toLowerCase(), input: (p[1] || '').toLowerCase(), param: p[2] || '', delay: +(p[3] || 0), times: +(p[4] ?? -1) }); this.outputs.set(k, list);
      }
    }
    if (kv.startdisabled === '1') this.enabled = false;
  }
}
interface Ev { t: number; target: string; input: string; param: string; activator: Ent | null; caller: Ent; }

export class IO {
  ents: Ent[] = []; byName = new Map<string, Ent[]>(); queue: Ev[] = []; time = 0; handlers = new Map<string, (e: Ent, input: string, param: string, act: Ent | null, caller: Ent) => boolean>();
  log: string[] = []; timeScale = 1; player!: Ent;
  add(e: Ent) { this.ents.push(e); if (e.name) { const l = this.byName.get(e.name) || []; l.push(e); this.byName.set(e.name, l); } }
  find(name: string, act: Ent | null, caller: Ent | null): Ent[] {
    name = name.toLowerCase();
    if (name === '!player') return [this.player]; if (name === '!activator') return act ? [act] : []; if (name === '!self' || name === '!caller') return caller ? [caller] : [];
    if (name.endsWith('*')) { const pre = name.slice(0, -1); return this.ents.filter(e => !e.killed && e.name.startsWith(pre)); }
    return (this.byName.get(name) || []).filter(e => !e.killed).concat(this.ents.filter(e => !e.killed && !e.name && e.cls === name));
  }
  fire(e: Ent, output: string, act: Ent | null, paramOverride?: string) {
    const list = e.outputs.get(output.toLowerCase()); if (!list) return;
    for (const o of list) {
      if (o.times === 0) continue; if (o.times > 0) o.times--;
      this.queue.push({ t: this.time + o.delay * (o.delay > 8 ? this.timeScale : 1), target: o.target, input: o.input, param: o.param || paramOverride || '', activator: act, caller: e });
    }
  }
  send(target: string, input: string, param = '', delay = 0, act: Ent | null = null, caller: Ent | null = null) { this.queue.push({ t: this.time + delay, target: target.toLowerCase(), input: input.toLowerCase(), param, activator: act, caller: caller || this.player }); }
  update(dt: number) {
    this.time += dt;
    for (let guard = 0; guard < 1000; guard++) {
      let bi = -1; for (let i = 0; i < this.queue.length; i++) if (this.queue[i].t <= this.time && (bi < 0 || this.queue[i].t < this.queue[bi].t)) bi = i;
      if (bi < 0) break; const ev = this.queue.splice(bi, 1)[0];
      for (const t of this.find(ev.target, ev.activator, ev.caller)) this.deliver(t, ev.input, ev.param, ev.activator, ev.caller);
    }
  }
  deliver(e: Ent, input: string, param: string, act: Ent | null, caller: Ent) {
    if (this.log.length > 400) this.log.shift(); this.log.push(`${this.time.toFixed(2)} ${e.name || e.cls}.${input}(${param})`);
    if (input === 'setparent') { e.kv.parentname = param; e.attachRel = null; e.reparentNow = true; return; }
    if (input === 'clearparent') { if (e.worldM) { e.pos = [e.worldM[12], e.worldM[13], e.worldM[14]]; } delete e.kv.parentname; e.attachRel = null; return; }
    if (input === 'kill') { e.killed = true; e.enabled = false; e.onKill?.(); return; }
    if (input === 'killhierarchy') { e.killed = true; e.enabled = false; e.onKill?.(); return; }
    if (input.startsWith('fireuser')) { this.fire(e, 'onuser' + input.slice(8), act); return; }
    const h = this.handlers.get(e.cls); if (h && h(e, input, param, act, caller)) return;
    if (input === 'enable') e.enabled = true; else if (input === 'disable') e.enabled = false; else if (input === 'toggle') e.enabled = !e.enabled;
  }
}
