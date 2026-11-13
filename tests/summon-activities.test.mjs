import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { summonActivities, summonActivitySignature } from "../scripts/automation/shared/summon-activities.mjs";
import { summonConcentrationActivity } from "../scripts/automation/shared/summon-lifecycle.mjs";
import { automationData } from "../scripts/automation/shared/helpers.mjs";
import { validateSummonActivityUse } from "../scripts/automation/shared/summon-combat.mjs";

test("summon abilities generate native attack, heal and protection activities", () => {
  let id = 0;
  globalThis.foundry = { utils: { randomID: () => `${++id}`.padStart(16, "0") } };
  const activities = Object.values(
    summonActivities([
      { name: "Attack", attackBonus: 5, formula: "1d8 + 3", damageType: "slashing" },
      { name: "Heal", type: "heal", formula: "2d6", selfCost: { value: 14, type: "force" } },
      { name: "Protection", type: "utility", activation: "reaction", action: "summon-spirit-protection" }
    ])
  );
  assert.equal(activities[0].attack.bonus, "5");
  assert.equal(activities[0].damage.parts[0].custom.formula, "1d8 + 3");
  assert.equal(activities[1].healing.custom.formula, "2d6");
  assert.equal(automationData(activities[1]).summonSelfCost.value, 14);
  assert.equal(activities[2].activation.type, "reaction");
  assert.equal(activities[2].flags[MODULE_ID].action, "summon-spirit-protection");
});

test("life spirit healing rejects empty targets, constructs and undead", () => {
  globalThis.game = { settings: { get: () => true }, user: { targets: new Set() } };
  globalThis.canvas = { ready: false };
  globalThis.ui = { notifications: { warn() {} } };
  const [activity] = Object.values(
    summonActivities([
      {
        name: "Heal",
        type: "heal",
        range: 30,
        selfCost: { value: 14, type: "force", excludeTypes: ["undead", "construct"] }
      }
    ])
  );
  assert.equal(validateSummonActivityUse(activity), false);
  for (const type of ["undead", "construct", "humanoid"]) {
    game.user.targets = new Set([{ actor: { system: { details: { type: { value: type } } } } }]);
    assert.equal(validateSummonActivityUse(activity), type === "humanoid");
  }
});
test("manual critical thresholds make the generated activity snapshot differ", () => {
  globalThis.foundry = { utils: { randomID: () => "0000000000000001" } };
  const original = summonActivities([{ name: "Attack", formula: "1d6" }]);
  const modified = structuredClone(original);
  Object.values(modified)[0].attack.critical = { threshold: 17 };
  assert.notEqual(summonActivitySignature(original), summonActivitySignature(modified));
});
test("native concentration receives a concentration-enabled clone, not a modified item", () => {
  const activity = {
    duration: { concentration: false },
    item: { isEmbedded: true },
    clone(data) {
      return { ...this, duration: data.duration };
    }
  };
  const concentrating = summonConcentrationActivity(activity);
  assert.equal(concentrating.duration.concentration, true);
  assert.equal(activity.duration.concentration, false);
});
