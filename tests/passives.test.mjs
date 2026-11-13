import assert from "node:assert/strict";
import { test } from "node:test";
import {
  flaggedPassiveEffectData,
  guardPassiveChanges,
  syncFlaggedPassiveEffects
} from "../scripts/automation/effects/passive-helpers.mjs";

test("passive sync removes duplicate bonuses, updates origin and clears deleted features", async () => {
  const module = "module",
    flag = "passive";
  let feature = { name: "Speed", uuid: "Actor.one.Item.new", img: "icon" };
  const data = () =>
    flaggedPassiveEffectData(module, flag, {
      key: "speed",
      feature,
      changes: [{ key: "system.attributes.movement.walk", type: "add", value: "10" }]
    });
  const actor = {
    uuid: "Actor.one",
    effects: [],
    async createEmbeddedDocuments(type, entries) {
      this.effects.push(...entries.map((entry, i) => ({ ...entry, id: `effect${i}` })));
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.effects = this.effects.filter(effect => !ids.includes(effect.id));
    },
    async updateEmbeddedDocuments(type, entries) {
      for (const entry of entries)
        Object.assign(
          this.effects.find(effect => effect.id === entry._id),
          entry
        );
    }
  };
  const definitions = () => (feature ? [data()] : []);
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

test("native DataModel defaults do not cause passive update loops", async () => {
  let writes = 0;
  const native = data => ({
    ...structuredClone(data),
    system: { extraDefault: 0, ...data.system },
    id: "effect",
    getFlag(module, key) {
      return this.flags?.[module]?.[key];
    },
    toObject() {
      return { ...data, system: this.system };
    },
    clone(patch) {
      return native({ ...data, ...patch });
    }
  });
  const actor = {
    uuid: "Actor.native",
    effects: [],
    async createEmbeddedDocuments(type, data) {
      const docs = data.map(native);
      this.effects.push(...docs);
      return docs;
    },
    async updateEmbeddedDocuments() {
      writes++;
    }
  };
  const definition = () => [
    flaggedPassiveEffectData("module", "passive", { key: "speed", feature: { name: "Speed" }, changes: [] })
  ];
  const locks = new Set();
  await syncFlaggedPassiveEffects(actor, locks, "module", "passive", definition);
  await syncFlaggedPassiveEffects(actor, locks, "module", "passive", definition);
  assert.equal(writes, 0);
});

test("manual passive edits and deliberate disabling survive synchronization", () => {
  const original = flaggedPassiveEffectData("module", "passive", {
    key: "speed",
    feature: { name: "Speed" },
    changes: [{ key: "speed", type: "add", value: "10" }]
  });
  const current = guardPassiveChanges(null, original, "module");
  current.disabled = true;
  current.name = "My custom label";
  const higher = structuredClone(original);
  higher.system.changes[0].value = "20";
  assert.equal(guardPassiveChanges(current, higher, "module").disabled, true);
  assert.equal(guardPassiveChanges(current, higher, "module").name, "My custom label");
  current.system.changes[0].value = "15";
  assert.equal(guardPassiveChanges(current, higher, "module"), null);
});
