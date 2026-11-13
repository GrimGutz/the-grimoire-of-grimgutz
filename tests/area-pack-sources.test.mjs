import assert from "node:assert/strict";
import { test } from "node:test";
import { documents as features } from "../src/packs/features.mjs";
import { documents as spells } from "../src/packs/spells.mjs";
import { MODULE_ID } from "../src/common.mjs";
import { AREA_DEFINITIONS } from "../scripts/automation/shared/area-definitions.mjs";

const all = [...features, ...spells];
function activities(document) {
  return Object.values(document.system.activities);
}

test("every configured AoE is authored as one native save activity with valid typed damage", () => {
  for (const spec of AREA_DEFINITIONS) {
    const document = all.find(doc => doc.system.identifier === spec.feature);
    assert.ok(document, spec.feature);
    const matches = activities(document).filter(activity => activity.flags?.[MODULE_ID]?.area?.id === spec.id);
    assert.equal(matches.length, 1, spec.id);
    const activity = matches[0];
    assert.equal(activity.type, "save", spec.id);
    assert.equal(activity.roll, undefined, spec.id);
    assert.deepEqual(activity.save.ability, [spec.save], spec.id);
    assert.equal(activity.target.template.type, spec.shape, spec.id);
    assert.equal(Number(activity.target.template.size), spec.size, spec.id);
    assert.equal(activity.damage.onSave, spec.onSave, spec.id);
    assert.deepEqual(
      activity.damage.parts.map(part => part.types),
      spec.damage.map(part => [part.type === "alignment" ? "radiant" : part.type]),
      spec.id
    );
    assert.deepEqual(activity.flags[MODULE_ID].automation.data.area, spec, spec.id);
  }
});

test("area conversion preserves unrelated seal activities and spell upcasting", () => {
  const seal = all.find(doc => doc.system.identifier === "witch-blade-seal");
  for (const activity of activities(seal).filter(activity => !activity.flags?.[MODULE_ID]?.area))
    assert.notEqual(activity.type, "save", activity.name);
  const bolt = all.find(doc => doc.system.identifier === "chaos-bolt-witch");
  const part = activities(bolt).find(activity => activity.flags?.[MODULE_ID]?.area).damage.parts[0];
  assert.deepEqual(part.scaling, { mode: "whole", number: 2, formula: "" });
});
