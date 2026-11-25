# The oracle: measuring the original Portal

`tools/oracle-ctl.mjs` runs the original game (the native Linux build from Gabriel's own Steam install, app 400) on its
own X display and measures it. `tools/parity.mjs` runs the same scenario in the original and in the port and compares
the numbers. Measured values live in `checks/reference/*.json` and `tools/run-checks.sh` asserts the port against them.

The idea comes from gta-sa-web's oracle (PRs #10 and #11 there): drive the original only with input it accepts from a
player, observe it only through what it shows or writes itself, and turn what it does into numbers.

## Rules

- Input goes through the game's own console only. oracle-ctl writes `portal/cfg/oracle/cmd.cfg` in the install and
  presses F10, which `portal/cfg/oracle/boot.cfg` binds to `exec oracle/cmd`. Movement is the game's own `+forward`,
  `+jump` and so on; placement is `setpos`/`setang` with `sv_cheats 1`.
- Output comes from the console log the game writes (`-condebug`, `portal/console.log`) and screen captures of its
  window (ffmpeg x11grab). Nothing reads the game's memory, hooks it, or patches a file. No Valve binary is
  disassembled.
- Steam runs as the normal Linux client, signed in to Gabriel's account. It remembers the login, so no password is
  typed. The game checks ownership through Steam as usual.
- Nothing the game produces goes into git: logs, traces, screenshots and clips stay in
  `/workspace/portal-web-shots/oracle/`. Only numbers, the build id and notes go into `checks/reference/`.

## Running it

```sh
node tools/oracle-ctl.mjs up            # Xvfb :20, Steam (signed in), the game at 800x500; waits for the console
node tools/oracle-ctl.mjs map testchmb_a_09
node tools/oracle-ctl.mjs con 'getpos; sv_gravity'
node tools/oracle-ctl.mjs trace NAME 120 --setup 'setpos 776 -968 256;setang 0 0 0' --at '10:+forward' --at '90:-forward'
node tools/oracle-ctl.mjs shot /workspace/portal-web-shots/oracle/x.png
node tools/oracle-ctl.mjs record /workspace/portal-web-shots/oracle/x.mp4 5
node tools/oracle-ctl.mjs down
```

`ORACLE_DISPLAY` (default `:20`, keep it off the agent desktops), `ORACLE_SIZE` (`800x500`), `PORTAL_DIR`,
`ORACLE_OUT` (`/workspace/portal-web-shots/oracle`). The machine needs the i386 Mesa and SDL libraries (the game is a
32-bit binary) and the `en_US.UTF-8` locale; without the locale the game shows a warning box at start, which `up`
dismisses with Return anyway.

```sh
node tools/parity.mjs orig checks/oracle/movement.json            # every scenario in the original
node tools/parity.mjs port checks/oracle/movement.json --attach S # and in the port (portal-ctl serve session S)
node tools/parity.mjs compare checks/oracle/movement.json         # side by side from the saved runs
node tools/parity.mjs reference checks/oracle/movement.json       # write checks/reference/movement.json
node tools/parity.mjs check checks/oracle/movement.json --attach S # fail if the port is out of tolerance
```

## Timing

Every trace pins `host_framerate 0.015`, Portal's tick, so each frame is exactly one tick of game time however
slowly llvmpipe draws (about 66 frames a second here at 800x500). The command buffer runs twice per frame, so
`wait 2` is one tick. That was checked with a free fall: the eye drops by 0.1350 more each sample, which is
600 u/s² at 0.015 s per sample. Each run's settings, cvars, frame rate and the game build go in the run's
`.meta.json` next to its trace.

## What the samples are

`getpos` prints the eye position as the client sees it, not the server's. Two things follow:

- `cl_smooth` eases the view for 0.1 s after landings and steps. Traces run with `cl_smooth 0`.
- The client view is blended between two ticks, so a sample sits a fraction of a tick off. Speeds, heights and rates
  are unaffected once they are steady, but anything timed from an edge (start, landing) is only good to about a
  tick. The metrics use medians over speed bands and a parabola fit to the airborne samples for airtime, which
  cancel the blend.

A button pressed through the console reaches the server one or two ticks after the command. The port applies it on
the same tick, so metrics are counted from when the motion starts, not from the event.

## Gotchas found on the way

- testchmb_a_00's intro keeps the player locked in the relaxation vault for a long time: `setpos` and the move keys
  do nothing. The movement scenarios use the big tiled room in testchmb_a_09.
- A `setpos` in the same batch as the trace sometimes landed a few ticks into the trace. Setup now goes in its own
  batch with wall time to settle, and parity.mjs reruns a scenario if the first sample isn't at the start position.
- The game window's title doesn't match `xdotool search --name`, so the window is found by pid.

## Entity positions: ent_text

`developer 1; ent_text NAME` (or a class name) draws the entity's overlay text, including `Position: x, y, z`, next to it
in the world. Take a screenshot from a spot where the overlays don't overlap (looking straight down helps) and read it off.
It's the game's own debug overlay, so it's within the rules, and it's how the a02/a08/a09 template cube positions were
measured. `report_entities` prints a count per class to the console log.
