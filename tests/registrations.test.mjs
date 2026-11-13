import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAutomationActionHandlers,
  getMidiHookHandlers,
  registerAutomation
} from "../scripts/automation/runtime.mjs";
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
  const subscriptions = [],
    sockets = [];
  globalThis.Hooks = {
    on: (name, callback) => subscriptions.push([name, callback]),
    once: (name, callback) => subscriptions.push([name, callback])
  };
  globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
  globalThis.game = {
    settings: { register() {}, registerMenu() {} },
    socket: { on: (name, callback) => sockets.push([name, callback]) }
  };
  registerAutomation();
  const handlers = getMidiHookHandlers();
  for (const [hook, name] of MIDI_QOL_HOOKS) {
    assert.ok(
      subscriptions.some(([event, callback]) => event === hook && callback === handlers[name]),
      name
    );
  }
  assert.ok(
    sockets.some(([name, callback]) => name === "module.the-grimoire-of-grimgutz" && typeof callback === "function")
  );
  assert.ok(subscriptions.some(([name]) => name === "createToken"));
  assert.ok(subscriptions.some(([name]) => name === "updateCombat"));
});

test("each content validator is registered exactly once", async () => {
  const subscriptions = [];
  globalThis.Hooks = { on: (name, callback) => subscriptions.push([name, callback]), once: () => {} };
  globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
  globalThis.game = { settings: { register() {}, registerMenu() {} }, socket: { on() {} } };
  registerAutomation();
  const hag = await import("../scripts/automation/transformations/hag.mjs");
  const illithid = await import("../scripts/automation/transformations/illithid.mjs");
  const master = await import("../scripts/automation/classes/master.mjs");
  const items = subscriptions.filter(([name]) => name === "preCreateItem").map(([, callback]) => callback);
  const advancements = subscriptions
    .filter(([name]) => name === "dnd5e.preAdvancementManagerComplete")
    .map(([, callback]) => callback);
  assert.equal(items.length, 19, "18 content validators and one prerequisite chain");
  assert.equal(advancements.length, 13, "12 content validators and one generic advancement validator");
  for (const validate of [hag.validateHagItem, illithid.validateIllithidItem, master.validateMasterItem])
    assert.equal(items.filter(c => c === validate).length, 1);
  for (const validate of [
    hag.validateHagAdvancement,
    illithid.validateIllithidAdvancement,
    master.validateMasterAdvancement
  ])
    assert.equal(advancements.filter(c => c === validate).length, 1);
  assert.equal(new Set(items).size, items.length);
  assert.equal(new Set(advancements).size, advancements.length);
});
