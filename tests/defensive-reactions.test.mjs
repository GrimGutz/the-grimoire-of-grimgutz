import assert from "node:assert/strict";
import { test } from "node:test";
import { guardianMarksPerTurn } from "../scripts/automation/classes/defensive-reactions.mjs";
import { canReact, recordModuleReaction } from "../scripts/automation/shared/combat-benefits.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";

test("mark-per-turn limits are distinct from the shorter special-attack resource table", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(guardianMarksPerTurn), [2, 3, 3, 4, 4]);
  assert.equal(guardianMarksPerTurn(0), 0);
});
test("module reactions are bounded even when Midi's reaction enforcement is disabled", async () => {
  const flags = {},
    actor = {
      statuses: new Set(),
      getFlag: (module, key) => flags[module]?.[key],
      async setFlag(module, key, value) {
        flags[module] ??= {};
        flags[module][key] = value;
      }
    };
  globalThis.game = { time: { worldTime: 100 }, combats: [] };
  globalThis.MidiQOL = { hasUsedReaction: () => false };
  assert.equal(canReact(actor), true);
  await recordModuleReaction(actor, null);
  assert.equal(canReact(actor), false);
  game.time.worldTime = 106;
  assert.equal(canReact(actor), true);
  assert.equal(flags[MODULE_ID].reactionUse.used, 1);
});
test("a larger native reaction maximum is respected without double-counting the same use", async () => {
  const flags = { "midi-qol": { actions: { reactionsMax: 2, reactionsUsed: 1 } } };
  const actor = {
    statuses: new Set(),
    getFlag: (module, key) => flags[module]?.[key],
    async setFlag(module, key, value) {
      flags[module] ??= {};
      flags[module][key] = value;
    }
  };
  globalThis.game = { time: { worldTime: 100 }, combats: [] };
  globalThis.MidiQOL = { hasUsedReaction: () => false };
  await recordModuleReaction(actor, null);
  assert.equal(flags[MODULE_ID].reactionUse.used, 1);
  assert.equal(canReact(actor), true);
});
