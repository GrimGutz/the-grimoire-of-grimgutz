import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTargetEffect } from "../scripts/automation/shared/target-effects.mjs";

test("explicit condition immunity prevents an automatic condition from being created", async () => {
  globalThis.game = { user: { id: "gm", isGM: true } };
  globalThis.ui = { notifications: { warn() {} } };
  let writes = 0;
  const actor = {
    name: "Immune",
    system: { traits: { ci: { value: new Set(["frightened"]) } } },
    async createEmbeddedDocuments() {
      writes++;
    }
  };
  const result = await applyTargetEffect({
    sourceActor: { uuid: "Actor.caster" },
    targets: [{ actor }],
    key: "fear",
    name: "Fear",
    status: "frightened"
  });
  assert.equal(result, false);
  assert.equal(writes, 0);
});
