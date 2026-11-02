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

## Known gaps
No skeletal animation, so doors and pedestals pop instead of animating. There is no rotation for
parented or rotating entities, and the cube is an unrotated AABB. Props don't collide (except elevator
floors). env_texturetoggle is missing (indicator lights and clocks). There is no MP3 or ADPCM sound, no
choreo or VCD dialogue, no PVS culling, and no HDR or tone mapping. There are no turrets or energy balls.

## Licensing and provenance
- All code here is original. Behaviour was matched from public sources only: the Valve Developer Wiki
  (file formats, entity and I/O docs) and Valve's public **Source SDK 2013** repository (movement constants
  and behaviour of `gamemovement.cpp`, and flag and contents values). Ideas on portal rendering are from
  public talks and articles, and noclip.website (MIT) was used as a format reference. **No leaked Source
  engine code (2003 or 2020) was read or used.**
- Valve's assets stay in your Steam install. The local server streams them to your own browser on
  127.0.0.1. Nothing is copied into the repository (`.gitignore` excludes asset types and `shots/`), and
  nothing is hosted publicly or pushed. Portal and its assets are © Valve Corporation. You need your
  own legal copy.
