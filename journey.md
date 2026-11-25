# Journey

A running log of work on the port. Times are America/New_York.

## 2026-11-24 to 25, session 3 (from 8:35 PM EST)

**4:35 AM EST, escape_02 starts in a rusted trench under a destroyed office.** The changelevel lands you at 6120, 1875, -1535 with the portal gun on the floor; OnNewGame ForceSpawns it and you pick it up on the first steps. The walkable floor is a narrow north-south strip along x 6120 at z -1536. South of y 1788 is goo, and west of about x 6080 the floor slopes down (I walked that slope to 5904, 2295, -1616 and hit the west wall, still at 100 health). Looking south from the lip you can see a ceiling grate — that's `rotating_fan_01` at 6016, 1648, -1396 — and through the mesh the original shows the rusted cylinder and the concrete office floor above. Shots that go through the hole in the original often say "Portal was on moving surface" (the blades), same as the fan in escape_01; aims that miss the blades still weren't landing on that upper floor from the trench (the cylinder and noportal metal sit around the shaft, and a floor above you is hit from underneath). The walkway itself continues north to about y 2708, then drops. A wall at y 2992 past the north fan is portalable, but the portal sits at z -1461, under the upper floor, so walking through would drop you into the pit. `tools/play/escape_02.js` now walks the south lip and the north end without falling, gun up, 100 health. Next is a legal hop onto the office floor (z around -1392 / -1280) and the walk toward the turret pods and GLaDOS.

**4:12 AM EST, escape_01's playthrough walks into the changelevel.** From the vent the script ducks east and south to the fan, puts a portal on that wall under the blades (1199, 48, -253), jumps back out of the vent into the tube room, and walks into a portal on the south wall at 1232, 512. That drops you into the rusted room at z -320, still at 100 health. A second pair of portals — the room's own south wall to a west-facing wall at 1920, -100, -260 — lands you on the east platform, and walking south along x 1888 hits `changelevel_escape_01_02` at 215.6 s. `window.changedTo` is escape_02, no errors, still 100 health. Next is escape_02 and the GLaDOS fight.

**4:10 AM EST, the fan blades were solid in the port, and the wall under them is a real room.** After the vent the duct turns east and then south toward `rotating_fan_07`. Walkthroughs say to put a portal on the wall under that fan and walk through. In the original the blades aren't solid — the entity is `func_rotating` with spawnflags 577, and 64 is "Not Solid" — so a shot from the duct at 1232, 300, looking down at the fan, goes through the blades and lands on a wall at about 1202, 48, z -266. The port was colliding with that brush, so the same shot either died on noportal metal or hung you in the fan. Skipping the collider when that flag is set, the shot now lands on the same wall. Walking into a linked portal on the tube-room south wall (1232, 512, -200, which does take a portal) drops you into a rusted-floor room under the shaft, feet at z -320, still at 100 health. I dropped out of noclip in the original at the same spot and landed on the same floor, in front of a "Danger — Authorized Personnel Only" door; it isn't goo. The playthrough is already in the vent at 192.3 s. Next is hooking that shot into the script and walking this lower room to `changelevel_escape_01_02`.

**3:54 AM EST, the playthrough crouch-jumps from the spat cube into the vent.** A standing jump from the floor still can't reach that lip, and a standing jump also can't mount the 40.5-tall cube (peak 20, plus step 18, still short, and the standing hull just hits the side). A running duck-jump does land on it — after the drop at 1153, 535 the playthrough backs up, runs at the cube, and ducks mid-air, and at 190.7 s you're standing on top at z -215, 100 health. Getting *into* the vent is a second, different jump: if you go while still ducked you only peak 21 units (around z -194), short of the lip at -176, and you also can't stand up that close to the wall. Walk north on the cube to about y 558, stand up, then jump south and duck mid-air. That one peaks at z -159 and steps onto the vent floor at 1153, 469, -176. The full playthrough does it at 192.3 s, still at 100 health, no errors. The duct behind the hole is tight (you have to stay ducked); it turns east then south toward `rotating_fan_07` at 1216, 176, -180, and the fan hangs over a pit down to z -320 with a walkable floor resuming east of x 1293 and south of a wall at y 48. Walkthroughs say to put a portal on the wall under the fan and walk through from behind. Next is that shot and the walk to `changelevel_escape_01_02`.

**3:35 AM EST, the vent opening is higher than a cube-jump in the port, and I started measuring it in the original.** The playthrough now picks up the spat cube on the tube-room floor (179.3 s, still at 100 health). The vent is a hole in the south wall at about x 1136–1168, y 512. In the port, point traces only go through at z -168 to -120; world brush 210 (concrete/duct) fills the lower part up to a lip at z -176 on the room side, with a sloped top. The cube is 40.5 tall and a jump only adds 21, so from the floor your feet peak around -194 — short of that lip. Walkthroughs are unambiguous: put the cube in front of the vent and crouch-jump in, or stack a chair. In the original, a floor-level look toward the opening shows the visible grille sitting right around the top of a storage cube, which is lower than the port's collision lip, but I still need a clean no-noclip setpos at the lip (a leftover spawned cube and noclip toggling made the first pass messy). Surfaces through the vent are noportal metal duct, so you can't portal past it from the tube room. Next is finishing that measurement and either fixing the lip if it's a port bug, or finding the original's actual crouch-jump, then the fan hallway and changelevel.

**3:20 AM EST, a live rocket goes up the tube and the cube lands on the floor.** After *43 I warp back the same way as before — south-wall portal to the far room, hallway to the alcove, duck through the broken pane — and put a floor portal under the 960 tube (that floor takes a portal; 1088 and 1216 do not). Hopping into it drops me back at the office south wall. The south-wall entry is the wrong one for this shot: a rocket heading mostly west has a large tangent on that plane, so it comes out of the floor going sideways and misses the trigger (one test exploded at 925, 1019, -68). Re-placing the west-wall entry at y 480 and baiting from -630, 490, the way the *43 shot did, sends the rocket nearly straight up. At 53.88 s it goes through the floor portal at 939, 577, -255, the 960 missile trigger fires `EnableAlternatePath` on `tracknode_boxtube_4`, and `broken_tube_box_spawner_3` ForceSpawns the box. It lands on the floor around 999, 568, -236. The entity origin stays at the spit point, so pickup has to look at the cube object, not the ent. If the floor portal is still open, the falling cube goes through and comes out the west-wall portal into the office — I overwrite that floor portal with the far-wall warp as soon as the rocket is through, then pick the cube up in the tube room. The vent is a tight opening in the south wall (about x 1136–1168, z -160 to -114, wall at y 512); a cube-jump from the floor can't reach it (the cube is 40.5 tall and a jump only adds 21), and the duct on the other side is noportal metal. Next is getting through that opening to the fan hallway and the changelevel.

**3:05 AM EST, a live rocket breaks the east glass and the far pane, and the tube train starts.** After Enable I have to leave the button — the first shot is only ~6.9 s later and the stand at -545 is inside the west-pane blast. From the same legal LOS stand at -600, 560 the turret breaks *50 on its own, the way the original did. The east pane (*51) is the tight one: standing in the turret room on the line of fire, a dodge that actually hits the glass leaves you inside the 64-unit blast (body-center, not feet). A portal redirect works without dying. Two west-wall portals both facing +X flip left/right, so a rocket aimed at y 480 comes out going north and misses the pane; a south-wall entry at -620, 448, facing +Y, with the exit on the west wall at y 480, sends that same rocket into *51 at -132, 677. After both panes are down, the far wall of the next room (256, 580, -180) is visible from the office, so you can walk into the south-wall portal and land past the turret before the next shot. d4's walkable gap is at x 180 (not the door origin at 203), the south hallway runs at y 420, and d5's gap at x 596 leads north into the *43 alcove. A portal on that alcove's east-facing wall at 512, 800, a jump back through it into the office, and the original west-wall entry at y 480 put a rocket through to 755, 861 and break *43. OnBreak Triggers `relay_make_tracktrain_box`, which ForceSpawns the looping tube train. The playthrough does all of that and is still at 100 health. Next is a floor portal under a missile trigger (the floor at x 832 and 960 takes a portal; 1088 and 1216 do not), a rocket up the tube, the spat cube, and the vent to the changelevel.

**2:15 AM EST, the rocket turret can turn all the way around now.** Its `aim_yaw` pose is a looping -180..180 parameter, but vis was using a clamp, so once it passed 180 it stuck facing north and never tracked the player around to the east office glass. Wrapping that pose lets it come around; from a stand at -200, 580 it now aims almost due east (dir 0.99, -0.10) and fires that way. Dodging the live rocket so it hits the east pane without also killing you is still in progress — 0.15 s of south-strafe breaks the glass but you're inside the blast.

**2:05 AM EST, a rocket into the tube can drop a cube now.** The vis fix is in (39/39 at 2:00 AM on e2a0f34). The other half of the puzzle was the tube itself: a `filter_only_missiles` trigger around each clear segment fires `EnableAlternatePath` on the box track, and the next cube on the loop is spat out as a real `prop_physics` with `PostSpawnSpeed` 200, pitched down. None of that was hooked up. `path_track` now honors the alternate path, `env_entity_maker` ForceSpawn of the tube train (speed 0, startspeed 200) starts it the same way the a10 carts already did, and PostSpawnSpeed actually throws the spit box. From a test ForceSpawn plus EnableAlternatePath, the train diverts at 1.00 s and the box lands on the floor at about 1255, 568, -236. Next is getting a live rocket into one of those triggers and walking the cube into the vent toward the changelevel.

