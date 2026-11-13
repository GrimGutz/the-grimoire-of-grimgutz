import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import {
  matchesAttackBenefit,
  consumeBenefit,
  appendCalculatedBonus,
  applyNativeAttackBonuses,
  bindWorkflowArmor,
  meleeReach
} from "../scripts/automation/shared/combat-benefits.mjs";

function effect(data) {
  return {
    flags: { [MODULE_ID]: { combatBenefit: data } },
    getFlag(module, key) {
      return this.flags[module]?.[key];
    },
    async setFlag(module, key, value) {
      this.flags[module][key] = value;
    },
    async delete() {
      this.disabled = true;
    }
  };
}
test("targeted and opportunity bonuses never affect unrelated attacks", () => {
  const e = effect({ kind: "attack-advantage", weaponOnly: true, opportunityOnly: true, against: ["enemy"] });
  const data = { attacker: { uuid: "ally" }, target: { uuid: "enemy" }, weapon: true, opportunity: true };
  assert.equal(matchesAttackBenefit(e, data), true);
  assert.equal(matchesAttackBenefit(e, { ...data, target: { uuid: "other" } }), false);
  assert.equal(matchesAttackBenefit(e, { ...data, opportunity: false }), false);
  e.disabled = true;
  assert.equal(matchesAttackBenefit(e, data), false);
});
test("native roll configuration receives scoped numeric bonuses exactly once", () => {
  const workflow = { grimgutzBenefitsPrepared: true, grimgutzAttackBenefits: [{ kind: "attack-bonus", amount: -3 }] };
  const config = { workflow, rolls: [{ parts: ["@mod"] }] };
  applyNativeAttackBonuses(config);
  applyNativeAttackBonuses(config);
  assert.deepEqual(config.rolls[0].parts, ["@mod", "-3"]);
  const unrelated = { rolls: [{ parts: [] }] };
  applyNativeAttackBonuses(unrelated);
  assert.deepEqual(unrelated.rolls[0].parts, []);
});
test("armor changes only workflow AC, including when Midi rebuilds its modifiers", () => {
  const workflow = {
    grimgutzAttackBenefits: [{ kind: "armor-ac", targetActorUuid: "defender", amount: 5 }],
    recordTargetACModifiers() {
      this.targetACModifiers = new Map([
        ["defender", 2],
        ["other", 0]
      ]);
    }
  };
  bindWorkflowArmor(workflow);
  bindWorkflowArmor(workflow);
  workflow.recordTargetACModifiers();
  assert.equal(workflow.targetACModifiers.get("defender"), 7);
  workflow.recordTargetACModifiers();
  assert.equal(workflow.targetACModifiers.get("defender"), 7);
  assert.equal(workflow.targetACModifiers.get("other"), 0);
});
test("ranged weapon range is never the reach of a guardian mark", () => {
  assert.equal(
    meleeReach({
      items: [
        {
          type: "weapon",
          system: {
            range: { value: 120, units: "ft" },
            activities: new Map([[1, { attack: { type: { value: "ranged" } } }]])
          }
        }
      ]
    }),
    5
  );
});
test("a shared remaining-hit pool is consumed once for a confirmed event", async () => {
  const e = effect({ kind: "direct-attack", remaining: 2, claims: [], reserved: "hit-1", reservedValue: 5 });
  assert.equal(await consumeBenefit(e, "hit-1"), true);
  assert.equal(await consumeBenefit(e, "hit-1"), false);
  assert.equal(e.getFlag(MODULE_ID, "combatBenefit").remaining, 1);
  assert.equal(e.getFlag(MODULE_ID, "combatBenefit").reserved, null);
  await consumeBenefit(e, "hit-2");
  assert.equal(e.disabled, true);
});
test("bonus damage recalculates traits from raw damage, never an already resisted packet", async () => {
  let raw;
  const actor = {
    system: { attributes: { hp: { value: 20, max: 20, temp: 0 } } },
    calculateDamage(parts) {
      raw = parts;
      return parts.map(part => ({ ...part, value: part.value / 2 }));
    }
  };
  const packet = {
    damageDetails: { rawcombinedDamage: [{ value: 10, type: "fire" }], combinedDamage: [{ value: 5, type: "fire" }] }
  };
  await appendCalculatedBonus({ actor }, packet, 4, "fire");
  assert.deepEqual(
    raw.map(part => part.value),
    [10, 4]
  );
  assert.equal(packet.totalDamage, 7);
  assert.equal(packet.newHP, 13);
});
