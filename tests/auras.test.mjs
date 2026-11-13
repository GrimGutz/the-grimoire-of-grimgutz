import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { syncSceneAuras } from "../scripts/automation/shared/auras.mjs";

let sequence = 0;
let automationEnabled;
function document(data) {
  return {
    ...structuredClone(data),
    id: data.id ?? `doc${++sequence}`,
    getFlag(module, key) {
      return this.flags?.[module]?.[key];
    },
    toObject() {
      return Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== "function"));
    }
  };
}

function actor(id, features = []) {
  return {
    uuid: `Actor.${id}`,
    name: id,
    isOwner: true,
    effects: [],
    items: features,
    system: { details: { type: { value: "undead" } } },
    async createEmbeddedDocuments(type, data) {
      this.effects.push(...data.map(document));
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const update of updates)
        Object.assign(
          this.effects.find(effect => effect.id === update._id),
          update
        );
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.effects = this.effects.filter(effect => !ids.includes(effect.id));
    }
  };
}

function token(actor, id, x = 0) {
  return { actor, center: { x, y: 0 }, document: { uuid: `Scene.one.Token.${id}`, disposition: 1, hidden: false } };
}

beforeEach(() => {
  automationEnabled = true;
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => automationEnabled },
    time: { worldTime: 120 },
    actors: [],
    scenes: []
  };
  const scene = {
    id: "one",
    templates: [],
    tokens: [],
    grid: { distance: 5, size: 100, units: "ft", type: 1 },
    async createEmbeddedDocuments(type, data) {
      this.templates.push(...data.map(document));
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const update of updates)
        Object.assign(
          this.templates.find(template => template.id === update._id),
          update
        );
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.templates = this.templates.filter(template => !ids.includes(template.id));
    }
  };
  game.scenes = [scene];
  globalThis.canvas = { ready: true, scene, tokens: { placeables: [] }, dimensions: { size: 100 } };
});

function battleAura() {
  const feature = {
    name: "Боевая нежить",
    uuid: "Actor.source.Item.aura",
    flags: { [MODULE_ID]: { feature: "battle-undead" } }
  };
  const source = actor("source", [feature]);
  const target = actor("target");
  game.actors = [source, target];
  canvas.tokens.placeables = [token(source, "source"), token(target, "target", 100)];
  canvas.scene.tokens = canvas.tokens.placeables.map(t => ({ actor: t.actor }));
  return { source, target };
}

test("turning automation off removes aura effects and indicators", async () => {
  const { target } = battleAura();
  await syncSceneAuras();
  assert.equal(target.effects.length, 1);
  assert.equal(canvas.scene.templates.length, 1);
  automationEnabled = false;
  await syncSceneAuras();
  assert.equal(target.effects.length, 0);
  assert.equal(canvas.scene.templates.length, 0);
});

test("effects are removed even if their linked target leaves the scene", async () => {
  const { target } = battleAura();
  await syncSceneAuras();
  canvas.tokens.placeables = canvas.tokens.placeables.filter(t => t.actor !== target);
  canvas.scene.tokens = canvas.scene.tokens.filter(t => t.actor !== target);
  await syncSceneAuras();
  assert.equal(target.effects.length, 0);
});

test("repeated and overlapping sync calls do not duplicate effects or templates", async () => {
  const { target } = battleAura();
  await Promise.all([syncSceneAuras(), syncSceneAuras(), syncSceneAuras()]);
  assert.equal(target.effects.length, 1);
  assert.equal(canvas.scene.templates.length, 1);
  target.effects.push(document(target.effects[0].toObject()));
  target.effects[1].id = "duplicateEffect";
  canvas.scene.templates.push(document(canvas.scene.templates[0].toObject()));
  canvas.scene.templates[1].id = "duplicateTemplate";
  await syncSceneAuras();
  assert.equal(target.effects.length, 1);
  assert.equal(canvas.scene.templates.length, 1);
});

test("expired fiend aura loses its indicator and reapplication restores it", async () => {
  const source = actor("fiend");
  const flame = document({
    flags: { [MODULE_ID]: { [FLAGS.SPIRIT_VESSEL_FIEND_FLAMES_EFFECT]: true } },
    _source: { duration: { value: 60, units: "seconds", expired: false } }
  });
  flame.updateDuration = () => ({ remaining: -60, secondsRemaining: -60 });
  source.effects = [flame];
  game.actors = [source];
  canvas.tokens.placeables = [token(source, "fiend")];
  canvas.scene.tokens = [{ actor: source }];
  await syncSceneAuras();
  assert.equal(canvas.scene.templates.length, 0);
  flame.updateDuration = () => ({ remaining: 60, secondsRemaining: 60 });
  await syncSceneAuras();
  assert.equal(canvas.scene.templates.length, 1);
  source.effects = [];
  await syncSceneAuras();
  assert.equal(canvas.scene.templates.length, 0);
});

test("hidden sources keep applying the aura but their indicator is hidden", async () => {
  const { target } = battleAura();
  canvas.tokens.placeables[0].document.hidden = true;
  await syncSceneAuras();
  assert.equal(target.effects.length, 1);
  assert.equal(canvas.scene.templates[0].hidden, true);
});

test("opening another scene does not remove effects belonging to the previous scene", async () => {
  const { target } = battleAura();
  await syncSceneAuras();
  const original = target.effects[0].id;
  const other = { ...canvas.scene, id: "other", templates: [], tokens: [] };
  game.scenes.push(other);
  canvas.scene = other;
  canvas.tokens.placeables = [];
  await syncSceneAuras();
  assert.ok(target.effects.some(effect => effect.id === original));
});

test("overlapping masking auras grant only the strongest ally save bonus", async () => {
  const feature = { name: "Аура маскировки", flags: { [MODULE_ID]: { feature: "masking-aura" } } };
  const first = actor("hollow-one", [feature]),
    second = actor("hollow-two", [feature]),
    ally = actor("ally");
  for (const [source, modifier] of [
    [first, 2],
    [second, 3]
  ]) {
    source.system.abilities = { con: { mod: modifier } };
    source.effects = [document({ flags: { [MODULE_ID]: { [FLAGS.HOLLOW_PASSIVE]: "masking-aura" } } })];
  }
  game.actors = [first, second, ally];
  canvas.tokens.placeables = [token(first, "hollow-one"), token(second, "hollow-two", 100), token(ally, "ally", 200)];
  canvas.scene.tokens = canvas.tokens.placeables.map(t => ({ actor: t.actor }));
  await syncSceneAuras();
  const bonuses = ally.effects.filter(effect => effect.getFlag(MODULE_ID, FLAGS.AURA_EFFECT) === "hollow-masking-aura");
  assert.equal(bonuses.length, 1);
  assert.equal(bonuses[0].system.changes[0].value, "3");
  canvas.tokens.placeables[1].center.x = 1000;
  await syncSceneAuras();
  const remaining = ally.effects.filter(
    effect => effect.getFlag(MODULE_ID, FLAGS.AURA_EFFECT) === "hollow-masking-aura"
  );
  assert.equal(remaining[0].system.changes[0].value, "2");
});