**1:45 AM EST, the original rocket turret sees and shoots through the office glass.** Standing west of the pane at feet -600, 560, -256 (south of the enable button, so the original isn't stuck in it), I Enabled `laser_1` in the oracle and waited. At 7 s the west glass was still there; at 9 s it was gone and the turret was tracking me through the hole, still at the same stand. That first shot from inside the turret room didn't answer this — this one does. The port's vis trace was using `MASK_SHOT_PORTAL`, which includes `CONTENTS.WINDOW`, so it stopped on the glass (frac 0.836) and never acquired the player. The panes are `TRANSLUCENT|WINDOW` (contents 0x10000002). Switching only the rocket turret's vis to `MASK_BLOCKLOS` (SOLID|MOVEABLE, no WINDOW — the same idea as Source's LOS mask) lets it see through; the rockets themselves still use a shot mask and `explodeRocket` already breaks `func_breakable_surf`. In the port, from the same stand: hadTarget is true by 7.0 s with a rocket in flight at about -424, 565, and at 9.0 s pane *50 is killed. Next is redirecting those rockets into the tube.

**1:40 AM EST, +use on the enable button turns the rocket turret on.** `button_enable_turret` is a Use-Opens `func_door_rotating` (spawnflags 4432 includes 256, distance 0), and looking at it from a stand at -545, 608 is enough for `G.use()` to hit it. OnFullyOpen Enables `laser_1`, plays `button1_down`, and swaps the rocket soundscapes. The playthrough does that at 103.9 s. The west glass (`func_breakable_surf` *50, x -521 to -488) would also Enable the turret if you broke it; there's another pane (*51) on the east side of the turret at x -152 to -119. Portals are already fizzled — the cleanser is a thin volume at x -760 to -752, on the way in. Next is redirecting the rockets into the tube (triggers at x 832–1216) and walking that to the changelevel.

**1:35 AM EST, the playthrough walks through the office doors to the rocket-turret button.** From the z -256 platform, the offices run south along x -800. The `prop_door_rotating` doors (d1–d5) have a model (`door01_left.mdl`) but the port doesn't spawn or collide them yet, so the opening is just the world doorframe. d1's gap is x -856 to -804 (the playthrough goes through at x -830, 90.8 s). d2's is y 556 to 604 (through at y 580, 95.4 s). That lands you in the rocket office; the playthrough stands at the enable button (-545, 640, -204) at 103.7 s. Next is +use on that button (it's a `func_door_rotating` with distance 0), the glass, `laser_1`, and the tube into the changelevel.

**1:30 AM EST, a 64-unit fling off the flipped door lands on the office platform.** The walkthrough was right: the top of the opened flippy door takes a portal. It isn't the rotating door's own faces (those are easy to miss); it's `flippy_brush`, a parented `func_brush` whose west face is plastic (`plasticwall001b` / `004a`, flags 2048, no noportal). Once the door has pitched -60, that face sits at about -1609, 1600, -279 with normal [0.5, 0, 0.87] — east and up, which is why the fling works.

From the large-room floor (around x -1100, y 1600) you can see that face. Because the normal's z is 0.87, the port treats it as a floor portal and takes "up" from the player's yaw, the same way the tube-bay floor did. Yaw 0 or 180 is a no-fit on the 128x128 plate; yaw 90 or 270 places cleanly. A linked floor portal at -1450, 1600, -512, then a 64-unit drop into it, comes out of the door and lands on the z -256 office platform at about -1104, 1639. A standing drop only sticks you on the door; a 128-unit drop overshoots and, from a floor at -1300, can instead land on a narrow metal ledge along the north wall (brush 322, y 1856–1920, x -1664 to -1152, also z -256, but noportal metalfloor). A 220-unit drop hits the metal ramp itself (brushes 2193/2194). The ramp and the platform top are `metalfloor_bts_001b`, noportal; the office wall under the platform (brush 317, x -768, z -384 to -256) is portalable concrete, but a wall exit there is still below the slab.

The playthrough now walks to -1100, faces north, places the door-top portal, places the floor at -1450, and drops 64 units in — the same kind of set-height portal entry the tube-bay already used. Next is the offices themselves, the rocket turret, and the tube into escape_02.

**1:25 AM EST, through the flippy door into the large room.** Once the door has finished flipping, walking east at y 1604 goes through the opening and drops you onto the z -512 floor of the next room (the playthrough lands around -1299, 1411, -512). The room runs east to a wall at x -768. A ramp (brushes 2193/2194, sloping up to the east) starts around x -1200 at z -290 and meets a platform at z -256 (x -1072 to -752) — that's the height of the offices, but it's 220 units above this floor, so the next step is the walkthrough fling onto that ramp.

**1:15 AM EST, through the hole and the flippy door is open.** From the walkway, the red arrow (overlay 94 at -1888, 1696, -209) sits on the south wall next to an EXIT scrawl a little higher. A few dozen units east of that is a small hole in the same wall: x -1852 to -1812, z -244 to -196, just 48 units tall, so you have to duck. The playthrough ducks through at x -1832 and drops into the pit (onto the turret at -1808, 1600, or the floor at z -384). That pit is `trigger_once` *40, which Opens `move_flippy_turret_door_12` and, two seconds later, the rotating flippy door itself (it ends at pitch -60). Walkthroughs then fling off the top of that opened door onto a ramp into the offices; that's next.

**1:05 AM EST, the playthrough jumps onto the higher walkway.** The metal stairs in the turret room are a broken flight (only a few grate treads, plus a `handrail04_brokensinglerise`) and they stop around z -456, so they never reach the walkway at z -256. The intended line, from Gamer Walkthroughs, is from the tube bay: put a portal on the south wall next to that walkway (the port places at -2208, 1696, -200, facing north) and jump across to it. The walkway itself is a 4-unit slab (brushes 2565 / 2570 / 525 / 524) along the south and east sides of the turret room.

The floor portal's "up" is taken from the player's yaw, and that offset decides where you come out of the wall. Facing north (yaw 90) when you place the floor, then dropping into the center and running east, lands on the walkway and runs to about -1744, 1743, -256 in the playthrough. A red arrow (`overlay_scrawlings_arrow01`, overlay 94) and an EXIT scrawl (overlay 95) are on the south wall at z -209 and z -161, around x -1888. Next is the small hole they point to, the turret you drop onto, and the flippy door into the offices.

**12:40 AM EST, the playthrough is out of the pit and into the turret room.** escape_01.js now stands at the east side of the alcove after the sparking door, puts one portal on the floor and the other on the concrete ceiling at z -128, and falls through into the tube bay at -2232, 1964, -512 (48 s). From there you can walk south to the converted-rung ladder at -2208, 1701, or shoot through the chain-link fence onto the west-facing wall of the next room (x -1792, z -315) and come out among the knocked-over turrets, at about -1999, 1742, -496. The metal stairs up to the office walkway are right there. A first walk up those stairs only gained about 48 units, so they may need a tighter approach or better collision; that's next, then the offices and the rocket turret.

The floor plate under the tube-bay landing is too tight for a 64x108 portal, so the script shoots 48 units west of the feet (onto -2280, 1964, -512) and only after blue has moved off the ceiling — a floor portal directly under that ceiling one is a loop, and even a 0.1 s wait on it was reporting no fit. Coming out of the wall portal also leaves you ducked and still sliding (onGround at z -456, vx -238); fly() now waits until the slide actually stops, and the playthrough lands at -1999, 1742, -496 at 50.3 s.

**12:25 AM EST, a portal through the hole lands in the tube-and-ladder room.** Standing at the east side of the alcove (feet -1748, 2188, -640) and aiming southwest-up (pitch -40.6, yaw 205.4) at about -2144, 2000, -200, the port places a portal on the underside of a concrete floor at -2232, 1964, -128 (`concrete/concrete_bts_floor002a`, flags 0, world brush 410). The other portal goes on the alcove floor. Falling through comes out of that ceiling and lands on the wreckage floor at -2232, 1964, -512, in a concrete bay with a tube in the ceiling and a chain-link fence on the east side — turrets and a stair/walkway are visible through the fence. That's the room Gamer Walkthroughs describes after the claw hole ("you'll land in a room with a tube and ladder").

The same aim in the original, from the same legal stand, printed "Portal placed on a no portal material." The view through the hole is right — you can see the red arrow and the white concrete of that room — so the original is hitting something along the path that the port's `MASK_SHOT_PORTAL` trace is not. Next is finding a nearby aim the original will accept onto that concrete (or a wall in the same room), then walking the landing on to the higher walkway, the offices, and the rocket turret.

The earlier questions are settled: brushes 287/1081/291 are world-only and the original's gun does hit them; the arrow is overlay 96 on 1081; the shaft above the hole is capped by a too-small `lights/white001` panel (brush 295 at z -288).

**12:16 AM EST, the arrow is on the metal wall, and the original hits it too.** The red arrow is an overlay (`overlays/overlay_scrawlings_arrow01`, id 96) at -1807, 2128, -467, facing north — painted on the north face of world brush 1081, the middle slab of that 16-unit wall at y 2112–2128. Brushes 287, 1081 and 291 belong only to world model 0. They are not in `door_raise_sparky` (*39) or any other brush entity, so killing the door does not move or remove them. The original's portal gun agrees: from the legal stand at feet -1792, 2220, a shot at the arrow itself prints "Portal placed on a no portal material," and shallower shots into the alcove ceiling around the hole print "unable to fit on surface." The gun is not ignoring those brushes, and the hole is not a separate model.

What you actually look through is a hole in the alcove ceiling (roughly x -1812 to -1748, y 2132–2172). The rusty surface with the arrow is that far wall, seen from below; the arrow points up and to the right. From y 2220 you cannot aim through the hole steeply enough to clear the top of the wall (z -384): anything past about pitch -53 hits the alcove ceiling first. Standing under the hole at y 2170 lets you look straight up the shaft. That shaft is capped by world brush 295 at z -288 (contents SOLID). The port says "no fit" on it. I also noclipped into the lit industrial room the arrow seems to point toward, around -1664, 2000, z -350 — turrets on a rust floor, pipes, a stair. Next is measuring that straight-up shot in the original, and finding a legal surface in or past that room that you can actually see from the alcove floor.

**11:50 PM EST, the alcove hole is the way out, but I haven't landed a legal portal through it yet.** After the 39/39 re-run I kept trying to ride the piston catwalk to the west walkway (x ≤ -2000, z -384). Holding south while C2/C3/C5 retract works: three jumps land on each south piston in turn. The problem is timing. By the time you reach C5, that 100 u/s piston has already carried you to y ≈ 2416, south of the west walkway's only window (y 2560–2688). The last jump then hits the pit's west wall at x -1984 and you fall. A north-row chase falls through the gap between the rows, because C1 leaves y 2619 almost immediately. In the original, holding only W also fails: it rides the north pistons to y 2832 and falls at t ≈ 6 s. So that walkway is a tight optional line, not the intended exit.

If you do make it, the path onward is clear: west along z -384 to about x -2272, south, a short jump at y 2464, then a 128-unit drop at y ≈ 2176 onto the wreckage floor at z -512, and the ladder rungs at -2208, 1701 (solid after a portal on the nearby detectors). Offices are east of there at z -248.

The intended way out of the pit, from public walkthroughs (Thonky, StrategyWiki) and from looking at the original, is the south alcove. After the claw look-and-use, `door_raise_sparky` is Killed and leaves a rectangular hole in the south wall (roughly x -1812 to -1766, z -562 to -400). In the original, standing in the alcove and looking south-up through that hole, you can see the wreckage floor and a far wall. Thonky says to look up above the claw for a red arrow, put a portal on the wall it's pointing at, and walk through a portal on the floor. StrategyWiki says the same: "sight up through the hole in the ceiling for the next portal."

In the port I can place on the alcove's own lower walls (z ≈ -570) and on the underside of the wreckage floor (z -512, facing down) — walking through that last one just dumps you back under the floor. I haven't yet placed a portal on a vertical wall *inside* the wreckage from a legal standing shot. A few traces do get through the hole as far as x -2100, y 1960, z 0, or a ceiling at z -256, but those surfaces have been noportal metal so far. Next is a tighter scan through that hole, and a few more aimed shots in the original, until I find the wall the arrow is pointing at.

**11:32 PM EST, checks are 39/39 after trigger_look.** 9a2f8b2 is in (trigger_look, +use prefers the first solid along the look, escape_01.js looks at the claw and uses the sparking door). The suite passed, including use-reach, the fling checks, and the GLaDOS ones. The playthrough itself gets through the south pod, enables the pincher relay, and the door is killed with the pole up at z -356, in 46 s. Still looking for a legal portal or walk from there into the wreckage and the offices.

**11:15 PM EST, the catwalk is the pistons, and trigger_look.** I ran the original along that ambush walkway for 9 s (`oracle/runs/e01-walk-beam.jsonl`). There is no static floor over the pit. You walk on the crusher tops at feet z -390 — a 32-unit gap between each pair — and the mid-pit trigger Opens them as you enter (C1/C4 immediately, C6/C3 at 0.25 s, C2/C5 at 0.5 s). Holding W, the original stays at y 2619 until the first gap, steps onto the north row, and is carried to about -1952, 2832, still at z -390, then falls into the pit around t=6 s when the slow west piston finishes retracting. After I forced every crusher fully Open, a setpos onto the old catwalk line dropped straight through, so the port was right to have a hole there once they leave.

In the port I was getting carried south on C2 before I reached the first gap, and a running jump got me to x -1968, just short of the west walkway at x -2000. The west walkway itself is noportal metal. The wreckage south of the pit does have portalable walls (x -1792, y 2208, z around -315 to -410, and a west wall at x -2432), but from the pit floor and the south alcove I still can't see a legal surface to put a portal on; the shot that reached x -2432 was from a noclipped eye above the wreckage ceiling.

The intended fidget in the alcove is `trigger_look`: stand in the doorway, look at `look_target_mini_ambush_escape` for 0.75 s (FOV 0.8), which Enables `relay_move_up_broke_pincher`. The sparking door (`door_raise_sparky`, Use Opens) then Triggers the relay, the broken pole lurches up, and the door is Killed. The port didn't have `trigger_look`, so that's in now, and escape_01.js looks at the claw after it walks through the south pod. +use also prefers the first solid along the look, so the south-pod turret doesn't steal the sparking door. Next is whether that opening, or a tighter shot from the doorway, actually gets me into the wreckage and the offices.

**11:00 PM EST, escape_01 reaches the south alcove.** After the lip fix, the script runs west from spawn, drifts off the narrow catwalk (the mid-pit crushers open as you enter), and lands on the ambush floor. The south turret pod opens about 21 s after the floor trigger; walking through it gets you into the broken-claw alcove at about -1839, 2132, -639. Next is out of that alcove, up toward the offices, and the rocket turret puzzle.

**10:50 PM EST, the ambush catwalk lip, and a start on escape_01.** In the original, walking west from spawn at 150 u/s goes straight onto the narrow catwalk over the turret-ambush pit (eye x -1585, then -1601, then the walkway dips to feet z -390; oracle/runs/e01-walk-lip.jsonl). The port stopped at -1584. `block_crazy_player_escaping_trap` is a 16-unit func_brush at the lip, StartDisabled, and the mid-pit trigger Enables it as soon as the hull crosses x -1600 — which is while you're still standing on the last 16 units of corridor floor, inside the brush that's just become solid. The original lets you walk through; the door is meant to close behind you once you're on the catwalk. A just-enabled func_brush that appears around the player now stays non-solid for them until they leave it. With that, the port walks the lip the same way, and escape_01.js gets from spawn onto the walkway (and, if you drift off the south edge, down onto the pit floor where the turret pods open). Next is through the south pod and on to the rocket office.

**10:30 PM EST, rocket turrets and portal-capable rockets.** The port now has `npc_rocket_turret` and `rocket_turret_projectile`. laser_1 starts retracted (spawnflags 1), Enable plays the model's open sequence and fires the first rocket at 6.95 s, then every 6.00 s. The sentry barrel is Y-up / Z-right, so aim uses that frame or the gun points straight up. A rocket is lethal (health 100 → 0 at 6.97 s standing in front, some knockback to about -414, 578). They also go through portals: one from -367, 572, -214 crossed a blue at -375 facing +X and came out the orange at 199, 576, -200, still at 550 u/s. The hole is taken if it's closer than the first solid in that tick, the way energy balls already do. Next is an escape_01 playthrough.

**10:10 PM EST, rocket turret numbers from the original.** After the box refresh, `hl2_linux` would not start because the 32-bit linker was gone (`/lib/ld-linux.so.2`). i386 libc, SDL and Mesa are back, and the original is running again. The earlier checks are still 39/39.

escape_01's `laser_1` sits in a floor mount at -320, 580, -250 and starts retracted (spawnflags 1). The enable button and the west glass both turn it on; it plays the model's `open` sequence (4.333 s) and then fires. Standing on the tiles in front of it at -400, 576 (eye at -184), with the original pinned to the 66-tick:

- the first rocket shows up between 6.84 and 6.96 s after Enable
- the next ones come about 6.0 s apart (5.96 s and 6.11 s on two watches)
- a rocket is lethal: with buddha on, health 100 drops to 1, so at least 99 damage. Regen then waits a second and climbs 1 per tick, the way the rest of the game already does
- projectile speed was already about 550 u/s; the class is `rocket_turret_projectile`, which is what the tube's `filter_only_missiles` looks for, and the tube props also take blast damage (type 64) through `filter_explode_damage`

The sounds are `NPC_RocketTurret.LockingBeep`, `NPC_FloorTurret.LockedBeep`, `RocketFire` and `RocketFlyLoop`. Next is putting the turret and a portal-capable rocket into the port, then an escape_01 playthrough.

**9:36 PM EST, first commit, and I'm measuring the rocket turret.** ca42ec1 has the portal duck, the
a15 retunes, and escape_00's crusher12 brake (zero leftover exit speed so we stay on the piston at z 1088).
a14 reaches a15 at 126.3 s, a15 reaches escape_00 at 261.7 s, escape_00 reaches escape_01 at 196.9 s.
Asserted fling and fling-wall checks still pass. eye5 is 560.3 on all three wall-fling drops; the 100-unit
drop would sit in a 11-unit tolerance (original 551.9), but 200 and 300 are still ~18 units low (original
578.4 / 578.7) because the first-exit placement differs, so I'm not asserting them yet. Floor-fling un-duck
timing is 0.364 s (original 0.345–0.375) and the eye pops 35.9 units, short of the original's 47 because
that's a 36-unit view snap.

escape_01 has one `npc_rocket_turret` (laser_1 at -320, 580, -250, spawnflags 1, starts disabled). The
switch button_enable_turret enables it, and so does breaking the west glass (`func_breakable_surf` *50).
The original's cheat `fire_rocket_projectile` from the player's eyes, at a wall 239 units away, spawned
`rocket_turret_projectile` plus `env_rockettrail` at tick 1 and they were gone at tick 29 — about 550 u/s
once you subtract the rocket model's 4.9-unit nose. Models are props_bts/rocket_sentry.mdl and
props_bts/rocket.mdl. The turret has Enable/Disable/Toggle and barrel/eye attachments; the puzzle is
redirecting those rockets through portals into a tube (triggers at x 832–1216, filter_only_missiles).
Full checks are still running (the 54 s GLaDOS destruction recording is a long one).

**9:25 PM EST, forced duck is in, and a14 and a15 still close.** Wall exits stay ducked until
you land; floor and ceiling exits snap the eye back up at 0.35 s if there's room. The mid-air duck also raises
the feet so the eye stays put, and landing clears that raise so standing up grows the hull upward — the way the
SDK does it, and the only way a duck-jump onto a15's exit-sign ledge (z 104 to 128) can unduck afterward. a15's
scripts needed a retune around that: the fall loop's second hop now leaves the wall portal at z 560, the walk
to crusher01_tc15 goes south around the floor portal then hops onto the cylinder top (z 104 at x 2764, not the
west shelf at z 80), and a duck-jump off the south end reaches the z 128 ledge. The broken-tube jump also had
to become a standing walk-off into the hole (y 964–996), then a duck so the hull fits under the tube ceiling;
holding 1616,1591 on the way up the far shaft lets the southbound push at z 1344 catch you. a15 reaches
escape_00 at 261.7 s, a14 reaches a15 at 126.3 s. escape_00 was walking off crusher12 with leftover exit speed; braking that landing let it close.

**8:45 PM EST, starting.** Tip was 57d7eb7, tree clean, on gabriel/oracle. The first pass is the wall-exit forced
duck and the floor-fling un-duck, measured against the original traces already in portal-web-shots/oracle/runs/orig.
A standing floor-to-wall exit in the original drops the eye 37 units by five ticks later (view 64 to 28, plus a
tick of lerp and gravity) and stays ducked for the rest of the flight; a floor-to-floor fling snaps the eye back up
about 0.35 s after the exit. The port still left at standing view, so eye5 was 596.3 against the original's 551.9 /
578.4 / 578.7. I'm modelling that in the hull and the view, then I'll re-check a14, a15 and escape_00 before keeping it.


## 2026-11-24, session 2 (from 9:03 AM EST)

**9:20 AM EST, a13's box cover holds the box now.** box_dropper_cover.mdl lists its flaps and arms under
`bone_followers` in the model's keyvalues, and the .phy has one convex piece per bone (20 of them). In SDK 2013 that's
CBoneFollowerManager: each listed bone gets a physics shadow that follows the bone. The port now reads the .phy
pieces (compactsurfaceheader_t from the public phyfile.h, then the ledges and points of the compact surface) and gives
each one a convex collider that moves with its bone, in the prop's current pose. With the cover closed, the box rests at
z 186.4. The original, sitting idle at the start (ent_text box), has it at 2055.1, 203.0, 186.6 for at least 28 s. The
x/y differ (2038, 201 in the port), since it lands on the flaps a bit differently. When the entry speech ends,
logic_drop_box opens the cover and the box drops. checks/box-cover.ctl covers both. The only other models in the game
with bone followers that show up in a00-a11 are a00's dropper cover and bed_cover, and those don't change a00's run.
a00 did lose 100 s at first, but not from a collider. The new timing put the walk into a wall with the box at a spot
where the player jittered by a unit, and that kept resetting the autopilot's stuck counter. walk() now also gives up
after 4 s without getting any closer to its waypoint. a00 is back at 178.6 s, a02 at 174.6.

**9:35 AM EST, energy balls bounce off a cube's real faces.** The ball's sweep used the cube's axis-aligned box, so a
cube could only send a ball straight back. a13's box-bounce catcher needs it sent sideways. Balls now sweep each cube
in the cube's own frame. Holding the box turned 45 degrees in launcher3's path sends the ball off sideways, and it ends
up in ball_trap_10. That a ball leaves a cube's face as a mirror bounce is my guess at what vphysics gives; I haven't
measured it.

**9:50 AM EST, firing while holding a cube drops it.** I checked this in the original, in a02 with box_2: pick it up,
look at the wall, +attack. The blue opens on the wall straight ahead, behind where the box was, and the box falls.
The port now does the same thing: the cube is let go and the shot goes past it. Before, the shot hit the held cube and
fizzled, which is why a13's script kept saying "nothing". a02's script fires its blue at the pit wall while holding box A. Now that drops the box, and placeCube picks it up
again. Fired before the pickup, the box sat in the way and the shot didn't place, so the order stays. What did change:
the pickup of box B on the right pedestal failed once, just after arriving through the portal, so the script tries
a second time. a02 now clears in 148 s, down from 174.6, because box A goes on its button faster than it did when it
was carried and shot around.

**10:00 AM EST, turret numbers from the original.** These were measured in a11 by standing 200 units in front of a
deployed turret and reading `ent_dump !player` once a tick:
- Health: 100. Each bullet takes 4 or 5 off, so 4.5 with the fraction carried over. Some ticks take 9 or 18 (two or four hits).
- Damage arrives every 3 to 4 ticks (about 0.05 s) once the turret has turned to the player.
- First hit to dead: 0.84 s at 200 units, 1.2 s at 450.
- Pushback: about 100 units in that second.
- Regen: `hurtme 50` takes 25 off on this skill. After about a second, health climbs back 1 per tick, so 25 takes about 0.4 s.
- `sk_npc_dmg_ar2` is 3, `sk_dmg_take_scale1` is 0.5 and `sv_regeneration_wait_time` is 1.0.

**10:15 AM EST, held distance tried at 81, not kept.** a13 has a hard reason to change it. Button b's trigger is 8
units across, on a 64-unit pedestal the player can't climb. With the box held 56 out, from the pedestal's edge it
gets no further than y 19, and the trigger is at y 64 to 72. The original holds it 81 out, which puts it right on
the button. So I put in the original's distance, plus two things from CGrabController in the public SDK 2013 that go
with it:
- the wall check: with a wall closer than half the traced length, the object is pulled in;
- the smoothed error: the cube is dropped past 12, rather than the port's instant drop at 80 off.

That broke a00, a02, a05 and a08. The longer reach snags the cube on door frames and on portal edges the scripts
walk past. The patch is at portal-web-shots/wip-hold81-all.patch. It needs the scripts reworked one by one, so it's
parked for now. a13 stops at the double door until then.

**12:05 PM EST, turret damage written, parked.** The port now has player health, regen and death, and turret bullets
do damage, all fitted to the numbers above. One turret on its own (training_turret, 200 units out) checks out against
the original:
- the original: health drops every 7 ticks, first hit to dead in 1.79 s and 1.68 s, shoved back 72 units into the wall;
- the port: every 7 ticks, first hit to dead in 1.79 s, shoved into the same wall.

The trouble is a11. The route the playthrough walks crosses the west room in front of the turret at (-482, -418) for
about 1.5 s, and that's enough to kill you. I taught the autopilot to stay out of turret sight. Then there's no way
out of the first rooms without being seen, and no portal pair it tries gets round it. A player would get behind the
turrets or knock them over, so the script needs rewriting around that. Patch: portal-web-shots/wip-turret-damage.patch.

I found a tipping difference while I was at it. In the original, stepping into trigger_knock_over_turret2 lays the
training turret on its side straight away, and it thrashes and fires into the wall. In the port the same 189 in/s kick
leaves it leaning on the wall at about 45 degrees (up 0.70, so not tipped, since that needs < 0.5). It only goes
over about 20 s later. More spin doesn't help, because it's the lean against the wall that holds it up.

**12:50 PM EST, a13 plays through, 295 s to the a14 elevator.** I didn't change the 56 hold. I worked the script around
it instead, the way a player would:
- Button b's pedestal is 64 high, too high to set the box on from the floor. So the box goes against the pedestal's
  east face as a step. The player hops onto it and up, turns round, lifts the box up after them and sets it on the
  button.
- The hallway 1 blue that "didn't place" had two causes. The end wall the ball hits is a concrete alcove at y 639,
  behind a player clip at 623, with metal on both sides, so 1599, 639, 184 is the one spot that takes a portal. Also,
  launcher2's ball bounces off that alcove every few seconds. A shot that meets the ball there doesn't place, and the
  old shoot() helper read the previous portal's open flag as success. shoot() now looks for a "failed" in the log, and
  the script fires again.
- The player stands on button a 34 units off the ball's line (y 253), so the ball passes.
- Each catcher raises one lift (relay_lift1/2/3_up enable each other in turn, so one relay_lift_up only lifts the next
  one). With all three up at -8 they're stepping stones: lift 1 from the upper room, running jumps to 2 and 3, then a
  jump east down onto the -128 corridor. The ramp from there leads up to the exit floor button. All of that is done
  carrying the box.
- It's chamber 17's ending. The box on the floor button opens switch_door_*_a11, and the incinerator button behind
  them holds the incinerator open for 13 s (wait 13). So: press it, run back for the box (the doors close behind,
  which doesn't matter now), and drop it in. trigger_killbox opens the exit doors and the elevator takes you to a14.

**1:45 PM EST, a14 plays through, 143 s.** a14's shortcut (the Portal Wiki lists it under chamber 18's alternative
solutions) starts with a portal on the wedge: a func_brush parented to rotating_door_wedge, which the switch swings to
45 degrees. The port turned down every rotated brush entity with "nothing", because shootPortal only knew how to look
up surface flags and the wall behind a portal on an unrotated collider. Now it does those lookups in the entity's own
frame: world point minus origin, times the transpose of the rotation, the same way the trace already handles rotated
colliders. A portal on a brush that turns fizzles, the same as one on a brush that moves. Blue goes on the wedge face
from the walkway; then I step off the walkway's end and put orange on the 576 platform under me while I fall. I come
out of the wedge at about 830 u/s, half east and half up, and land in the cube room at 2635, 899, 1216. Landing there
starts the scaffold. I ride it back with the cube and walk it under the pushed-out wedge to the floor button. The exit
climb uses the wiki's bounce: you come out of a floor portal going up as fast as you went in. Swapping the other portal
onto the next higher platform each time you fall back gains that platform's height. Every exit is 1175 u/s, so from the
top over P3 I can put the last portal straight on the angled panel and skip P4. That angle also lays the portal along
the panel, which is only 119 units long; from P4's side it didn't fit. That a 45-degree face takes its portal's up from
the player's yaw, like a floor, is the port's existing rule (|n.z| > 0.7). I haven't checked that against the original.
The run is deterministic (143.0 s twice). Checks 37/37, and a00 to a13 run at the same times.

**2:40 PM EST, doors go back on their own, and a13 and a14 had to get faster.** The SDK's func_door and
func_door_rotating go back after `wait` seconds when wait is 0 or more and the toggle flag (32) isn't set. The port
left them open. Now they return, button-style rotating doors included. Two scripts depended on the old behaviour. In
a13, the incinerator door now really closes after its 13 s, so the box run had to be quicker. Full speed between
waypoints with the view level got it there; looking down had made the held box catch on a step. a13 now clears in
290.9 s. In a14, the wedge swings back after its wait of 9 s, and its OnFullyClosed shuts the piston, so the lane I had
used for the cube was gone. The cube now comes back through a portal in the alcove. The steps there need duck-jumps,
with a pause between them to let the unduck finish. a14 now clears in 109.1 s.
That route turned up a stuck bug. Coming out of the door's wall portal while rising, the hull passed the hole's rim
while still partly in the wall. The tunnel through the wall only exists while the hull fits inside the hole, so the
player ended up inside solid and stayed there. Now the move is clipped at the rim, as Source's solid rim would do: keep
the axis that still fits and zero the velocity along the other. Checks 37/37.

**3:55 PM EST, a15 to the end, and a01 waits for GLaDOS.** Sounds now load before the first frame (84cec96), so
scenes run at their real length. a01's entry scene is 21.0 s where it used to fall back to 4 s, and the entrance
doors only open on its OnCompletion. The a01 script gave up on the gun before they opened. It now waits for the scene,
and a01 clears in 112.7 s instead of 85.6 s. The same change moved a02 from 148 to 152.6 s and a14 from 109.1 to
121.1 s.
a15 now plays through to escape_00 in 267.1 s, along the Portal Wiki's escape route. Four gaps in the port were in
the way:
- trigger_push didn't exist. It now follows SDK 2013 triggers.cpp: a base velocity along pushdir, an upward push
  lifts the player off the ground first, and the push carries on as momentum when it ends. The broken tube carries
  you at 350 u/s, then up, then 500 u/s south into the box dropper's shaft.
- The dropper's lid chunks are prop_physics with motion disabled. EnableMotion did nothing to a static prop, so you
  stood on the lid after it "broke". Now it turns the prop into a physics body, and the env_physexplosion scatters
  the chunks.
- func_portal_detector didn't exist. a15's last shaft has a wall that blocks only the player. It drops when both
  portals are inside portal_detector_at_exit. The detector now fires its touch outputs for the gun portals. The touch
  test, the 64x112 portal rectangle overlapping the brush bounds, is my guess at the game's test.
- The dropper hole is 64 units across and the last push throws you at its south wall, so the script steers back in
  the air. A player would do the same.
The rest is scripting: the button room's door by portal, the elevator shaft, a crouch-jump between the two pistons
to see the low ledge's top, the sideways cylinder to the exit-sign ledge, and two portals in the exit shaft. Checks
37/37.

**4:20 PM EST, escape_00 to the east ledge, then parked.** The script rides the middle piston up, puts blue on the
east ledge's wall, and comes out of an orange on the south wall at the bottom. That gets to the east ledge in 55 s
(committed). The next room has two pistons under a ledge, and the walkthrough's "wall up above the ledge" didn't turn
up: I scanned portal shots from the floor and from the x 520 slot, and none landed above z -300 except one far wall
at (479, -31, 136). I parked it there to get to turrets.

**4:30 PM EST, the training turret falls over now.** I watched a11's two knock-over kicks in the original at
host_timescale 0.25 (sheets 0.085 s apart). Either kick leaves the turret standing for about 0.3 s, past 60 degrees by
about 0.6 s, and on its side by 0.7 s. The port leaned it on the wall at 45 degrees for 20 s. Two things were wrong:
- The body. The port used the model's hull, a 32x32x64 box. turret_01.phy is seven convex pieces: three thin legs
  (the back one 2.6 units wide), the leg tops and a 20-unit-wide shell, 100 kg. Its eighth piece spans the whole model.
  The other seven add up to the volume in the text section (8655), so the eighth is the hull the tree is built on, not
  part of the body. Sideways, the centre of mass is only 7 units inside the line between a front foot and the back
  foot, and the box had 16. The body now uses the pieces' corners and extreme points as contacts, and its centre of mass and
  inertia come from sampling the pieces. The centre comes out at (4.5, 0, 35.8), the same as the .phy header's own.
- The kick. SDK 2013's CalculateExplosiveDamageForce gives 300 kg·in/s per damage point (75 kg at 4 in/s), so 71 in/s
  on 100 kg, not the port's tuned 189. It goes along the line through BodyTarget, a random point between low on the
  body and the eyes. I apply it at the centre, so it doesn't spin the turret (a guess). It's the feet catching on the
  floor that tip it, as in the original.
Now the kicks put it past up 0.5 at 0.73 s (kick 1) and 0.65 s (kick 2). checks/turret-tip-time asserts it stands at 0.3
and 0.6 s and is over at 1.0 s. a10, a11, a13 and a15 still clear (a11 86.5 s).

**5:00 PM EST, turret damage is in, but only with ?damage=1.** I brought the 12:05 PM patch back on top of the new
turret body. checks/turret-damage stands the player 200 units in front of the training turret: dead 1.80 s after the
first hit (the original: 1.79 and 1.68 s), and shoved from x 214 to the wall at 144, 70 units (the original: 72). Then
I mapped what the a11 turrets see, using the same sight test the turrets use, on a 24-unit grid. The route the script
walks to the turret it carries is a long loop through the west and north rooms. Almost every step of it is covered:
the north corridor along y 60 is in sight of the two turrets at (399, 336) and (240, 336) from end to end, and the turret
room itself is covered by three. With damage on, the player dies 9 s after the kick. Avoiding turret sight leaves no
route, and pricing it in makes the planner give up. The two floors I tried for a portal under a turret (the ones at
(455, -383) and (800, -432)) take none. a11 needs a route planned by hand: knocking turrets over from behind and
finding cover. That's more than this session has left, so damage stays behind ?damage=1 (game.damage, off by default),
and the autopilot only avoids turret sight when it's on. a10, a11, a13 and a15 clear as before.

**5:15 PM EST, wall flings come out at the original's speed.** I put the 8:35 AM change back in. For a fling in through
a floor and out of a wall, it takes the tick's gravity out of the velocity before the portal turns it sideways. The
exits are 400.0, 527.3 and 627.3 u/s against the original's 391.5, 526.5 and 625.5. They were 409.1, 536.4 and 636.4.
Last time it broke a10's second cart hop. This time I ran a10 with it on and off and compared the logs. The player
comes out of the channel orange 0.1 s later, and by then the cart is 13 units east of the window the script waited
for, so it never boarded. The hops now walk onto the cart wherever it is within 24 units. a10 clears in 197.3 s, and
a05 to a09 are unchanged. The fling parity checks and floor-fling and fling-pillars pass.
The flight height is still open, but the original's eye track shows where it comes from. One to two ticks after
leaving the wall portal, the eye drops 36 to 41 units at once (589.2 -> 547.8 at the 100 drop, 616.0 -> 574.4 at the
300 drop). Then it flies on smoothly. 36 is standing eye 64 less ducked eye 28, so the player is ducked in place on the
way out. Floor-to-floor flings show the other half: the eye pops up about 47 units 0.35 s after the exit, which looks
like the un-duck. That fits Portal ducking the player through portals. I haven't modelled it: with eye-only data I
can't tell when the duck ends in the wall case (it hasn't ended 0.75 s later), and a change to the player's hull
touches every fling the playthroughs use.

