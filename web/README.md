# portal-web hosted preview (Cloudflare)

This folder deploys the **engine only** to a private Cloudflare preview at `https://portal.rccpr.tech`.
It never ships game data. Players supply their own Steam copy of Portal in the browser. The files are
copied into the browser's private storage (OPFS) on their device and never leave it.

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

- `pnpm dev`: `workerd` on `127.0.0.1:8430` serves `.build/` with Access simulated as
  `local@localhost`. It does not need Cloudflare credentials.
- `pnpm serve`: a static server on `127.0.0.1:8431`.
- `pnpm test`: Worker routing, headers, guard and artifact tests, the import-selection unit tests,
  and Chromium tests on synthetic, made-up files: directory handle, drop, OPFS copy/resume, VPK
  reads, search order, bad selection, full disk and forget.
- `pnpm e2e`: with `pnpm dev` running, this feeds the real local Steam install
  (`PORTAL_DIR`, default `~/.steam/debian-installation/steamapps/common/Portal`) through the folder
  input into OPFS. It then checks that a00 renders, that a reload skips the picker, that the a00
  autopilot reaches `testchmb_a_01`, and that manage and forget work. It uses a throwaway Chrome
  profile and saves shots `shots/45-…` to `shots/50-…`.

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
