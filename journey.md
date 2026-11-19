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

**9:40 AM, sequence cross-fades.** Rebuilt the pose path the way SDK 2013's bone_setup.cpp lays it out (CalcPoseSingle
blend grid with the posekey branch, delta layers via QuaternionSM/MA, autoplay layers, pose parameters defaulting to 0
in their own units), then added sequence transitions as C_BaseAnimating does: fade time min(old fadeout, new fadein),
weight on the 3s²−2s³ spline, STUDIO_SNAP skips it. GLaDOS's idle→hit switch used to move a bone 44.6 units in one
tick; with the fade the largest per-tick move is 13.6 units, which is the animation's own motion
(`poses` max_move, glados-hit-compare.mp4). Also fixed: `SetDefaultAnimation` with an empty value, onDone overwriting
the next sequence's cycle, hidden props freezing. GLaDOS check frames and 30 later-chamber views are byte-identical to
the pre-refactor build.

**9:54 AM, security cameras track the player.** npc_security_camera had no model at all (kv.model was undefined, the
spawn crashed). Now it spawns security_camera.mdl and aims with aim_yaw/aim_pitch. The aim isn't guessed: the lens axis
is the "light" attachment's +y, and a 5° table over both pose ranges says where each pose points. Pitch 0 is straight
down and every direction has two poses (yaw, p) and (yaw±180, −p), so the pick has a small continuity penalty, or it
flipped between them. Rest is (0, 120), looking straight out. 90°/s turn rate; sight test is a MASK_SHOT_PORTAL ray.
New harness `lookat X Y Z` keeps the view on a point every tick. checks/camera-track.ctl: while the player strafes
under cam1 in a00 the lens-to-eye error is median 4°, max 8° once it has turned to them (was: no camera).

**9:57 AM, model animation events.** Nothing ran the events stored in the sequences, so the elevator doors and box
dropper moved silently. Sequences now carry their mstudioevent_t list (new-style events by name), and props run
client events the way SDK 2013's C_BaseAnimating::DoAnimationEvents does: a new sequence starts just before cycle 0
so frame-0 events fire, each fires once as the cycle passes it, a wrap of over half a cycle runs the rest of the loop
first, invisible props skip. AE_CL_PLAYSOUND plays the soundscript at the prop, AE_CL_STOPSOUND stops it (the
engine uses the first attachment's position; the prop origin is within a few units for these). checks/anim-events.ctl:
a01's elevator door open fires move_1 at 0.076 s, close_1 at 0.515 and 0.545, stop at 0.606, which is the first
tick + cycle × 0.633 s for each. All four door/dropper soundscripts resolve to waves.

**10:04 AM, first-person portal gun.** There was no viewmodel at all. v_portalgun.mdl is now drawn last, over a
cleared depth buffer, at the eye, with Source's viewmodel_fov 54 (a horizontal angle at 4:3, so 41.8° vertical at any
window shape). Sequences by activity: ACT_VM_DRAW when the gun is first held, PRIMARYATTACK per shot, FIZZLE when a
cleanser takes the portals, PICKUP while carrying (held on its last frame), RELEASE on drop, IDLE otherwise, with the
same cross-fades as props. checks/viewmodel.ctl records it with a per-frame probe: draw → idle at tick 66–68 (1.0 s,
31 frames @30), fire1 → idle at 34 (0.5 s), release → idle at 46 (0.667 s); sampled every 2 ticks. `set
showViewModel off` for comparisons. The 30 later-chamber views: 27 identical to the session-start build, 3 differ by
under 0.07% of pixels, all the newly spawned security cameras (a10, a14).

**10:18 AM, floor turrets.** The run was interrupted at about 10:10 with the turret work uncommitted; I picked it up,
rebuilt and re-ran both checks before committing. npc_portal_turret_floor had no model or behaviour. It now spawns
turret_01.mdl as a physics box sized from the model's hull (16×16×32 half-extents, standing on its origin, so the
rigid body code learned non-cubic boxes: corners, AABB and moment of inertia from the three half-extents; cubes
are unchanged). Behaviour follows HL2's npc_turret_floor.cpp from the public SDK, since Portal's own turret code
isn't public: closed until the player is in a 60° ground cone, in range and visible from the "eyes" attachment;
deploy, then aim by moving the aim_yaw/aim_pitch poses toward the goal measured in the muzzle's own frame (at most
18° per think, a third held back), fire when within 10°, search ±60° for 5 s when the player is lost, retire.
Up·z under 0.5 counts as tipped: alarm, thrash and fire for 2–2.5 s, close, die, OnTipped/OnDeath fire.
env_physexplosion now pushes physics bodies (magnitude minus 0.4 per unit, applied at the blast point so it spins),
which is what a11's knock-over demonstration uses.