**5:40 PM EST, escape_00 past the two pistons (84.6 s).** GameFAQs (arandomgamer02) has the step the Portal Wiki
leaves vague. Stand west of the pistons, look straight up and back off until a grey wall shows high above, put one
portal there and the other on the dark mark crusher_room_2_0 hits on the ledge's underside, then ride the piston up
into the mark. The wall is the one my scan had found and I'd written off: (479, -31, 138), facing north, high over
the walkway. I'd discarded it because AP.lookAt at that point hit a metal wall at (572, 360, -212) instead, so the
script now sets the scan's own angles (pitch -55, yaw 270, from 528, 450). One port bug was in the way. The crusher
carried the player up to the mark with the head through the portal, but there was no teleport: the crossing test
compared the eye before and after the player's own move, and the crusher had moved the eye across the plane before
that. It now compares from the eye at the start of the tick when the movers only shifted it by under 64 units. The
script rides the piston up, comes out of the wall and lands on the walkway at (479, 22, -63), at 84.6 s. The rest of the
map (the exit-sign ledge, the fast pistons, the horizontal pistons and the cube tube over the goo) is still to do.

**5:50 PM EST, a15's fall loop starts further west.** The wall-fling tick takes 9 u/s off the first exit (204 instead
of 213). From the old mark at -1900 the second hop went up into the deck beam at x -1760, z 666, and the chamber
didn't clear. From -1940 the same 204 exit still happens, but the second hop starts at z 619 and lands in the tank
room at [-1262, 447, 352]. It goes through to escape_00 in 265.3 s (it was 267.1 before the wall-fling tick). a14 was
already retuned this afternoon: it walks up to the wedge switch and retries use until the piston starts, and clears in
125.4 s.

