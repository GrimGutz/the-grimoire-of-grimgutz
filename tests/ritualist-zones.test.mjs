import assert from "node:assert/strict";
import {test} from "node:test";
import {protectiveZoneChanges, protectiveZoneContains, syncProtectiveZones} from "../scripts/automation/classes/ritualist-zones.mjs";
import {MODULE_ID} from "../scripts/automation/shared/constants.mjs";
test("protective ritual immunities are not granted to enemies, and slowing does not grant new movement modes", () => {
  const actor = {system: {attributes: {movement: {walk: 30, fly: 0}}}};
  assert.deepEqual(protectiveZoneChanges(true, actor).map(c => c.value), ["frightened", "charmed"]);
  assert.deepEqual(protectiveZoneChanges(false, actor).map(c => [c.key, c.value, c.type]), [["system.attributes.movement.walk", "0.5", "multiply"]]);
});
test("overlapping protective circles slow only once, and leaving removes only their owned effect", async () => {
  const scene = {id: "one", grid: {size: 100, distance: 5}, tokens: [], regions: []};
  const actor = {uuid: "Actor.enemy", effects: [], system: {attributes: {movement: {walk: 30}}},
    async createEmbeddedDocuments(_type, rows) {for (const data of rows) {
      const effect = {...data, getFlag: (m, key) => data.flags[m]?.[key], async delete() {actor.effects = actor.effects.filter(e => e !== effect);}};
      actor.effects.push(effect);
    }}};
  const enemy = {actor, disposition: -1, x: 0, y: 0, width: 1, height: 1}; scene.tokens = [enemy];
  scene.regions = ["a", "b"].map(id => ({uuid: `Scene.one.Region.${id}`, shapes: [{type: "circle", x: 50, y: 50, radius: 600}],
    flags: {[MODULE_ID]: {protectiveZone: {sourceTokenUuid: "source", itemUuid: "item"}, zoneExpiresAt: 600}}}));
  globalThis.game = {settings: {get: () => true}, user: {isGM: true}, time: {worldTime: 0}, actors: [actor]};
  globalThis.canvas = {}; globalThis.fromUuid = async () => ({disposition: 1});
  await syncProtectiveZones(scene); await syncProtectiveZones(scene); assert.equal(actor.effects.length, 1);
  actor.effects.push({name: "Manual", getFlag: () => null}); enemy.x = 2000;
  await syncProtectiveZones(scene); assert.deepEqual(actor.effects.map(e => e.name), ["Manual"]);
});
test("protective ritual uses occupied spaces of large tokens and fixed Region geometry", () => {
  globalThis.game = {}; globalThis.canvas = {};
  const scene = {grid: {size: 100, distance: 5}};
  const zone = {shapes: [{type: "circle", x: 50, y: 50, radius: 120}]};
  assert.equal(protectiveZoneContains(zone, {x: 100, y: 0, width: 2, height: 2}, scene), true);
  assert.equal(protectiveZoneContains(zone, {x: 500, y: 0, width: 1, height: 1}, scene), false);
});
