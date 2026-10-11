import assert from "node:assert/strict";
import {test} from "node:test";
import {availableWitchSlots} from "../scripts/automation/classes/witch-blade.mjs";
import {applyWeaponBuffAttackAutomation, weaponBuffApplies} from "../scripts/automation/shared/weapon-buffs.mjs";
import {FLAGS} from "../scripts/automation/shared/constants.mjs";
test("crystallization offers only real available normal or pact slots", () => {
  assert.deepEqual(availableWitchSlots({system: {spells: {spell2: {value: 0}, spell4: {value: 1}, pact: {value: 2, level: 3}}}}),
    [{key: "spell4", level: 4, remaining: 1}, {key: "pact", level: 3, remaining: 2}]);
});
test("a chosen weapon buff cannot affect a different weapon", () => {
  assert.equal(weaponBuffApplies({weaponUuids: ["chosen"]}, {uuid: "other"}), false);
  globalThis.game = {settings: {get: () => true}, user: {targets: new Set([{actor: {system: {spells: {spell5: {max: 9}}}}}])}};
  const data = {weaponUuids: ["chosen"], criticalThresholdReduction: 2, advantageAgainstSpellcasters: true};
  const effect = {getFlag: (_m, key) => key === FLAGS.WEAPON_BUFF_EFFECT ? "buff" : data};
  const config = {subject: {item: {uuid: "other", type: "weapon"}, actor: {effects: [effect]}, attack: {type: {value: "melee"}}}, rolls: [{options: {}}]};
  applyWeaponBuffAttackAutomation(config); assert.deepEqual(config.rolls[0].options, {});
  config.subject.item.uuid = "chosen"; applyWeaponBuffAttackAutomation(config);
  assert.equal(config.rolls[0].options.criticalSuccess, 18);
  assert.equal(config.rolls[0].options.advantage, undefined, "unrelated global user targets cannot grant advantage");
  config.workflow = {targets: new Set([{actor: {system: {spells: {spell1: {max: 1}}}}}])};
  applyWeaponBuffAttackAutomation(config); assert.equal(config.rolls[0].options.advantage, true);
});