**6:00 PM EST, escape_00 reaches the exit-sign pad (92.5 s).** From the walkway I jump the north rail and drop onto the
portalable floor at z -319, then put blue on the east wall at (895, 478, 410) and orange on the floor at (650, 351,
-319). The important bit is to stand at (650, 280) and run due north (yaw 90) into the floor portal. A hop that isn't
lined up that way comes out with no +y, 34 units south of the pad, and falls through the hole. Lined up, the walk-in
itself is enough: the exit is (878, 496, 373) at 204 u/s west, and I land on the z=320 pad at (792, 497, 320), then
walk north to (792, 546, 320). The pad floor and the west wall at x 256 are both noportal metal, so the high-speed
piston room (lab4a_crusherroom2, west of that wall) still needs another portal pair. Thonky says to look at the red
arrow, put a portal on the wall across from the next ledge, and fall through a floor portal (the lower floor is visible
through the hole from the pad). That's the next step.

**6:30 PM EST, escape_00 takes the south-strip route and climbs to crusher08 (107.5 s).** The pad route works, but
Thonky's "next ledge" is the z=320 strip south of the walkway, and that's the way on to the pistons. From the walkway I
shoot blue high on the east wall at (895, 183, 460), hop onto the z -59 ledge at (700, 117), stand still (a running hop
keeps 150 u/s of leftover +y and flies over the hole), and put orange on the lower floor at (700, 250, -319) so the fall
hits the rim, not the hole centre. The landing-fast test then fires: exit (879, 183, 382) at 562 u/s west, land at
(530, 183, 312), walk south onto the strip at (417, 119, 320) at 93.1 s. The high-speed blockers are just west of there.
The corridor mouth is south of the y=-24 wall; hugging that corner pins you at (255, -24). Walking south to (276, -54)
first, then west to (150, -46), blue on the wall past the pistons at (-127, -150, 384) and orange on the y=0 wall at
(150, 0, 384), and walking into orange comes out at (-127, -144, 320) at 97.6 s. The two vertical blockers at x -64 can
be skipped: the far north wall at y=767 is visible from the corridor, and a walk-into on the west wall at (-127, 47,
384) lands at (-165, 750, 320) at 99.6 s. From there the "over here" climb is east-wall hops onto
lab4a_crusherroom2_crusher01 (z 568) and crusher05 (z 698), then a west-wall hop onto crusher08 (z 826) at 107.5 s.
The orange for a piston hop has to be on the wall at this y and eye height; walking off a moving piston to a stale
mark comes out too low and wedges in the wall. Walking off an exit has to follow that portal's normal, or a west-wall
hop bounces back through. Still to do: the two highest pistons (a south-wall portal at (63, 256, 1142) is the right
spot, but the exit sits under the lip at z 1088 and sticks), the cube tube over the goo, and the changelevel at
(576, 2176, 640). The exit-sign pad route is still in the file under window.PAD, unused.

