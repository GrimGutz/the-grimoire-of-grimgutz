import assert from "node:assert/strict";
import { test } from "node:test";
import { processRepeatedSaves } from "../scripts/automation/effects/repeated-saves.mjs";
import { isForwardTurn } from "../scripts/automation/shared/combat-flow.mjs";

test("successful repeated saves remove the effect, failed saves retain it", async () => {
  const gm = { id: "gm" };
  globalThis.game = { user: gm, users: { activeGM: gm }, settings: { get: () => true } };
  let total = 9,
    removed = 0;
  const effect = {
    _source: { duration: { value: 60, units: "seconds" } },
    updateDuration: () => ({ remaining: 60 }),
    getFlag: () => ({ ability: "wis", dc: 12, event: "turnEnd" }),
    async delete() {
      removed++;
    }
  };
  const actor = {
    effects: [effect],
    async rollSavingThrow(config) {
      assert.equal(config.target, 12);
      return [{ total }];
    }
  };
  await processRepeatedSaves(actor);
  assert.equal(removed, 0);
  total = 15;
  await processRepeatedSaves(actor);
  assert.equal(removed, 1);
});
test("rewinding combat does not trigger turn-end automation", () => {
  assert.equal(
    isForwardTurn({ started: true, round: 2, turn: 0, previous: { round: 1, turn: 3 } }, { round: 2, turn: 0 }),
    true
  );
  assert.equal(
    isForwardTurn({ started: true, round: 1, turn: 3, previous: { round: 2, turn: 0 } }, { round: 1, turn: 3 }),
    false
  );
});
