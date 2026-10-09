import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { chooseSpiritVesselAbility, chooseSpiritVesselStrikeDamage } from "../scripts/automation/classes/spirit-vessel.mjs";
import { applyWeaponBuffAttackAutomation } from "../scripts/automation/shared/weapon-buffs.mjs";

let result, dialogs, writes;
beforeEach(() => {
  result = "cha"; dialogs = []; writes = [];
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: { wait: async data => { dialogs.push(data); return result; } } } } };
});
function actor() {
  return {
    uuid: "Actor.one", items: [
      { type: "class", system: { identifier: "spirit-vessel" }, async update(data) { writes.push(data); } },
      { type: "subclass", system: { classIdentifier: "spirit-vessel" }, flags: { [MODULE_ID]: { schemaVersion: 1, spiritVesselSubclass: "elemental-air" } } }
    ], async setFlag(module, key, value) { writes.push({ key, value }); }
  };
}
test("spirit ability and damage dialogs contain choices and save the selected value", async () => {
  assert.equal(await chooseSpiritVesselAbility(actor()), true);
  assert.match(dialogs[0].content, /value="cha"/);
  result = "cold";
  assert.equal(await chooseSpiritVesselStrikeDamage(actor()), true);
  assert.match(dialogs[1].content, /value="cold"/);
  assert.ok(writes.some(write => write.value === "cold"));
});
test("cancelled spirit choices do not write to the actor", async () => {
  result = null;
  assert.equal(await chooseSpiritVesselAbility(actor()), false);
  assert.equal(await chooseSpiritVesselStrikeDamage(actor()), false);
  assert.equal(writes.length, 0);
  assert.equal(dialogs.length, 2);
});
test("crystallization updates dnd5e criticalSuccess and keeps a better existing threshold", () => {
  const effect = { _source: { duration: { value: 60, units: "seconds" } }, updateDuration: () => ({ remaining: 60 }),
    getFlag: (_module, key) => key === FLAGS.WEAPON_BUFF_EFFECT ? "crystal" : { criticalThresholdReduction: 2 } };
  for (const [threshold, expected] of [[20, 18], [17, 17]]) {
    const config = { subject: { actor: { effects: [effect] }, item: { type: "weapon" }, attack: { type: { value: "melee", classification: "weapon" } } },
      rolls: [{ options: { criticalSuccess: threshold } }] };
    applyWeaponBuffAttackAutomation(config);
    assert.equal(config.rolls[0].options.criticalSuccess, expected);
  }
});
