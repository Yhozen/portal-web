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