checks/turret.ctl (player in the training turret's cone, strafing, then behind it): deploy → idlealert at frame 20,
active from frame 22, 46 shots; while active the muzzle-to-player error has median 0°; once the player is behind it,
search for 5 s, retract and back to idle. checks/turret-tip.ctl: the explosion pushes it at 189 in/s, it is tipped
by tick 18, fires 37 shots while thrashing, retracts at tick 190 and is dead at 238, lying on its side at z 16. The
first version of that check filmed from the player's spot, where the turret falls behind the pillar; it now films
from the side with the viewmodel off. later-smoke.ctl (20 s from each later spawn): no page errors.
Clips: /workspace/portal-web-shots/anim/turret-after.mp4, turret-tip-after.mp4 and their -sheet.png.

**10:38 AM, attachments.** (A box restore at about 10:22 threw away the first version of this; redone from the notes.)
Nothing handled SetParentAttachment, and the maps use it in two places that matter for animation:
- escape_02's logic_auto hangs three cores and the dummy core on glados_body's ball_01..ball_04. They stayed where
  the mapper dropped them, 69 to 160 units from the attachments, while her idle swings those attachments up to 50
  units, so the cores floated in place next to a moving body.
- every energy-ball catcher (a03 to a15) parents its caught ball and sprites to the housing's ball_attachment.

New `attachWorld(prop, name)` gives an attachment's world matrix in the prop's current pose (sequence, cycle, fades,
pose parameters; bones cached per pose). SetParentAttachment puts the child on it, origin and angles both;
SetParentAttachmentMaintainOffset keeps the offset at the moment it's sent; SetParent and ClearParent drop it.

That turned up a second bug: env_entity_maker revived only the unparented members of a catcher template, so the
caught ball, and the catcher door with its two path_tracks, stayed dead. They're placed now too. With both fixes,
checks/catcher.ctl shows the ball appear in the cradle the tick the trigger fires and stay on the attachment (0.00
units) through "close" (2.0 s) into "closed"; before, the cradle stayed empty. checks/glados-cores.ctl: each core is
0.00 units from its attachment for the whole 5 s loop while the attachments move up to 50 units.
Clips: anim/catcher-compare.mp4, anim/glados-cores-compare.mp4 (before | after).

**10:44 AM, props that animate on map logic.** checks/props-anim.ctl records two with a cycle probe. a00's box
dropper cover plays "open" when logic_drop_box fires and reaches cycle 1.0 at 0.667 s (the model says 20 frames at
30 fps, 0.633 s; the probe samples every 1/30 s), then "close" after the cube falls out, and the next cube drops in
on the closed cover. a01's pedestal "open" is at cycle 0.42 after 1.0 s (71 frames, 2.33 s, so 0.43 expected). The
other animated models the maps use decode cleanly with `mdl-info --continuity` (no frame jumps over 10× the median).
Props without a DefaultAnim stay on frame 0 of sequence 0, which is what a prop_dynamic does when nothing starts a
sequence, so the frozen catcher ball, signs and lifts are left as they are.

**10:50 AM, $selfillum on models, the open question from Nov 18.** The answer is in the texture flags. Every
material that went white in that experiment (lift_platform, light_rail_platform, and turret_01 too) has a DXT1 base
texture without the ONEBITALPHA or EIGHTBITALPHA flag, and VertexLitGeneric clears $selfillum when the base texture
isn't translucent, which only those flags make it. The DXT5 ones (GLaDOS, cubes, doors, buttons, catchers,
launchers, signs) have real masks: mean alpha 0 to 36 out of 255, mostly zero, with the lit strips and eyes at full.
Props now add base × $selfillumtint × base alpha to the lit colour when the flag is there, and nothing otherwise.
checks/selfillum.ctl: GLaDOS's eye and panel lights come on; the a10 lift, a14 rail platform and a11 turret are
unchanged; the cube and doors get their small glowing details. Over the 30 later-chamber views, 17 are unchanged and
the rest change on under 0.32% of pixels, except a13's third view at 1.7%, where door_02's indicator strip now glows.
World brushes are untouched (they still draw $selfillum faces unlit). Before | after:
/workspace/portal-web-shots/selfillum-before-after.png.

