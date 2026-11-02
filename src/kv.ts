// KeyValues text parser (VMT, gameinfo, etc.). Keys are lowercased. Duplicate keys keep the first value.
export type KV = { [k: string]: string | KV };
export function parseKV(text: string): KV {
  let i = 0; const n = text.length;
  const tok = (): string | null => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text[i] === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
      break;
    }
    if (i >= n) return null;
    const c = text[i];
    if (c === '{' || c === '}') { i++; return c; }
    if (c === '"') { const e = text.indexOf('"', i + 1); const s = text.slice(i + 1, e < 0 ? n : e); i = e < 0 ? n : e + 1; return '\u0000' + s; }
    const st = i; while (i < n && !/[\s{}"]/.test(text[i])) i++; return '\u0000' + text.slice(st, i);
  };
  const block = (): KV => {
    const o: KV = {};
    for (;;) {
      const k = tok(); if (k === null || k === '}') return o;
      if (k === '{') { block(); continue; }
      const key = k.slice(1).toLowerCase(); const v = tok(); if (v === null) return o;
      let val: string | KV;
      if (v === '{') val = block(); else if (v === '}') return o; else {
        val = v.slice(1);
        // skip optional [$X360] conditionals
        const save = i; const nx = tok(); if (!(nx && nx.startsWith('\u0000[') )) i = save;
      }
      if (!(key in o)) o[key] = val;
    }
  };
  return block();
}
