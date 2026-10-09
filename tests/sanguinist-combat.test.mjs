import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID, FLAGS } from "../scripts/automation/shared/constants.mjs";
import { verifiedBloodSpell } from "../scripts/automation/classes/sanguinist-combat.mjs";
import { processRepeatedSaves } from "../scripts/automation/effects/repeated-saves.mjs";

test("a conversion counter is not proof that an arbitrary spell is Blood", () => {
  const flags = { [FLAGS.SANGUINIST_BLOOD_SPELL_USED]: 3 }, actor = { getFlag: (_module, key) => flags[key] };
  assert.equal(verifiedBloodSpell(actor, {}, "ordinary"), false);
  flags.bloodSpellArmed = { reservedWorkflowId: "cast-one" };
  assert.equal(verifiedBloodSpell(actor, {}, "cast-one"), true); assert.equal(verifiedBloodSpell(actor, {}, "cast-two"), false);
  delete flags.bloodSpellArmed; flags.bloodSpellWorkflows = ["cast-one"];
  assert.equal(verifiedBloodSpell(actor, {}, "cast-one"), true);
});
test("bleeding routes one repeat through native save/damage rather than also rolling a plain save", async () => {
  const save = { ability: "con", dc: 16, event: "turnEnd", damage: [{ formula: "2d8", type: "necrotic" }], sourceTokenUuid: "source", sourceItemUuid: "item", targetTokenUuid: "target" };
  const effect = { uuid: "effect", getFlag: (_module, key) => key === "repeatSave" ? save : null };
  let plain = 0, pulses = [];
  const actor = { effects: [effect], async rollSavingThrow() { plain++; } };
  globalThis.game = { user: { isGM: true }, settings: { get: () => true }, combat: { id: "combat", round: 1, turn: 2 } };
  globalThis.fromUuid = async uuid => uuid === "item" ? { uuid } : { uuid, actor, parent: { id: "scene" } };
  await processRepeatedSaves(actor, "turnEnd", { pulse: async data => { pulses.push(data); }, eventKey: "ending-turn" });
  assert.equal(plain, 0); assert.equal(pulses.length, 1); assert.equal(pulses[0].event.removeEffectOnSaveUuid, "effect");
  assert.deepEqual(pulses[0].event.damage, [{ formula: "2d8", type: "necrotic" }]);
});
