import assert from "node:assert/strict";
import {test} from "node:test";
import {MODULE_ID} from "../scripts/automation/shared/constants.mjs";
import {regenerationAmounts, regenerationUnavailable, regenerateJuggernaut, clearRegenerationTemporaryHp} from "../scripts/automation/classes/juggernaut-regeneration.mjs";
function actor(level = 1, hp = 10) {
  const flags = {juggernautFlaw: "troll"};
  const doc = {uuid: "Actor.juggernaut", items: [{type: "class", system: {identifier: "juggernaut", levels: level}}, {system: {identifier: "regenerating-soul"}}],
    system: {attributes: {hp: {value: hp, max: 100, temp: 0}, prof: 6}, abilities: {con: {mod: 4}}, traits: {di: {value: new Set()}}}, statuses: new Set(),
    getFlag: (_module, key) => flags[key], async update(patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (key.startsWith(`flags.${MODULE_ID}.-=`)) delete flags[key.split(".-=")[1]];
        else if (key.startsWith(`flags.${MODULE_ID}.`)) flags[key.slice(`flags.${MODULE_ID}.`.length)] = value;
        else if (key.startsWith("system.attributes.hp.")) doc.system.attributes.hp[key.split(".").at(-1)] = value;
      }
    }}; return doc;
}
test("regeneration caps healing at each level threshold and never heals at zero HP", () => {
  for (const [level, threshold] of [[1, 25], [2, 25], [3, 33], [4, 33], [5, 50]]) {
    assert.equal(regenerationAmounts(actor(level, threshold - 1)).healing, 1);
    assert.equal(regenerationAmounts(actor(level, threshold)).healing, 0);
    assert.equal(regenerationAmounts(actor(level, 0)).healing, 0);
  }
});
test("regeneration checks immunity, confirmed blockers and unknown environment without guessing", () => {
  const doc = actor(); assert.equal(regenerationUnavailable(doc), null);
  doc.system.traits.di.value.add("fire"); assert.ok(regenerationUnavailable(doc));
  doc.system.traits.di.value.clear(); doc.getFlag = () => "night";
  assert.ok(regenerationUnavailable(doc));
});
test("regeneration does not replace or remove stronger unrelated temporary HP", async () => {
  const doc = actor(); doc.system.attributes.hp.temp = 20;
  await regenerateJuggernaut(doc); assert.equal(doc.system.attributes.hp.temp, 20);
  doc.system.attributes.hp.value = 100; await clearRegenerationTemporaryHp(doc);
  assert.equal(doc.system.attributes.hp.temp, 20);
});
test("only owned temporary HP are removed when all missing HP are restored", async () => {
  const doc = actor(); await regenerateJuggernaut(doc); assert.equal(doc.system.attributes.hp.temp, 3);
  doc.system.attributes.hp.value = 100; await clearRegenerationTemporaryHp(doc);
  assert.equal(doc.system.attributes.hp.temp, 0);
});
