import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { sameZone, sceneZone, sceneZones, zoneKey, zoneOrigin } from "../scripts/automation/shared/scene-zones.mjs";

const original = globalThis.game;
afterEach(() => {
  globalThis.game = original;
});
const collection = docs => Object.assign([...docs], { get: id => docs.find(doc => doc.id === id) });
const region = id => ({ id, uuid: `Scene.s.Region.${id}`, documentName: "Region" });
const template = id => ({ id, uuid: `Scene.s.MeasuredTemplate.${id}`, documentName: "MeasuredTemplate" });

test("Foundry v14 lists each template zone once, as its Region, without reading Scene#templates", () => {
  globalThis.game = { release: { generation: 14 } };
  const scene = {
    regions: collection([region("a"), region("b")]),
    get templates() {
      throw new Error("deprecated Scene#templates read");
    }
  };
  assert.deepEqual(
    sceneZones(scene).map(zone => zone.uuid),
    ["Scene.s.Region.a", "Scene.s.Region.b"]
  );
  assert.equal(sceneZone(scene, "a").documentName, "Region");
});

test("before v14 regions and templates are combined without duplicates", () => {
  globalThis.game = { release: { generation: 13 } };
  const scene = { regions: collection([region("a")]), templates: collection([template("a"), template("t")]) };
  assert.deepEqual(
    sceneZones(scene).map(zone => zone.uuid),
    ["Scene.s.Region.a", "Scene.s.MeasuredTemplate.t"]
  );
  assert.equal(sceneZone(scene, "t").documentName, "MeasuredTemplate");
  assert.deepEqual(sceneZones(null), []);
});

test("template and Region uuids of one zone compare equal", () => {
  assert.equal(zoneKey("Scene.s.MeasuredTemplate.a"), "s:a");
  assert.equal(sameZone("Scene.s.MeasuredTemplate.a", region("a")), true);
  assert.equal(sameZone("Scene.s.MeasuredTemplate.a", region("b")), false);
  assert.equal(sameZone("Scene.other.Region.a", region("a")), false);
  assert.equal(sameZone(null, null), false);
});

test("zone origin comes from a Region shape or template fields", () => {
  assert.deepEqual(zoneOrigin({ shapes: [{ type: "line", x: 10, y: 20, rotation: 90 }] }), {
    type: "line",
    x: 10,
    y: 20,
    direction: 90
  });
  assert.deepEqual(zoneOrigin({ t: "ray", x: 1, y: 2, direction: 45 }), { type: "line", x: 1, y: 2, direction: 45 });
  assert.equal(zoneOrigin({ shapes: [{ type: "polygon", points: [0, 0, 1, 1] }] }), null);
  assert.equal(zoneOrigin({}), null);
});
