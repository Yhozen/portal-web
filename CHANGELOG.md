# Changelog

Dated progress on the port, one entry per oracle session. Gameplay videos live on
[GitHub releases](https://github.com/Yhozen/portal-web/releases), not in this tree, and are
embedded on the [changelog site](https://yhozen.github.io/portal-web/). The longer log is in
[journey.md](journey.md). Times are America/New_York (EST).

## Session 3 — 24–25 Nov 2026

From 8:35 PM EST on 24 Nov through 9:49 AM EST on 25 Nov, on `gabriel/oracle`. The session reel
was cut at [`f2160f8`](https://github.com/Yhozen/portal-web/commit/f2160f857654f176a829e40a33ff9c2bfc39214e)
around 6:53 AM EST; the playthrough regressions that showed up in the wrap-up allplay were fixed at
[`d7b1478`](https://github.com/Yhozen/portal-web/commit/d7b1478b37852c1ef414a05748355b85576962cf)
at 9:49 AM EST. 44 commits since session 2. Checks pass 39/39.

**Videos** (in the [`session-3-2026-11-25`](https://github.com/Yhozen/portal-web/releases/tag/session-3-2026-11-25) release):

- [Session 3 reel](https://github.com/Yhozen/portal-web/releases/download/session-3-2026-11-25/session3-reel.mp4)
  (87.7 s, recorded 6:52 AM EST on 25 Nov, from `f2160f8`): live playthroughs of the escape_02 flings
  up to GLaDOS's catwalk, and a rocket aimed up the broken escape_01 tube.
- [escape_02 flings](https://github.com/Yhozen/portal-web/releases/download/session-3-2026-11-25/e02-flings.mp4)
  (65 s, 6:44 AM EST).
- [escape_01 rocket up the tube](https://github.com/Yhozen/portal-web/releases/download/session-3-2026-11-25/e01-rocket-tube.mp4)
  (38 s, 6:50 AM EST).

### What landed

- The rocket turret's timing and damage were measured in the original: first shot at 6.9 s, then one
  every 6 s, 550 u/s, lethal. Its rockets go through portals, it sees you through breakable glass,
  and it can turn a full circle.
- Tube boxes take path_track's alternate path and spit out the cube, and the escape fan isn't solid,
  both as in the original.
- You duck when you come out of a wall portal and stand up after a floor fling. A cube you're carrying
  stays in your hands through that duck.
- Pointing at a door and pressing use now works, and so do look triggers.
- Rocket blasts damage GLaDOS, and her cores burn in the incinerator.

The wrap-up allplay first showed regressions in a02, a03, a06, a10, a13 and a15. The new duck at a
wall portal had made you drop a carried cube and had undone the aim a10 needed for its lift; look
triggers closed a06's fling-pillar doors while you looked down into the pit; a03's wall portal sat
off the energy ball's path; and the new train code was grabbing a13's ball catchers and placing them
rotated wrong. Those are fixed at `d7b1478`.

### Playthrough

Game seconds to the next map, from the allplay at 9:41–9:49 AM EST on 25 Nov:

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

### Still ahead

GLaDOS's last two cores and the ending. A route through a11 that survives turret damage, so
`?damage=1` can become the default. The hold-distance 81 change, parked because the playthrough
scripts are tuned around 56. a07 still finishes on the chamber with the next map unset.

## Session 2 — 24 Nov 2026

From 9:03 AM EST through 8:28 PM EST on 24 Nov, on `gabriel/oracle` at
[`57d7eb7`](https://github.com/Yhozen/portal-web/commit/57d7eb7a3b35949df91616b435c570468a710a68).
49 commits since session 1. Checks pass 39/39.

**Videos** (in the [`session-2-2026-11-24`](https://github.com/Yhozen/portal-web/releases/tag/session-2-2026-11-24) release):

- [Session 2 reel](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/session2-reel.mp4)
  (112.6 s, recorded 8:27 PM EST, from `57d7eb7`). The official allplay is the source of the 198.4 s
  escape_00 time. A recorded replay of the tube-to-changelevel tail drifted into the goo, so the reel
  uses the cube-tube climb plus the earlier piston-route footage.
- [escape_00 piston route](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-route-reel.mp4)
  (24.2 s, 6:53 PM EST).
- [escape_00 cube tubes](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-tubes.mp4)
  (22 s, 7:46 PM EST).
- [escape_00 toward the changelevel](https://github.com/Yhozen/portal-web/releases/download/session-2-2026-11-24/e00-end.mp4)
  (87.5 s, 8:19 PM EST). This take is not the source of the official time; see the reel note above.

### What landed

- Bone followers, so a13's dropper cover is solid and holds the box.
- Energy balls bounce off cubes in the cube's own frame.
- Firing while holding a cube drops it.
- `trigger_multiple` refires while something sits in it, as in the SDK's CTriggerMultiple.
- Doors return after their wait.
- Portals work on rotated brush entities, and the player is clipped out at a wall portal's rim.
- `trigger_push` follows the SDK.
- `prop_physics` EnableMotion, and `func_portal_detector`.
- Turret `.phy` body: it tips in 0.6–0.7 s, as in the original. Turret damage is 1.80 s from first
  hit to death, against 1.79 in the original, and stays behind `?damage=1`.
- Wall-fling speed: 400 / 527.3 / 627.3 against the original's 391.5 / 526.5 / 625.5.
- Cube-tube `.phy` collision, which is how escape_00 climbs to the changelevel.

### Playthrough

Game seconds to the next map, from the allplay at wrap-up:

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

### Still ahead (at the end of the session)

escape_01, escape_02 and the GLaDOS fight. A route through a11 that survives turret damage. Hold
distance 81, parked because a patch at that distance broke the a00, a01, a02 and a08 scripts. a07
still ends with the next map unset.

## Session 1 — 23–24 Nov 2026

From about 11:45 PM EST on 23 Nov through 8:56 AM EST on 24 Nov, on `gabriel/oracle` at
[`795cd54`](https://github.com/Yhozen/portal-web/commit/795cd54a5da3b54c834f80d18f8dd27ee2da18e9).
Checks pass 36/36.

**Video** (in the [`session-1-2026-11-24`](https://github.com/Yhozen/portal-web/releases/tag/session-1-2026-11-24) release):

- [Session 1 reel](https://github.com/Yhozen/portal-web/releases/download/session-1-2026-11-24/oracle-session-reel-2026-11-24.mp4)
  (46.9 s, recorded 8:23 AM EST on 24 Nov). A side-by-side floor fling against the original, the
  +use reach sheet, the a13 box climb, and a11 played through to the lift. The footage is from the
  morning's build at `af8974f`, just before the session wrap-up note at `795cd54`.

### What landed

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

### Playthrough

Game seconds to the next map, from the playthroughs on the final build of the session, written up
at 8:50 AM EST on 24 Nov:

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

### Still ahead (at the end of the session)

a13's ball catchers and lifts, a14, and the escape maps. The wall-fling height and the speed fix
without breaking a10. Held distance 81. box_dropper's cover and prop_dynamic solidity. Turret damage
and the turret tip-over.

## macOS canvas and known no-ops — 21 Nov 2026

From 6:40 PM EST through 7:55 PM EST on 21 Nov, on `gabriel/noop-inputs`, tip
[`19d1495`](https://github.com/Yhozen/portal-web/commit/19d14956e5198e1cfae4c881c0532dcce29152a7).
Merged to main as [pull request #5](https://github.com/Yhozen/portal-web/pull/5) at 6:08 PM EST on
22 Nov (`c26bacf`), which was the tip of origin/main until the oracle work.

On the hosted preview, Gabriel's Mac showed a00's floor button and the cube on it black except for
their self-lit strips. It did not reproduce on SwiftShader or Mesa llvmpipe. The cause was the
canvas: model materials keep their `$selfillum` mask in the base texture's alpha, the opaque passes
wrote it into an alpha-channel drawing buffer, and the page composited that buffer as
premultiplied, which macOS shows as black. The context is now `alpha: false`.
`env_tonemap_controller` and `logic_autosave` inputs are registered as known no-ops. The harness
gained `assert`, `PCTL_GL=mesa` and `FILES_DIR`.

## Animation session — 19 Nov 2026

From 9:25 AM EST through 2:25 PM EST on 19 Nov, on `gabriel/linux-depot` at
[`1136585`](https://github.com/Yhozen/portal-web/commit/1136585a6794eeb9c6936f3774eadb054aabbcf0).
A five-hour session to stop judging animations from single screenshots. 29 checks pass. Merged to
main as [pull request #1](https://github.com/Yhozen/portal-web/pull/1) on 21 Nov.

**Video** (in the [`animation-session-2026-11-19`](https://github.com/Yhozen/portal-web/releases/tag/animation-session-2026-11-19) release):

- [Animation session reel](https://github.com/Yhozen/portal-web/releases/download/animation-session-2026-11-19/highlights-2026-11-19.mp4)
  (44.6 s, recorded 1:49 PM EST). GLaDOS's cores riding her body, a10's telescoping lifts, the
  first-person gun's fizzle, floor turrets deploying and tipping over, and a08's cube riding its
  rail platform.

### What landed

The animation pipeline follows the public SDK 2013 rules: blend grids, delta and autoplay layers,
0.2 s sequence cross-fades, long sequences read from `.ani` sections, and client animation events.
The first-person portal gun plays its draw, fire, fizzle, pickup and release sequences. Floor
turrets deploy, aim, fire, search and tip over, and security cameras track the player. GLaDOS's
cores and the energy-ball catcher's ball ride their parent's attachment. `$selfillum` no longer
turns a10/a14's lift platforms white. a10's telescoping lifts sink all the way, riding them no
longer throws the player up, and a06's fling pillars start where Hammer put them. Portal shots
slide off no-portal faces as well as edges. Cubes ride moving trains. Named lights switch their
light styles, `env_shake` shakes the view, and falling onto a floor portal keeps the fall speed.
`portal-ctl` gained `record` and a persistent `serve` mode.

The scripted autopilot plays a00 to a07 in order, including the 07a to 07b elevator, and a08 up to
the cube platform's east stop. The fling onto the platform still misses.

## Test harness — 18 Nov 2026

From 8:20 PM EST through 9:20 PM EST on 18 Nov, on `gabriel/linux-depot` at
[`5a6134e`](https://github.com/Yhozen/portal-web/commit/5a6134ecf120ed22d74349c52ddeae8f9906fa63).
Six commits, off main at `0d06ee2`. Turrets were not implemented yet.

### What landed

- `tools/portal-ctl.mjs`, documented in [docs/harness.md](docs/harness.md), modelled on Horizon's
  `horizon-ctl`: one command per line in, one JSON line per command out. Each run starts its own
  asset server and headless Chromium. Screenshots are deterministic: the pause is set before any
  page code runs, `Math.random` is seeded, the game only advances on `step` (fixed 1/66 s ticks),
  and all 30 later-chamber views were byte-identical between this branch and main at `0d06ee2`.
- The Linux depot on the box is byte-identical to the older install.
- 2D sky and the `sky_camera` 3D skybox, which is what the escape_02 ending and its distant scenery
  were missing.
- Animated props are skinned when drawn, not every tick. GLaDOS's body had been CPU-skinned and
  re-uploaded every tick, on screen or not. `EntityIO.find` indexes entities by classname instead of
  scanning all 1,565 of them (the parenting code looks up each parented prop's parent twice a tick,
  and escape_02 has 67 of them). Together those cuts took escape_02 simulation from 962 to 200 ms
  per 660 ticks, about 0.3 ms per tick instead of 2.0.
- A `$selfillum`-on-models attempt lit GLaDOS's lights but turned a14 and a10's lift platforms
  bright white, because their textures have no real alpha mask. It was reverted.

The autopilot playthroughs still finished with the same game times as on 2 Nov: a00 117.8 s, a01
82.0 s, a03 119.3 s.

## Portal occlusion and lighting — 3 Nov 2026

From about 7:05 AM EST through 8:03 AM EST on 3 Nov, on main at
[`0d06ee2`](https://github.com/Yhozen/portal-web/commit/0d06ee236039068b4a11e1b55559387fa644ef7a).
The portal-bug update went out at 8:04 AM EST. These four commits, plus the uploader commit, were
pushed from the Mac at 8:41 AM EST, which put main at `0d06ee2`.

**Stills** (in the [`portal-occlusion-2026-11-03`](https://github.com/Yhozen/portal-web/releases/tag/portal-occlusion-2026-11-03) release):

- [Before](https://github.com/Yhozen/portal-web/releases/download/portal-occlusion-2026-11-03/1_repro_before.png):
  a portal showing through the wall.
- [After](https://github.com/Yhozen/portal-web/releases/download/portal-occlusion-2026-11-03/1_repro_after_portalfix.png):
  the wall hides the portal; a sliver remains through glass, with the glass tint.
- [a00 pedestal](https://github.com/Yhozen/portal-web/releases/download/portal-occlusion-2026-11-03/3_a00_pedestal_after.png):
  the room with the lighting fixes.

The portal shader had left depth undefined, so portals showed through every wall. Walls now hide
portals at every recursion level, and a portal behind glass shows through with the glass tint.
Props take the room's ambient light instead of a single placeholder brightness, and the white
triangle decals around the button pedestals take their light from the floor under them. Frame rate
did not change. Earlier that morning: an owner-only private R2 bucket for game files, and
`upload-game-files --s3`.

## Hosted preview — 2 Nov 2026

From 9:30 PM EST through 11:40 PM EST on 2 Nov, tip
[`ad36170`](https://github.com/Yhozen/portal-web/commit/ad36170e69f8a9908ef6c084e45e0d4bcc5b42e4).
A private Cloudflare preview of the engine only, at portal.rccpr.tech, and a bring-your-own-files
mode that copies a player's own Portal folder into the browser's private storage (OPFS). No game
data goes into git, the build, or the engine bucket. The GitHub repository itself was created
around 9:58 PM EST, during this session. The a00 autopilot reached a01 at 117.8 s from OPFS.

## Chambers 00 through 07 — 2 Nov 2026

From 6:27 PM EST through 8:35 PM EST on 2 Nov, tip
[`ec6295a`](https://github.com/Yhozen/portal-web/commit/ec6295aec82e29393b885e6d49f308c4ec08f28f)
at 8:23 PM EST. The update describing this milestone went out at 8:30 PM EST.

Chambers 00 through 06 play all the way through in the browser, and 07 works up to picking up the
dual portal gun, then stops at the exit switch. Times were 46.5 s for 05 and 59.2 s for 06
(reported as 47 s and 59 s). Xash3D projects were looked at for ideas only; no code was copied, and
no leaked code was used.

**Stills** (in the [`chambers-00-07-2026-11-02`](https://github.com/Yhozen/portal-web/releases/tag/chambers-00-07-2026-11-02) release):

- [a05, the cube on the platform](https://github.com/Yhozen/portal-web/releases/download/chambers-00-07-2026-11-02/40-a05-fryer-route-box-on-platform.png)
- [a06, the fling room](https://github.com/Yhozen/portal-web/releases/download/chambers-00-07-2026-11-02/41-a06-fling-pillar.png)
- [a07, the dual-gun pedestal](https://github.com/Yhozen/portal-web/releases/download/chambers-00-07-2026-11-02/42-a07-dual-gun.png)

### What landed

a05 carries the cube around the cleanser field using the fixed orange portal. a06 lets you put
portals on the fling pillars and fling yourself, and grates stay solid inside portal tunnels. a07's
gun pedestal rotates and fires like the real game, portals slide away from edges where they are not
allowed so the energy ball reaches its catcher, the moving platform shuttles, and you get the dual
gun at about 122 s.

### Playthrough

Regression at 8:16 PM EST, on the way to `ec6295a`:

| Map | Time | Next |
|---|---|---|
| a00 | 117.8 | a01 |
| a01 | 82.1 | a02 |
| a02 | 149.3 | a03 |
| a03 | 119.3 | a04 |
| a04 | 71.5 | a05 |
| a05 | 46.5 | a06 |
| a06 | 59.2 | a07 |
| a07 | about 122, at the dual gun | stops at the exit switch |

## a02 through a04 — 2 Nov 2026

From 2:25 PM EST through 3:25 PM EST on 2 Nov, tip
[`b57a6ac`](https://github.com/Yhozen/portal-web/commit/b57a6accbfd46b9e83a6286fb94152a07338a109).
a02 part 2, a03 and a04 play through end to end. Energy balls, template catchers, ride-along on
moving brushes, and floor-portal centre crossing all landed in this hour.

**Stills** (in the [`chambers-02-04-2026-11-02`](https://github.com/Yhozen/portal-web/releases/tag/chambers-02-04-2026-11-02) release):

- [a02, both boxes on the buttons](https://github.com/Yhozen/portal-web/releases/download/chambers-02-04-2026-11-02/38-a02-part2-both-buttons.png)
- [a03, the cart ride](https://github.com/Yhozen/portal-web/releases/download/chambers-02-04-2026-11-02/37-a03-cart-ride.png)
- [a04, the cart ride](https://github.com/Yhozen/portal-web/releases/download/chambers-02-04-2026-11-02/39-a04-cart-ride.png)

| Map | Time | Next |
|---|---|---|
| a00 | 117.8 | a01 |
| a01 | 81.8 | a02 |
| a02 | 149.3 | a03 |
| a03 | 119.3 | a04 |
| a04 | 71.5 | a05 |

## The port begins — 2 Nov 2026

From 9:51 AM EST through 12:32 PM EST on 2 Nov. The install was in place at 9:51 AM EST (build
19017868). The first render of the relaxation vault, in headless Chromium with SwiftShader, was at
9:58 AM EST: lightmapped textured brushes, 41 fps at 1024×640, load 460 ms. The first commit,
[`4091bc3`](https://github.com/Yhozen/portal-web/commit/4091bc3923a59d372c3df04b6c68aef0b54ca5da),
is at 10:12 AM EST. The morning's tip is
[`f6df7d1`](https://github.com/Yhozen/portal-web/commit/f6df7d1cc661fec2b6f10a2fa0efde589ec14c88)
at 12:31 PM EST. Clean-room throughout: Valve Developer Wiki specs and the public Source SDK 2013,
no leaked code.

**Stills** (in the [`first-session-2026-11-02`](https://github.com/Yhozen/portal-web/releases/tag/first-session-2026-11-02) release):

- [First render, the relaxation vault](https://github.com/Yhozen/portal-web/releases/download/first-session-2026-11-02/01-first.png)
  (9:58 AM EST).
- [Portal gun placement](https://github.com/Yhozen/portal-web/releases/download/first-session-2026-11-02/04-gun.png)
- [Cube on the floor button](https://github.com/Yhozen/portal-web/releases/download/first-session-2026-11-02/06-button.png)

### What landed

VPK v2 and BSP v20 loaders, a lightmapped renderer, Source-style movement, entity I/O, recursive
stencil portals, cube pickup, elevators, changelevels, the a01 pedestal gun, MDL skeletal animation,
rotating doors, a tumbling cube, overlays, audio, and PVS culling. `tools/autopilot.js` walks the
maps through the normal controls only.

By 12:32 PM EST, after a short a00 regression was fixed: a00 reaches a01 at 117.8 s, a01 reaches a02
at 81.8 s, and a02 part 1 reaches the middle elevator at 70.6 s. a02 part 2 was still open.
