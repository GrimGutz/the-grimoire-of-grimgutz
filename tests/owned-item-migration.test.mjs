import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { migrateOwnedItems } from "../scripts/automation/runtime.mjs";
import { ownedItemMigrationPlan } from "../scripts/automation/shared/owned-item-migration.mjs";

test("legacy edited descriptions and activities are not silently replaced", async () => {
  const original = {
    name: "Feature",
    type: "feat",
    system: {
      identifier: "feature",
      description: { value: "Source rules" },
      activities: { source: { flags: { [MODULE_ID]: { action: "take-root" } } } }
    },
    flags: { [MODULE_ID]: { feature: "feature" } },
    effects: []
  };
  const source = { ...original, toObject: () => structuredClone(original) };
  globalThis.game = {
    user: { id: "gm" },
    users: { activeGM: { id: "gm" } },
    packs: new Map([[`${MODULE_ID}.features`, { getDocuments: async () => [source] }]])
  };
  const item = {
    ...structuredClone(original),
    id: "item",
    _stats: { compendiumSource: `Compendium.${MODULE_ID}.features.Item.item` }
  };
  item.system.description.value = "My campaign rule";
  item.system.activities = { manual: { name: "Custom attack", type: "attack" } };
  const updates = [];
  await migrateOwnedItems({
    uuid: "Actor.owner",
    name: "owner",
    isOwner: true,
    items: [item],
    async updateEmbeddedDocuments(type, data) {
      updates.push(...data);
    }
  });
  assert.ok(updates.every(update => !Object.keys(update).some(key => key.startsWith("system."))));
});

test("advancement changes require review and never erase existing choices", () => {
  const item = {
    id: "one",
    flags: {},
    system: {
      advancement: [
        {
          _id: "grant",
          type: "ItemChoice",
          configuration: { allowDrops: true },
          value: { added: { 6: "Chosen.Item.uuid" } }
        }
      ]
    }
  };
  const source = structuredClone(item);
  source.system.advancement[0].value = { added: {} };
  assert.equal(ownedItemMigrationPlan(item, source).conflicts.length, 0);
  source.system.advancement[0].configuration.allowDrops = false;
  const plan = ownedItemMigrationPlan(item, source);
  assert.deepEqual(plan.conflicts, [{ field: "system.advancement", reason: "advancement-requires-review" }]);
  assert.equal(plan.update?.["system.advancement"], undefined);
  assert.equal(item.system.advancement[0].value.added[6], "Chosen.Item.uuid");
});

test("only unchanged snapshotted fields receive future rules updates", () => {
  const item = { id: "one", flags: {}, system: { description: { value: "Original" }, activities: {} }, effects: [] };
  const source = structuredClone(item);
  const initial = ownedItemMigrationPlan(item, source);
  item.flags[MODULE_ID] = { managedItemFields: initial.update[`flags.${MODULE_ID}.managedItemFields`] };
  source.system.description.value = "Corrected rules";
  const planned = ownedItemMigrationPlan(item, source);
  assert.equal(planned.update["system.description"].value, "Corrected rules");
  item.system.description.value = "House rules";
  const manual = ownedItemMigrationPlan(item, source);
  assert.equal(manual.update?.["system.description"], undefined);
  assert.deepEqual(manual.conflicts, [{ field: "system.description", reason: "manual-edit" }]);
});