**6:45 PM EST, the original does force a duck on a wall-fling exit.** I already had the original traces from this
morning (checks/oracle/fling-wall.json, wallfling-duck-100, and the floor flings). getpos is the client eye, so I
compared standing wall-flings to one that starts with +duck held. In the original, a standing floor-to-wall exit
drops the eye 37.3 / 37.6 / 37.2 units by five ticks later (drops of 100, 200, 300). That's standing view 64 minus
ducked view 28, plus a tick or two of lerp and gravity; the client eye undershoots for a tick (down to 547.8 on the
100 drop) and then settles. The same 100-unit drop with +duck held from the start only drops 1.4 units (gravity). So
the 37-unit drop is the stand-to-duck view change, not exit placement. Floor-to-floor flings in the original then pop
the eye back up 50.0 / 53.6 units (100 / 300 drops) about 0.34–0.36 s after the exit; a drop that starts ducked still
pops, but only 27.0 units. The port does neither: the same wall-fling exits with viewOffset 64, the eye drops 1.7
units in five ticks, and eye5 is 596.29 for all three drops (the original's is 551.878 / 578.386 / 578.721, so the
port flies 44.4 / 17.9 / 17.6 units higher). The 200 and 300 cases are the 36-unit duck minus about 18 units of
different first-exit placement; the 100 case also comes out of the original lower on the first tick (589 vs 616).
Speed and drift are already within (or just next to) tolerance after this afternoon's wall-fling tick. I have not
modelled the duck. Changing the hull on exit would touch every fling, including a14/a15, and a viewOffset-only duck
would put the camera in a standing hull. Left recorded, not asserted, in checks/reference/fling-wall.json.


**7:45–8:20 PM EST, escape_00 reaches the changelevel.** After the cube tubes, the route is a standing
run-jump from the lower-tube lip into an east-wall portal — placed first at the y=1224 crossing, because
the wall is not in view from y=1570 — with the exit on the west wall above crusher01_esc00. Landing when
the piston is west (closed) and riding the opening stroke puts us on the z=768 floor. The pit railings
around the changelevel are a 41-unit world brush (top z=809), higher than a jump, so they are not hopped:
from the walkway a downward ceiling portal at (576, 2176, 1088) and the same west-wall exit, ridden west
on the close, drop through `changelevel_escape_00_01` into escape_01. The full playthrough is 198.4 s,
`changedTo "escape_01"` at [565, 2184, 701]. Script: tools/play/escape_00.js (96bf94d). The wall-exit
forced-duck experiment was left on the shelf.

