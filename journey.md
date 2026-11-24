# Journey

A running log of work on the port. Times are America/New_York.

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