**10:52 AM, missing-file noise.** The three 404s left on a clean run are gone. w_portalgun's texture name already
includes its cdmaterials directory, so the first probe asked for a doubled path that can't exist; probes that would
double the directory are skipped. escape_01's rot_door_frame names "debugempty" for a 4-triangle piece; that's the
engine's draw-nothing material (debug/debugempty), which isn't in the game files, so it's now built in and not drawn,
instead of two 404s and the magenta fallback. Model draws skip nodraw materials. Every map from a00 to escape_02 now
loads and runs 2 s with 0 errors, warnings or failed requests, and the 30 later-chamber views are byte-identical.

**10:54 AM, persistent harness mode.** `portal-ctl serve SOCKET` keeps the asset server and browser up and takes
scripts on a unix socket; `--attach SOCKET run/script` sends one and prints the replies with the usual exit codes.
A follow-up script on a loaded map (pose, screenshot, state) takes 0.4 s end to end instead of about 3 s, and a map
change costs only the map load. `build` rebuilds and clears the browser cache, `quit` ends the session. docs/harness.md
has the details.

**11:05 AM, resumed after the interruption.** tools/play/ctl.mjs was left untracked. It turns a chamber script into a
portal-ctl script, so the autopilot plays inside the deterministic harness. That makes it work with the serve session
from 10:54. It worked as written, so I kept it and added two things. The first is a watchdog around game.step: it throws after 400 s of game
time or 300 s of real time (MAX_GAME_S, MAX_WALL_S). Without it, a route that gets stuck in the autopilot's planner
keeps the serve session busy until it's killed, which is what the first a03 run did. The second is
tools/play/seq.sh SOCKET [MAP...], which prints one line per chamber (next map, game time, wall time, page errors).

**11:50 AM, a03's floor catcher stopped catching.** The first sequential run went a00, a01, a02 and then stuck in a03:
the ball came out of the ceiling portal, fell onto the catcher and bounced back up at z -45, 50 units above the
trigger, forever. That came from 4d53218. Since then, env_entity_maker also places the catcher's door, a
func_tracktrain with spawnflags 8 (Passable). Passable trains get a 160-unit floor disc, which stands in for the
elevator body prop's physics floor. On the catcher, that disc sat across the mouth. Over all maps, the passable trains
are the 47 elevator bodies (192 by 192 by 148, or 192 by 16 by 148 in a00), 23 catcher doors (8 by 16 by 13), escape_01's two box carriers
(32 by 32 by 16) and escape_02's four core rails (16 by 16 by 16). Only brushes at least 128 tall get the disc now, so it's
just the elevators. checks/catcher-ball.ctl plays room 1 for real (orange opened, blue on the ceiling): before, the ball
bounces for the whole 7 s; after, it drops in at frame 40, the housing plays close then closed, and lift_up_trigger_a
is enabled. Clip: anim/catcher-ball-compare.mp4 (before | after), with its sheet.

Sequential run after the fix, one serve session: a00 to a06 all reach their changelevel, with 0 page errors:
a00 174 s of game time (8 s real), a01 82 s (18 s), a02 149 s (10 s), a03 119 s (180 s real, mostly the planner), a04 72 s,
a05 46 s, a06 59 s. a07 stops in the launcher room, where the scorch mark isn't visible from the landing spot. It
stops in the same place on 1af4970, before today's changes, so it isn't a regression.

**11:57 AM, resumed; props started by map logic, checked against the model data.** The interrupted run left a
`poses` change (up axes recorded, so hinge rolls count as turns, and `reached_end_s` for one-shot sequences) and
checks/props-anim2.ctl. Ran it in a serve session: every one-shot sequence reaches cycle 1 one tick after its
(frames-1)/fps: round_elevator_doors open and close 0.636 s (model 0.633), bed_cover opening 0.970 (0.967),
combine_ball_launcher open and close 0.970 (0.967), light_rail_endcap movedown 1.636 (1.633). The door's largest
per-tick turn, 10.2° at tick 8, is Scene_Root: idle_closed and open store that bone 90° apart about z and the 0.2 s
fade slerps between them on a bell curve (1.5, 4.1, ... 10.2, ... 2.1). Root and both door leaves don't follow it
(Root's world axes don't move at all), so it isn't visible; the leaves turn about 1.2° a tick, smoothly. No pops.

