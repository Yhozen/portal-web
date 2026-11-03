# portal-web hosted preview (Cloudflare)

This folder deploys the **engine only** to a private Cloudflare preview at `https://portal.rccpr.tech`.
Build and deploy never ship game data. Players supply their own Steam copy of Portal in the browser. The
files are copied into the browser's private storage (OPFS) on their device and never leave it.

The one exception is the owner (`ownerEmail` in `scripts/config.mjs`, `gabriel@garox.org`). He can copy
his own install into a second, private R2 bucket by hand (`pnpm upload-game-files`, see
[Owner files](#owner-files-private-bucket)). The Worker serves that bucket only to his Access identity,
so on any browser he plays without picking a folder.

It follows Horizon's `web/` deploy (Alchemy v2 beta, `alchemy` / `@alchemy.run/cloudflare`
2.0.0-beta.84, `effect` 4.0.6, pinned in `pnpm-lock.yaml`):

- Stack `PortalWeb`, stage `preview` only.
- Worker `portal-web-preview` on the custom domain `portal.rccpr.tech`. `workers.dev` is enabled and
  version preview URLs are disabled.
- Cloudflare Access application "Portal private preview": One-time PIN e-mail login, a 24 h session,
  and an allow policy for the e-mails in `scripts/config.mjs` (`allowedEmails`, the same as Horizon's).
  The Worker also checks the Access identity against `ALLOWED_EMAILS`.
- A new private R2 bucket (`Engine`, no public access) holds only the engine bundle. The bundle is one
  content-addressed object, `assets/<sha256>/portal-engine.js` (~130 kB), uploaded by the `PublishAssets`
  Action before the Worker release.
- The HTML shell, `loader.js` and `release.json` are embedded in the Worker. Like Horizon, this avoids
  Static Assets because of the `ctx.access` limitation. They are served `no-store` with a strict CSP.
  The engine is served by an internal `Assets` entrypoint with Workers Cache (`crossVersionCache`) as
  `private, max-age=31536000, immutable`. The `X-Portal-Asset-Cache` header shows the cache status.
  `loader.js` loads the engine with Subresource Integrity (the SHA-256 is in `release.json`).
  `RELEASE_ID` is the release hash. There is no container or multiplayer.
- A second private R2 bucket, `GameFiles` (`portal-web-preview-game-files`), is created empty. It has no
  public access, no r2.dev URL, no custom domain and no CORS. Only `/files/…` reads it, and only for the
  owner (see below).

## Never-upload guard

`scripts/guard.mjs` runs:

- in `pnpm build`, on the esbuild inputs (only `src/*.ts` is allowed), on the output and on `upload.json`;
- in `alchemy.run.ts`, before the stack reads the build;
- in the upload Action, before each object goes to R2.

It fails on:

- Valve/Source file extensions (vpk, bsp, vtf, vmt, mdl, vvd, vtx, phy, wav, mp3, pcf, cache, captions…);
- Steam paths (`steamapps`, `common/Portal`, …);
- file magic (VPK, VBSP, VTF, IDST, IDSV, RIFF, ID3/MP3, ZIP, LZMA, OGG, gzip);
- any file over 10 MB or any file that isn't on the allowlist.

`pnpm guard:repo` (also run by `pnpm test`) applies the same checks to the git working tree and every
blob in history. No build, plan or deploy script touches the game-files bucket, and a test enforces this.

## Deploy from the Mac

Prerequisites in Cloudflare (once):

1. Use the same account as Horizon, with the `rccpr.tech` zone active on it. The custom domain makes
   Cloudflare create the `portal` DNS record and TLS certificate itself. Don't add a DNS record by hand;
   if a `portal.rccpr.tech` record already exists, delete it first or the domain attach fails.
2. Zero Trust/Access must be enabled. The stack *looks up* the existing One-time PIN identity provider
   (created by `HorizonWeb`) instead of creating or adopting it, so deleting this stack cannot remove
   Horizon's login. If the account has no One-time PIN provider, add one in Zero Trust → Settings →
   Authentication first.
3. The token in Alchemy's `default` profile needs Workers Scripts, Workers Routes/Custom Domains,
   R2, Access (apps and policies) and Zone read for `rccpr.tech`. Horizon's profile already has these.

```sh
cd portal-web/web
pnpm install
pnpm alchemy profile show --profile default           # reuse Horizon's profile, or:
# pnpm alchemy profile edit --profile default --add Cloudflare
pnpm build                                             # esbuild ../src -> .build (guarded)
pnpm test && pnpm check
pnpm alchemy plan --stage preview --profile default    # review: 1 bucket, 1 worker, 1 access app, 1 domain
pnpm alchemy deploy --stage preview --profile default  # or: pnpm run deploy (builds first)
```

As with Horizon, remove any `CLOUDFLARE_*` environment variables from the shell so that the reviewed
`default` profile is used.

After deploying:

1. Open `https://portal.rccpr.tech` in a private window. You should get the Access e-mail code, then
   the "Portal files" screen.
2. Check that an anonymous `curl -I https://portal.rccpr.tech/` is redirected to Access.
3. To roll back, deploy an older commit. Old engine objects stay in R2.
4. Optional, owner only: upload your own files (next section).

## Owner files (private bucket)

This step is run by hand from the owner's Mac, after the first deploy has created the bucket. It is
never part of build or deploy:

```sh
cd portal-web/web
pnpm upload-game-files --dry-run --from "~/Library/Application Support/Steam/steamapps/common/Portal"
pnpm upload-game-files --from "~/Library/Application Support/Steam/steamapps/common/Portal"
```

- It uploads the same selection as the in-browser picker (1,148 files, 4.13 GB; the largest is 134 MB,
  under R2's 300 MB single-PUT limit). Each file goes to `files/<path>`, using the R2 REST API with the
  Alchemy `default` profile's Cloudflare token (it needs R2 edit).
- It can be resumed. A re-run skips files whose size and MD5 already match, so after a Steam update you
  just run it again. `manifest.json` is deleted before any change and written last, after every object
  has been listed and verified. A half-finished upload is therefore never offered to the engine.
  `--prune` deletes objects that are no longer selected; `--concurrency N` defaults to 4.
- The Worker serves `GET/HEAD /files/<portal|hl2>/…` and `/files/manifest.json`. It does this only after
  the normal Access check, and only if the Access identity e-mail equals `OWNER_EMAIL`. Everyone else on
  the allowlist gets `403`, and their player falls back to the **Portal files** picker. Without an Access
  session, Access redirects to login at the edge, as for every route. Responses are
  `Cache-Control: private, max-age=86400` and `Vary: Cookie`, with ETag/304 and single HTTP Range
  (206/416, If-Range). The manifest is `private, no-store`. These responses come from the Worker's
  default entrypoint, never from the shared Workers Cache.
- Engine order: `?files=manage` shows the files screen. Otherwise the engine uses a complete OPFS copy
  if one exists (fastest, no network), then the owner bucket (`/files/manifest.json` returns 200, so the
  source is `hosted-private` and archives are read with Range requests), then the picker.
  `?files=hosted` uses only the bucket (it shows an error instead of the picker); `?files=device` skips
  the bucket. `window.hostedFiles` holds the probe status.
- To remove the files, empty the bucket in the dashboard (R2 → `portal-web-preview-game-files`). The
  bucket is not force-destroyed, so destroying the stack fails until it is empty.

### Costs

R2 has no egress fees. The figures below use R2 Standard list prices; check the dashboard for your account.

- Storage: 4.13 GB, inside the 10 GB-month free tier. Above it, R2 costs $0.015/GB-month, so this would
  be about $0.06 a month.
- Uploads: about 1,150 Class A operations (PUTs, plus a few lists and deletes) per full upload. A re-run
  that changes nothing costs only a couple of list calls. The free tier includes 1M Class A per month.
- Play: one Class B operation per read. a00 took about 386 reads (20 whole files plus 366 ranges); the
  free tier includes 10M Class B per month. Each read is also one Worker request (free plan 100k a day,
  paid plan 10M a month included).

## Player flow

1. Sign in with the e-mailed one-time PIN (allowlisted addresses only).
2. The first visit shows **Portal files**. Players can click **Choose Portal folder…** (Chrome/Edge,
   File System Access API), use **Select folder…** (any browser, `<input webkitdirectory>`), or drag
   the folder onto the page. In Steam: right-click Portal → Manage → Browse local files.

   The picker accepts the install folder or anything above it (`common/` or `steamapps/`) and reads
   only Portal's subtree. Only the files the engine uses are copied (about 1,150 files, 4.1 GB): the
   five VPK sets plus their archives, `portal/maps/*.bsp`, `resource/`, `scripts/` and `sound/`.

   The copy shows progress, size and speed. It resumes after an interruption, because files already
   stored at the right size are kept. It also checks the quota first: if space is short, the message
   says how much is needed. The page calls `navigator.storage.persist()`. A manifest is written last,
   so a half-done copy is never used.
3. Later visits read straight from OPFS (a00 loads in about 0.2 s). **Portal files…** (bottom right)
   or `?files=manage` reopens the screen with the saved size, storage use, persistence state, **Play**
   and **Forget files**. Forget files deletes the whole copy.

Local server mode (`node server/server.ts`, `127.0.0.1:8420`) is unchanged and remains the default
for `site/`. Hosted mode is selected by `window.PORTAL_FILES = "local"` (set by `web/loader.js`) or
`?files=local`. `?files=server` forces server mode.

## Local testing

- `pnpm dev`: miniflare (`workerd`) on `127.0.0.1:8430` runs the real Worker with local R2 emulation
  in `.dev-r2/` (gitignored), seeded with `.build/`. It does not need Cloudflare credentials. Access is
  simulated: the identity is the owner by default; `X-Dev-Access-Email: friend@localhost` acts as
  another allowlisted player, and `X-Dev-Access-Email: none` acts as no identity. This header only
  exists in the dev worker.
- `pnpm upload-game-files --local --from <install>`: seeds the local `FILES` bucket (the same code
  path, through the R2 binding). Run it with `pnpm dev` stopped, or restart dev afterwards.
- `pnpm serve`: a static server on `127.0.0.1:8431`.
- `pnpm test`: Worker routing, headers, guard and artifact tests, the import-selection unit tests,
  and Chromium tests on synthetic, made-up files: directory handle, drop, OPFS copy/resume, VPK
  reads, search order, bad selection, full disk and forget.
- `pnpm e2e`: with `pnpm dev` running, this feeds the real local Steam install
  (`PORTAL_DIR`, default `~/.steam/debian-installation/steamapps/common/Portal`) through the folder
  input into OPFS. It then checks that a00 renders, that a reload skips the picker, that the a00
  autopilot reaches `testchmb_a_01`, and that manage and forget work, all as `friend@localhost`. It
  first checks that the owner loads a00 from the seeded local bucket with no picker (source
  `hosted-private`) and that the autopilot reaches `testchmb_a_01`. It also checks that the friend
  gets `403` and the picker. It uses throwaway Chrome profiles and saves shots `shots/45-…` to `50-…`
  and `51-…`/`52-…` (owner). `--skip-owner` skips the owner phase if the local bucket isn't seeded.

## Limitations

- `showDirectoryPicker` is Chromium-only. Firefox and Safari get the folder input and drag-and-drop.
  Safari versions without `createWritable` copy through a worker using `createSyncAccessHandle`.
  Only Chromium was tested here.
- The data is a 4.1 GB one-time copy per browser profile. If `persist()` isn't granted, which is
  common until the site is bookmarked or used often, the browser may evict it under storage pressure.
- Safari's OPFS quota may be lower than 4.1 GB, in which case the copy stops with a clear message.
- On macOS, Chrome's picker may refuse `~/Library`. Use **Select folder…** or drag the folder from
  Finder (Steam → Manage → Browse local files opens it).
- Resume and reuse compare file sizes only. After a Steam update, choose **Forget files** and import
  again.
- Mobile browsers are not supported (there is no Steam install there).
- Owner files: the bucket is read over the network, so the first load of a map is slower than OPFS.
  The browser's private HTTP cache keeps files for a day. Uploading uses the 300 MB single-PUT REST
  path, so a future file over 300 MB would need multipart (none exists in Portal today).
- The `/files/` check trusts the same Access identity as the rest of the Worker (the platform's
  `ctx.access.getIdentity()`, which request headers cannot forge). Anyone added to `ownerEmail` can read
  the bucket, so keep it to your own address.
