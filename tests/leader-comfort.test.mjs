import assert from "node:assert/strict";
import {test} from "node:test";
import {applyComfortHealingConfig} from "../scripts/automation/classes/leader-comfort.mjs";
test("healing maximization preserves modifiers and does not spend twice during native dialog previews", () => {
  const state = {remaining: 2, usedByIndex: {}}, config = {workflow: {grimgutzComfortReservation: state}};
  const roll = {parts: ["3d8 + 2"]}; applyComfortHealingConfig(config, roll, 0);
  assert.deepEqual(roll.parts, ["16 + 1d8 + 2"]); assert.equal(state.usedByIndex[0], 2);
  const rebuilt = {parts: ["3d8 + 2"]}; applyComfortHealingConfig(config, rebuilt, 0);
  assert.deepEqual(rebuilt.parts, ["16 + 1d8 + 2"]); assert.equal(state.usedByIndex[0], 2);
});
test("multiple healing parts share a single available-dice budget", () => {
  const state = {remaining: 2, usedByIndex: {}}, config = {workflow: {grimgutzComfortReservation: state}};
  const first = {parts: ["1d6"]}, second = {parts: ["2d8"]};
  applyComfortHealingConfig(config, first, 0); applyComfortHealingConfig(config, second, 1);
  assert.deepEqual(first.parts, ["6"]); assert.deepEqual(second.parts, ["8 + 1d8"]);
  assert.equal(Object.values(state.usedByIndex).reduce((a, b) => a + b, 0), 2);
});
