# portal-ctl: headless test harness

`tools/portal-ctl.mjs` runs the port headlessly against a Portal folder and takes commands from a script or the
command line. Every command prints one JSON line, so a run can be diffed, grepped or fed to another tool. It is
modelled on `horizon-ctl` from Horizon's native client (docs/native-client.md, "Agent control"): one JSON reply per
command, errors as `"ok": false` with an `error` string, a `script` mode that stops at the first error unless
`--keep-going` is given, and the same exit codes (0 ok, 1 a command failed, 2 usage error, 3 the server or browser
could not be started). Unlike horizon-ctl it has no long-running game to attach to: each invocation starts its own
asset server (`server/server.ts`, 127.0.0.1 on a free port) and headless Chromium with SwiftShader WebGL2, and shuts
both down at the end.

## Determinism

After `map` loads, the harness takes the clock away from the page: the page's own frame loop stops simulating and
stops drawing. The game only advances on `step N` (N fixed ticks of 1/66 s, the same tick the game uses) and a frame
is only drawn on `render`, `screenshot` or `bench`. `Math.random` is replaced by a seeded generator (`--seed`, default
1). Screenshots are the WebGL canvas only, without the HUD text, flattened over the page's black background (the canvas
has an alpha channel that opaque passes fill from texture alpha, which image viewers otherwise show as white). The same script on the same build gives
byte-identical screenshots; `diff` on two runs reports `"identical": true`.

## Usage

```sh
node tools/portal-ctl.mjs --game /home/box/steam-games/portal-linux script checks/ending.ctl
node tools/portal-ctl.mjs --game ~/path/to/Portal run 'map testchmb_a_00; pose 0 0 0 0 90; screenshot /tmp/a.png'
node tools/portal-ctl.mjs help
```

For many short runs against one map, keep a session open instead of paying the server, browser and map start-up each
time:

```sh
node tools/portal-ctl.mjs --game ~/path/to/Portal serve /tmp/pctl.sock &      # prints {"serving": ...}
node tools/portal-ctl.mjs --attach /tmp/pctl.sock run 'map testchmb_a_00; pose -830 -1200 150 0 90; screenshot /tmp/a.png'
node tools/portal-ctl.mjs --attach /tmp/pctl.sock run 'step 66; screenshot /tmp/b.png'   # same page, about 0.4 s
node tools/portal-ctl.mjs --attach /tmp/pctl.sock run 'build; map testchmb_a_00'        # rebuild, reload with the new code
node tools/portal-ctl.mjs --attach /tmp/pctl.sock run quit
```

Scripts sent to a session run one at a time in arrival order, and the page's state (map, position, `lookat`, probes)
carries over between them, so a script that needs a clean start should begin with `map`. Replies and exit codes are
the same as a normal run; 3 means the socket couldn't be reached.

Options: `--game DIR` (default `$PORTAL_DIR`, then the Steam path), `--size WxH` (default 1024x640), `--port N`,
`--base URL` (use a server that is already running), `--keep-going`, `--no-build` (skip `./build.sh`), `--seed N`.
`script -` reads the script from stdin. Lines are split like a shell (quotes group words) and `#` starts a comment,
except `eval`, which takes the rest of its line exactly as written. `run` splits its argument on `;`, so JavaScript
with semicolons belongs in a script file.

Environment: `CHROME` is the browser to launch (default `/usr/bin/google-chrome`). `PCTL_GL=mesa` runs ANGLE on the system
OpenGL ES driver instead of SwiftShader (Mesa llvmpipe on a machine without a GPU; needs `mesa-dri-drivers`), a second
WebGL implementation for bugs that depend on the driver. `FILES_DIR=DIR` makes the asset server also serve DIR at `/files/`
with Range requests. DIR is laid out like the hosted preview's private bucket (`manifest.json`, `portal/`, `hl2/`), so
`map NAME files=local` reads through the hosted-files reader (`src/localfs.ts`) without the Worker.

