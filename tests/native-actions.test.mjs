import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { reactionAttack } from "../scripts/automation/shared/native-actions.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
let actor, source, target, calls, choice;
beforeEach(() => {
  const flags = {},
    users = [];
  users.activeGM = { id: "gm" };
  globalThis.game = { user: { id: "gm", isGM: true }, users, combats: [], time: { worldTime: 100 } };
  globalThis.foundry = {
    utils: { escapeHTML: String, randomID: () => "prompt" },
    applications: { api: { DialogV2: { wait: async () => "yes" } } }
  };
  calls = [];
  choice = "yes";
  actor = {
    uuid: "actor",
    statuses: new Set(),
    getFlag: (module, key) => flags[module]?.[key],
    async setFlag(module, key, value) {
      flags[module] ??= {};
      flags[module][key] = value;
    }
  };
  const data = {
    _id: "attack",
    type: "attack",
    attack: { bonus: "1" },
    damage: { includeBase: true, parts: [] },
    consumption: { targets: [{ type: "itemUses", target: "ammo", value: "1" }] }
  };
  const item = {
    type: "weapon",
    name: "Sword",
    actor,
    system: { damage: { base: { types: new Set(["slashing"]) } } },
    clone(patch) {
      const activity = Object.values(patch.system.activities)[0];
      return { system: { activities: new Map([[activity._id, activity]]) } };
    }
  };
  const activity = { uuid: "attack", item, type: "attack", toObject: () => structuredClone(data) };
  item.system.activities = new Map([["attack", activity]]);
  actor.items = [item];
  source = { uuid: "source", actor, parent: { id: "scene" } };
  target = { uuid: "target", parent: source.parent };
  globalThis.MidiQOL = {
    hasUsedReaction: () => false,
    async completeActivityUse(activity) {
      calls.push(activity);
      return { id: "roll" };
    }
  };
  foundry.applications.api.DialogV2.wait = async dialog =>
    dialog.content.includes('select name="choice"') && dialog.content.includes('value="attack"') ? "attack" : choice;
});
test("a declined reaction produces no native activation and no reaction expenditure", async () => {
  choice = "no";
  assert.equal(await reactionAttack(source, target), false);
  assert.equal(calls.length, 0);
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse"), undefined);
});
test("an includeBase weapon with no extra parts receives valid typed bonus damage and keeps ammunition", async () => {
  await reactionAttack(source, target, { attackBonus: 3, damageBonus: 4 });
  assert.equal(calls[0].damage.includeBase, true);
  assert.deepEqual(calls[0].damage.parts[0].types, ["slashing"]);
  assert.equal(calls[0].damage.parts[0].custom.formula, "4");
  assert.equal(calls[0].attack.bonus, "1 + 3");
  assert.equal(calls[0].consumption.targets[0].target, "ammo");
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse").used, 1);
});
