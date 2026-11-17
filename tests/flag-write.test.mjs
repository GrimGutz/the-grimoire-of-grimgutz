import assert from "node:assert/strict";
import { test } from "node:test";
import { flagKey, newestEntries, replaceFlag } from "../scripts/automation/shared/flag-write.mjs";
import { flagState } from "../scripts/automation/shared/flag-state.mjs";

test("uuid map keys survive dot-notation expansion and stay distinct", () => {
  const keys = ["Scene.a.Token.b", "Scene%2Ea", "wf:Scene.a.Token.b:combinedDamage"].map(flagKey);
  for (const key of keys) assert.ok(!key.includes("."), key);
  assert.equal(new Set(keys).size, 3);
  assert.equal(decodeURIComponent(flagKey("Scene.a.Token.b")), "Scene.a.Token.b");
});

test("replaceFlag replaces the whole stored value through Foundry's ForcedReplacement", async () => {
  const updates = [];
  globalThis.foundry = {
    data: { operators: { ForcedReplacement: { create: value => ({ forced: value }) } } }
  };
  try {
    await replaceFlag({ update: async data => updates.push(data) }, "claims", { b: 1 });
    assert.deepEqual(updates, [{ "flags.the-grimoire-of-grimgutz.claims": { forced: { b: 1 } } }]);
  } finally {
    delete globalThis.foundry;
  }
});

test("pruned keys leave flag state instead of being merged back", async () => {
  // A Foundry-like document: setFlag/update merge objects; ForcedReplacement replaces.
  const Forced = class {
    constructor(value) {
      this.value = value;
    }
  };
  globalThis.foundry = { data: { operators: { ForcedReplacement: { create: value => new Forced(value) } } } };
  const stored = { claims: { old: 1, kept: 2 } };
  const document = {
    uuid: "Actor.a",
    getFlag: (_scope, key) => structuredClone(stored[key]),
    async setFlag(_scope, key, value) {
      stored[key] = { ...stored[key], ...value };
    },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const key = path.split(".").at(-1);
        stored[key] = value instanceof Forced ? value.value : { ...stored[key], ...value };
      }
    }
  };
  try {
    const claims = flagState("claims");
    await claims.patch(document, state => newestEntries(state, 1));
    assert.deepEqual(stored.claims, { kept: 2 });
  } finally {
    delete globalThis.foundry;
  }
});
