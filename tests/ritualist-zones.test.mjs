import assert from "node:assert/strict";
import {test} from "node:test";
import {protectiveZoneChanges, protectiveZoneContains, syncProtectiveZones, protectiveZoneScheduler} from "../scripts/automation/classes/ritualist-zones.mjs";
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

test("movement during protective zone synchronization is replayed with the final position", async () => {
  const scene = {id: "one", position: 1}, positions = [];
  let release, entered;
  const gate = new Promise(resolve => {release = resolve;});
  const start = new Promise(resolve => {entered = resolve;});
  const schedule = protectiveZoneScheduler(async current => {
    positions.push(current.position);
    if (positions.length === 1) {entered(); await gate;}
  });
  const first = schedule(scene); await start;
  scene.position = 2; const second = schedule(scene);
  scene.position = 3; schedule(scene); release();
  await Promise.all([first, second]); assert.deepEqual(positions, [1, 3]);
});

test("neutral dispositions do not turn unrelated creatures into protective-circle allies", async () => {
  const scene = {id: "neutral", grid: {size: 100, distance: 5}, tokens: [], regions: []};
  const actor = {uuid: "Actor.neutral", effects: [], async createEmbeddedDocuments() {assert.fail("unrelated neutral ally");}};
  scene.tokens = [{actor, disposition: 0, x: 0, y: 0, width: 1, height: 1}];
  scene.regions = [{uuid: "zone", shapes: [{type: "circle", x: 50, y: 50, radius: 600}],
    flags: {[MODULE_ID]: {protectiveZone: {sourceTokenUuid: "source"}, zoneExpiresAt: 600}}}];
  globalThis.game = {settings: {get: () => true}, user: {isGM: true}, time: {worldTime: 0}, actors: []};
  globalThis.canvas = {}; globalThis.fromUuid = async () => ({disposition: 0, actor: {uuid: "Actor.other"}});
  await syncProtectiveZones(scene);
});
