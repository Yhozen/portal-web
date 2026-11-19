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

8:24 to 8:30 PM. Wrote tools/tour.mjs to look around the later chambers without playing them: for each map it picks a few points of interest (ball launchers, buttons, turrets, cleansers, doors), finds a nearby eye position in open space using the BSP leaf contents, and takes a screenshot looking at the thing with a frame-rate sample. The first version put the camera inside walls and outside the map half the time; checking that the eye, the point below it and the midpoint to the target are all in empty leaves with a valid cluster fixed most of that. Shots are in /workspace/portal-web-shots/tour-*.png.

Looked at a08, a09, a10, a11, a13, a14, a15 and the three escape maps. Lightmaps, props and the prop ambient lighting from Nov 3 look right in all of them. I didn't see anything like the dark props from before. Frame rates at those spots were 22 to 60 fps (a10 around the ball launcher is the slowest at 22 to 36 with about 820 draws before I fixed the camera spots, 366 to 386 after).

The black areas above some chamber walls are expected. No test chamber has sky faces; that space is just outside the map.

8:31 PM. Found a real gap at the very end of the game. escape_02 is the only map with sky faces (58 of them, all in the area around the ending), plus a sky_camera at 0 0 2560 with scale 3 for a 3D skybox. The renderer skipped sky faces and had no skybox at all, so the ending outside the facility (the parking lot around 192 0 133, where the point_viewcontrol looks up at an angle) showed a black sky and none of the trees or background buildings. Before: before-escape02-ending-*.png.

Added a skybox to src/render.ts, written from the Valve Developer Wiki pages on 2D and 3D skyboxes:
- When a map has sky faces, the six skybox/<skyname><side> materials are loaded. The map names sky_day01_05_hdr; with no HDR here, the LDR set (sky_day01_05) is used when it exists. Side faces honour the "scale 1 2" texture transform, so the image fills the top half and the clamped bottom row fills the rest, which is how the game draws them.
- If sky_camera exists, the area around it is drawn from sky_camera + eye / scale, scaled up by the scale, then the depth buffer is cleared and the normal world is drawn on top. Only in the top-level view, since it ends with a full depth clear; portal views get the 2D sky only.
- It only runs when the view's PVS reaches a cluster that has sky faces, so the other maps and the indoor parts of escape_02 do no extra work.

First try drew the 2D sky as a small cube around the eye. It looked right except at exact angles: at a pitch of exactly 45 degrees, some cube corners sit exactly on the eye plane and SwiftShader drew smeared wedges across the screen. Switched to a full-screen pass that turns each pixel into a view ray and picks the cube face in the shader. That left a thin light line at each face seam, because the jump in texture coordinates there made the GPU pick the smallest mip. Sampling level 0 only fixed it. After: after-escape02-ending-*.png, side by side in compare-escape02-ending.png.

Frame rate at the ending view (headless SwiftShader, 1024x526, median over 5 s): 40 fps and 6.2 ms per frame without the sky, 28.5 fps and 10.2 ms with it. That is the cost of drawing the 3D skybox area (about 110 extra draws) and is only paid where the sky is visible. Indoors in escape_02 nothing changes (458 draws and about 28 fps either way), and testchmb_a_00 and a14 still don't load a sky (41 and 40 fps at spawn).

pnpm check is clean and pnpm test passes 27 of 27, including the repository guard.