**11:58 AM, floor buttons.** checks/button.ctl drops the a00 cube on the second button. floor_button_door_a00 is a
func_door moving down (movedir 90 0 0) at 25 units/s with lip 0 on an 8-unit-deep brush, so 0.32 s, about 21 ticks.
The probe has it moving from tick 12 to 33, the parented button_top following 1:1 (137.56 to 129.56), the exit doors
opening, the indicator strip switching from blue to orange; taking the cube off brings it back up in 21 ticks.
Linear constant-speed motion is what func_door does. Nothing to fix.

**12:04 PM, energy balls.** checks/energy-ball.ctl films one a04 ball in flight: 200 units/s constant, life ticking
down from 16 s. Two problems, both in how the ball model is drawn:
- the in-flight ball never played combineball.mdl's looping idle (31 frames at 4 fps), the port spun it at a
  made-up 400°/s yaw instead. It now plays the idle, and the probe shows 1/7.5 cycles per second.
- the model is built to be seen from one side. Its two glow cards are flat quads with normal -y and the shell is a
  dome from y -11.2 to 2.5, in the bind pose; the idle's base bone holds that turned to +x for the whole loop. Any
  other angle showed a sliver, so with the yaw spin the ball flickered between a sphere and a sliver, and from the
  side it was mostly a sliver. The ball now keeps its +x on the viewer. That is also the only orientation in which
  the animation's base-bone turn makes sense, which is why I took it over facing -y.
checks/energy-ball-views.ctl holds a ball and looks at it from three sides: before, one sphere and two slivers;
after, a sphere from every side (energy-ball-views-compare.png, energy-ball-compare.mp4). The caught ball in the
catchers is a plain prop_dynamic on an attachment and is left alone.

**12:09 PM, a10's pillar lifts stopped halfway.** checks/lift.ctl opens both doors of the first pillar lift. Each pillar
is two stacked func_doors moving down at 15 units/s: lift_pillar_door_bottom_a (120 units), and
lift_pillar_door_top_a (128 units), which is parented to the bottom one's brush, with the platform brush and
lift_platform.mdl parented on top. The probe showed the top door's own t going 0 to 1 while its world z only followed
its parent: the hierarchy pass rebuilt every child from its parent and the offset at spawn, which threw away a
parented door's own travel. So the platform stopped at z -122, hovering 128 units over the pit, instead of reaching
-250. A parented func_door now slides in its parent's space. The platform goes down 248 units, at 30 units/s
for 8 s and 15 for the last 0.53 s, and ends flush with the floor (lift-compare.mp4, lift-compare-sheet.png).

The model trailed its brush by up to 0.23 units while moving: the chain is four deep (bottom door, its brush, top
door, platform brush, model) and the hierarchy ran two passes. It runs four passes now and the model stays exactly
5.99 units under the brush. The 30 later-chamber views are byte-identical before and after.

**12:14 PM, a06 broke with that fix, so it's narrower now.** The sequential run after f15d076 stopped in a06: the
autopilot couldn't put blue on the fling pillars. Those are three start-open func_doors deep per pillar
(bottom_bottom, bottom, top, flags 13), and a trigger_look closes the bottom_bottom ones when you look at them.
With every door's own travel counted, the children start retracted too, so the pillar faces end up 384 units inside
the wall, and the chamber can't be solved. With the children at their Hammer offsets, which is what the old code
did, the faces come out to x 520 and it works. I couldn't pin down from public material how the engine places a
start-open door on a parent, so start-open parented doors keep the old rule, and only the others (a10's pillar lifts, the
train rest doors in a03/a04/a07/a08/a14, a11's panel, a14's catcher door) slide in their parent's space.
checks/fling-pillars.ctl gives the same probe as before the fix; checks/lift.ctl still reaches -250.

