# Journey

A running log of work on the port. Times are America/New_York.

## 2026-11-18, evening session (about 8:20 to 9:20 PM)

Gabriel asked for an hour on the port, starting from a fresh Linux depot of Portal pulled with steamcmd from his own account.

8:22 PM. Started on a new branch, gabriel/linux-depot, off main at 0d06ee2. The depot was still downloading, so I took baseline screenshots of the later chambers (a08 to a15 and the three escape maps) from the older install already on the box. They all load. a16 to a19 don't exist in Portal, so the 404s there are expected. Spawn-view frame rates in headless Chrome with SwiftShader at 1024x640 sit between 28 and 41 fps, which matches the numbers from Nov 2.

8:33 PM. steamcmd finished (app 400, buildid 19017868, 4.33 GB on disk), installed to /home/box/steam-games/portal-linux. Compared it with the older install:

- Same build id and the same SizeOnDisk as the old appmanifest.
- MD5 of all 660 VPK, BSP and txt files under hl2/, portal/ and platform/ match exactly.
- The only differences in the file list are the old install's save games (portal/save/), the appmanifest that steamcmd writes into the install folder (steamapps/appmanifest_400.acf), and two stray files named hl2_sound_vo_english_00x.vpk.box-store-snap-*, which come from the box's snapshot tooling, not from Steam.
- Ran the import selector from src/localfs.ts (selectImport and validateImport) over both folders under Node. Both give the same 1,148 files and 4.13 GB with no problems reported, and the stray snapshot files are filtered out by the existing patterns. So the hosted picker, the uploader manifest and the local server already work with a steamcmd install folder. No loader change needed.

Pointed the local server at the new depot (PORTAL_DIR=/home/box/steam-games/portal-linux) for the rest of the session.
