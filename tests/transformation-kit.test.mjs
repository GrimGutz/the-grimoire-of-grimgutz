import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { DATA_TRANSFORMATION_KITS } from "../scripts/automation/transformations/data-content.mjs";
import { dataTransformationDocuments, dataTransformationFeatureDocuments } from "../src/packs/data-transformations.mjs";

const kit = id => DATA_TRANSFORMATION_KITS.find(entry => entry.definition.id === id);
const card = key =>
  structuredClone(dataTransformationFeatureDocuments.find(document => document.system.identifier === key));

beforeEach(() => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
});

function actor({ items = [], abilities = {}, prof = 5, temp = 0, flags = {} } = {}) {
  const scores = { str: 10, dex: 10, con: 14, int: 16, wis: 16, cha: 10, ...abilities };
  const system = {
    abilities: Object.fromEntries(
      Object.entries(scores).map(([key, value]) => [key, { value, mod: Math.floor((value - 10) / 2) }])
    ),
    attributes: { prof, hp: { temp }, movement: { walk: 30 } },
    traits: { size: "med" }
  };
  const document = {
    uuid: "Actor.test",
    isOwner: true,
    items: items.map(item => ({ ...item, isSuppressed: false })),
    effects: [],
    system,
    _source: { system: structuredClone(system) },
    flags: { [MODULE_ID]: flags },
    getFlag: (scope, key) => key.split(".").reduce((value, part) => value?.[part], document.flags[scope]),
    async setFlag(scope, key, value) {
      const parts = key.split(".");
      let target = document.flags[scope];
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)] = value;
    },
    async unsetFlag(scope, key) {
      delete document.flags[scope][key];
    },
    async createEmbeddedDocuments(_type, data) {
      document.effects.push(...data.map(entry => ({ ...entry, getFlag: (scope, key) => entry.flags?.[scope]?.[key] })));
      return data;
    },
    async updateEmbeddedDocuments() {},
    async deleteEmbeddedDocuments() {}
  };
  return document;
}

test("each data transformation builds a root with tier grants 3/1/1/1 and boon choices 4/8/12", () => {
  assert.equal(dataTransformationDocuments.length, 5);
  for (const root of dataTransformationDocuments) {
    const grants = root.system.advancement.filter(entry => entry.type === "ItemGrant");
    const choices = root.system.advancement.filter(entry => entry.type === "ItemChoice");
    assert.deepEqual(
      grants.map(entry => entry.configuration.items.length),
      [3, 1, 1, 1],
      root.name
    );
    assert.deepEqual(
      choices.map(entry => entry.configuration.pool.length),
      [4, 8, 12],
      root.name
    );
  }
  assert.equal(dataTransformationFeatureDocuments.length, 90);
});

test("native activities read the transformation DC and tier from roll data", () => {
  const roar = Object.values(card("sphinx-roar").system.activities)[0];
  assert.equal(roar.type, "save");
  assert.equal(roar.save.dc.formula, "@flags.the-grimoire-of-grimgutz.tf.sphinx.dc");
  assert.deepEqual(roar.save.ability, ["wis"]);
  assert.equal(roar.consumption.targets[0].type, "itemUses");
  assert.deepEqual(card("sphinx-roar").effects[0].statuses, ["frightened", "paralyzed"]);
  assert.equal(card("sphinx-voice").system.uses.max, "@flags.the-grimoire-of-grimgutz.tf.sphinx.tier");
  const statics = Object.values(card("psyker-static").system.activities)[0];
  assert.equal(statics.damage.parts[0].custom.formula, "(@flags.the-grimoire-of-grimgutz.tf.psyker.tier)d8");
});

