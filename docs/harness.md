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

Options: `--game DIR` (default `$PORTAL_DIR`, then the Steam path), `--size WxH` (default 1024x640), `--port N`,
`--base URL` (use a server that is already running), `--keep-going`, `--no-build` (skip `./build.sh`), `--seed N`.
`script -` reads the script from stdin. Lines are split like a shell (quotes group words) and `#` starts a comment,
except `eval`, which takes the rest of its line exactly as written. `run` splits its argument on `;`, so JavaScript
with semicolons belongs in a script file.

| command | what it does |
| --- | --- |
| `map NAME [QUERY]` | load a map (`nochange=1` always); replies load time, requests, MB, warning and error counts |
| `pose X Y Z PITCH YAW` | noclip, intro fade off, feet at X Y Z (eye 64 above), view angles in degrees |
| `look PITCH YAW` | change only the view angles |
| `noclip on\|off` | `off` lets `step` run the real player physics |
| `step N [KEYS]` | advance N ticks, holding KEYS (`w`, `wd`, `space`, `duck`) |
| `shoot blue\|orange` | fire the portal gun along the view, as the mouse does |
| `use` | press E |
| `fire ENTITY INPUT [PARAM]` | queue an entity input; it is delivered on the next `step` |
| `set KEY VALUE` | renderer switch: `showSky usePVS useCubes useLightmap showOverlays noPortalRender maxDepth` |
| `render` | draw one frame: draws, views, culled and `frame_ms` (CPU plus GPU, measured with `gl.finish`) |
| `screenshot PATH` | draw one frame and save the canvas as PNG |
| `bench N` | draw N frames back to back with the simulation still: avg, p50, p95, max ms and fps |
| `diff A B [OUT]` | changed-pixel share (channel difference over 8), mean difference, optional diff image |
| `state` | map, position, angles, velocity, noclip, eye cluster, held cube, open portals, counters |
| `ents [REGEX] [N]` | BSP entities by classname: classname, targetname, origin |
| `errors` | console errors and warnings, page errors and failed requests (with paths) since the last call |
| `eval JS` | evaluate JS in the page (`window.game` is the engine) and reply its JSON value |
| `sleep S` | wait S seconds of wall time |

Example output:

```
{"line":2,"cmd":"map","ok":true,"ms":2552,"map":"escape_02","ready_ms":2478,"load_ms":2166,"requests":797,"mb":165.1,...}
{"line":9,"cmd":"bench","ok":true,"ms":1142,"frames":30,"avg_ms":36.68,"p50_ms":36.4,"p95_ms":39.5,"max_ms":41.5,"fps":27.3,"draws":355,"views":1}
{"line":10,"cmd":"diff","ok":true,"ms":179,"size":[1024,640],"changed_share":0,"mean_diff":0,"identical":true}
```

Scripts used for checks live in `checks/`: `escape02-ending.ctl` (skybox), `later-chambers.ctl` (30 views in a08 to
escape_02), `later-smoke.ctl` (20 s of real simulation from each later spawn), `glados-anim.ctl` (an animated, skinned prop). They hold only map names, coordinates and commands, never game data;
screenshots should be written outside the repository (the `.gitignore` also drops `*.png`).

## Numbers

Frame times come from SwiftShader on the CPU, so they are only good for before/after comparisons on the same
machine, not as a measure of real GPU performance. `bench` times frames back to back without the page's
requestAnimationFrame pacing; it reads lower than the HUD fps, which includes the browser's own frame overhead.
