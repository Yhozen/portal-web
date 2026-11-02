import { Assets } from './assets.ts';
import { loadVMT, type Material } from './vmt.ts';
import { parseVTF, decodeToRGBA, FMT, TEXF } from './vtf.ts';

export interface GLMat { name: string; vmt: Material | null; tex: WebGLTexture; w: number; h: number; translucent: boolean; additive: boolean; alphatest: number;
  unlit: boolean; tint: [number, number, number, number]; nodraw: boolean; noportal: boolean; selfillum: boolean; }

export class MaterialCache {
  gl: WebGL2RenderingContext; assets: Assets; s3tc: any; mats = new Map<string, Promise<GLMat>>(); texs = new Map<string, Promise<{ tex: WebGLTexture; w: number; h: number } | null>>();
  white: WebGLTexture; missing: WebGLTexture; vtfBytes = 0;
  constructor(gl: WebGL2RenderingContext, assets: Assets) {
    this.gl = gl; this.assets = assets; this.s3tc = gl.getExtension('WEBGL_compressed_texture_s3tc');
    this.white = this.solid([255, 255, 255, 255]); this.missing = this.solid([255, 0, 255, 255]);
  }
  solid(c: number[]) { const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c)); return t; }
  texture(path: string) {
    path = path.toLowerCase().replace(/\\/g, '/').replace(/\.vtf$/, '');
    let p = this.texs.get(path);
    if (!p) { p = this.loadTex(path); this.texs.set(path, p); }
    return p;
  }
  private async loadTex(path: string) {
    const buf = await this.assets.read('materials/' + path + '.vtf'); if (!buf) return null;
    let v; try { v = parseVTF(buf); } catch (e) { console.warn('vtf', path, e); return null; }
    this.vtfBytes += buf.byteLength;
    const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    const cfmt = this.s3tc && ({ [FMT.DXT1]: this.s3tc.COMPRESSED_RGB_S3TC_DXT1_EXT, [FMT.DXT1_ONEBITALPHA]: this.s3tc.COMPRESSED_RGBA_S3TC_DXT1_EXT, [FMT.DXT3]: this.s3tc.COMPRESSED_RGBA_S3TC_DXT3_EXT, [FMT.DXT5]: this.s3tc.COMPRESSED_RGBA_S3TC_DXT5_EXT } as Record<number, number>)[v.format];
    if (cfmt && v.width % 4 === 0 && v.height % 4 === 0) {
      let lv = 0;
      for (let m = 0; m < v.mips; m++) { const w = Math.max(1, v.width >> m), h = Math.max(1, v.height >> m); gl.compressedTexImage2D(gl.TEXTURE_2D, lv++, cfmt, w, h, 0, v.data[m][0]); }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, v.mips - 1);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, v.width, v.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, decodeToRGBA(v.format, v.data[0][0], v.width, v.height));
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, v.flags & TEXF.CLAMPS ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, v.flags & TEXF.CLAMPT ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    return { tex: t, w: v.width, h: v.height };
  }
  get(name: string) {
    name = name.toLowerCase().replace(/\\/g, '/').replace(/\.vmt$/, '');
    let p = this.mats.get(name); if (!p) { p = this.load(name); this.mats.set(name, p); } return p;
  }
  private async load(name: string): Promise<GLMat> {
    const vmt = await loadVMT(name, p => this.assets.text(p));
    const P = vmt?.params || {}; const sh = vmt?.shader || '';
    const flag = (k: string) => P[k] !== undefined && P[k] !== '0';
    let base = P['$basetexture'];
    const m: GLMat = { name, vmt, tex: this.missing, w: 1, h: 1, translucent: flag('$translucent') || flag('$additive') || /refract|water/.test(sh), additive: flag('$additive'),
      alphatest: flag('$alphatest') ? +(P['$alphatestreference'] || 0.5) : 0, unlit: /unlit|refract|water|sprite/.test(sh), tint: [1, 1, 1, 1], nodraw: name.startsWith('tools/'),
      noportal: flag('%noportal'), selfillum: flag('$selfillum') };
    if (/refract|water/.test(sh)) { const c = (P['$refracttint'] || P['$fogcolor'] || '{200 220 230}').replace(/[{}\[\]]/g, ' ').trim().split(/\s+/).map(Number); const s = (P['$refracttint'] || '').includes('{') || (P['$fogcolor'] || '').includes('{') ? 255 : 1;
      m.tint = [c[0] / s, c[1] / s, c[2] / s, 0.35]; if (!base) base = ''; }
    if (P['$alpha']) m.tint[3] = +P['$alpha'], m.translucent = true;
    if (P['$color']) { const c = P['$color'].replace(/[{}\[\]]/g, ' ').trim().split(/\s+/).map(Number); const s = P['$color'].includes('{') ? 255 : 1; m.tint = [c[0] / s, c[1] / s, c[2] / s, m.tint[3]]; }
    if (base) { const t = await this.texture(base); if (t) { m.tex = t.tex; m.w = t.w; m.h = t.h; } }
    else if (/refract|water/.test(sh)) m.tex = this.white;
    else if (!vmt) console.warn('missing material', name);
    return m;
  }
}
