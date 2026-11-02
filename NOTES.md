# Portal Web — log (times America/New_York)
- 09:51 Portal install complete (StateFlags 4, buildid 19017868). portal_pak is VPK v2, BSPs are v20. Wrote VPK reader (src/vpk.ts) + GameFS following gameinfo.txt search order. Clean-room from Valve Developer Wiki specs; no leaked code.
- 09:58 First render of testchmb_a_00 (relaxation vault) in headless Chromium/SwiftShader: lightmapped textured brushes, 41 fps @1024x640, load 460 ms. shots/01-first.png
- 10:05 MDL v44/VVD/VTX loader (metal_box, button, doors, bed) + static props; Source-style player movement (from public SDK 2013 gamemovement.cpp behaviour) with BSP brush AABB traces.
- 10:10 Game layer (src/game.ts, src/ents.ts): entity I/O queue, logic_relay/timer/case/auto, math_counter, trigger_once/multiple + filters, func_door/func_brush, prop_portal linking, point_template/env_entity_maker cloning, env_fade/env_hudhint (localized from resource/portal_english.txt), choreo-scene timing stub.
  Portal gun placement + recursive stencil portal views work (shots/04-gun.png); walking through a portal teleports with velocity/view transform (scripted test: 1 teleport, exit velocity 175 along exit normal).
  Cube pickup (E), carry, drop on floor button -> floor_button_trigger_box_a00 fires -> exit doors open (shots/06-button.png).
- 10:15 Eye-inside-portal near-plane fix (fullscreen stencil quad, cull off); teleport now triggers on the eye crossing; exit unstick nudge. shots/08-nearplane.png
- 10:18 func_tracktrain elevator rides; end-of-path OnPass; trigger_changelevel -> testchmb_a_01 via landmark (shots/09-elevator.png, 10-a01.png).
- 10:22 Passable (spawnflag 8) trains: no brush collision, floor platform instead -> can walk out of the a01 elevator.
- 10:26 weapon_portalgun pickup (pedestal in a01, spawn guns in later maps; canfireportal1/2), gun portals link with map prop_portals (blue gun <-> fixed orange in a01, teleport verified; shots/12-a01-gun.png, 13-a01-blue.png). No-pointer-lock fallback (middle-drag look, Q/F fire). README.
- 10:31 MDL skeletal animation (sequences, compressed anim tracks, CPU skinning), prop_dynamic SetAnimation: doors, pedestal and button tops animate.
- 10:33 func_rotating / func_door_rotating, rotated brush colliders, full-matrix parenting, SetParent.
- 10:38 Cube rigid body (corner contacts, tumbling, sleep, orientation kept through portals); solid AABB colliders for small props.
- 10:42 info_overlay rendering, multi-frame VTFs, ToggleTexture/AnimatedTexture proxies, env_texturetoggle (indicator signs/lights). shots/18-overlays.png, 19-indicator-on.png
- 10:48 Audio: soundscripts, MS-ADPCM decoder, mp3/wav via decodeAudioData, ambient_generic, GLaDOS dialogue + captions from scenes.image summaries. shots/20-glados-caption.png
- 10:59 Logic-chain harness tools/solve.js (teleport-based) reaches escape_02 through every map.
- 11:02 PVS culling: per-cluster world index buffers, PVS box tests for brush ents/props, per-portal-view cluster. escape_02 draws 1446 -> 216, ~11 -> 32 fps (SwiftShader). shots/21, 22
- 11:05 Parented rotators keep their own spin (a01 pedestal); FirePortal1/2 inputs. shots/23-a01-pedestal-fires.png
- 11:10 material_modify_control (SetMaterialVar, StartFloatLerp, StartAnimSequence): a00 countdown clock runs. shots/24-a00-countdown-clock.png
- 11:16 start-open func_doors; CheckStuck-style unstick after teleport; tools/autopilot.js: A* over player-hull traces + input-only walker (aims, moves, use(), shootPortal() like the real controls).
- 11:24 Held cubes stay held through portals; testchmb_a_00 completed by real traversal (tools/play/testchmb_a_00.js) -> changelevel a01 at ~118 s game time. shots/25, 26
- 11:37 portalSolve (sweeps real gun shots, vantage spots); testchmb_a_01 completed by real traversal (~82 s). shots/27, 28
- 11:41 prop_physics Wake/Sleep/EnableMotion; brush toggles wake cubes. a02 part 1 solved by autopilot: box drops into pit, drop in, grab it, shoot blue on pit wall, exit via fixed orange with the box, box on button, middle elevator up. shots/29-a02-pit.png
- 12:07 Killed point_template originals were still drawn (a02 showed two cubes on the pedestal) -> hidden at spawn. Autopilot can grab cubes resting on pedestals (arrival z window).

## 12:10–12:32 EST
- MDL pose: non-static-prop models use the raw sequence pose (studiohdr flags & 0x10 at offset 152); this fixed the door halves showing as a black edge-on slab. Rest-posed prop_dynamics start animating again when SetAnimation arrives (restPose).
- HUD hint key names are spaced out ("[W]   [S]" instead of running together).
- Fresh screenshots: 30 (a02 part 1 done, inside the elevator), 32 (exit door opening), 33 (pedestal), 34 (cube tumbling), 35 (GLaDOS caption), 36 (a02 part 1 rerun after the fixes).
- Perf (headless SwiftShader, 1024x640): a00 776 ms / 32 fps; a02 735 ms / 34 fps; a14 1405 ms / 31.5 fps; escape_02 2402 ms / 28 fps, 215 draws (was 1446 draws / about 11 fps before PVS).
- a00 autopilot regression bisected. There were two causes:
  1. In 4db4a7f, wakeCubes() woke every cube whenever any door moved or brush toggled. Now it only wakes cubes within 96u of that entity's bounds.
  2. In 2fc8bf3/c39a010, pickUp/placeCube started using reach and a wider z window. They now try plain gotoRetry first and fall back to the wider window only if that fails.
  After the fix, a00 → a01 at 117.8 s, a01 → a02 at 81.8 s, and a02 part 1 reaches the middle elevator top at 70.6 s.
- a02 part 2 is still open. The second box sits in a pit and the pedestal box is out of reach from the floor. The intended route probably goes through the fixed orange portal_a1_rm3a at (704,1148,759), which trigger (448,464,611) activates. The exit needs counter_buttons_rm3a = 2.
