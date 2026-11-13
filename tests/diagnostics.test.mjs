import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectAutomation } from "../scripts/automation/shared/diagnostics.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";

test("inspection reports suppressed effects, expired timers and missing authority without any writes", async () => {
  const forbidden = () => {
    throw Error("diagnosis must not mutate documents");
  };
  const actor = {
    documentName: "Actor",
    uuid: "Actor.one",
    name: "One",
    isToken: true,
    items: [
      {
        uuid: "Actor.one.Item.a",
        name: "Summon",
        system: {
          identifier: "one",
          uses: { max: "1", spent: 1 },
          activities: {
            a: {
              id: "a",
              name: "Summon",
              flags: { [MODULE_ID]: { action: "summon" } },
              consumption: { targets: [{ type: "itemUses", value: "1" }] }
            }
          }
        },
        effects: []
      }
    ],
    effects: [
      {
        uuid: "Actor.one.ActiveEffect.a",
        name: "Suppressed",
        disabled: false,
        isSuppressed: true,
        duration: { value: 1, units: "minutes" },
        start: { time: 0 },
        update: forbidden,
        updateDuration: forbidden
      }
    ],
    update: forbidden,
    getFlag: () => null,
    testUserPermission: () => true
  };
  globalThis.game = {
    settings: { get: () => true },
    user: { id: "player" },
    users: {},
    modules: new Map(),
    packs: new Map(),
    actors: [],
    time: { worldTime: 61 }
  };
  globalThis.fromUuid = async () => actor;
  const report = await inspectAutomation(actor.uuid, { actionHandlers: new Map([["summon", () => {}]]) });
  assert.deepEqual(report.effects[0].reasons, ["suppressed", "expired"]);
  assert.deepEqual(report.items[0].actions[0].reasons, ["no-active-gm", "insufficient-resource"]);
  report.effects[0].duration.value = 999;
  assert.equal(actor.effects[0].duration.value, 1);
  assert.equal(report.actor.synthetic, true);
});
test("read-only diagnosis rejects another player's NPC rather than leaking resources", async () => {
  game.user = { id: "player", isGM: false };
  await assert.rejects(inspectAutomation({ documentName: "Actor", testUserPermission: () => false }), /Диагностика/);
});
