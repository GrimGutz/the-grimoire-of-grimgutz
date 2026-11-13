import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableSpellSlots,
  slotSelection,
  requiresHigherSlot,
  canSpendHollowCharges
} from "../scripts/automation/transformations/hollow-combat.mjs";
test("spellburn includes pact slots at their real level, but not empty or cantrip pools", () => {
  const slots = availableSpellSlots({
    system: {
      spells: { spell1: { value: 2 }, spell0: { value: 10 }, spell3: { value: 0 }, pact: { value: 1, level: 4 } }
    }
  });
  assert.deepEqual(
    slots.map(slot => slot.level),
    [1, 1, 4]
  );
  assert.deepEqual(
    slotSelection(
      slots,
      slots.map(slot => slot.id),
      6
    ),
    { spell1: 2, pact: 1 }
  );
  assert.equal(slotSelection(slots, ["pact:0"], 3), null);
  assert.equal(slotSelection(slots, ["spell1:0", "spell1:0"], 2), null);
  assert.equal(slotSelection(slots, ["missing"], 2), null);
});
test("weakening requires an actual higher cast level, not merely a slot of the same level", () => {
  assert.equal(requiresHigherSlot(3, 3), true);
  assert.equal(requiresHigherSlot(3, 4), false);
  assert.equal(requiresHigherSlot(0, 0), true);
  assert.equal(requiresHigherSlot(2, NaN), false);
});
test("hollow spending rejects invalid costs and empty reserves", () => {
  const feature = { system: { identifier: "magic-eradicator", uses: { value: 5, max: 10, spent: 5 } } };
  const actor = { items: [feature] };
  assert.equal(canSpendHollowCharges(actor, 6), false);
  assert.equal(canSpendHollowCharges(actor, -1), false);
  assert.equal(canSpendHollowCharges(actor, 0), true);
});
