import assert from "node:assert/strict";
import { test } from "node:test";
import { defineContent } from "../scripts/automation/shared/content.mjs";
import {
  CONTENT,
  contentApi,
  contentMidiHandlers,
  contentOfKind,
  contentSyncs,
  registerContentActions
} from "../scripts/automation/content-registry.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";

test("descriptors have unique ids and only known kinds", () => {
  assert.equal(new Set(CONTENT.map(content => content.id)).size, CONTENT.length);
  assert.deepEqual(
    contentOfKind("transformation").map(content => content.id),
    [
      "arkane",
      "automaton",
      "broodmother",
      "chimera",
      "deathknight",
      "dullahan",
      "factory",
      "god",
      "hag",
      "halfdragon",
      "illithid"
    ]
  );
  assert.equal(contentOfKind("class").length + contentOfKind("transformation").length, CONTENT.length);
});

test("every descriptor action reaches the runtime registry", () => {
  const registry = getAutomationActionHandlers();
  for (const content of CONTENT)
    for (const [action, handler] of Object.entries(content.actions))
      assert.equal(registry.get(action), handler, action);
});

test("duplicate action ids are refused instead of silently replaced", () => {
  assert.throws(() => registerContentActions(new Map([["hag-control", () => {}]])), /already registered/);
});

test("every descriptor Midi handler is scheduled in MIDI_QOL_HOOKS and exported", () => {
  const scheduled = new Set(MIDI_QOL_HOOKS.map(([, name]) => name));
  const handlers = getMidiHookHandlers();
  for (const [name, handler] of Object.entries(contentMidiHandlers())) {
    assert.ok(scheduled.has(name), `${name} is never called: add it to MIDI_QOL_HOOKS`);
    assert.equal(handlers[name], handler);
  }
});

test("syncs and API come from the descriptors", () => {
  assert.equal(contentSyncs("class").length, contentOfKind("class").length);
  assert.equal(contentSyncs("transformation").length, contentOfKind("transformation").length);
  assert.equal(typeof contentApi().useIllithidRefuge, "function");
});

test("defineContent rejects typos and non-functions", () => {
  assert.throws(() => defineContent({ id: "x", kind: "class", acitons: {} }), /Unknown content field "acitons"/);
  assert.throws(() => defineContent({ id: "x", kind: "spell" }), /unknown kind/);
  assert.throws(() => defineContent({ id: "x", kind: "class", actions: { a: "nope" } }), /not a function/);
  const content = defineContent({ id: "x", kind: "class" });
  assert.deepEqual([content.itemValidators, content.advancementValidators], [[], []]);
  assert.ok(Object.isFrozen(content));
});
