// Test-only bundle entry: exposes the local-files module to the page.
import * as localfs from '../../../src/localfs.ts';
(globalThis as any).T = localfs;
