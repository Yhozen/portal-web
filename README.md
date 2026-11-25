# portal-web

A clean-room, browser-based (WebGL2 + TypeScript) player for **Portal (2007)** that reads the game's
data **at runtime from your own local Steam install**. No Valve assets are in this repository, and the
server only listens on `127.0.0.1`.

Docs: [the journey so far](journey.md) · [changelog](CHANGELOG.md) ·
[changelog on GitHub Pages](https://yhozen.github.io/portal-web/).

## Run

```sh
cd /workspace/portal-web
npm install            # esbuild + playwright-core (dev only)
./build.sh             # bundles src/ -> site/main.js
node server/server.ts  # http://127.0.0.1:8420/  (Node >= 23, uses built-in TS stripping)
```

Open `http://127.0.0.1:8420/?map=testchmb_a_00` and click the canvas to grab the mouse.
To use a different install, set `PORTAL_DIR=/path/to/steamapps/common/Portal`.

### Hosted mode (private preview)
`web/` deploys the engine only to Cloudflare (`https://portal.rccpr.tech`, behind Access). There, each
player picks their own Portal folder. It is copied into the browser's private storage (OPFS) and read
from there; nothing is uploaded. The owner can also put his own copy in a private R2 bucket that only
his Access identity can read (`pnpm upload-game-files`, run by hand). See [web/README.md](web/README.md). Locally, `?files=local` uses the same
path against `site/`, `?files=manage` opens the files screen, and `?files=server` forces the local server.

### Controls
| key | action |
|---|---|
| mouse | look (pointer lock). Without pointer lock: middle-drag to look |
| W A S D | move |
| Space / Ctrl or C | jump / duck |
| LMB / RMB (Q / F without pointer lock) | blue / orange portal |
| E | pick up or drop a cube |
| V | noclip (hold Shift for fast) |
| R | restart the map |

### Query flags
- `map=testchmb_a_00` sets the BSP to load. Level changes navigate automatically.
- `gun=1` gives you a dual portal gun. `gun=0` gives no gun. By default the map decides: there is no gun
  in 00, the pedestal gun is in 01, and spawn guns are given in later chambers.
- `fast=0.15` scales long scripted delays (over 8 s), such as GLaDOS lines, so the intro waits are
  shorter. `fast=0` keeps the real timing.
- `pos=x,y,z`, `ang=p,y,r` set the spawn override. `landmark=&lp=&ang=` are set by trigger_changelevel.
- `nochange=1` stops level changes from navigating. `sens=1.0` sets mouse sensitivity.

## Test harness
`node tools/portal-ctl.mjs --game DIR script checks/escape02-ending.ctl` runs the port headlessly from a script
(load a map, pose the camera, step ticks, screenshot, bench, diff) and prints one JSON line per command. Runs are
deterministic, so two builds can be compared image for image. See [docs/harness.md](docs/harness.md).

## What is implemented
- Formats: VPK v2 directory and archives, BSP v20 (faces, displacements, lightmaps, brushes, entities,
  static props, pakfile zip), VTF 7.x (DXT1/3/5 and the common RGBA formats, mips), VMT (incl. `patch`),
  MDL v44 + VVD + VTX static meshes with skins.
- Rendering: lightmapped world, alpha test and translucency, props, and recursive stencil portals
  (depth 2) with oblique clipping. There is a full-screen stencil path when the eye is inside a portal hole.
- Movement: Source-style gamemovement (accelerate, friction, air control, stairs, duck, jump) against
  BSP brush hulls, moving brushes and the cube.
- Portals: portal-gun placement rules (noportal surfaces, fitting and nudging, overlap,
  func_noportal_volume, cleansers), teleport with position, velocity and view transform, a walk-through
  tunnel, and map `prop_portal`s linked with gun portals.
- Gameplay: entity I/O (outputs, delays, `!activator` and other target names, wildcards), logic_*,
  math_counter, triggers and filters, func_door, func_brush, func_tracktrain elevators, prop_dynamic
  animations (as show/hide), point_template and env_entity_maker cube droppers, floor buttons, cube
  carry and physics (AABB), env_fade, env_hudhint (localized), ambient_generic (.wav), and
  trigger_changelevel with landmarks.

## Added since the first version
- MDL skeletal animation with CPU skinning: doors, the a01 pedestal and button tops animate. Parented
  and rotating entities rotate (func_rotating, func_door_rotating, SetParent).
- The cube is a rigid body: it tumbles on corner contacts, sleeps, keeps its orientation through
  portals and stays held when carried through a portal. Small props have AABB colliders.
- Overlays, multi-frame VTFs, texture-toggle proxies (indicator signs) and material_modify_control
  (the countdown clocks).
- Audio: soundscripts, wav (PCM and MS-ADPCM), mp3, GLaDOS lines with captions, music.
- PVS culling per view (including portal views), one world draw per texture per cluster.
- Start-open doors, CheckStuck-style unstick after teleports, Wake/Sleep inputs on cubes.
- `tools/autopilot.js` plays the maps through the normal controls only (A* over hull traces,
  aiming and firing the gun the same way the mouse does). `tools/play/run.sh <map> [png]` runs a
  per-chamber script from `tools/play/`.


## State (2026-11-25), session 3

[![checks](https://yhozen.github.io/portal-web/badge-checks.svg)](https://yhozen.github.io/portal-web/)
[![changelevel](https://yhozen.github.io/portal-web/badge-maps.svg)](https://yhozen.github.io/portal-web/)

From 8:35 PM EST on 24 Nov through 9:49 AM EST on 25 Nov, on `gabriel/oracle`. The session reel was
cut at [`f2160f8`](https://github.com/Yhozen/portal-web/commit/f2160f857654f176a829e40a33ff9c2bfc39214e)
around 6:53 AM EST; the playthrough regressions that showed up in the wrap-up allplay were fixed at
[`d7b1478`](https://github.com/Yhozen/portal-web/commit/d7b1478b37852c1ef414a05748355b85576962cf)
at 9:49 AM EST. 44 commits since session 2. Checks pass 39/39.

Video: [session 3 reel](https://yhozen.github.io/portal-web/#session-3-reel) (87.7 s of live
playthroughs). The escape_02 flings off the slanted doors into the alcove, onto the high shelf and
up onto GLaDOS's catwalk, then a rocket aimed up the broken escape_01 tube so the cube spits out.
Clips: [the flings](https://github.com/Yhozen/portal-web/releases/download/session-3-2026-11-25/e02-flings.mp4)
(65 s), [rocket up the tube](https://github.com/Yhozen/portal-web/releases/download/session-3-2026-11-25/e01-rocket-tube.mp4)
(38 s). The files live in the
[session 3 release](https://github.com/Yhozen/portal-web/releases/tag/session-3-2026-11-25), not in
the tree.

What landed, measured against the original:

- The rocket turret's timing and damage (first shot at 6.9 s, then one every 6 s, 550 u/s, lethal).
  Its rockets go through portals, it sees you through breakable glass, and it can turn a full circle.
- Tube boxes take path_track's alternate path and spit out the cube; the escape fan isn't solid.
- You duck when you come out of a wall portal and stand up after a floor fling. A cube you're
  carrying stays in your hands through that duck.
- Pointing at a door and pressing use works, and so do look triggers.
- Rocket blasts damage GLaDOS, and her cores burn in the incinerator.

The wrap-up allplay first showed regressions in a02, a03, a06, a10, a13 and a15. The new duck at a
wall portal had made you drop a carried cube and had undone the aim a10 needed for its lift; look
triggers closed a06's fling-pillar doors while you looked down into the pit; a03's wall portal sat
off the energy ball's path; and the new train code was grabbing a13's ball catchers and placing them
rotated wrong. Those are fixed at `d7b1478`.

Playthrough, game seconds to the next map, from the allplay at 9:41–9:49 AM EST on 25 Nov:

| Map | Time | Next |
|---|---|---|
| a00 | 178.9 | a01 |
| a01 | 113.3 | a02 |
| a02 | 149.9 | a03 |
| a03 | 119.9 | a04 |
| a04 | 72.1 | a05 |
| a05 | 51.7 | a06 |
| a06 | 63.9 | a07 |
| a07 | 131.4 | unset |
| a08 | 76.3 | a09 |
| a09 | 119.0 | a10 |
| a10 | 203.4 | a11 |
| a11 | 86.6 | a13 |
| a13 | 290.1 | a14 |
| a14 | 126.3 | a15 |
| a15 | 261.7 | escape_00 |
| escape_00 | 196.9 | escape_01 |
| escape_01 | 215.6 | escape_02 |
| escape_02 | 199.3 | second core burns |

Still ahead: GLaDOS's last two cores and the ending. A route through a11 that survives turret
damage, so `?damage=1` can become the default. The hold-distance 81 change, parked because the
playthrough scripts are tuned around 56. a07 still finishes on the chamber with the next map unset.

## State (2026-11-24), session 2

From 9:03 AM EST through 8:28 PM EST on 24 Nov, on `gabriel/oracle` at
[`57d7eb7`](https://github.com/Yhozen/portal-web/commit/57d7eb7a3b35949df91616b435c570468a710a68).
49 commits since session 1. Checks pass 39/39.

Video: [session 2 reel](https://yhozen.github.io/portal-web/#session-2-reel) (112.6 s). Every test
chamber except a07 reached its level change, and escape_00 played through into escape_01 in 198.4 s.
The official allplay is the source of that time; a recorded replay of the tube-to-changelevel tail
drifted into the goo, so the reel uses the cube-tube climb plus the earlier piston-route footage.
Clips: [piston route](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-route-reel.mp4),
[cube tubes](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-tubes.mp4),
[toward the changelevel](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-end.mp4).
The files live in the
[session 2 release](https://github.com/Yhozen/portal-web/releases/tag/session-2-2026-11-24).

What landed, measured against the original:

- Bone followers, so a13's dropper cover is solid and holds the box.
- Energy balls bounce off cubes in the cube's own frame.
- Firing while holding a cube drops it.
- `trigger_multiple` refires while something sits in it, as in the SDK's CTriggerMultiple.
- Doors return after their wait.
- Portals work on rotated brush entities, and the player is clipped out at a wall portal's rim.
- `trigger_push` follows the SDK. `prop_physics` EnableMotion, and `func_portal_detector`.
- Turret `.phy` body: it tips in 0.6–0.7 s, as in the original. Turret damage is 1.80 s from first
  hit to death, against 1.79 in the original, and stays behind `?damage=1`.
- Wall-fling speed: 400 / 527.3 / 627.3 against the original's 391.5 / 526.5 / 625.5.
- Cube-tube `.phy` collision, which is how escape_00 climbs to the changelevel.

Playthrough, game seconds to the next map, from the allplay at wrap-up:

| Map | Time | Next |
|---|---|---|
| a00 | 178.6 | a01 |
| a01 | 112.7 | a02 |
| a02 | 152.6 | a03 |
| a03 | 125.6 | a04 |
| a04 | 72.1 | a05 |
| a05 | 51.7 | a06 |
| a06 | 64.4 | a07 |
| a07 | 131.4 | unset |
| a08 | 78.7 | a09 |
| a09 | 119.1 | a10 |
| a10 | 197.3 | a11 |
| a11 | 86.6 | a13 |
| a13 | 290.9 | a14 |
| a14 | 125.4 | a15 |
| a15 | 265.3 | escape_00 |
| escape_00 | 198.4 | escape_01 |

At the end of the session, escape_01, escape_02 and the GLaDOS fight were still ahead, along with
the a11 damage route, the parked hold-distance 81 change, and a07's ending.

## State (2026-11-24), session 1

From about 11:45 PM EST on 23 Nov through 8:56 AM EST on 24 Nov, on `gabriel/oracle` at
[`795cd54`](https://github.com/Yhozen/portal-web/commit/795cd54a5da3b54c834f80d18f8dd27ee2da18e9).
Checks pass 36/36.

Video: [session 1 reel](https://yhozen.github.io/portal-web/#session-1-reel) (46.9 s, recorded
8:23 AM EST). A side-by-side floor fling against the original, the +use reach sheet, the a13 box
climb with the original's reach, and a11 played through to the lift. The footage is from the
morning's build at `af8974f`, just before the wrap-up note at `795cd54`. The file lives in the
[session 1 release](https://github.com/Yhozen/portal-web/releases/tag/session-1-2026-11-24).

An oracle was built from the original Portal (the native Linux build, driven through its own
console) and the port was measured against it overnight.

- Movement (22 metrics on a09's floor): walk 150 against a previous 175, now 150. Running jump
  speed 225 against 175, now 225. Air strafe cap 60 against 30, now 60. Duck eye 90% at 0.345 s
  against 0.18 s, now matched. Running jump distance 116.6 against 116.6.
- Floor-to-floor flings, which used to come back up 37–41 units too high, now match the drop height.
- Floor-to-wall fling speed was still 2–5% high at the end of the session. A fix that got it to
  400.0 / 527.3 / 627.3 broke a10 and was left uncommitted; it landed in session 2.
- Cubes take their size from the model hull (±20.25 for metal_box), not a fixed ±12.
- +use reach follows the SDK's FindUseEntity (80 units, hull sweeps, cone 0.8).
- Glass takes no portal. Cleansers fizzle shots across them. Template cubes go to their own offsets.
- The held cube follows the SDK grab controller more closely; hold distance stayed at 56, against
  about 81 in the original.

Playthrough, game seconds to the next map, from the playthroughs on the final build of the session,
written up at 8:50 AM EST on 24 Nov:

| Map | Time | Next |
|---|---|---|
| a00 | 178.9 | a01 |
| a01 | 85.6 | a02 |
| a02 | 168.3 | a03 |
| a03 | 125.6 | a04 |
| a04 | 72.1 | a05 |
| a05 | 52.0 | a06 |
| a06 | 65.0 | a07 |
| a07 | 131.3 | unset |
| a08 | 78.7 | a09 |
| a09 | 118.6 | a10 |
| a10 | 198.2 | a11 |
| a11 | 69.8 | a13 |
| a13 | 43.7 | WIP, into the ball hallway |

At the end of the session, a13's ball catchers and lifts, a14 and the escape maps were still ahead,
along with the wall-fling fix, held distance, the dropper cover, and turret tip-over and damage.

## Known gaps
The dated state sections above are the better picture of what plays through. Still ahead, as of
25 Nov 2026: GLaDOS's last two cores and the ending; a route through a11 that survives turret
damage, so `?damage=1` can become the default; the hold-distance 81 change; and a07, which still
finishes with the next map unset. Dissolving (the cleanser) only removes objects, without the
effect. No HDR or tone mapping. Choreo scenes run on their summary timing only, without lip sync
or gestures. Lighting on models is a single ambient sample.

## Credits and references
Clean-room implementation. File formats and behaviour come from the Valve Developer Wiki, Valve's
public Source SDK 2013 headers (struct layouts and movement constants) and the MIT-licensed
noclip.website (the order of the lightmap and displacement UVs). No leaked Source engine code was
used, read or referenced. Portal and its assets are © Valve. They are read from your own install
at runtime and are never copied into this repository or served beyond 127.0.0.1.
