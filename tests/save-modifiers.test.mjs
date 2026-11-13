import assert from "node:assert/strict";
import { test } from "node:test";
import { addSaveAdvantage } from "../scripts/automation/midi/save-modifiers.mjs";
test("native multi-choice snapshots receive hasAdvantage and preserve other abilities", () => {
  const keys = [],
    details = {
      rollAbilities: ["dex", "con"],
      advantageByChoice: {
        dex: { hasAdvantage: false, tracker: { advantage: { add: key => keys.push(key) } } },
        con: { hasAdvantage: false }
      }
    };
  addSaveAdvantage(details, "dodge", "Dodge", ["dex"]);
  assert.equal(details.advantageByChoice.dex.hasAdvantage, true);
  assert.equal(details.advantageByChoice.con.hasAdvantage, false);
  assert.equal(details.advantage, undefined);
  assert.deepEqual(keys, ["dodge"]);
});
test("one-ability saves use Midi's real modifierTracker", () => {
  let applied = 0;
  const details = {
    rollAbilities: ["dex"],
    modifierTracker: {
      advantage: {
        add() {
          applied++;
        }
      }
    }
  };
  addSaveAdvantage(details, "dodge", "Dodge", ["dex"]);
  assert.equal(details.advantage, true);
  assert.equal(applied, 1);
  const other = { rollAbilities: ["wis"] };
  addSaveAdvantage(other, "dodge", "Dodge", ["dex"]);
  assert.equal(other.advantage, undefined);
});
