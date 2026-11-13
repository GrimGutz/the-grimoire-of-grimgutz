import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  abilitySaveBonus,
  abilitySaveProficiency,
  dnd5eAtLeast,
  effectKey,
  globalSaveBonus,
  movementSpeed,
  senseRange,
  versionAtLeast
} from "../scripts/automation/shared/system-paths.mjs";

const original = globalThis.game;
afterEach(() => {
  globalThis.game = original;
});
const runSystem = version => {
  globalThis.game = { system: { id: "dnd5e", version } };
};

test("versions compare numerically by segment", () => {
  assert.equal(versionAtLeast("6.0.6", "6.0"), true);
  assert.equal(versionAtLeast("5.3.3", "6.0"), false);
  assert.equal(versionAtLeast("10.0", "9.9.9"), true);
  assert.equal(versionAtLeast("6.0", "6.0.0"), true);
});

test("an unknown system version keeps the 5.x layout", () => {
  globalThis.game = undefined;
  assert.equal(dnd5eAtLeast("6.0"), false);
  assert.equal(effectKey("system.attributes.movement.fly"), "system.attributes.movement.fly");
});

test("senses always use ranges (moved in 5.3, the module minimum)", () => {
  runSystem("5.3.3");
  assert.equal(effectKey("system.attributes.senses.truesight"), "system.attributes.senses.ranges.truesight");
  assert.equal(effectKey("system.attributes.senses.units"), "system.attributes.senses.units");
  assert.equal(effectKey("system.attributes.senses.ranges.darkvision"), "system.attributes.senses.ranges.darkvision");
});

test("5.x keeps movement and bonus paths", () => {
  runSystem("5.3.3");
  for (const key of [
    "system.attributes.movement.walk",
    "system.attributes.init.bonus",
    "system.bonuses.abilities.save",
    "system.abilities.dex.bonuses.save"
  ])
    assert.equal(effectKey(key), key);
});

test("6.0 moves movement speeds and roll bonuses like dnd5e's own shims", () => {
  runSystem("6.0.6");
  const expected = {
    "system.attributes.movement.walk": "system.attributes.movement.speeds.walk",
    "system.attributes.movement.fly": "system.attributes.movement.speeds.fly",
    "system.attributes.movement.hover": "system.attributes.movement.hover",
    "system.attributes.movement.units": "system.attributes.movement.units",
    "system.attributes.init.bonus": "system.attributes.init.roll.bonus",
    "system.attributes.death.bonuses.save": "system.attributes.death.roll.bonus",
    "system.bonuses.abilities.save": "system.rolls.ability.save.bonus",
    "system.bonuses.mwak.attack": "system.rolls.attack.mwak.bonus",
    "system.bonuses.rsak.damage": "system.rolls.damage.rsak.bonus",
    "system.abilities.dex.bonuses.save": "system.abilities.dex.save.roll.bonus",
    "system.abilities.cha.bonuses.check": "system.abilities.cha.check.roll.bonus",
    "system.skills.ins.bonuses.check": "system.skills.ins.roll.bonus",
    "system.bonuses.spell.dc": "system.bonuses.spell.dc",
    "system.attributes.ac.bonus": "system.attributes.ac.bonus"
  };
  for (const [legacy, current] of Object.entries(expected)) assert.equal(effectKey(legacy), current, legacy);
});

test("readers accept both data layouts and preserve raw values", () => {
  const legacy = { system: { attributes: { movement: { walk: 30 }, senses: { truesight: 60 } } } };
  const current = {
    system: { attributes: { movement: { speeds: { walk: 40 } }, senses: { ranges: { truesight: 0 } } } }
  };
  assert.equal(movementSpeed(legacy, "walk"), 30);
  assert.equal(movementSpeed(current, "walk"), 40);
  assert.equal(movementSpeed(current, "fly"), undefined);
  assert.equal(senseRange(legacy, "truesight"), 60);
  assert.equal(senseRange(current, "truesight"), 0, "a zero range is not replaced by a legacy fallback");
});

test("save roll parts read the 6.0 locations before deprecated getters", () => {
  const prof = { hasProficiency: true, term: "@prof" };
  assert.equal(abilitySaveProficiency({ save: { prof }, saveProf: "old" }), prof);
  assert.equal(abilitySaveProficiency({ saveProf: prof }), prof);
  assert.equal(abilitySaveBonus({ save: { roll: { bonus: "" } }, bonuses: { save: "old" } }), "");
  assert.equal(abilitySaveBonus({ bonuses: { save: "1d4" } }), "1d4");
  assert.equal(globalSaveBonus({ system: { rolls: { ability: { save: { bonus: "2" } } } } }), "2");
  assert.equal(globalSaveBonus({ system: { bonuses: { abilities: { save: "1" } } } }), "1");
});

test("every module passive is built on the running layout", async () => {
  const { flaggedPassiveEffectData } = await import("../scripts/automation/effects/passive-helpers.mjs");
  const changes = [
    { key: "system.attributes.movement.fly", type: "upgrade", value: "30" },
    { key: "system.bonuses.abilities.save", type: "add", value: "2" }
  ];
  runSystem("5.3.3");
  assert.deepEqual(
    flaggedPassiveEffectData("m", "f", { key: "k", changes }).system.changes.map(c => c.key),
    ["system.attributes.movement.fly", "system.bonuses.abilities.save"]
  );
  runSystem("6.0.6");
  assert.deepEqual(
    flaggedPassiveEffectData("m", "f", { key: "k", changes }).system.changes.map(c => c.key),
    ["system.attributes.movement.speeds.fly", "system.rolls.ability.save.bonus"]
  );
  assert.equal(changes[0].key, "system.attributes.movement.fly", "definitions are not mutated");
});