test("tier, DC and passives follow the owned boons", async () => {
  const sphinx = kit("sphinx");
  const owner = actor({
    items: ["sphinx-transformation", "sphinx-form", "sphinx-bond", "sphinx-eye", "sphinx-awareness"].map(card),
    abilities: { int: 20, wis: 18 }
  });
  owner.items.push({ ...card("sphinx-mandate"), isSuppressed: false });
  assert.equal(sphinx.level(owner), 2);
  assert.equal(sphinx.dc(owner), 8 + 5 + 2 + 5);
  const effects = sphinx.passiveDefinitions(owner);
  const changes = effects.flatMap(effect => effect.system?.changes ?? effect.changes);
  assert.ok(
    changes.some(change => change.key === "system.abilities.int.value" && change.value === "2"),
    "cap 22"
  );
  assert.ok(changes.some(change => change.key === "system.abilities.wis.value" && change.value === "3"));
  assert.ok(changes.some(change => change.key.endsWith("senses.ranges.truesight") && change.value === "120"));
  assert.ok(changes.some(change => change.key === "system.attributes.death.roll.mode"));
  await sphinx.sync(owner);
  assert.deepEqual(owner.flags[MODULE_ID].tf.sphinx, { tier: 2, dc: 20 });
});

test("a boon that requires another is unavailable without it and rejected in advancement", () => {
  const sphinx = kit("sphinx");
  const owner = actor({ items: ["sphinx-transformation", "sphinx-mastery"].map(card) });
  assert.equal(sphinx.has(owner, "mastery"), false);
  const manager = { actor: owner };
  assert.equal(sphinx.validateAdvancement(manager, 11, [card("sphinx-mastery")], [], []), false);
  const fresh = { actor: actor({ items: [card("sphinx-transformation")] }) };
  assert.equal(
    sphinx.validateAdvancement(fresh, 11, [card("sphinx-arcanum"), card("sphinx-mastery")], [], []),
    undefined
  );
});

test("psi points are paid before an activity and refused when short", async () => {
  const psyker = kit("psyker");
  const awakening = card("psyker-awakening");
  awakening.system.uses = { max: 10, spent: 6 };
  const updates = [];
  awakening.update = async data => {
    updates.push(data);
    awakening.system.uses.spent = data["system.uses.spent"];
  };
  const owner = actor({ items: [card("psyker-transformation"), awakening] });
  owner.items[1] = awakening;
  awakening.isSuppressed = false;
  const activities = Object.values(card("psyker-static").system.activities);
  const staticActivity = { ...activities[0], actor: owner, item: owner.items[1] };
  assert.equal(psyker.payPool(staticActivity), undefined, "4 of 4 points available");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(updates.at(-1), { "system.uses.spent": 10 });
  assert.equal(psyker.payPool(staticActivity), false, "no points left");
});

test("Destiny Points: gains are capped, consume-all empties the pool and reports it", async () => {
  const voidKit = kit("void");
  const owner = actor({ items: ["void-transformation", "void-glyphs"].map(card) });
  const messages = [];
  globalThis.ChatMessage = { create: async data => messages.push(data.content), getSpeaker: () => ({}) };
  const gain = Object.values(card("void-glyphs").system.activities).find(entry => entry.name.startsWith("Точка"));
  for (let index = 0; index < 5; index++) await voidKit.poolAction(owner, gain);
  assert.equal(voidKit.poolValue(owner), 3, "three without Manic Enlightenment");
  const zenith = Object.values(card("void-zenith").system.activities)[0];
  voidKit.payPool({ ...zenith, actor: owner, item: { name: "Зенит" } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(voidKit.poolValue(owner), 0);
  assert.match(messages.at(-1), /3/);
  assert.equal(voidKit.payPool({ ...zenith, actor: owner, item: {} }), false, "needs at least one point");
});

test("the Vendigo empowerment marker disappears with the temporary hit points", async () => {
  const vendigo = kit("vendigo");
  let deleted = 0;
  const marker = {
    getFlag: (_scope, key) => ({ transformationMarker: "empowered", transformation: "vendigo" })[key],
    delete: async () => deleted++
  };
  const owner = actor({ temp: 5 });
  owner.effects = [marker];
  await vendigo.clearMarkers(owner);
  assert.equal(deleted, 0);
  owner.system.attributes.hp.temp = 0;
  await vendigo.clearMarkers(owner);
  assert.equal(deleted, 1);
});