**8:20–8:50 PM EST, wrap-up.** Engine code had changed earlier (cube-tube `.phy` collision in 613f90d),
so checks and allplay were re-run. `tools/run-checks.sh` on `/tmp/pctl3.sock`: passed 39, failed 0,
including parity-fling-wall 15/15, parity-fling 12/12, and parity-movement 22/22. `tools/play/seq.sh`
for a00–a11, a13–a15, and escape_00: every script exit 0, page_errors 0. escape_00 198.4 s → escape_01.
a07 still ends at 131.4 s with `changedTo` unset (the script finishes on testchmb_a_07; pre-existing).
A recorded replay of the tube-to-changelevel tail drifted into the goo (input rounding), so the reel
uses the cube-tube climb from that capture plus the earlier piston-route reel; the live allplay run is
the source of the 198.4 s time. Reel: `/workspace/portal-web-shots/oracle/session2/session2-reel.mp4`.


**12:25 PM EST, buttons refire while something sits on them.** Chasing a00 under the 81 hold turned up a real bug. The
cube touched the box button, slid off 0.06 s later (so the door closed) and then settled back on it. The trigger saw the
new touch, but its wait of 1 s hadn't run out, so OnTrigger never fired and the door stayed shut with a box sitting on
the button. In SDK 2013 (triggers.cpp, ActivateMultiTrigger) Touch runs every frame and only waits out the reset
time, so a trigger_multiple keeps firing OnTrigger once per wait for as long as something is in it. The port does that
now. a00 to a11 clear at exactly the same times as before and checks are 37/37.

The 81 hold itself goes back on the shelf. With the button fix, a wall pull-in like CGrabController's and a turn limit
on the carry walk it still fails a00, a01, a02 and a08 (it clears a03 and a05). The scripts were all tuned around 56,
so this needs a script-by-script retune, not a one-number change. Patch: portal-web-shots/wip-hold81-v3.patch.

## 2026-11-23 to 24, oracle session (from about 11:45 PM EST)

**Summary (written 8:50 AM EST).** I built an oracle out of the original Portal and measured the port against it all
night. The original's Linux build runs headless on the box: Xvfb display :20, launched through Steam, which signed in by
itself with no password prompt and no Steam Guard. tools/oracle-ctl.mjs drives it through its own console, and
tools/parity.mjs runs the same scenario in both. The original's numbers live in checks/reference as JSON (numbers and
notes only). Its clips and stills stay in portal-web-shots/oracle. 36 commits from 9c6c160 to af8974f, plus this note.

Original vs port, before and after this session:
- Movement (22 metrics on a09's floor): walk 150 vs 175, now 150. Running jump speed 225 vs 175, now 225. Air strafe cap
  60 vs 30, now 60. Duck eye 90% at 0.345 s vs 0.18 s, now matched. Running jump distance 116.6 vs 116.6.
- Floor-to-floor fling, came back up 37-41 units too high. Now exit vz 362.8/349.1, 442.0/427.3, 509.1/493.2 and
  611.1/603.5 (original/port) for drops of 100/150/200/300. Sideways mapping within 0.03.
- Floor-to-wall fling: exit 391.5/526.5/625.5 vs 409.1/536.4/636.4, still 2-5% high. A fix that gets it to
  400.0/527.3/627.3 broke a10 and isn't committed (8:35 entry). The port's flight is still 18-44 units higher.
- Cube size: ±20.25 from the model hull (was ±12). Resting z 20.4/20.4 (a11), 500.4/500.3 (a09), 468.4/468.3 (a02).
- +use reach: the SDK's FindUseEntity (80 units, hull sweeps, cone 0.8), fits all 7 readings (98 grabs, 104 doesn't
  standing at the centre; 104 grabs looking over the top). It was 100 to the centre.
- Glass takes no portal. Cleansers fizzle shots across them. Template cubes go to their own offsets, as ent_text shows.
- Held distance: the original holds ~81 from the eye (88 looking up), the port 56. Measured, not changed.

Checks: 36 pass (33 ctl files plus the parity runs). Playthroughs on the final build, game seconds to the next map:
a00 178.9, a01 85.6, a02 168.3, a03 125.6, a04 72.1, a05 52.0, a06 65.0, a07 stops at the elevator log at 131.3 as
before, a08 78.7, a09 118.6, a10 198.2, a11 69.8 to a13. a08 to a11 are new tonight. a13 is WIP and gets into the
ball hallway with the box at 43.7 s.

Left: a13's ball catchers and lifts, a14, the escape maps; the wall-fling height and the speed fix without breaking
a10; held distance; box_dropper's cover and prop_dynamic solidity; turret damage and the turret tip-over.

**The original runs here, natively.** Portal's Linux build (hl2_linux, 32-bit, build 19017868) runs on the box under Xvfb
display :20 with Mesa llvmpipe, launched through the Steam client with my remembered login. It needed the i386 libraries
and the en_US.UTF-8 locale. No password prompt and no Steam Guard came up; the game log says it's logged on to Steam.
No Wine needed.

**tools/oracle-ctl.mjs drives it through its own console.** A config binds F10 to `exec oracle/cmd`, xdotool presses F10
on the game window, and the output is read back from console.log (-condebug). With host_framerate 0.015 one frame is one
tick, and since the command buffer runs twice a frame, `wait 2` is one tick. A free fall gives 0.135 units per tick²
(600 u/s²), which confirms one sample per tick. getpos reports the client view, which is blended between ticks and lags
inputs by a tick or two, so the metrics use medians, fits and onset of motion rather than single samples. Rules and
gotchas are in docs/oracle.md. Nothing from the game (screenshots, clips, configs) goes into git; it all lives in
portal-web-shots/oracle/.

**12:30 AM EST, movement was off in several ways.** tools/parity.mjs runs the same scenario in the original and in the
port (checks/oracle/movement.json, ten scenarios on a09's floor) and checks/reference/movement.json holds the original's
numbers. Before: walk 150 in the original vs 175 in the port, ducked walk 50 vs 58.3, duck eye reaching 90% in 0.345 s vs
0.18 s, standing jump rise 20.1 vs 22.2, running jump speed 225 vs 175 (the port had no HL2 forward boost), air strafe cap
60 vs 30, and ducking in the air made the port's eye jump 32 units where the original's moves smoothly. player.ts now follows
the public Source SDK 2013 gamemovement.cpp for the jump order, the duck state machine and its timing, and the speed
clamps. All 22 metrics are within tolerance now, for example walk acceleration 1099 vs 1098, stop decel 401.6 vs 400.8,
airtime 0.518 vs 0.518, running jump distance 116.6 vs 116.6, gravity 599.6 vs 601.1.

**12:55 AM EST, floor-to-floor flings came out too high.** checks/oracle/fling.json drops the player 100 to 300 units onto
a floor portal in a08 with the exit on the floor too. In the original the feet come back up to within 8 units of the drop
height (-7.5, -3.3, +2.1, -5.6 for 100/150/200/300). The port came up 37 to 41 units higher, because it puts the hull
upright and whole in front of the exit. teleportPlayer now takes that lift out of the exit speed, and the port comes back to
the drop height exactly. Two things are recorded but not asserted. The original's eye pops up about 47 units roughly 0.35 s
after every exit, whatever the height. I can't tell from eye positions alone why, so the port doesn't copy it. And the
entry/exit speeds differ by about 30 because the original starts falling during the setup pause.

**a05 broke with the slower walk.** The scripted playthrough lost a05: picking the cube back up on the platform now already
carries the player through orange into the button room, and the script then drove back into the floor portal. The script
now only drives into orange if the player is still on the platform side, and a05 goes to a06 again (48.6 s, was 46.4 s).

**1:15 AM EST, floor fling sideways.** Two more fling scenarios drop the player onto the a08 floor portal while moving 60
u/s east or north. The original turns 60 east into (31, 51) and 60 north into (51, -31) out of the exit, and the port
matches to within 0.03.

**1:40 AM EST, glass takes no portal.** Probing a08 in the original, shots at the start room's frosted window and at the rail
platform's glass top fizzle, and the port was placing portals on both. Translucent materials now reject portals
(checks/glass-noportal.ctl).

**2:00 AM EST, a08 has two cubes.** box_maker's point_template lists two cubes, and the port only spawned the first. The
second sits on the start room's grating roof, and the chamber needs both. Templates with several entities now spawn
each one at its offset from the template, moved to the maker. A single-entity template still spawns at the maker's
origin, because that's where a02's cube shows up in the original. That's not what the SDK 2013 code reads like, so it's a
measured behaviour, not a derived one (checks/template-cubes.ctl).

**2:45 AM EST, the held cube, after the SDK's grab controller.** Carrying cubes in a08 kept snagging or leaving the player
standing on the cube in mid-air. The held cube now follows CGrabController from the public SDK 2013
weapon_physcannon.cpp more closely: the view pitch used to place it is clamped to ±75, it's kept out of the player's
hull, it's let go when the player stands on it, and a cube you stand on can't be picked up. I kept the hold distance at
56 instead of the SDK's 24 plus the object's radius, because the a00 to a07 scripts are tuned to it and I haven't
measured the original's yet. The autopilot steps off a cube before picking it up and lowers it onto a button before
letting go. a00 to a07 still play through and all 34 checks pass.

**3:55 AM EST, a08 plays through.** The route, all through normal input and portal shots: hold the start room's button,
put portals on a start-room wall and above the roof to get onto it, take the roof cube out through a portal behind the
roof, and leave it on button a so the high door stays open. Then blue through that door onto the main room's ceiling,
take the cube through, and park it. The fling is orange on the floor under the ceiling blue, a fall loop up to about 940
u/s, then blue moved to the floor just north of the platform. Out of it at 918 u/s up, the air steering toward the
platform's centre is enough, and the player lands on the platform (rail_cart_brush_lvl7) at z 172. Walking off with the
cube snagged it on the platform's lip, so the script turns north with the view pitched up 40° and jumps off. Each pillar
button gets blue on the ceiling over it and orange low on the north wall. The player walks in carrying a cube, drops onto
the pillar and places the cube (b at z 236, c at z 140). The exit door is up on a grating ledge and the ceiling over the
ledge takes no portal, but through the open door the exit room's ceiling does. The elevator goes to a09 after 80.7 game
seconds and 3 s of wall time. The first version took over 8 minutes of wall time, all of it in the autopilot's
portal search for the ledge, so that step is now written out in the script.

**4:07 AM EST, entity positions from the original with ent_text.** getpos only tells me where I am. With `developer 1`
and `ent_text NAME`, the original draws each named entity's position, speed and model over the view, so a screenshot of
it gives positions I can compare against. Notes are in docs/oracle.md. The screenshots stay in portal-web-shots.

**4:15 AM EST, template copies go to their own offsets.** ent_text put a09's spawned cube on the top step at (1083.2,
-771.2, 500.4) and a02's box_2 at (953, 779). Both are what CPointTemplate::CreateInstance in the public SDK 2013 does:
each copy keeps its offset from the template origin, moved and turned with the maker. The port had put single-entity
templates at the maker's origin. A copy that would start inside a wall still goes to the maker's origin, because a02's
cube ends up in its glass drop tube in the original and the port has no vphysics push-out. That part is a guess.

