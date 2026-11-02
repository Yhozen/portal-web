# Portal Web — log (times America/New_York)
- 09:51 Portal install complete (StateFlags 4, buildid 19017868). portal_pak is VPK v2, BSPs are v20. Wrote VPK reader (src/vpk.ts) + GameFS following gameinfo.txt search order. Clean-room from Valve Developer Wiki specs; no leaked code.
- 09:58 First render of testchmb_a_00 (relaxation vault) in headless Chromium/SwiftShader: lightmapped textured brushes, 41 fps @1024x640, load 460 ms. shots/01-first.png
- 10:05 MDL v44/VVD/VTX loader (metal_box, button, doors, bed) + static props; Source-style player movement (from public SDK 2013 gamemovement.cpp behaviour) with BSP brush AABB traces.
- 10:10 Game layer (src/game.ts, src/ents.ts): entity I/O queue, logic_relay/timer/case/auto, math_counter, trigger_once/multiple + filters, func_door/func_brush, prop_portal linking, point_template/env_entity_maker cloning, env_fade/env_hudhint (localized from resource/portal_english.txt), choreo-scene timing stub.
  Portal gun placement + recursive stencil portal views work (shots/04-gun.png); walking through a portal teleports with velocity/view transform (scripted test: 1 teleport, exit velocity 175 along exit normal).
  Cube pickup (E), carry, drop on floor button -> floor_button_trigger_box_a00 fires -> exit doors open (shots/06-button.png).
