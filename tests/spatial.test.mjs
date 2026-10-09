import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { feetToSceneUnits, tokenSceneDistance } from "../scripts/automation/shared/spatial.mjs";

beforeEach(() => { globalThis.game = {}; globalThis.canvas = { scene: { grid: { size: 100, distance: 5, units: "ft", type: 1 } } }; });
function token(id, x, width = 1) { return { document: { uuid: id, x, y: 0, width, height: 1, elevation: 0 } }; }
test("feet are converted to metric scene units", () => {
  canvas.scene.grid.units = "m";
  assert.ok(Math.abs(feetToSceneUnits(10) - 3.048) < 0.00001);
});
test("range uses the nearest occupied space of a large token", () => {
  assert.equal(tokenSceneDistance(token("large", 0, 2), token("medium", 200)), 5);
});
test("native scene grid measurement determines diagonal distance", () => {
  canvas.scene.grid.measurePath = ([a, b]) => ({ distance: Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / 100 * 5 });
  const diagonal = token("diagonal", 100); diagonal.document.y = 100;
  assert.equal(tokenSceneDistance(token("source", 0), diagonal), 5);
});
