import assert from "node:assert/strict";
import { test } from "node:test";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../scripts/automation/effects/passive-helpers.mjs";

test("passive sync removes duplicate bonuses, updates origin and clears deleted features", async () => {
  const module = "module", flag = "passive";
  let feature = { name: "Speed", uuid: "Actor.one.Item.new", img: "icon" };
  const data = () => flaggedPassiveEffectData(module, flag, { key: "speed", feature,
    changes: [{ key: "system.attributes.movement.walk", type: "add", value: "10" }] });
  const actor = { uuid: "Actor.one", effects: [],
    async createEmbeddedDocuments(type, entries) { this.effects.push(...entries.map((entry, i) => ({ ...entry, id: `effect${i}` }))); },
    async deleteEmbeddedDocuments(type, ids) { this.effects = this.effects.filter(effect => !ids.includes(effect.id)); },
    async updateEmbeddedDocuments(type, entries) {
      for (const entry of entries) Object.assign(this.effects.find(effect => effect.id === entry._id), entry);
    }
  };
  const definitions = () => feature ? [data()] : [];
  const locks = new Set();
  await syncFlaggedPassiveEffects(actor, locks, module, flag, definitions);
  actor.effects.push({ ...structuredClone(actor.effects[0]), id: "duplicate" });
  actor.effects[0].origin = "Actor.one.Item.old";
  actor.effects[0].duration.expired = true;
  await syncFlaggedPassiveEffects(actor, locks, module, flag, definitions);
  assert.equal(actor.effects.length, 1);
  assert.equal(actor.effects[0].origin, feature.uuid);
  assert.equal(actor.effects[0].duration.expired, false);
  feature = null;
  await syncFlaggedPassiveEffects(actor, locks, module, flag, definitions);
  assert.equal(actor.effects.length, 0);
});
