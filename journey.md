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

8:40 PM. Change of plan from Gabriel: build a proper test harness first, modelled on Horizon's native client doc (docs/native-client.md in horizon-rust/horizon, the "Agent control" section about horizon-ctl), then use it for the chamber checks.

What I took from horizon-ctl: one command per line in, one JSON line per command out, errors as JSON with a reason, a script mode that stops at the first error unless told to keep going, and the same exit codes (0 ok, 1 command failed, 2 usage, 3 couldn't start). What I left out: horizon-ctl attaches to a running game over a socket and has an MCP server. Here each run starts its own asset server on a free port and its own headless Chromium, and stops both at the end. That is simpler and enough for reproducing bugs; a long-running mode can come later if it's needed.

The result is tools/portal-ctl.mjs, documented in docs/harness.md. Commands: map, pose, look, noclip, step N [keys], shoot, use, fire (entity input), set (renderer switches), render, screenshot, bench, diff, state, ents, errors, eval, sleep.

Determinism took two tries. The first version paused the page's frame loop right after the map loaded, and two runs of the same script matched on testchmb_a_01. But comparing main against this branch over 30 views in the later chambers showed differences in a09, a10 and a11, maps the skybox can't touch. The cause was the page simulating and drawing a few real-time frames between "ready" and the harness pausing it, so doors and ball launchers had moved by a varying amount. Now the pause is set by an init script before any page code runs, Math.random is seeded, the game only advances on step (fixed 1/66 s ticks), and screenshots are taken from the canvas right after an explicit draw. With that, all 30 views are byte-identical between main (0d06ee2, served from a worktree) and this branch, which also confirms the skybox only changes the ending.

checks/escape02-ending.ctl and checks/later-chambers.ctl hold the two scripts I used (map names, coordinates and commands only, nothing from the game). Screenshots go to /tmp/portal-checks/.

bench numbers (frames drawn back to back with gl.finish, SwiftShader, 1024x640), p50 per frame at the 30 later-chamber views: 13.8 to 45 ms. Slowest are escape_02 (34.7 to 45 ms, 459 to 525 draws), a10 near the exit doors (42.9 ms, 386 draws) and escape_00 (31 to 41 ms). At the ending view, sky off 22.4 ms vs sky on 37.1 ms.

Small findings from the harness's errors command:
- Every map that has a portal gun makes one 404 for w_portalgun.vmt with the cdmaterials path doubled. That is the model loader probing cdmaterials + name before falling back to the plain name, which then works. It's noise, not a bug.
- escape_01's rot_door_frame.mdl asks for a material named "debugempty", which isn't found because the real file is materials/debug/debugempty.vmt. I looked at the door and didn't see anything wrong, so I left it.
- The dark lift pillars in a15 get an ambient cube of about 0.3 to 0.45 at their centre. They're dark, but that looks like the right answer for a dark metal model standing in the pit, not a lighting bug.

8:50 PM. Used the harness on escape_02. A 20-second smoke run from each later map's spawn (checks/later-smoke.ctl: real physics, 1,320 ticks) showed no page errors, and the player stayed inside the map everywhere. escape_02 stood out for simulation cost: about 2 ms per tick against 0.3 to 0.7 ms elsewhere. Timing the game's sub-steps from the harness (eval to wrap animateProps and update) put 376 of 1,397 ms over 660 ticks in animateProps. The only animating prop is GLaDOS's body (glados_body.mdl, 21,575 vertices), and it was CPU-skinned and re-uploaded on every 1/66 s tick, on screen or not.

Fix: animateProps still advances the animation every tick, but the skinning now waits until the renderer actually draws the prop, and runs once per pose change. Off-screen props never get skinned. Results:
- animateProps fell from 376 ms to 12 ms per 660 ticks, and the whole escape_02 simulation from 1,326 ms to 962 ms against main (2.0 to 1.46 ms per tick).
- checks/glados-anim.ctl looks at GLaDOS at two points in the animation. Both frames are byte-identical to main's.
- All 30 later-chamber views are still identical to main's.

Things I tried and backed out:
- $selfillum on models. GLaDOS and the other props_bts models use $selfillum, which the renderer only applies to world faces (as fully unlit). I added the Source behaviour, where the base texture's alpha masks a self-lit term. GLaDOS's lights came up, but the lift platforms in a14 and a10 went bright white, because their textures have no real alpha mask. I can't check that against the real game from here, so I reverted it. The before/after is in selfillum-experiment-main-vs-mask.png and selfillum-experiment-glados.png. Open question: what do the lift platforms look like in the game, and does the engine ignore $selfillum when the texture has no alpha?
- Screenshot alpha. The WebGL canvas has an alpha channel, and opaque passes write the texture's alpha into it. Image viewers then showed GLaDOS as pure white, which isn't what the page shows (it sits on a black background). The harness now flattens screenshots over black. The canvas itself is unchanged.

State at the end of the session: branch gabriel/linux-depot, nothing pushed, nothing deployed. The R2 bucket wasn't touched.

Still open:
- Turrets aren't implemented, as listed in the README. a08 onward hasn't been played end to end by the autopilot; the per-chamber scripts stop at a07.
- The black areas above walls in the chambers are correct (no sky faces there), but they show in noclip.
- debugempty on escape_01's rot_door_frame, the w_portalgun cdmaterials probe 404, and the $selfillum question above.
- A long-running harness mode (one browser, many commands over a socket, like horizon-ctl) would make interactive bug hunting faster. Each run currently pays about 1 to 2.5 s for the map load.

8:58 PM. The rest of the escape_02 tick cost was elsewhere in update, outside the named sub-steps (they added up to about 70 of 997 ms). The cause turned out to be EntityIO.find. For a plain name, it also matches entities whose classname equals the name, and it found those by scanning all 1,565 entities. The parenting code looks up each parented prop's parent twice a tick, and escape_02 has 67 of them, so that alone was about 370 ms per 660 ticks in a direct test. find now keeps an index by classname, in the same add order, with the same killed and unnamed checks at call time.

escape_02 simulation went from 962 to 200 ms per 660 ticks, so with the skinning change it's about 0.3 ms per tick instead of 2.0. The smoke run (1,320 ticks per map) got faster on every later map, for example a15 from 832 to 300 ms, escape_00 from 831 to 360 ms and escape_02 from 1,923 to 437 ms. Checks that nothing changed:
- The smoke run's state replies (positions, clusters, energy-ball counts) and all 10 of its screenshots are identical before and after.
- The GLaDOS frames are still identical to main's.
- The autopilot playthroughs still finish with the same game times as on Nov 2: a00 to a01 at 117.8 s, a01 to a02 at 82.0 s (81.8 s before; those runs use the real-time page loop, so small drift is normal), and a03 to a04 at 119.3 s. a02 and a04 timed out when I ran four at once in parallel, and I didn't get to rerun them one at a time.

9:08 PM. Stopping here.

## 2026-11-19, animation session (from 9:25 AM)

Gabriel asked for five more hours, with the focus on being able to prove that animations are right rather than trusting single screenshots.

9:25 AM. ffmpeg 7.1 is already on the box (Debian package), with libx264, libvpx-vp9 and drawtext, so no install was needed. Read the public Source SDK 2013 headers and sources from Valve's GitHub repo (public/studio.h, public/studio.cpp, public/bone_setup.cpp, game/client/c_baseanimating.cpp, game/server/props.cpp, game/shared/sequence_transitioner.cpp) for the data layouts and playback rules. Portal's own game code isn't in that repo, so Portal-specific behaviour comes from the HL2 equivalents and the Valve Developer Wiki.

9:30 AM. Harness additions (tools/portal-ctl.mjs, docs/harness.md):
- `record PATH FRAMES [FPS] [KEYS]` steps the fixed 1/66 s tick loop, reads back each drawn frame and pipes it to ffmpeg (mp4 or webm). Every frame is labelled with its frame number, time and game tick, so a clip can be matched against pose dumps. If the page throws mid-recording, the frames so far are kept and the command fails with the frame and tick.
- `sheet VIDEO OUT [CxR]` makes a contact sheet of evenly spaced frames; `frames VIDEO DIR` extracts PNGs.
- `anim [REGEX]` lists animated props with their sequence, cycle, rate, loop flag, frame count, fps and duration.
- `poses OUT TICKS [REGEX]` steps and writes every matching prop's model-space bone positions and orientations per tick as JSONL, and replies the sequences each prop went through with the measured cycles per second.
- tools/mdl-info.ts reads a model's animation data straight from the MDL header: sequences with flags, frames, fps, blends, fade times, events, autolayers, pose parameters, bone controllers, attachments, .ani blocks and $includemodel. `--continuity` decodes every frame of every sequence and reports the biggest frame-to-frame bone translation and rotation, plus the last-to-first gap for looping ones. Wrong decoding shows up there as jumps far bigger than the animation's normal motion, or as an exception.

The refactor that exposes bone matrices to the harness leaves rendering unchanged: the GLaDOS check frames are byte-identical to the previous commit's.

9:33 AM. First bug, found by surveying every animated model the maps use. The models in the ending's GLaDOS destruction (models/gladdysdestruction/*.mdl, the Destructo_glados_body* props) keep their 54 s "go" sequence in .ani files: the MDL holds the first 30 frames, and the other 42 sections point into animation blocks of the .ani. The port read every section offset relative to the MDL, so 30 frames in it read past the end of the file and threw a RangeError from inside the renderer. In the page that exception happens inside the requestAnimationFrame callback before it reschedules itself, so the whole game would have stopped at the ending. Fixed by following mstudioanimdesc_t::pAnim in the SDK's studio.cpp: sections with animblock > 0 read from the .ani at that block's start plus animindex, and the last frame of a long animation comes from its own extra section. The model loader fetches the .ani when a model has animation blocks.

Evidence: /workspace/portal-web-shots/anim/destruction-before.mp4 (30 frames, then the error at tick 80), destruction-after.mp4 (the full 54.5 s at 24 fps, 640x400) and destruction-after-sheet.png. mdl-info --continuity on all six destruction models now decodes every frame. The last-frame rule changes nothing visible elsewhere (GLaDOS's sectioned idle moves by under 0.01 units at that frame).

Also: `SetDefaultAnimation` with an empty value (relay_boss_burn_state_4 sends that to glados_body before "death") now clears the default, instead of falling back to the map's "idle" when the death sequence ends.
