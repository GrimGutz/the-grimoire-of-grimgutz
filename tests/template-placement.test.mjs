import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { placeActivityArea } from "../scripts/automation/shared/template-placement.mjs";

const regions = [];
const scene = { regions: Object.assign(regions, { get: id => regions.find(region => region.id === id) }) };
const region = id => ({
  id,
  parent: scene,
  documentName: "Region",
  deleted: false,
  async delete() {
    this.deleted = true;
  }
});
const activity = (type = "sphere") => ({ target: { template: { type } } });

beforeEach(() => {
  regions.length = 0;
  globalThis.canvas = { scene };
  globalThis.CONFIG = { DND5E: { areaTargetTypes: { sphere: { template: "circle" }, cone: { template: "cone" } } } };
});

test("dnd5e 6 TemplatePlacement creates Regions in one call", async () => {
  const placed = region("r1");
  regions.push(placed);
  const calls = [];
  globalThis.game = {
    system: { canvas: { TemplatePlacement: { fromActivity: async a => (calls.push(a), [placed]) } } }
  };
  const act = activity();
  assert.deepEqual(await placeActivityArea(act), [placed]);
  assert.deepEqual(calls, [act]);
});

test("TemplatePlacement cancellation resolves null and a missing area throws the caller's message", async () => {
  globalThis.game = { system: { canvas: { TemplatePlacement: { fromActivity: async () => null } } } };
  assert.equal(await placeActivityArea(activity()), null);
  await assert.rejects(placeActivityArea(activity("wall"), { missing: "no square" }), /no square/);
});

test("the legacy AbilityTemplate flow returns the Region behind each placed template", async () => {
  const backing = region("t1");
  regions.push(backing);
  const wrapper = { id: "t1", parent: scene, documentName: "MeasuredTemplate" };
  let origin;
  globalThis.game = {
    system: {
      canvas: { AbilityTemplate: { fromActivity: (_a, o) => ((origin = o), [{ drawPreview: async () => [wrapper] }]) } }
    }
  };
  assert.deepEqual(await placeActivityArea(activity(), { origin: { x: 1, y: 2 } }), [backing]);
  assert.deepEqual(origin, { x: 1, y: 2 });
});

test("a legacy cancel after an earlier placement removes what was placed", async () => {
  const first = region("a");
  regions.push(first);
  globalThis.game = {
    system: {
      canvas: {
        AbilityTemplate: {
          fromActivity: () => [
            { drawPreview: async () => [first] },
            {
              drawPreview: async () => {
                throw undefined;
              }
            }
          ]
        }
      }
    }
  };
  assert.equal(await placeActivityArea(activity()), null);
  assert.equal(first.deleted, true);
});

test("a legacy placement error is rethrown after cleanup", async () => {
  const first = region("a");
  globalThis.game = {
    system: {
      canvas: {
        AbilityTemplate: {
          fromActivity: () => [
            { drawPreview: async () => [first] },
            {
              drawPreview: async () => {
                throw new Error("boom");
              }
            }
          ]
        }
      }
    }
  };
  await assert.rejects(placeActivityArea(activity()), /boom/);
  assert.equal(first.deleted, true);
  globalThis.game = { system: { canvas: {} } };
  await assert.rejects(placeActivityArea(activity()), /не задан корректный шаблон/);
});
