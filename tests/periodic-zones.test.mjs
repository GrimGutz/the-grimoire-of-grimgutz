import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { processPeriodicZones } from "../scripts/automation/shared/periodic-zones.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";

let combat, template, calls, source, target;
beforeEach(() => {
  calls = []; source = { uuid: "Scene.one.Token.source", actor: { uuid: "Actor.source" } };
  target = { id: "target", uuid: "Scene.one.Token.target", actor: { uuid: "Actor.target" }, x: 100, y: 0, width: 1, height: 1 };
  template = { uuid: "Scene.one.MeasuredTemplate.zone", t: "circle", x: 50, y: 50, distance: 30,
    flags: { [MODULE_ID]: { areaCastId: "cast", zoneExpiresAt: 160, periodicZone: { sourceTokenUuid: source.uuid,
      sourceItemUuid: "Actor.source.Item.whirlwind", event: { save: "dex", dc: "15", damage: [{ formula: "8d8", type: "radiant" }] } } } } };
  const scene = { id: "one", grid: { size: 100, distance: 5 }, tokens: [target], templates: [template] };
  combat = { id: "combat", scene, started: true, round: 1, turn: 1, previous: { round: 1, turn: 0, tokenId: "target" },
    turns: [{ tokenId: "target" }] };
  globalThis.game = { user: { isGM: true }, settings: { get: () => true }, time: { worldTime: 120 } };
  globalThis.canvas = { ready: true, scene };
  globalThis.MidiQOL = { computeTargetsFromTemplates: () => [{ actor: target.actor, document: target }] };
  globalThis.fromUuid = async uuid => uuid === source.uuid ? source : uuid.includes("Item") ? { uuid } : { disabled: false };
});
const pulse = async data => { calls.push(data); return {}; };
test("whirlwind triggers at the ending target turn with typed damage and its existing template", async () => {
  await processPeriodicZones(combat, { turn: 1 }, { pulse });
  assert.equal(calls.length, 1); assert.equal(calls[0].targets[0].document.uuid, target.uuid);
  assert.deepEqual(calls[0].event.damage, [{ formula: "8d8", type: "radiant" }]);
  assert.equal(calls[0].template, template);
});
test("movement, rewinding combat, expiration and lost concentration do not pulse", async () => {
  await processPeriodicZones(combat, { x: 200 }, { pulse });
  combat.turn = 0; await processPeriodicZones(combat, { turn: 0 }, { pulse }); combat.turn = 1;
  game.time.worldTime = 160; await processPeriodicZones(combat, { turn: 1 }, { pulse }); game.time.worldTime = 120;
  template.flags[MODULE_ID].zoneConcentrationEffect = "effect";
  fromUuid = async uuid => uuid === "effect" ? { disabled: true } : source;
  await processPeriodicZones(combat, { turn: 1 }, { pulse }); assert.equal(calls.length, 0);
});
test("another canvas scene does not determine the zone's ending target", async () => {
  canvas.scene = { id: "other" }; MidiQOL.computeTargetsFromTemplates = () => { throw Error("Wrong canvas"); };
  await processPeriodicZones(combat, { turn: 1 }, { pulse }); assert.equal(calls.length, 1);
  assert.equal(calls[0].scene.id, "one");
});

test("a scene-unlinked Foundry 14 encounter uses the ending combatant's scene", async () => {
  const scene = combat.scene;
  combat.scene = null;
  combat.turns[0].sceneId = scene.id;
  game.scenes = new Map([[scene.id, scene]]);
  await processPeriodicZones(combat, {turn: 1}, {pulse});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scene, scene);
  assert.equal(calls[0].targets[0].document.uuid, target.uuid);
});

test("a multi-scene encounter uses the ending token, not its linked scene or the GM canvas", async () => {
  const scene = combat.scene;
  target.parent = scene;
  combat.turns[0].token = target;
  combat.turns[0].sceneId = scene.id;
  combat.scene = {id: "other", tokens: [{...target, uuid: "Scene.other.Token.target"}], templates: []};
  canvas.scene = combat.scene;
  await processPeriodicZones(combat, {turn: 1}, {pulse});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scene, scene);
  assert.equal(calls[0].targets[0].document.uuid, target.uuid);
});

test("a pending lookup cannot change the ending-turn event key when combat advances again", async () => {
  const resolve = fromUuid;
  fromUuid = async uuid => {
    const doc = await resolve(uuid);
    combat.previous = {round: 1, turn: 1};
    return doc;
  };
  await processPeriodicZones(combat, {turn: 1}, {pulse});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].eventKey, `zone:cast:${target.uuid}:combat:1:0`);
});