**4:15 AM EST, a09 plays through (118.7 game s).** A fling from the west wall onto the cube's steps (blue high on the wall,
orange on the floor, drop back in once and come out at about 600 u/s east). Then the cube down and onto the button, across
the goo room by portal, a portal on the wall the energy ball hits to send it up to the ceiling over the catcher, then the
lift and the elevator to a10.

**4:21 AM EST, floor-to-wall flings measured.** checks/oracle/fling-wall.json drops the player 100, 200 and 300 units onto a
floor portal in a09's box room with the exit on a wall. The original comes out at 391, 527 and 626 u/s, the port at 409,
536 and 636, which is 2 to 5% high. The sideways drift agrees within 8 units, but the port flies 18 to 44 units higher.
Those are recorded in checks/reference and not asserted yet.

**5:00 AM EST, where the extra height comes from (not solved).** I ran the 300-unit drop again in the original holding
duck. Ducked, the exit is smooth: the eye comes out at x 641.6, z 582, and the player stays ducked. Standing, the eye
comes out at x 656.75, z 589, drops about 41 units in two ticks, bounces back 4.6, and then follows a smooth arc to land
standing. The ceiling there is at 640, so nothing is in the way. My guesses are that it's the client blending the view
across the teleport, or that the original pushes a standing hull out of the portal tunnel. I haven't modelled either. The
speed gap is within about one tick of sampling, as I found before.

**5:08 AM EST, the cleanser stops portal shots.** In a10 the original fizzles shots fired across an enabled
trigger_portal_cleanser, and the port let them through. Now they fizzle. a05 relied on the old behaviour, so its blue now
goes through the window above the cleanser instead (51.9 game s, same as before). a10's first energy ball launcher sits
flush with its wall, and the ball now gets pushed out of the wall on spawn. That one's a guess.

**5:15 AM EST, a10 rooms 1 to 3.** A fall-loop fling over the first glass. Room 2's ball is redirected into its catcher
(27.4 s). The upper hall's floor and ceiling take no portals, so the field there is crossed with a double fling: a fall
into the stair pit and out of the south wall's block, then again. Room 3's field takes the same double fling off the
west block, and the ball goes off the scorch mark on the north wall into ball_trap_11.

**5:48 AM EST, a10's conveyor carts and the run to a11 (198.2 game s).** The carts across the goo never showed up.
They're env_entity_maker copies of a template holding a func_tracktrain, and the port moved the template train instead of
copying it. Now each member is copied at the maker, and the train snaps to its first path corner and starts at its speed,
as in SDK 2013 trains.cpp Find(). A cart spawns every 15 s and is killed at node 8. Killed brushes also kept drawing;
they're hidden now, and KillHierarchy takes the parented children with it. The route boards two carts across, stepping on
when the cart's centre is within 4 units behind and 12 ahead of the player, or you drop through it. Then into the final
room. Shots from the top of lift a fizzled on the lift itself, so the script steps to its north edge first. Orange goes
on the floor at (-36, 1195), since x -28 doesn't fit a portal. From there a west-moving fling out of orange at (-97, -8,
574) lands on the exit lift, and the elevator goes to a11. All 35 checks pass.

**6:20 AM EST, cubes were too small.** Every cube used a fixed ±12-unit box, but metal_box.mdl's hull is ±20.25, so
cubes sat 8 units into floors and could fall into gaps between other boxes. a11's stacked boxes showed it: in the port the
top ones dropped through to the floor, inside the boxes below. ent_text in the original puts a11's floor boxes at z 20.4 on
a z-0 floor, a09's spawned cube at 500.4 and a02's box_2 at 468.4 once settled. The port now gives 20.4, 500.3 and 468.3.
I'd written a02's down as 460.4 before; that was read while it was still falling. Cubes take their size from the model
hull now, kept per model, so template copies made in the middle of a tick get it too. The bigger boxes showed up three
other problems, all fixed:
- A trace that starts inside another cube's box (cube AABBs are looser than the boxes once they turn) is retried without
  that cube. Otherwise the centre sweep went startsolid and the cube fell through the floor, or a held cube couldn't be
  pulled out of a pile.
- The rigid body's position correction is swept, so a deep corner can't push the centre through a thin wall.
- Triggers test a body's own rotated bounds, not a cube of its narrowest half-width. A turret is about four times taller
  than its narrowest half-width, and a11's floor button never saw the turret standing on it.

a02 and a08 needed new steps for a 40-unit cube. a02 walks off the pedestal holding box B with the view pitched up, and
a08 lines up square to the portal before walking in and backs off to the pillar's edge to set the cube on the pad. a00
to a11 play through in order: a02 176.5 s, a08 78.6 s, the rest the same as before.

**6:55 AM EST, a11 plays through (69.8 game s).** The entry doors open when GLaDOS's entry scene ends. The training
turret stands in the west doorway. Stepping in beside it fires the env_physexplosion that kicks it aside: the port's
pushes it 189 in/s and leaves it upright against the jamb, while the original knocks it over (ent_text afterwards: on its
side, "died"). I haven't modelled the tip. The floor button by the exit takes anything named "box", and every turret in
the chamber is named box, so the script carries the turret nearest the button onto it. The radio fort's boxes would do,
but walking into the fort boxes the player in, and the radio and its clutter sit on the east boxes as solid props. Past
the exit doors a grating fence splits the room, and shots go through grating: blue on the floor beyond it, orange on the
west wall, walk in. The last room is behind a grating window. Its floor takes no portal, so blue goes high on its far
wall, over the turret, and orange on this room's east wall. Turrets don't hurt the player in the port yet, which the
original's do; that's still a gap.

**7:15 AM EST, a13 isn't done.** The start corridor takes no portals anywhere (I swept every direction from two spots).
The way on is a box climb: a 64-unit step, then a ledge at 128 ("soundscape_useyourbox"). With the 40-unit cube the
player now gets from the floor onto the box and then onto the step, which the old 24-unit cube couldn't allow. Getting
the box up after you is the open part: from the step, the box below is 114 units from the eye, past the port's 100-unit
grab reach. I don't know the original's reach yet. The window at the west end looks onto the exit button room
(floor_button_lab5), and the exit needs the cube in the incinerator.

**7:40 AM EST, a held cube stuck on a step's edge.** Lifting the box over a13's step, the held cube's sweep stopped
dead against the step's top edge. The trace came back blocked at fraction 0, not startsolid, so nothing could get it
unstuck. The SDK's held object is a physics shadow that slides, so the held move now slides the rest of the way along
what it hit. If it's caught a little inside a brush, it goes straight to the wanted spot when the box fits there and
the centre's path is clear, never through a wall. a00–a11 play the same (a02 is 8 s quicker, 168.3 s).

**7:45 to 8:00 AM EST, +use reach, measured.** The port grabbed a cube if its centre was less than 100 units along
the view. The public SDK's FindUseEntity measures something else. It checks the view ray, then 16-unit hulls swept
below it, and takes a hit if it's within 80 units of the eye, where the height counts only outside the player's own
body. So a box at your feet, or just below the step you stand on, is close. I measured it in the original with
sv_debug_player_use 1 and ent_text on a02's box_2, the player on its floor (distances are box centre to player):
- Looking at the centre, standing: 98 grabs (green cross, held mass 1 kg). 104, 112 and 120 don't (red cross).
- Looking at the centre, ducked: 90 and 98 grab, 104 doesn't.
- Looking just over its top: 104 grabs.

The near face is 20.25 closer than the centre, so 98 and 104 are 77.75 and 83.75, either side of 80. The SDK's hulls
would take the box from 104 even looking at its centre. So the port does the SDK search, except that a view ray that
hits the cube out of reach finds nothing. That last part is my guess at Portal's own player code, which isn't public,
and it fits all seven readings. My first reading (104 refused) was taken ducked without my noticing; getpos said
476, and the real-time clip then grabbed from 104. checks/use-reach.ctl holds the six port cases.

**7:50 AM EST, a13: the box climb works.** With the SDK's reach, the box can be picked up from the step, 113 units from
the eye to its centre but only 24 below the player's feet. Place it below the 64 step, climb it, step up, grab it,
set it on the step, climb it, jump onto the 128 ledge, grab it again. The script gets that far (26 s). Two things
left: the way from the ledge down to the exit button's room (floor_button_lab5, x 1300 to 1410, below and west), and
the box's start. In the original, box_dropper_model_cover holds the box at z 186.6 until GLaDOS's entry speech ends
(logic_drop_box). In the port the cover isn't solid, so the box drops at once. It lands in the same place.

**8:25 AM EST, a13 mapped past the climb, not finished.** From the 128 ledge a corridor runs south along x 1604 into
the ball hallway (x 1360 to 1680, y -712 to -1030), where the three energy ball launchers start as you walk in. Carrying
the box through the corridor's end fires create_steps_for_beginning_puzzle, which only lets boxes through, and that
opens door_create_steps_for_first_puzzle, the steps back up. The script gets this far with the box in hand (43.7 s).
The exit button (floor_button_lab5) is in a room with glass on both sides: the start room on the east and the room by
the lifts on the west, which is how you see it from the start. You reach it only from the lower level south of it,
where the incinerator is. That level ties in with the three lifts (lift1..3_rm5, raised one at a time by
relay_lift1..3_up), which the three ball_trap catchers raise. So the rest of a13 is a portal puzzle that steers energy
balls into catchers. That's the next session's work.

**8:22 AM EST, held distance, measured, not changed.** The original holds the box further out than the port. Eye at
(870, 779, 513), ent_text after the box settles:
- view level: 81.3 units from the eye;
- 24.5 down: 81.7;
- 30 up: 87.9.

The port holds it 56 out. The SDK's UpdateObject gives 24 + radius, which is 67 at level for this box. So Portal holds
further than the SDK too. Three readings don't pin down a rule, and the scripted button drops in a00–a11 are tuned to
56, so I've written this down and left the code alone.