**12:18 PM, viewmodel fizzle and turret timings.** checks/viewmodel-fizzle.ctl opens a blue portal from the a02
spawn, then walks through the middle cleanser. The portals close at tick 34 (x 681) and v_portalgun plays fizzle
with no cross-fade, which is right for a snap sequence. It ends 32 ticks later (the model says 16 frames at 30 fps,
0.5 s), and idle fades in over the next 13 ticks (0.2 s fadeout). The first version filmed the draw animation, not
the fizzle: the harness's `step` doesn't yield to the page, so the viewmodel's model only finished loading during
`record`. A `sleep 1` after the first step fixes that. That's a harness artifact, not a game bug.
Turrets, from this morning's turret.ctl probe: deploy runs from cycle 0.2 to 1 in 36 ticks (0.8 × 0.667 s is 35),
and retract from 0 to 1 in 44 ticks (0.667 s). Both match the model.

**12:25 PM, a07 hung the serve session.** The a07 playthrough ran for more than 10 minutes and blocked every script queued
behind it. The step watchdog never fired, because the time went into the autopilot's planner (portalSolve, then plan),
which doesn't call game.step. ctl.mjs now also sets `window.__deadline`, and plan() checks it every 1,024 expansions,
so a stuck route ends with a watchdog error and its log. I also tried a binary heap for the planner's open list. It
didn't help (a03 took 192 s against 166 s, same route), so I dropped it: the time goes into the neighbour traces,
not the min scan.

**12:38 PM, portals slide off no-portal strips.** With the hang gone, the a07 log showed the real block. The pellet in the
launcher room hits the south wall at x -638, z 320, and blue there always failed with "no fit". Tracing along the
wall, the concrete runs to x -610, and a no-portal metal strip starts at about -605. A portal centred on -638 reaches
-606, so one corner lands on the metal. The placement nudge only treated missing or bent surface as an edge, so it
never moved the portal and the shot failed. In the game, a shot near a strip like that slides over until it fits. Now a
no-portal face counts as an edge too: the portal lands at x -642 against the strip and still covers the pellet's
line (checks/portal-nudge.ctl, portal-nudge-after.png). With that, a07's first half plays through: blue on the scorch
mark, the pellet goes into the catcher at 39.9 s, the scaffold rides, and the second gun is picked up.

The next stop was a script bug. The exit switch rides button_pedistal, which the gun pickup closes 1 s later (256 units at
100/s), and the script pressed it 0.6 s after the pickup, while the switch was still under the floor. It now waits for
the pedestal. Then the exit door, the 07a-07b elevator and the ride up all work (z 784 at 130.6 s). The second half of
the map (chamber 12: box dropper, floor button, the piston wedge) has no route written yet, so a07 stops there.

**12:44 PM, riding the a10 lift threw the player up.** checks/lift-ride.ctl stands on the lowered platform and lets the
ride trigger raise it. The first run had the player shot up by about 180 units again and again while the platform didn't
move. The door's crush test moved the door to its spawn-frame position, found the player inside it, and pushed them up
by the gap between that position and the door's real one, which for a door on a parent is the hierarchy's world
position. A door on a parent now steps from its world position by this tick's travel. Now the player rides from
-250 to -2 standing on it the whole way, 2 units above the brush origin, at 30 and then 15 units/s. (The check walks
into the room's entry trigger first. Teleporting straight onto the lift fires the lift's trigger and the room's
"open all lifts" trigger on the same tick, and the second one wins.)

**12:46 PM, resumed after the interruption; on to a08 (chamber 13).** a07 still plays to the top of the 07a-07b
elevator (130.6 s, 0 page errors) and stops there, since chamber 12 has no route. So I started a08 from its own spawn
in the serve session. Its first half now plays: standing on the start-room button opens a door high in the main room's
west wall, over the button's grating roof. Blue goes through that door onto the main-room ceiling, orange goes on a start-room
wall, and the player steps off the button and walks through. The wall launcher's pellet hits the west wall at
(-255, 191, 169). Orange there and blue on the ceiling over the floor catcher (Maker_balltrap_lvl7 spawns it mouth-up at
about (86, 14)) drop it in at 12.8 s, which starts the cube's rail platform.