| command | what it does |
| --- | --- |
| `build` | run `./build.sh` and clear the browser cache; the next `map` loads the new code (for `serve` sessions) |
| `quit` | end a `serve` session after the current script |
| `map NAME [QUERY]` | load a map (`nochange=1` always); replies load time, requests, MB, warning and error counts |
| `pose X Y Z PITCH YAW` | noclip, intro fade off, feet at X Y Z (eye 64 above), view angles in degrees |
| `look PITCH YAW` | change only the view angles |
| `noclip on\|off` | `off` lets `step` run the real player physics |
| `step N [KEYS]` | advance N ticks, holding KEYS (`w`, `wd`, `space`, `duck`) |
| `shoot blue\|orange` | fire the portal gun along the view, as the mouse does |
| `use` | press E |
| `fire ENTITY INPUT [PARAM]` | queue an entity input; it is delivered on the next `step` |
| `set KEY VALUE` | renderer switch: `showSky usePVS useCubes useLightmap showOverlays noPortalRender maxDepth animFades showViewModel` |
| `render` | draw one frame: draws, views, culled and `frame_ms` (CPU plus GPU, measured with `gl.finish`) |
| `screenshot PATH` | draw one frame and save the canvas as PNG |
| `bench N` | draw N frames back to back with the simulation still: avg, p50, p95, max ms and fps |
| `diff A B [OUT]` | changed-pixel share (channel difference over 8), mean difference, optional diff image |
| `state` | map, position, angles, velocity, noclip, eye cluster, held cube, open portals, counters |
| `ents [REGEX] [N]` | BSP entities by classname: classname, targetname, origin |
| `errors` | console errors and warnings, page errors and failed requests (with paths) since the last call |
| `eval JS` | evaluate JS in the page (`window.game` is the engine) and reply its JSON value |
| `assert JS` | like `eval`, but the command fails (exit 1, or the script stops) unless the value is truthy. Write a check's expected numbers as expressions, e.g. `assert window.game.game.stats.teleports === 1` |
| `inject FILE` | run a JS file in the page, read by the harness relative to the repository: probes that define helpers on `window`, such as `tools/transit.js`. A new `map` starts clean |
| `sleep S` | wait S seconds of wall time |
| `lookat X Y Z\|off` | keep the view aimed at a point on every tick of `step`, `record` and `poses` |
| `record PATH FRAMES [FPS] [KEYS]` | step the game 66/FPS ticks per frame (holding KEYS) and pipe every frame to ffmpeg: `.mp4` (x264) or `.webm` (VP9). Each frame is labelled `frame / t / tick` (`--no-label` drops it). If `window.__probe` is a function, its value per frame goes to `PATH.probe.jsonl`. A frame that throws keeps the video so far and fails with the frame and tick |
| `sheet VIDEO OUT [CxR] [W] [A-B]` | contact sheet: C×R frames spread evenly over the video (or frames A–B), each W px wide |
| `frames VIDEO DIR [A-B]` | dump frames as PNGs |
| `anim [REGEX]` | animated props: entity, class, model, sequence, cycle, rate, looping, frames, fps, duration, active fades, pose parameters |
| `poses OUT TICKS [REGEX] [EVERY] [KEYS]` | step TICKS and write every bone's position, forward and up axes to JSONL; replies sequence spans, cycles per second, `reached_end_s` for a one-shot sequence that ran from cycle 0 to 1 (compare with frames-1 over fps), and the largest per-tick bone move and turn (either axis, so hinge rolls count; with the median), which is how pops are found |

Example output:

```
{"line":2,"cmd":"map","ok":true,"ms":2552,"map":"escape_02","ready_ms":2478,"load_ms":2166,"requests":797,"mb":165.1,...}
{"line":9,"cmd":"bench","ok":true,"ms":1142,"frames":30,"avg_ms":36.68,"p50_ms":36.4,"p95_ms":39.5,"max_ms":41.5,"fps":27.3,"draws":355,"views":1}
{"line":10,"cmd":"diff","ok":true,"ms":179,"size":[1024,640],"changed_share":0,"mean_diff":0,"identical":true}
```

Scripts used for checks live in `checks/`: `escape02-ending.ctl` (skybox), `later-chambers.ctl` (30 views in a08 to
escape_02), `later-smoke.ctl` (20 s of real simulation from each later spawn), `glados-anim.ctl` (an animated, skinned prop), `glados-hit.ctl` and `glados-destruction.ctl` (sequence cross-fades and the 54 s `.ani`-streamed ending, recorded), `camera-track.ctl` (a security camera following the player, with a lens-error probe), `opaque-canvas.ctl` (asserts that every pixel of the drawing buffer is opaque, with a cube on a00's button), `portal-transit.ctl` (walks the player through five portal layouts with `tools/transit.js`, 150 seeded random walks each, and asserts no view pop between wall portals and no tick stuck in solid), `portal-a00.ctl` (the same probe on a00's own portals while the blue one moves on its timer). They hold only map names, coordinates and commands, never game data;
screenshots should be written outside the repository (the `.gitignore` also drops `*.png`).

Before a deploy, run `tools/gate.sh` (needs `PORTAL_DIR`; about an hour, with nothing else loading the machine). It
builds the engine, starts its own harness session, and runs `tools/run-checks.sh` and `tools/play/check.sh`. That
script plays every chamber in `checks/reference/playthrough.json` and fails when one stops reaching its next map or
its game time moves past the tolerance. When everything passes, the gate appends the hash of `src/`
(`node tools/engine-hash.mjs`) to `.gate/passed`, which is per machine and not committed. `pnpm deploy` in `web/` runs
`scripts/gate.mjs` first and refuses an engine whose hash has no full pass recorded. `GATE=skip pnpm deploy` overrides
that, and should only be used on purpose. GitHub CI can't run the gate, because the checks need the game files.

`node tools/mdl-info.ts models/props/glados.mdl` (paths inside the game, `--game DIR` as above) prints a model's animation data straight from the file: sequences with flags,
frames@fps, duration, blend grid, fades, events and autolayers, pose parameters, bone controllers, attachments and
`.ani` blocks (`--json`, `--bones`, `--survey [REGEX]` over every model in the game). `--continuity` decodes every
frame and reports the median and largest frame-to-frame bone move, and the gap from the last frame back to the first
for looping sequences, so a decoding bug shows up as a jump.

## Numbers

Frame times come from SwiftShader on the CPU, so they are only good for before/after comparisons on the same
machine, not as a measure of real GPU performance. `bench` times frames back to back without the page's
requestAnimationFrame pacing; it reads lower than the HUD fps, which includes the browser's own frame overhead.
