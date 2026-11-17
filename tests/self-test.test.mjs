import assert from "node:assert/strict";
import { test } from "node:test";
import { registerQuenchBatch, runSelfTest } from "../scripts/automation/self-test.mjs";

test("the in-world self-test refuses to run without a GM", async () => {
  globalThis.game = { user: { isGM: false } };
  await assert.rejects(runSelfTest(), /needs a GM/);
});

test("the self-test registers one Quench batch", () => {
  const batches = [];
  registerQuenchBatch({ registerBatch: (key, body, options) => batches.push([key, options.displayName]) }, () => ({}));
  assert.deepEqual(batches, [["the-grimoire-of-grimgutz.self-test", "Grimoire of GrimGutz: self-test"]]);
});
