import test from "node:test";
import assert from "node:assert/strict";
import { selectImport, validateImport, wanted } from "../../src/localfs.ts";
import { vpkDir } from "./fixtures/vpk.mjs";

const entry = (path, bytes = new Uint8Array([1])) => ({ path, size: bytes.length, open: async () => new File([bytes], path.split("/").pop()) });

test("selection finds the install root wherever the player pointed, and copies only what the engine reads", () => {
  for (const prefix of ["", "Portal/", "common/Portal/", "Steam/steamapps/common/Portal/"]) {
    const sel = selectImport([
      entry(`${prefix}portal/portal_pak_dir.vpk`), entry(`${prefix}portal/portal_pak_000.vpk`),
      entry(`${prefix}hl2/hl2_textures_dir.vpk`), entry(`${prefix}hl2/HL2_MISC_001.vpk`), entry(`${prefix}hl2/hl2_sound_misc.vpk.sound.cache`),
      entry(`${prefix}portal/maps/testchmb_a_00.bsp`), entry(`${prefix}portal/maps/escape_00_commentary.txt`),
      entry(`${prefix}portal/resource/portal_english.txt`), entry(`${prefix}hl2/scripts/game_sounds.txt`),
      entry(`${prefix}portal/bin/server.so`), entry(`${prefix}hl2_linux`), entry(`${prefix}portal/save/quick.sav`),
      entry(`${prefix}portal/cfg/config.cfg`), entry(`${prefix}hl2/media/valve.bik`), entry(`${prefix}portal/.DS_Store`),
    ]).map((c) => c.rel);
    assert.deepEqual(sel, ["hl2/hl2_misc_001.vpk", "hl2/hl2_textures_dir.vpk", "hl2/scripts/game_sounds.txt",
      "portal/maps/testchmb_a_00.bsp", "portal/portal_pak_000.vpk", "portal/portal_pak_dir.vpk", "portal/resource/portal_english.txt"], prefix);
  }
  // Loose files dropped without folders are placed by name.
  assert.deepEqual(selectImport([entry("portal_pak_dir.vpk"), entry("hl2_textures_dir.vpk"), entry("testchmb_a_00.bsp"), entry("notes.txt")]).map((c) => c.rel),
    ["hl2/hl2_textures_dir.vpk", "portal/maps/testchmb_a_00.bsp", "portal/portal_pak_dir.vpk"]);
  assert.equal(wanted("hl2/hl2_sound_vo_english_004.vpk"), true);
  assert.equal(wanted("hl2/hl2_pak_dir.vpk"), false);
});

test("validation requires the directories, every referenced archive and a map", async () => {
  const pak = vpkDir([{ path: "materials/a.vmt", archive: 0, offset: 0, length: 4 }, { path: "materials/b.vmt", archive: 2, offset: 0, length: 4 }]);
  const tex = vpkDir([{ path: "materials/c.vtf", archive: 0, offset: 0, length: 0, data: new Uint8Array() }], { embedded: true });
  const set = selectImport([entry("Portal/portal/portal_pak_dir.vpk", pak), entry("Portal/portal/portal_pak_000.vpk"),
    entry("Portal/hl2/hl2_textures_dir.vpk", tex), entry("Portal/hl2/hl2_misc_dir.vpk", tex)]);
  assert.deepEqual(await validateImport(set), ["missing portal/maps/*.bsp", "missing portal/portal_pak_002.vpk"]);
  assert.deepEqual(await validateImport(selectImport([entry("Portal/portal/portal_pak_dir.vpk", new Uint8Array([1, 2, 3]))])),
    ["missing hl2/hl2_textures_dir.vpk", "missing hl2/hl2_misc_dir.vpk", "missing portal/maps/*.bsp", "portal/portal_pak_dir.vpk is not a VPK directory"]);
});
