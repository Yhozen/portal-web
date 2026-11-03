// First-run / "Portal files" screen for the hosted build: choose the Steam install, watch the copy, forget it.
import {
  entriesFromDrop, entriesFromFileList, entriesFromHandle, fmtBytes, forgetFiles, importFiles, readManifest,
  selectImport, storageInfo, opfsSupported, type RawEntry,
} from './localfs.ts';

const CSS = `#files{position:fixed;inset:0;z-index:10;background:#0b0f12f2;color:#dde;font:15px/1.45 system-ui,sans-serif;display:flex;align-items:center;justify-content:center}
#files .box{max-width:640px;width:calc(100% - 40px);padding:28px 32px;border:1px solid #fff2;border-radius:10px;background:#12181d}
#files h1{font-size:22px;margin:0 0 6px;color:#fff}#files p{margin:8px 0;color:#bcc}#files code{font:13px ui-monospace,monospace;color:#9de;word-break:break-all}
#files .drop{margin:16px 0;padding:22px;border:2px dashed #fff3;border-radius:8px;text-align:center;color:#9ab}
#files .drop.over{border-color:#6cf;background:#6cf1;color:#fff}
#files button,#files label.btn{font:14px system-ui,sans-serif;padding:8px 14px;margin:4px 8px 4px 0;border-radius:6px;border:1px solid #6cf8;background:#1d3a4d;color:#fff;cursor:pointer;display:inline-block}
#files button.danger{border-color:#f668;background:#4d1d1d}#files button:disabled{opacity:.4;cursor:default}
#files .bar{height:8px;background:#fff1;border-radius:4px;overflow:hidden;margin:10px 0 4px}#files .bar i{display:block;height:100%;width:0;background:#6cf}
#files .status{white-space:pre-wrap;font-size:13px;color:#9ab;min-height:1.4em}#files .err{color:#f99}#files small{color:#789}`;

export async function showFilesScreen(): Promise<void> {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'files'; document.body.appendChild(root);
  (window as any).filesScreen = 'open';
  try { await run(root); } finally { root.remove(); style.remove(); (window as any).filesScreen = 'closed'; }
}

function run(root: HTMLElement) {
  return new Promise<void>(resolve => {
    const picker = typeof (window as any).showDirectoryPicker === 'function';
    root.innerHTML = `<div class="box">
      <h1>Portal files</h1>
      <p>This player needs the game files from <b>your own copy of Portal</b> (Steam). They are copied into this
      browser's private storage on this device and are never uploaded.</p>
      <p><small>In Steam: right-click Portal → Manage → Browse local files. Usual locations:<br>
      macOS <code>~/Library/Application Support/Steam/steamapps/common/Portal</code><br>
      Windows <code>C:\\Program Files (x86)\\Steam\\steamapps\\common\\Portal</code><br>
      Linux <code>~/.steam/steam/steamapps/common/Portal</code></small></p>
      <div class="have" hidden></div>
      <div class="actions">
        ${picker ? '<button class="pick">Choose Portal folder…</button>' : ''}
        <label class="btn">Select folder…<input class="dirinput" type="file" webkitdirectory multiple hidden></label>
      </div>
      <div class="drop">…or drag the Portal folder (or its VPK files) here</div>
      <div class="bar" hidden><i></i></div>
      <div class="status"></div>
    </div>`;
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    const status = $('.status'), bar = $('.bar'), fill = bar.querySelector('i') as HTMLElement, have = $('.have');
    const say = (t: string, err = false) => { status.textContent = t; status.classList.toggle('err', err); (window as any).filesStatus = t; };
    let busy = false;
    const setBusy = (b: boolean) => { busy = b; root.querySelectorAll('button,input').forEach(e => (e as HTMLButtonElement).disabled = b); };

    const showHave = async () => {
      const m = await readManifest(); const info = await storageInfo().catch(() => null);
      if (!m) { have.hidden = true; return; }
      have.hidden = false;
      have.innerHTML = `<p>Saved in this browser: <b>${Object.keys(m.files).length} files, ${fmtBytes(m.total)}</b>
        ${info ? `<br><small>Storage used ${fmtBytes(info.usage)} of ${fmtBytes(info.quota)} · ${info.persisted ? 'kept until you forget them' : 'the browser may clear them under storage pressure'}</small>` : ''}</p>
        <button class="play">Play</button><button class="danger forget">Forget files</button>`;
      ($('.play') as HTMLButtonElement).onclick = done;
      ($('.forget') as HTMLButtonElement).onclick = async () => {
        if (busy) return; setBusy(true);
        try { await forgetFiles(); say('Forgot the saved Portal files.'); } catch (e: any) { say('Could not delete: ' + (e?.message ?? e), true); }
        setBusy(false); await showHave();
      };
    };
    const done = () => {
      const u = new URL(location.href); if (u.searchParams.get('files') === 'manage') { u.searchParams.delete('files'); history.replaceState(null, '', u); }
      resolve();
    };

    const ingest = async (collect: () => Promise<RawEntry[]>) => {
      if (busy) return; setBusy(true); bar.hidden = true;
      try {
        say('Looking for Portal files…');
        const sel = selectImport(await collect());
        const total = sel.reduce((s, x) => s + x.size, 0);
        say(`Found ${sel.length} files (${fmtBytes(total)}). Checking…`);
        bar.hidden = false; const t0 = performance.now();
        await importFiles(sel, p => {
          fill.style.width = (100 * p.done / Math.max(1, p.total)).toFixed(1) + '%';
          const rate = p.done / Math.max(0.001, (performance.now() - t0) / 1000);
          say(p.file ? `Copying ${p.index + 1}/${p.count}: ${p.file}\n${fmtBytes(p.done)} of ${fmtBytes(p.total)}${rate > 1e6 ? ` · ${fmtBytes(rate)}/s` : ''}` : `Copied ${fmtBytes(p.total)}.`);
          (window as any).filesProgress = p;
        });
        say(`Saved ${sel.length} files (${fmtBytes(total)}). Starting…`);
        setBusy(false); done();
      } catch (e: any) {
        if (e?.name === 'AbortError') say('');
        else say(String(e?.message ?? e), true);
        setBusy(false); await showHave();
      }
    };

    if (!opfsSupported()) { say('This browser has no private file storage (OPFS). Use a current Chrome, Edge, Firefox or Safari.', true); return; }
    const pick = root.querySelector('.pick') as HTMLButtonElement | null;
    if (pick) pick.onclick = () => ingest(async () => entriesFromHandle(await (window as any).showDirectoryPicker({ id: 'portal', mode: 'read' })));
    const input = $('.dirinput') as HTMLInputElement;
    input.onchange = () => { const files = [...(input.files ?? [])]; input.value = ''; if (files.length) ingest(async () => entriesFromFileList(files)); };
    const drop = $('.drop');
    root.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    root.addEventListener('dragleave', () => drop.classList.remove('over'));
    root.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const dt = e.dataTransfer; if (dt) { const p = entriesFromDrop(dt); ingest(() => p); } });
    showHave();
  });
}
