import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { applySpellSourceResistance } from "../scripts/automation/midi/spell-resistance.mjs";

beforeEach(() => { globalThis.game = { settings: { get: () => true } }; });
function packet(parts) {
  const effect = { getFlag: (_module, key) => key === FLAGS.HOLLOW_PASSIVE ? "fortified-soul" : null,
    _source: { duration: { value: null, units: "seconds" } } };
  const token = { actor: { effects: [effect], system: { attributes: { hp: { value: 30, max: 30, temp: 0, damage: 0 } } } } };
  const damageItem = { damageDetail: parts };
  return { token, context: { workflow: { item: { type: "spell" } }, damageItem } };
}
test("spell resistance halves spell damage once without changing healing", () => {
  const { token, context } = packet([{ type: "fire", value: 11 }, { type: "healing", value: -4 }]);
  applySpellSourceResistance(token, context);
  assert.equal(context.damageItem.damageDetail[0].value, 5);
  assert.equal(context.damageItem.damageDetail[1].value, -4);
  applySpellSourceResistance(token, context);
  assert.equal(context.damageItem.damageDetail[0].value, 5);
});
test("existing damage-type resistance is not doubled and weapon damage is unaffected", () => {
  const { token, context } = packet([{ type: "fire", value: 6, active: { type: { resistance: true } } }]);
  applySpellSourceResistance(token, context); assert.equal(context.damageItem.damageDetail[0].value, 6);
  context.workflow.item.type = "weapon";
  context.damageItem.damageDetail = [{ type: "fire", value: 12 }];
  applySpellSourceResistance(token, context); assert.equal(context.damageItem.damageDetail[0].value, 12);
});
test("a disabled fortified soul does not reduce damage", () => {
  const { token, context } = packet([{ type: "cold", value: 12 }]);
  token.actor.effects[0].disabled = true;
  applySpellSourceResistance(token, context); assert.equal(context.damageItem.damageDetail[0].value, 12);
});
