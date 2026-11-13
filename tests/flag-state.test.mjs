import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { flagState } from "../scripts/automation/shared/flag-state.mjs";

// A document whose setFlag lands after a server round trip, like Foundry's.
function documentWith(value) {
  let stored = value;
  return {
    uuid: `Actor.${Math.random()}`,
    getFlag: (scope, key) => (scope === MODULE_ID && key === "testState" ? stored : undefined),
    setFlag: async (_scope, _key, next) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      stored = structuredClone(next);
    },
    get stored() {
      return stored;
    }
  };
}

test("concurrent function patches see each other's results", async () => {
  const { patch } = flagState("testState", "test-state");
  const document = documentWith({ fusion: 0 });
  await Promise.all(
    Array.from({ length: 5 }, () =>
      patch(document, state => {
        state.fusion += 2;
      })
    )
  );
  assert.equal(document.stored.fusion, 10);
});

test("an object patch merges into the latest state instead of a stale copy", async () => {
  const { read, patch } = flagState("testState", "test-state");
  const document = documentWith({ accepted: ["a"], suppressed: [] });
  const beforeDialog = structuredClone(read(document));
  await patch(document, { suppressed: ["a"] });
  // A slow flow that cloned state before a dialog would have dropped `suppressed`.
  await patch(document, latest => ({ ...latest, accepted: [...beforeDialog.accepted, "b"] }));
  assert.deepEqual(document.stored, { accepted: ["a", "b"], suppressed: ["a"] });
});

test("read falls back to the default and patch resolves to the stored state", async () => {
  const { read, patch } = flagState("testState", "test-state", () => ({ known: [] }));
  const document = documentWith(undefined);
  assert.deepEqual(read(document), { known: [] });
  assert.deepEqual(await patch(document, { known: ["fear"] }), { known: ["fear"] });
});
