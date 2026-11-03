// Where game files come from. Two interchangeable sources behind one interface:
//  - ServerSource: the localhost dev server (node server/server.ts) streams /fs/<path> from the Steam install.
//  - LocalSource (localfs.ts): files the player copied from their own install into this browser's private
//    storage (OPFS). Used by the hosted build; nothing from the game is ever uploaded anywhere.
export interface FileSource {
  readonly kind: 'server' | 'local';
  read(path: string): Promise<ArrayBuffer | null>; // path is already normalised (lower case, forward slashes)
}

export class ServerSource implements FileSource {
  readonly kind = 'server';
  async read(p: string) {
    const r = await fetch('/fs/' + p.split('/').map(encodeURIComponent).join('/'));
    return r.ok ? r.arrayBuffer() : null;
  }
}

// The page chooses with window.PORTAL_FILES ('local' in the hosted shell); ?files=local|server|manage overrides.
export function filesMode(): 'server' | 'local' {
  const q = new URLSearchParams(location.search).get('files');
  if (q === 'local' || q === 'manage') return 'local';
  if (q === 'server') return 'server';
  return (globalThis as any).PORTAL_FILES === 'local' ? 'local' : 'server';
}

export async function openFileSource(): Promise<FileSource> {
  if (filesMode() === 'server') return new ServerSource();
  const { openLocalSource } = await import('./localfs.ts');
  return openLocalSource();
}
