import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { syncSceneAuras } from "../scripts/automation/shared/auras.mjs";
import { auraIndicatorData } from "../scripts/automation/shared/aura-templates.mjs";

let scene, calls, serial = 0;
function doc(data) {
  return { ...structuredClone(data), id: data._id ?? `region${++serial}`, getFlag(module, key) { return this.flags?.[module]?.[key]; },
    toObject() { return Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== "function")); } };
}
function actor(id, key, flags = {}) {
  return { uuid: `Actor.${id}`, isOwner: true, items: key ? [{ uuid: `Actor.${id}.Item.feature`, flags: { [MODULE_ID]: { feature: key } } }] : [],
    effects: [], statuses: new Set(), flags: { [MODULE_ID]: flags }, system: { details: { type: { value: "humanoid" } }, abilities: { cha: { mod: 6 } } },
    async createEmbeddedDocuments(type, data) { this.effects.push(...data.map(doc)); },
    async updateEmbeddedDocuments(type, data) { for (const update of data) Object.assign(this.effects.find(doc => doc.id === update._id), update); },
    async deleteEmbeddedDocuments(type, ids) { this.effects = this.effects.filter(doc => !ids.includes(doc.id)); } };
}
function token(actor, id, x, disposition = 1, width = 1) {
  return { id, actor, center: { x: x + 50 * width, y: 50 }, document: { id, uuid: `Scene.${scene.id}.Token.${id}`,
    x, y: 0, width, height: 1, elevation: 0, disposition, hidden: false } };
}
beforeEach(() => {
  calls = [];
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, settings: { get: () => true },
    modules: new Map([["midi-qol", { active: true }]]), actors: [], scenes: [], time: { worldTime: 120 } };
  scene = { id: `native${++serial}`, regions: [], tokens: [], grid: { distance: 5, size: 100, units: "ft", type: 1 },
    async createEmbeddedDocuments(type, data) { assert.equal(type, "Region"); calls.push(["create", data.length]);
      this.regions.push(...data.map(data => ({ ...doc(data), uuid: `Scene.${this.id}.Region.${++serial}`,
        shapes: data.shapes.map(shape => ({ ...shape, hole: false, rotation: 0 })) }))); },
    async updateEmbeddedDocuments(type, updates) { assert.equal(type, "Region"); calls.push(["update", updates.length]);
      for (const update of updates) Object.assign(this.regions.find(region => region.id === update._id), update); },
    async deleteEmbeddedDocuments(type, ids) { assert.equal(type, "Region"); calls.push(["delete", ids.length]); this.regions = this.regions.filter(region => !ids.includes(region.id)); } };
  game.scenes = [scene]; globalThis.canvas = { ready: true, scene, tokens: { placeables: [] } };
  globalThis.MidiQOL = { computeTargetsFromTemplates(refs) {
    assert.equal(typeof refs[0], "string");
    const region = scene.regions.find(region => region.uuid === refs[0]); assert.ok(region);
    return canvas.tokens.placeables.filter(token => region.shapes.some(shape => Math.hypot(token.center.x - shape.x, token.center.y - shape.y) <= shape.radius));
  } };
});
function populate(...tokens) { canvas.tokens.placeables = tokens; scene.tokens = tokens.map(token => ({ ...token.document, actor: token.actor })); game.actors = tokens.map(token => token.actor); }

test("native Region is attached, follows its source and removes debuffs on exit without duplicates", async () => {
  const source = actor("source", "aura-of-carnage", { carnageAuraDamageType: "slashing" }), target = actor("target");
  const a = token(source, "source", 0), b = token(target, "target", 200, -1); populate(a, b);
  await syncSceneAuras();
  assert.equal(scene.regions.length, 1); assert.equal(scene.regions[0].attachment.token, "source");
  assert.equal(scene.regions[0].locked, true); assert.equal(scene.regions[0].shapes[0].gridBased, true);
  assert.equal(source.effects.length, 1); assert.equal(target.effects[0].system.changes[0].value, "slashing"); // "Any creature" includes the owner.
  calls.length = 0; await syncSceneAuras(); assert.deepEqual(calls, []); // Native defaults do not cause update loops.
  a.document.x = 1000; a.center.x = 1050; await syncSceneAuras();
  assert.equal(scene.regions.length, 1); assert.equal(scene.regions[0].shapes[0].x, 1050); assert.equal(target.effects.length, 0);
  a.document.x = 0; a.center.x = 50; await syncSceneAuras(); assert.equal(target.effects.length, 1);
});

test("carnage stops for unconscious sources, not for a conscious stunned source", async () => {
  const source = actor("source", "aura-of-carnage", { carnageAuraDamageType: "piercing" }), target = actor("target");
  populate(token(source, "source", 0), token(target, "target", 100));
  source.statuses.add("stunned"); await syncSceneAuras(); assert.equal(target.effects.length, 1);
  source.statuses.add("unconscious"); await syncSceneAuras(); assert.equal(target.effects.length, 0); assert.equal(scene.regions.length, 0);
});

test("enlightenment grants checks to friends only, and hidden source does not reveal its Region", async () => {
  const source = actor("gutz", "аура-просвещения-1"), ally = actor("ally"), enemy = actor("enemy");
  const own = token(source, "gutz", 0); own.document.hidden = true;
  populate(own, token(ally, "ally", 100), token(enemy, "enemy", 100, -1)); await syncSceneAuras();
  assert.equal(ally.effects[0].system.changes[0].key, "system.bonuses.abilities.check");
  assert.equal(ally.effects[0].system.changes[0].value, "6"); assert.equal(enemy.effects.length, 0);
  assert.equal(scene.regions[0].hidden, true); assert.equal(ally.effects[0].flags[MODULE_ID][FLAGS.AURA_SOURCE], own.document.uuid);
});

test("large-token emanation includes each occupied space and uses metric scene units", () => {
  scene.grid.units = "m"; scene.grid.distance = 1.524;
  const source = token(actor("large"), "large", 0, 1, 2);
  const data = auraIndicatorData({ id: "test", name: "Aura", radius: 5 }, source, scene);
  assert.equal(data.shapes.length, 2); assert.ok(data.shapes.every(shape => Math.abs(shape.radius - 100) < 0.001));
  assert.deepEqual(data.shapes.map(shape => shape.x), [50, 150]); assert.equal(data.attachment.token, "large");
});
