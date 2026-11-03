# portal-web

A clean-room, browser-based (WebGL2 + TypeScript) player for **Portal (2007)** that reads the game's
data **at runtime from your own local Steam install**. No Valve assets are in this repository, and the
server only listens on `127.0.0.1`.

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
from there; nothing is uploaded. See [web/README.md](web/README.md). Locally, `?files=local` uses the same
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

## Known gaps
No energy balls, turrets or rockets. Dissolving (the cleanser) only removes objects, without the effect.
No HDR or tone mapping. Choreo scenes run on their summary timing only, without lip sync or gestures.
Props other than small ones don't collide. Lighting on models is a single ambient sample.

## Credits and references
Clean-room implementation. File formats and behaviour come from the Valve Developer Wiki, Valve's
public Source SDK 2013 headers (struct layouts and movement constants) and the MIT-licensed
noclip.website (the order of the lightmap and displacement UVs). No leaked Source engine code was
used, read or referenced. Portal and its assets are © Valve. They are read from your own install
at runtime and are never copied into this repository or served beyond 127.0.0.1.
