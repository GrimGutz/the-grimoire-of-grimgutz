import assert from "node:assert/strict";
import { test } from "node:test";
import { getAutomationActionHandlers, getMidiHookHandlers, registerAutomation } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { automationAction } from "../scripts/automation/shared/helpers.mjs";

test("every authored activity has a real callable action registration", async () => {
  const registry = getAutomationActionHandlers();
  let checked = 0;
  for (const pack of ["classes", "subclasses", "features", "transformations", "spells", "equipment", "bestiary"]) {
    const { documents } = await import(`../src/packs/${pack}.mjs`);
    for (const document of documents) {
      for (const item of [document, ...(document._embeddedItems ?? document.items ?? [])]) {
        for (const activity of Object.values(item.system?.activities ?? {})) {
          const action = automationAction(activity);
          if (!action) continue;
          assert.equal(typeof registry.get(action), "function", `${pack}: ${item.name} / ${action}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 100);
});

test("registerAutomation installs the actual Midi callbacks and summon socket", () => {
  const subscriptions = [], sockets = [];
  globalThis.Hooks = {
    on: (name, callback) => subscriptions.push([name, callback]),
    once: (name, callback) => subscriptions.push([name, callback])
  };
  globalThis.foundry = {applications: {api: {ApplicationV2: class {}}}};
  globalThis.game = { settings: { register() {}, registerMenu() {} }, socket: { on: (name, callback) => sockets.push([name, callback]) } };
  registerAutomation();
  const handlers = getMidiHookHandlers();
  for (const [hook, name] of MIDI_QOL_HOOKS) {
    assert.ok(subscriptions.some(([event, callback]) => event === hook && callback === handlers[name]), name);
  }
  assert.ok(sockets.some(([name, callback]) => name === "module.the-grimoire-of-grimgutz" && typeof callback === "function"));
  assert.ok(subscriptions.some(([name]) => name === "createToken"));
  assert.ok(subscriptions.some(([name]) => name === "updateCombat"));
});