**8:35 AM EST, WIP, not committed: the wall-fling speed gap.** A guess at where the 2 to 5% comes from: the port
applies the tick's gravity before the teleport, so a floor-in, wall-out fling carries one extra tick of fall (600/66,
about 9 u/s) out sideways. Putting that tick back in z when the entry faces up and the exit is a wall
(`|in.f.z| > 0.7 && |out.f.z| < 0.7`, add 600*dt to vel.z before the portal transform) takes the exits from 409.1, 536.4
and 636.4 to 400.0, 527.3 and 627.3 against the original's 391.5, 526.5 and 625.5. The 200 and 300 drops are then within
1 u/s and the 100 drop is still 8.5 high. It broke a10: the double flings land about 9 units shorter, the patch portal
in the stair pit no longer fit (clamping its target fixed that), and further on the second cart hop misses ("hop 1 board
false") and the run stops at 312 s without leaving the chamber. Retuning a10's cart hops wasn't quick, so I took the change
out as the rule says. The diff, with the clamp, is in portal-web-shots/wip-wallfling-gravity.patch. The flight height
(wf eye5 551.9, 578.4, 578.7 in the original vs 596.3 in the port) is a separate thing and is still open.

**8:40 AM EST, a13: where the balls have to go.** The script's end of the ball hallway (1533, -974, 64) is a dead end on
foot. The two rm8 launchers sit at (1481, -980, 236) and (1599, -980, 172), launcher3_lab5 at (691, -277, -200). The
catchers are far west and low: ball_trap_10 at (-512, -585, -196), ball_trap_12 at (-512, -1273, -164), ball_trap_11 at
(-512, -1977, -164). Each one raises a lift (lift1..3_rm5 at x 960, y 448, 672, 896). So the balls have to be carried
west by portals across most of the map. From the script's end spot (1523, -855, 64), with the box put down, a sweep
of 84 shots (pitch -75 to 75, every 30 degrees of yaw) placed no portal: the hallway is noportal metal and one glass
window, so the way west isn't from there. The launchers face north (angles 0 90 0). Nothing more done on that yet.

## 2026-11-21, evening (about 6:40 to 7:55 PM)

**Black models on macOS.** On the hosted preview, Gabriel's Mac showed a00's floor button and the cube on it black except
for their self-lit strips. It did not reproduce here on SwiftShader, on Mesa llvmpipe (new `PCTL_GL=mesa`), through the
hosted-files reader (new `FILES_DIR` on the dev server), or with the deployed minified bundle. The cause was the canvas: model
materials keep their $selfillum mask in the base texture's alpha, the opaque passes wrote it into an alpha-channel drawing
buffer, and the page composited colour > alpha as premultiplied, which macOS shows as black. 71% of the pixels over the button
and cube had alpha under 250. The context is now `alpha: false`; renders are byte-identical here and every pixel reads 255.
checks/opaque-canvas.ctl uses the new `assert JS` command, which fails unless the value is truthy (a first step on item 7).

**io.unhandled.** Over the first 20 s of a08 to escape_02 the only unhandled inputs were env_tonemap_controller
(exposure, bloom, tonemap rate) and logic_autosave. They are registered as no-ops (LDR renderer, no saves).

**v_hands.vtf.** The 404 comes from the game data: models/weapons/v_models/v_portalgun/v_hands.vmt sets $basetexture
models\weapons\v_models\v_hands\v_hands, which isn't shipped. A v_hands.vtf sits next to the VMT. Not changed.

Also noticed: game.ts calls `io.cancel?.()` on choreo Cancel/Stop, but IO has no `cancel`, so pending outputs of a cancelled
scene still fire.

## 2026-11-19 session summary (animation session, 9:25 AM to 2:25 PM)

This session's goal was to stop judging animations from single screenshots. The harness can now record. `record`
steps the fixed tick loop and encodes every frame to mp4, with the frame, time and tick burned in, and it logs
`window.__probe()` per frame next to the video. `sheet` and `frames` make contact sheets and PNG strips, `anim` lists
every animated prop with its sequence, cycle and rate, and `poses` dumps bone positions per tick and measures cycles per
second. tools/mdl-info.ts reads sequence data straight from the model files, so every timing check below compares the
port against the model's own numbers. `serve`/`--attach` keeps one browser running for many scripts, and
tools/run-checks.sh runs the whole checks/ folder in one session. Before and after clips are in
/workspace/portal-web-shots/anim/, outside the repository.

The fixes, roughly in order. The animation pipeline now follows the SDK rules: blend grids over pose parameters, delta
and autoplay layers, 0.2 s sequence cross-fades, long sequences read from .ani sections, and client animation events,
so elevator doors and the box dropper play their sounds on the right frame. The first-person portal gun is drawn with
its draw, fire, fizzle, pickup and release sequences. Floor turrets deploy, aim, fire, search and tip over, and
security cameras track the player. GLaDOS's cores and the energy-ball catcher's ball ride their parent's attachment
instead of floating in place. $selfillum no longer turns a10/a14's lift platforms and turrets white. Energy balls keep
their modelled side to the viewer instead of showing a sliver. a10's telescoping lifts sink all the way instead of
stopping 128 units over the pit, riding them no longer throws the player up, and a06's fling pillars start where Hammer
put them. Portal shots slide off no-portal faces as well as edges. Cubes ride moving trains. Named lights switch their
light styles, env_shake shakes the view, func_noportal_volume takes its inputs, and IO counts the inputs nothing
handles. Falling onto a floor portal keeps the fall speed. Before that fix the floor behind the hole stopped the
player and every fling came out slow.

Playthrough reach: the scripted autopilot plays a00 to a07 in order, including the 07a to 07b elevator, and a08 up to the
cube platform reaching its east stop. The fling onto the platform still misses: the exit comes out drifting away from
the platform in y, and air control can't correct it before the player lands. At the end of the session the build passes
and the 29 checks in checks/ all pass with no page errors (tools/run-checks.sh). The highlight reel is
anim/highlights-2026-11-19.mp4, with anim/highlights-2026-11-19-sheet.png.

### What's left to be done

In priority order, for a complete playthrough and then polish:

1. a08: land the fling on the cube platform. The approach into the fall loop has to give the exit a velocity toward
   the platform. Then get the cube off, put the cube and the player on buttons b and c, and take the exit elevator.
2. a09 through a19 and escape_00 to escape_02 as scripted playthroughs. Today they are only covered by spawn smoke
   checks and the 30 later-chamber views. Each will turn up its own map-logic gaps, as a07 and a08 did.
3. The remaining inputs that nothing handles (from io.unhandled): prop_dynamic Enable/DisableCollision, env_sprite
   ShowSprite, env_beam colour and width, point_spotlight, env_citadel_energy_core and weapon_portalgun ChargePortal*.
4. Fling physics against the real game: compare exit speeds and air control with recorded runs of the original, not
   just with the SDK formulas.
5. Rocket turrets (npc_rocket_turret has no code yet) and the escape-map GLaDOS fight, checked on video the way the
   floor turrets were.
6. Polish: the viewmodel still requests v_hands.vtf and gets a 404 (find out where the material really lives), HDR and tonemap inputs,
   save and load, sound mixing, and performance on the large escape maps.
7. Turn checks into assertions. Today a check passes when every command succeeds and the page logs no errors. The
   numbers in the probe logs are compared by hand.

### Out of scope

- Anything that needs leaked Source engine code. Only the public Source SDK 2013 is used as a reference, so features
  that exist only in the leaked engine (exact engine-side portal rendering, VPhysics internals) are reimplemented from
  observed behaviour or left approximate.
- Public hosting of Valve's game files. Assets are read from an owned Steam install or the private owner-only bucket.
  None go into git, test fixtures or committed screenshots, and the clips stay in /workspace/portal-web-shots.
- Pushing, deploying or touching R2 from these sessions. Gabriel pushes and deploys himself from his Mac.
- Portal 2 content, multiplayer, Steam integration (achievements, cloud saves) and mod or workshop support. None of
  them are planned.

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

**1:25 PM, falling onto a floor portal lost the speed.** I tried an honest way onto a08's cube platform: a fall loop
between the ceiling blue and an orange on the floor below it, then blue moved to the floor next to the platform. The
fall reached 904 u/s and came out of blue at 213. A per-tick log showed the reason. The hull landed on the floor inside the
orange hole (13 units off centre, well inside it), the floor behind the portal stopped it before the hull centre
crossed the plane, the fall speed went to 0, and the player then sank through slowly. That breaks every fling. Now, when the
player lands this tick on an open, linked floor portal with the hull inside the hole (8-unit margin) after falling
faster than 150 u/s, it counts as going through, with the velocity from before the landing. checks/floor-fling.ctl
drops the player 300 units onto a floor portal: in at 564 u/s, out at 636 u/s upward (it's still accelerating on the
last tick), rising to the ceiling. In the a08 attempt the exit is now 913 u/s.

The attempt still misses the platform. The lateral speed coming out of the exit is +74 in y, away from the platform, and
air control can't undo that before the player comes back down, so it lands on the floor at y -193. The script for the
attempt is kept outside the repository (portal-web-shots/testchmb_a_08-fling-attempt.js), and tools/play/testchmb_a_08.js
still stops at the east stop.

**1:45 PM, steering during the drop doesn't change the fling's drift.** Two more a08 attempts with the fixed floor
portals, holding forward toward +y and then toward -y for the whole final drop into orange. The exit velocity's y came
out +44 and +57 (exit z speed 913 and 949), so air control during the fall barely moves it. The drift away from the
platform comes from the horizontal speed built up walking into the fall loop and from how the two floor portals' frames
map it, so the next try should change the approach into the loop or where orange sits, not the input during the drop.
Both attempts land at about (-83, -156), 115 units short of the platform at y -272. Neither change is committed.

**1:50 PM, wrap-up.** tools/run-checks.sh runs every checks/*.ctl in one serve session and counts only console and page
errors as failures. All 29 pass. The sequential playthrough a00 to a07 was rerun on the final build. The highlight reel
(tools/highlight-reel.py) is anim/highlights-2026-11-19.mp4, with a contact sheet next to it.

**2:05 PM, the floor-fling rule broke a05.** The full sequential rerun caught it: in a05 the player goes up out of a floor
portal, falls back onto it, and the new landing rule sent them straight back through, five times, and the cube was
dropped on the way (a05 stopped at "box on button"). The landing rule now skips the portal the player came out of in
the last 1.5 s, so falling back onto it lands as before. checks/floor-fling.ctl is unchanged (in at 600, out at 554
upward, back up to z 306), and a00 to a07 play through in order again with the same game times as before. a08 runs
to the cube platform's east stop and then misses the fling as described above.
