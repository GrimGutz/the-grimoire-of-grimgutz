import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { migrateOwnedItems } from "../scripts/automation/runtime.mjs";
import { migrationFingerprint } from "../scripts/automation/shared/owned-item-migration.mjs";

// One advancement fires createItem once per granted item, so migrateOwnedItems
// is invoked several times at once for the same actor. Each run must see the
// previous run's result instead of re-planning the same effect creation.
test("concurrent owned-item migrations of one actor create a new compendium effect once", async () => {
  const effect = { _id: "fx0000000000000", name: "Rule effect", system: { changes: [] } };
  const base = {
    name: "Feature",
    type: "feat",
    system: { identifier: "serial-feature", description: { value: "Rules" }, activities: {} },
    flags: { [MODULE_ID]: { feature: "serial-feature" } }
  };
  const source = { ...structuredClone(base), effects: [effect] };
  globalThis.game = {
    user: { id: "gm" },
    users: { activeGM: { id: "gm" } },
    packs: new Map([[`${MODULE_ID}.features`, { getDocuments: async () => [source] }]])
  };

  const effects = [];
  effects.get = id => effects.find(entry => entry._id === id);
  const item = {
    ...structuredClone(base),
    id: "item",
    effects,
    _stats: { compendiumSource: `Compendium.${MODULE_ID}.features.Item.item` }
  };
  item.flags[MODULE_ID].managedItemFields = { effects: migrationFingerprint([]) };
  let creates = 0;
  item.createEmbeddedDocuments = async (_type, data) => {
    creates++;
    await new Promise(resolve => setTimeout(resolve, 0));
    effects.push(...structuredClone(data));
  };
  item.updateEmbeddedDocuments = async () => {};
  item.deleteEmbeddedDocuments = async () => {};
  const actor = {
    uuid: "Actor.serial",
    name: "serial",
    isOwner: true,
    items: [item],
    async updateEmbeddedDocuments(_type, updates) {
      await new Promise(resolve => setTimeout(resolve, 0)); // server round trip
      for (const update of updates) {
        const snapshot = update[`flags.${MODULE_ID}.managedItemFields`];
        if (snapshot) item.flags[MODULE_ID].managedItemFields = snapshot;
      }
    }
  };

  await Promise.all([migrateOwnedItems(actor), migrateOwnedItems(actor), migrateOwnedItems(actor)]);
  assert.equal(creates, 1);
  assert.equal(effects.length, 1);
});