**1:01 PM, the cube fell off its platform.** func_tracktrain_lvl7 carries a door, the platform model, the platform brush and
box_no_fall_off, all parented, with the cube resting on top. The moment the train started, the cube stayed where it was
while the platform slid out from under it. It dropped 170 units to the floor at x -133, so the cube never reached the far end.
Nothing moved physics cubes with the brushes they rest on. The player had that rule, but cubes didn't. Now, when a brush entity
or a train moves, any cube whose box rests on it (a 3-unit downward box trace hits that entity with an upward normal)
moves by the same amount. checks/cube-on-train.ctl fires the catch relay and films the platform. Before: the cube is on the
floor by 2.6 s and the platform rides away empty. After: the cube stays at a fixed offset of (-42.2, 13.3) from the
train over the whole 365-unit ride to the east stop. A first version woke the cube every tick, and it crept 13 units
across the platform in 8 s, so a resting cube now stays asleep while it's carried. Clip:
anim/cube-on-train-compare.mp4 (before | after) and its sheet.

Still open in a08: getting the cube off the platform, then cube and player onto buttons b (pedestal top z 233) and c
(z 137), which both have to be down to open the exit. Every ceiling and wall spot over the rail I tried is no-portal
metal, so I haven't found the route yet. tools/play/testchmb_a_08.js plays up to the platform reaching its east stop
(24.5 s).

**1:05 PM, inputs nothing acted on.** IO now keeps a count of inputs that fell through to the default handler
(`io.unhandled`). I ran it over the a00 to a08 playthroughs and 20 s from every later spawn. Apart from tonemap and
autosave inputs, which are expected without HDR and saves, the list is short: `light.turnon/turnoff` on the elevator
shaft lights, `env_shake.startshake`, `prop_dynamic.enable/disablecollision`, `env_sprite.showsprite`,
`env_citadel_energy_core`, `env_beam` colour and width, `point_spotlight`, `weapon_portalgun.chargeportal*` and a02's
`func_noportal_volume.deactivate`.

**1:12 PM, named lights.** Every elevator shaft has a pair of named lights on their own light style (32 to 34), flagged
initially dark. The elevator's path_tracks turn them on as the car passes and off at the top. The renderer only baked
style 0, so they never lit. The atlas bake now sums every style a face has in linear light (each style's block follows
the last, four blocks per style on bump-lit faces) before the same tone curve. A switchable style starts on unless its light
is initially dark, and TurnOn, TurnOff and Toggle re-bake only that style's faces and upload their rects. checks/light-styles.ctl, in
a00's exit shaft: on changes 13% of the view (138 faces) and off is byte-identical to the first frame. The 30
later-chamber views are byte-identical to the previous build. Only escape_02 and background2 have a named style light
that starts on, and none of those views show it. Before | after: /workspace/portal-web-shots/light-styles-off-on.png.
I also filmed a ride from inside the a00 car, and it showed no change: what you see from in there is the car model, which
is lit by the leaf ambient cubes, not the shaft's lightmaps. So I didn't keep that clip.

**1:13 PM, func_noportal_volume** takes Activate, Deactivate and Toggle now (a02's trigger_portal_spawn_a2_rm3a
deactivates noportal_door_rm3a). a02 still plays the same (149.3 s).

**1:16 PM, env_shake.** Every elevator start and stop, and a00's portal-spawn rooms, send StartShake, and nothing
acted on it. The view shake now follows SDK 2013's CViewEffects::CalcShake and ApplyShake (view_effects.cpp). Each
shake picks a new random offset (±amplitude) and roll (±amplitude/4) `frequency` times a second, then scales them by a
sine whose frequency rises as the shake runs out and by the squared remaining fraction, and its amplitude decays per
frame. Starting a shake follows UTIL_ScreenShake and EnvShake.cpp: the amplitude is capped at 16 and falls off linearly
out to the radius (flag 1 means everyone at full strength), only players on the ground are shaken unless flag 4 is set,
and flag 0x20 means no view shake. The offset moves the view origin and the roll is added to the view angles. The
viewmodel isn't shaken. checks/shake.ctl: a00's exit-elevator shake (amplitude 4, frequency 2.5, duration 2, radius 500)
starts 5.47 s after the trigger and runs for exactly 40 frames at 20 fps (2.0 s). The largest offset is 1.86 units and
the largest roll 0.34°, settling to 0 before it retires. a00, a01 and a04 still finish in the same game time. Clip:
anim/shake-after.mp4.
