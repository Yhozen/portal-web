(() => { const G = game.game, io = G.io, out = [], P = () => game.pl.pos.map(v => v | 0);
const lg = (k, ...v) => out.push(io.time.toFixed(1) + ' ' + k + ' ' + v.map(x => JSON.stringify(x)).join(' '));
let lastFail = null; { const f0 = G.fizzleShot.bind(G); G.fizzleShot = (w, why) => { lastFail = 'portal ' + w + ' failed: ' + why; return f0(w, why); }; }
const shoot = (which, at) => { AP.lookAt(at); AP.wait(0.15); lastFail = null; G.shootPortal(which); AP.wait(0.15); const Pp = G.gunPortals[which]; return Pp.open && !lastFail ? Pp.pos.map(v => v | 0) + ' f ' + Pp.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail; };
const tryShoot = (which, ts) => { let r = ''; for (const t of ts) { r = shoot(which, t); if (!/not placed/.test(r)) break; } return r; };
const placeAt = (which, at) => {
  const eye = game.pl.eye(); const d = at.map((v, i) => v - eye[i]), l = Math.hypot(...d) || 1, f = d.map(v => v / l);
  lastFail = null; G.shootPortal(which, { eye, f }); AP.wait(0.1);
  const Q = G.gunPortals[which];
  return Q.open && !lastFail ? Q.pos.map(v => v | 0) + ' f ' + Q.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail;
};
const T = 1 / 66, idle = { fwd: 0, side: 0, jump: false, duck: false };
const fly = (min = 0.3, max = 8) => {
  let top = -1e9;
  for (let k = 0; k < max * 66; k++) {
    game.step(T, idle); top = Math.max(top, game.pl.pos[2]);
    // a wall-portal exit leaves you ducked and still sliding; that is onGround
    // but not landed (turret-room drop stopped at z -456 with vx -238)
    const slow = Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 16;
    if (k > min * 66 && game.pl.onGround && slow) break;
  }
  return game.pl.pos.map(v => v | 0) + ' top ' + (top | 0);
};
const standAt = (x, y, max = 6) => {
  for (let k = 0; k < max * 66; k++) {
    const dx = x - game.pl.pos[0], dy = y - game.pl.pos[1], dist = Math.hypot(dx, dy);
    if (dist < 2 && Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 8 && game.pl.onGround && k > 5) break;
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: Math.min(0.8, dist / 12), side: 0, jump: false, duck: false });
  }
  game.pl.vel = [0, 0, 0]; AP.wait(0.2); lg('stood', game.pl.pos.map(v => +v.toFixed(1)));
};
// yaw 0 = +X, 90 = +Y, 180 = -X, 270 = -Y. +side is to the right of facing.
const runHold = (yaw, holdAxis, holdVal, stopAxis, stopPred, max = 8) => {
  for (let k = 0; k < max * 66; k++) {
    game.pl.ang = [0, yaw, 0];
    const err = holdVal - game.pl.pos[holdAxis];
    const rad = yaw * Math.PI / 180;
    const rx = Math.sin(rad), ry = -Math.cos(rad);
    const rcomp = holdAxis === 0 ? rx : ry;
    const side = Math.abs(rcomp) < 0.2 ? 0 : Math.max(-0.6, Math.min(0.6, err / 8 / rcomp));
    game.step(T, { fwd: 1, side, jump: false, duck: false });
    if (stopPred(game.pl.pos[stopAxis]) && k > 5) break;
  }
  game.pl.vel = [0, 0, 0];
};
const glassGone = (m) => { const e = io.ents.find(x => x.cls === 'func_breakable_surf' && x.kv.model === m); return e && !!e.killed; };
// run west along the spawn corridor and the narrow catwalk over the ambush pit, holding y near 2624.
// looking yaw 180 (west), +side is south (-Y), so a positive dy (we're south of the line) needs -side.
const runWest = (xStop, yHold = 2624, max = 8) => {
  for (let k = 0; k < max * 66; k++) {
    const dy = yHold - game.pl.pos[1];
    game.pl.ang = [0, 180, 0];
    game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, dy / 8)), jump: false, duck: false });
    if (game.pl.pos[0] <= xStop && game.pl.onGround && k > 10) break;
  }
};
try {
AP.wait(2); lg('start', P() + ' gun ' + G.hasGun + ' fire ' + G.canFire);
// corridor west from -1172, 2619, -383, over the catwalk lip at x -1600 (the original walks this at 150 u/s;
// see oracle/runs/e01-walk-lip.jsonl). The gun is picked up on the first steps (OnNewGame ForceSpawns it).
runWest(-1710, 2624, 8);
lg('catwalk or fall', P(), 'g ' + game.pl.onGround);
if (window.STAGE === 1) throw 'stage 1';
// the mid-pit crushers open as we enter, and the catwalk is only a few dozen units wide; if we
// drift off the south edge we land on the ambush floor (z -639). Wait for that, or keep west if we stay up.
if (game.pl.pos[2] > -500) {
  runWest(-1900, 2624, 6);
  lg('still up', P(), 'g ' + game.pl.onGround);
}
for (let k = 0; k < 4 * 66 && game.pl.pos[2] > -600; k++) game.step(T, idle);
lg('pit or walkway', P(), 'g ' + game.pl.onGround);
if (window.STAGE === 2) throw 'stage 2';
// south pod (door_*_pod3) opens about 21 s after the floor trigger (19 s relay + 2 s door delay)
const tLand = io.time;
const southOpen = () => { const d = AP.ent('door_lower_pod3') || AP.ent('door_upper_pod3'); return d && (d.state === 'open' || d.state === 'opening' && (d.t || 0) > 0.8); };
AP.wait(28, southOpen);
lg('south pod', 'waited ' + (io.time - tLand).toFixed(2), 'lower ' + ((AP.ent('door_lower_pod3') || {}).state || '?'), 'pos ' + ((AP.ent('door_lower_pod3') && AP.ent('door_lower_pod3').pos) ? AP.ent('door_lower_pod3').pos.map(v => v | 0) : ''), P());
if (game.pl.pos[2] < -500) {
  lg('to the south wall', JSON.stringify(AP.gotoRetry([-1792, 2280, -639], 16, 20, 0.4)).slice(0, 120), P());
  // the alcove past the pod is tight (broken claw at -1790, 2144); a direct goto can say "no path" after
  // we're already through, so just walk south until we're clearly past the door at y 2296
  for (let k = 0; k < 5 * 66 && game.pl.pos[1] > 2180; k++) {
    const dx = -1792 - game.pl.pos[0], dy = 2144 - game.pl.pos[1];
    game.pl.ang = [0, Math.atan2(dy, dx) * 180 / Math.PI, 0];
    game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
  }
  lg('through the pod', P(), 'g ' + game.pl.onGround);
  // trigger_look at the alcove doorway: look at the broken claw for 0.75 s to Enable
  // relay_move_up_broke_pincher, then Use the sparking door (spawnflag 256) to Open it,
  // which Triggers the relay, raises the broken pole, and Kills the door.
  standAt(-1792, 2188, 4);
  const lookT = AP.ent('look_target_mini_ambush_escape');
  if (lookT) {
    AP.lookAt(lookT.origin);
    AP.wait(1.2);
    lg('looked at claw', P(), 'relay ' + !!(AP.ent('relay_move_up_broke_pincher') || {}).enabled);
    // Use range is 80 from the eye; look at the sparking door (its underside is at z -562) so the trace hits it
    const sparkyPos = (AP.ent('door_raise_sparky') || {}).origin || [-1789, 2144, -562];
    AP.lookAt([sparkyPos[0], sparkyPos[1], -562]);
    AP.wait(0.15);
    G.use();
    AP.wait(2.2);
    const sparky = AP.ent('door_raise_sparky');
    const pole = AP.ent('turret_deliver_pole_20');
    lg('after use', 'sparky ' + (sparky && sparky.killed ? 'killed' : 'alive'), 'pole z ' + ((pole && (pole.pos || pole.origin) || [0,0,0])[2] | 0), P());
  }
  // portal out through the ceiling hole: stand on the east side of the alcove, orange on
  // the floor, blue on the underside of the concrete floor at z -128 in the tube room
  // (brush 410, concrete_bts_floor002a). Falling in lands at about -2232, 1964, -512.
  if (window.STAGE === 3) throw 'stage 3';
  standAt(-1748, 2188, 4);
  lg('east stand', P(), 'floor ' + placeAt(1, [-1792, 2208, -700]));
  lg('ceiling', placeAt(0, [-2144, 2000, -200]));
  const orange = G.gunPortals[1], blue = G.gunPortals[0];
  if (orange && orange.open && blue && blue.open) {
    game.pl.pos = [orange.pos[0], orange.pos[1], orange.pos[2] + 12];
    game.pl.vel = [0, 0, -30];
    lg('fell through', fly(0.4, 6), 'blue ' + blue.pos.map(v => v | 0));
  } else {
    lg('no hole portals', 'o ' + !!(orange && orange.open) + ' b ' + !!(blue && blue.open));
  }
}
if (window.STAGE === 4) throw 'stage 4';
// intended route (Gamer Walkthroughs): from the tube bay, portal onto the
// south wall next to the higher walkway (y 1696, z -200) and jump across to it.
// face north when placing the floor portal — that sets its "up" so a center
// entry comes out far enough east to land on the z -256 walkway and run to
// about -1744, 1743, -256. The turret-room rust floor is below this, past
// the fence; the metal stairs down there are broken and don't reach the walkway.
if (game.pl.pos[0] < -2100 && game.pl.pos[2] < -400) {
  standAt(-2232, 1964, 4);
  lg('walkway wall', placeAt(0, [-2208, 1696, -200]));
  game.pl.ang = [0, 90, 0];
  lastFail = null;
  const eye2 = game.pl.eye();
  G.shootPortal(1, { eye: [eye2[0] - 48, eye2[1], eye2[2]], f: [0, 0, -1] });
  const o2 = G.gunPortals[1], b2 = G.gunPortals[0];
  const floorOk = o2 && o2.open && !lastFail && o2.pos[0] < -2100 && o2.pos[2] < -480;
  lg('tube floor', P(), 'floor ' + (floorOk ? o2.pos.map(v => v | 0) + ' f ' + o2.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail));
  if (floorOk && b2 && b2.open) {
    game.pl.pos = [o2.pos[0], o2.pos[1], o2.pos[2] + 12];
    game.pl.vel = [0, 0, -20];
    game.pl.ang = [0, 0, 0];
    let top = -1e9;
    for (let k = 0; k < 4 * 66; k++) {
      game.step(T, { fwd: 1, side: 0, jump: k === 6 || k === 22, duck: false });
      top = Math.max(top, game.pl.pos[2]);
      const onWalk = game.pl.onGround && game.pl.pos[2] > -280 && game.pl.pos[2] < -180 && game.pl.pos[0] > -2188;
      const slow = Math.hypot(game.pl.vel[0], game.pl.vel[1]) < 16;
      if (k > 30 && onWalk && slow) break;
    }
    lg('onto walkway', P(), 'top ' + (top | 0), 'blue ' + b2.pos.map(v => v | 0));
    // walk west toward the red arrow (overlay 94 at -1888, 1696, -209)
    if (game.pl.pos[2] > -280 && game.pl.pos[2] < -180) {
      standAt(-1888, 1743, 6);
      if (window.STAGE === 5) throw 'stage 5';
      // duck through the small hole in the south wall (x -1852..-1812, z -244..-196)
      // and drop onto the turret. trigger_once *40 then Opens the flippy door.
      standAt(-1832, 1740, 4);
      for (let k = 0; k < 0.5 * 66; k++) game.step(T, { fwd: 0, side: 0, jump: false, duck: true });
      for (let k = 0; k < 5 * 66; k++) {
        game.pl.ang = [0, 270, 0];
        game.step(T, { fwd: 1, side: 0, jump: false, duck: true });
        if (game.pl.pos[1] < 1608 && game.pl.onGround && game.pl.pos[2] < -300) break;
      }
      const flip = AP.ent('flippy_turret_door_12') || {};
      lg('through the hole', P(), 'g ' + game.pl.onGround, 'flippy ' + (flip.state != null ? flip.state : '?'));
      // trigger is +0.5s, then move_flippy fully opens, then +2s, then the
      // rotating door swings 60 degrees at 15 deg/s (~4 s). Wait it out.
      const doorDone = () => {
        const f = AP.ent('flippy_turret_door_12') || {};
        const a = (f.ang || f.angles || [0])[0];
        return Math.abs(a) >= 55;
      };
      AP.wait(10, doorDone);
      const flip2 = AP.ent('flippy_turret_door_12') || {};
      lg('flippy open', P(), 'state ' + flip2.state, 'ang ' + (flip2.ang || flip2.angles || []).map(v => (v | 0)));
      if (window.STAGE === 6) throw 'stage 6';
      // if we landed on the turret (z ~ -325), walk south off it onto the pit floor
      if (game.pl.pos[2] > -350) {
        for (let k = 0; k < 2 * 66; k++) {
          game.pl.ang = [0, 270, 0];
          game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
          if (game.pl.pos[2] < -360 && game.pl.onGround) break;
        }
        lg('off the turret', P());
      }
      // the open door is the way into the large room; walk east through it and
      // drop to the z -512 floor. A ramp up to z -256 starts around x -1200.
      standAt(-1700, 1604, 5);
      for (let k = 0; k < 6 * 66; k++) {
        const dy = 1604 - game.pl.pos[1];
        game.pl.ang = [0, 0, 0];
        game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, dy / 8)), jump: false, duck: false });
        if (game.pl.pos[0] > -1300 && game.pl.onGround && game.pl.pos[2] < -450) break;
      }
      lg('large room', P(), 'g ' + game.pl.onGround);
      if (window.STAGE === 7) throw 'stage 7';
      // walkthrough: portal on the top of the flipped door, another on the
      // floor, and fling onto the z -256 ramp/platform into the offices.
      // The door top is flippy_brush (plastic, n [0.5,0,0.87] once open).
      // Because |n.z| > 0.7 it is treated as a floor portal, so its "up"
      // comes from yaw; only yaw 90 or 270 lets a 64x108 portal fit.
      standAt(-1100, 1600, 8);
      game.pl.ang = [0, 90, 0];
      AP.wait(0.2);
      lg('door top', P(), placeAt(0, [-1668, 1600, -260]));
      standAt(-1450, 1600, 8);
      game.pl.ang = [90, 0, 0];
      lastFail = null;
      G.shootPortal(1, { eye: game.pl.eye(), f: [0, 0, -1] });
      const floor = G.gunPortals[1], doorP = G.gunPortals[0];
      const floorOk = floor && floor.open && !lastFail && floor.pos[2] < -480;
      lg('room floor', P(), 'floor ' + (floorOk ? floor.pos.map(v => v | 0) + ' f ' + floor.f.map(v => +v.toFixed(2)) : 'not placed ' + lastFail),
        'door ' + (doorP && doorP.open ? doorP.pos.map(v => v | 0) + ' f ' + doorP.f.map(v => +v.toFixed(2)) : 'no'));
      // a 64-unit fall into that floor portal (linked to the door top) lands
      // on the office platform at about -1104, 1639, -256. 128 overshoots;
      // 0 leaves you stuck on the door. The tube-bay drop already enters a
      // portal from a set height; this is the same idea.
      if (floorOk && doorP && doorP.open) {
        game.pl.pos = [floor.pos[0], floor.pos[1], floor.pos[2] + 64];
        game.pl.vel = [0, 0, 0];
        game.pl.onGround = false;
        game.pl.ang = [0, 0, 0];
        lg('fling out', fly(0.3, 10), 'g ' + game.pl.onGround);
        if (game.pl.onGround && game.pl.pos[2] > -280 && game.pl.pos[2] < -200) {
          standAt(-900, 1600, 8);
          lg('office platform', P(), 'g ' + game.pl.onGround);
          if (window.STAGE === 8) throw 'stage 8';
          // the platform continues south at x -800. d1's doorway is a 52-unit
          // gap at x -856..-804 (center -830); d2's is y 556..604 (center 580).
          // The prop doors have no model/collision yet, but the frames are world
          // brushes, so the hull has to go through those openings.
          standAt(-800, 1180, 10);
          standAt(-830, 1180, 4);
          for (let k = 0; k < 8 * 66; k++) {
            const dx = -830 - game.pl.pos[0];
            game.pl.ang = [0, 270, 0];
            game.step(T, { fwd: 1, side: Math.max(-0.5, Math.min(0.5, dx / 8)), jump: false, duck: false });
            if (game.pl.pos[1] < 1000 && game.pl.onGround) break;
          }
          lg('through d1', P(), 'g ' + game.pl.onGround);
          standAt(-700, 580, 10);
          for (let k = 0; k < 8 * 66; k++) {
            const dy = 580 - game.pl.pos[1];
            game.pl.ang = [0, 0, 0];
            game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, dy / 8)), jump: false, duck: false });
            if (game.pl.pos[0] > -600 && game.pl.onGround) break;
          }
          lg('through d2', P(), 'g ' + game.pl.onGround);
          standAt(-545, 640, 8);
          lg('turret button', P(), 'g ' + game.pl.onGround);
          if (window.STAGE === 9) throw 'stage 9';
          // button_enable_turret is a Use-Opens func_door_rotating (spawnflags
          // 4432 includes 256). OnFullyOpen Enables laser_1.
          const btn = AP.ent('button_enable_turret');
          if (btn) AP.lookAt(btn.pos || btn.origin);
          AP.wait(0.25);
          G.use();
          AP.wait(1, () => (AP.ent('laser_1') || {}).rocketEnabled);
          const las = AP.ent('laser_1') || {};
          lg('turret enabled', P(), 'laser ' + !!las.rocketEnabled, 'btn ' + (btn && btn.state));
          if (window.STAGE === 10) throw 'stage 10';
          // first rocket is ~6.9 s after Enable and is lethal; the button stand
          // is inside the west-pane blast, so get back to the legal LOS stand
          // south of the button before it fires.
          standAt(-600, 560, 4);
          lg('stood back from the glass', P(), 'g ' + game.pl.onGround);
          for (let k = 0; k < 14 * 66; k++) { game.step(T, idle); if (glassGone('*50')) break; }
          lg('west glass', glassGone('*50'), P(), 'hp ' + G.health);
          if (glassGone('*50') && !G.dead) {
            // a rocket into the south-wall portal comes out the west wall,
            // same-facing portals flip Y, and the path hits the east pane.
            lg('east entry', placeAt(0, [-620, 448, -200]));
            lg('east exit', placeAt(1, [-656, 480, -200]));
            standAt(-560, 470, 5);
            let shotAt = las.nextRocket;
            lg('east bait', P(), 'shotAt ' + (shotAt && shotAt.toFixed(2)));
            for (let k = 0; k < 8 * 66; k++) {
              const now = io.time;
              if (shotAt && now >= shotAt && now <= shotAt + 1.2) {
                game.pl.ang = [0, 90, 0];
                game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
              } else game.step(T, idle);
              if (glassGone('*51') || G.dead) break;
            }
            lg('east glass', glassGone('*51'), P(), 'hp ' + G.health, 'dead ' + !!G.dead);
            if (window.STAGE === 11) throw 'stage 11';
            if (glassGone('*51') && !G.dead) {
              // both panes are open, so a portal on the far wall of the next
              // room is visible from the office. Walk into the south-wall
              // portal and you're past the turret before the next rocket.
              lg('far wall', placeAt(1, [256, 580, -180]));
              for (let k = 0; k < 3 * 66; k++) {
                const dx = -620 - game.pl.pos[0];
                game.pl.ang = [0, 270, 0];
                game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, -dx / 8)), jump: false, duck: false });
                if (game.pl.pos[0] > 0) break;
              }
              lg('far room', fly(0.2, 6), 'hp ' + G.health);
              // d4's walkable gap is at x 180, then the south hallway at y 420,
              // then d5's gap at x 596 north into the *43 alcove.
              runHold(270, 0, 180, 1, v => v <= 420, 6);
              runHold(0, 1, 420, 0, v => v >= 596, 10);
              runHold(90, 0, 596, 1, v => v >= 800, 6);
              lg('alcove', P(), 'exit43 ' + placeAt(1, [512, 800, -180]));
              standAt(540, 800, 3);
              // the alcove portal sits at z -180; a short jump walks into it
              // and drops you back at the office south wall.
              for (let k = 0; k < 2 * 66; k++) {
                const dy = 800 - game.pl.pos[1];
                game.pl.ang = [0, 180, 0];
                game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, dy / 8)), jump: k < 10, duck: false });
                if (game.pl.pos[0] < 0) break;
              }
              lg('back in the office', fly(0.15, 4), 'hp ' + G.health);
              runHold(90, 0, -630, 1, v => v >= 500, 3);
              lg('west entry', placeAt(0, [-656, 480, -200]));
              standAt(-630, 490, 4);
              shotAt = las.nextRocket;
              lg('43 bait', P(), 'shotAt ' + (shotAt && shotAt.toFixed(2)), 'hp ' + G.health);
              for (let k = 0; k < 8 * 66; k++) {
                const now = io.time;
                if (shotAt && now >= shotAt && now <= shotAt + 1.2) {
                  game.pl.ang = [0, 90, 0];
                  game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
                } else game.step(T, idle);
                if (glassGone('*43') || G.dead) break;
              }
              AP.wait(0.5);
              const train = io.ents.find(e => e.cls === 'func_tracktrain' && !e.killed && e.name === 'box_tracktrain_1');
              lg('glass 43', glassGone('*43'), P(), 'hp ' + G.health, 'dead ' + !!G.dead,
                'train ' + (train ? (train.pos || []).map(v => v | 0) + ' spd ' + train.speedNow : 'none'));
              if (window.STAGE === 12) throw 'stage 12';
              if (glassGone('*43') && !G.dead) {
                // back through the south-wall portal to the far room, duck through
                // the broken *43 pane, and put a floor portal under the 960 tube
                // so the next office rocket goes up into the missile trigger.
                lg('far wall 2', placeAt(1, [256, 580, -180]));
                lg('south entry 2', placeAt(0, [-620, 448, -200]));
                for (let k = 0; k < 4 * 66; k++) {
                  const dx = -620 - game.pl.pos[0];
                  game.pl.ang = [0, 270, 0];
                  game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, -dx / 8)), jump: false, duck: false });
                  if (game.pl.pos[0] > 0) break;
                }
                lg('far room 2', fly(0.2, 6), 'hp ' + G.health);
                runHold(270, 0, 180, 1, v => v <= 420, 6);
                runHold(0, 1, 420, 0, v => v >= 596, 10);
                runHold(90, 0, 596, 1, v => v >= 800, 6);
                runHold(0, 1, 800, 0, v => v >= 740, 5);
                game.pl.ang = [0, 0, 0];
                for (let k = 0; k < 3 * 66; k++) game.step(T, { fwd: 1, side: 0, jump: false, duck: true });
                AP.wait(0.5);
                lg('through 43', P());
                runHold(270, 0, game.pl.pos[0], 1, v => v <= 576, 8);
                runHold(0, 1, 576, 0, v => v >= 960, 8);
                lg('tube floor', placeAt(1, [960, 576, -255]), P());
                for (let k = 0; k < 3 * 66 && game.pl.pos[0] > 400; k++) game.step(T, { fwd: 0, side: 0, jump: k < 10, duck: false });
                lg('back in the office 2', fly(0.15, 5), 'hp ' + G.health);
                if (!G.dead && game.pl.pos[0] < 400) {
                  lg('west entry 2', placeAt(0, [-656, 480, -200]));
                  standAt(-630, 490, 4);
                  shotAt = las.nextRocket;
                  if (!shotAt || shotAt < io.time - 0.05) {
                    AP.wait(8, () => las.nextRocket && las.nextRocket >= io.time - 0.05);
                    shotAt = las.nextRocket;
                  }
                  lg('tube bait', P(), 'shotAt ' + (shotAt && shotAt.toFixed(2)), 'hp ' + G.health);
                  let wentThrough = false;
                  for (let k = 0; k < 8 * 66; k++) {
                    const now = io.time;
                    if (shotAt && now >= shotAt && now <= shotAt + 1.2) {
                      game.pl.ang = [0, 90, 0];
                      game.step(T, { fwd: 1, side: 0, jump: false, duck: false });
                    } else game.step(T, idle);
                    if (io.log.some(l => /broken_tube_box_spawner_3\.forcespawn|relay_broken_tube_effects2|tracknode_boxtube_4\.enablealternatepath/i.test(l))) { wentThrough = true; break; }
                    if (G.dead) break;
                    if (shotAt && now > shotAt + 2.5) break;
                  }
                  if (!wentThrough) wentThrough = io.log.some(l => /broken_tube_box_spawner_3\.forcespawn|relay_broken_tube_effects2/i.test(l));
                  lg('tube rocket', wentThrough, P(), 'hp ' + G.health, 'dead ' + !!G.dead);
                  // wait until the rocket has hit the missile trigger, then overwrite
                  // the floor portal before the spat cube falls into it; otherwise the
                  // cube comes out the west-wall portal into the office.
                  if (wentThrough && !G.dead) {
                    lg('far wall 3', placeAt(1, [256, 580, -180]));
                    lg('south entry 3', placeAt(0, [-620, 448, -200]));
                    for (let k = 0; k < 4 * 66; k++) {
                      const dx = -620 - game.pl.pos[0];
                      game.pl.ang = [0, 270, 0];
                      game.step(T, { fwd: 1, side: Math.max(-0.6, Math.min(0.6, -dx / 8)), jump: false, duck: false });
                      if (game.pl.pos[0] > 0) break;
                    }
                    lg('far room 3', fly(0.2, 6), 'hp ' + G.health);
                    runHold(270, 0, 180, 1, v => v <= 420, 6);
                    runHold(0, 1, 420, 0, v => v >= 596, 10);
                    runHold(90, 0, 596, 1, v => v >= 800, 6);
                    runHold(0, 1, 800, 0, v => v >= 740, 5);
                    game.pl.ang = [0, 0, 0];
                    for (let k = 0; k < 3 * 66; k++) game.step(T, { fwd: 1, side: 0, jump: false, duck: true });
                    AP.wait(0.5);
                    runHold(270, 0, game.pl.pos[0], 1, v => v <= 576, 8);
                    const spitBox = () => G.cubes.find(c => c.alive && c.ent && c.ent.name === 'box' && c.ent.isCopy);
                    // the box needs a moment to finish falling onto the tube-room floor
                    for (let k = 0; k < 3 * 66; k++) {
                      const c = spitBox();
                      if (c && c.pos[2] < -220 && Math.abs(c.vel[2]) < 8) break;
                      game.step(T, idle);
                    }
                    const spit = spitBox();
                    lg('spit cube', spit && spit.pos.map(v => v | 0), 'hp ' + G.health, 'dead ' + !!G.dead);
                    if (spit && !G.dead) {
                      standAt(spit.pos[0] + 50, spit.pos[1], 5);
                      AP.lookAt(spit.pos);
                      AP.wait(0.2);
                      G.use();
                      AP.wait(0.4);
                    }
                    lg('held cube', !!G.held, spitBox() && spitBox().pos.map(v => v | 0), P(), 'hp ' + G.health);

                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
if (window.STAGE === 8) throw 'stage 8';
lg('done early', P());
} catch (e) { lg('ERROR', String(e && e.message || e), P(), 'ap ' + JSON.stringify((AP.LOG || []).slice(-6))); }
out.push(AP.LOG.slice(-20).join('\n'));
out.push(io.log.filter(l => /picked|portalgun|laser_1|rocket|teleport|fizz|changed|pod|crusher|trap_1|block_crazy|pincher|sparky|look_target|pole_20|tracktrain|forcespawn|broken_tube|changelevel|relay_make/.test(l)).slice(-25).join('\n'));
return out.join('\n'); })()
