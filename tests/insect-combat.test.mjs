import assert from "node:assert/strict";
import { test } from "node:test";
import { insectLordDocuments } from "../src/packs/insect-lord-features.mjs";
import { drainLinkActive, bloodDrainHealing } from "../scripts/automation/classes/insect-combat.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
test("bite and drain are native typed activities, not extra chat-only damage macros", () => {
  const card = insectLordDocuments.find(item => item.system.identifier === "blood-drain"),
    activities = Object.values(card.system.activities);
  const bite = activities.find(activity => activity.flags[MODULE_ID].insectBite),
    drain = activities.find(activity => activity.flags[MODULE_ID].bloodDrain);
  assert.equal(bite.type, "attack");
  assert.equal(bite.attack.type.value, "melee");
  assert.equal(drain.type, "damage");
  assert.equal(bite.roll, undefined);
  assert.equal(drain.roll, undefined);
  assert.equal(bite.flags[MODULE_ID].action, "");
});
test("draining requires the same scene, a live capable source, valid consent and five-foot reach", () => {
  globalThis.game = {};
  globalThis.canvas = {};
  const scene = { id: "one", grid: { size: 100, distance: 5, type: 1 } };
  const actor = () => ({
    type: "character",
    effects: [],
    statuses: new Set(),
    system: { attributes: { hp: { value: 10 } } },
    getFlag: () => false
  });
  const source = { uuid: "source", x: 0, y: 0, width: 1, height: 1, actor: actor(), parent: scene };
  const target = { uuid: "target", x: 100, y: 0, width: 1, height: 1, actor: actor(), parent: scene };
  const link = { targetTokenUuid: target.uuid, willing: true };
  assert.equal(drainLinkActive(source, target, link), true);
  target.x = 300;
  assert.equal(drainLinkActive(source, target, link), false);
  target.x = 100;
  source.actor.statuses.add("unconscious");
  assert.equal(drainLinkActive(source, target, link), false);
  source.actor.statuses.clear();
  link.willing = false;
  assert.equal(drainLinkActive(source, target, link), false);
  target.actor.statuses.add("unconscious");
  assert.equal(drainLinkActive(source, target, link), true);
});
test("healing is half confirmed damage, rounded down, never a pre-resistance recommendation", () => {
  assert.equal(bloodDrainHealing(11), 5);
  assert.equal(bloodDrainHealing(5), 2);
  assert.equal(bloodDrainHealing(0), 0);
});
