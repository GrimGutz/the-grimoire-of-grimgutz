import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emitConfirmedDamage,
  onConfirmedDamage,
  damageHealthSignature
} from "../scripts/automation/shared/damage-events.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
test("confirmed damage remains idempotent after GM reload and ledger history pruning", async () => {
  let events = [],
    claims = [],
    applied = 0;
  const journal = {
    getFlag: (_module, key) => (key === "automationLedger" ? true : events),
    async setFlag(_module, _key, value) {
      events = value;
    }
  };
  const card = {
    uuid: "card",
    getFlag: () => claims,
    async setFlag(_module, _key, value) {
      claims = value;
    }
  };
  const source = { uuid: "actor", async setFlag() {} };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => true },
    journal: [journal],
    time: { worldTime: 0 },
    scenes: new Map()
  };
  globalThis.fromUuid = async uuid => (uuid === "card" ? card : source);
  const options = {
    [MODULE_ID]: {
      damageEvent: {
        key: "one-damage",
        sourceActorUuid: "actor",
        targetTokenUuid: "target",
        sceneId: "one",
        itemCardUuid: "card",
        benefits: []
      }
    }
  };
  const actor = { async setFlag() {} };
  onConfirmedDamage(() => {
    applied++;
  });
  await emitConfirmedDamage(actor, 12, options);
  assert.equal(applied, 1);
  assert.deepEqual(claims, ["one-damage"]);
  events = []; // Simulate pruning old completed events from the bounded journal.
  const reloaded = await import("../scripts/automation/shared/damage-events.mjs?test-new-gm");
  reloaded.onConfirmedDamage(() => {
    applied++;
  });
  await reloaded.emitConfirmedDamage(actor, 12, options);
  assert.equal(applied, 1);
  assert.deepEqual(claims, ["one-damage"]);
});
test("another damage executor can confirm through the active GM without revealing NPC HP", async () => {
  const actor = { uuid: "targetActor", system: { attributes: { hp: { value: 8, temp: 0 } } }, async setFlag() {} },
    events = [];
  const context = {
    key: "delegated-damage",
    confirmationNonce: "private-nonce",
    targetTokenUuid: "targetToken",
    sourceActorUuid: "sourceActor",
    itemCardUuid: "second-card",
    sceneId: "one",
    benefits: []
  };
  const card = {
    uuid: "second-card",
    flags: { preparedDamageEvents: { [context.key]: context } },
    getFlag(_module, key) {
      return this.flags[key];
    },
    async setFlag(_module, key, value) {
      this.flags[key] = value;
    }
  };
  const journal = {
    getFlag: (_module, key) => (key === "automationLedger" ? true : events),
    async setFlag(_module, _key, value) {
      events.splice(0, events.length, ...value);
    }
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    settings: { get: () => true },
    journal: [journal],
    time: { worldTime: 0 },
    scenes: new Map()
  };
  globalThis.fromUuid = async uuid =>
    uuid === "second-card" ? card : uuid === "targetToken" ? { actor } : { uuid, async setFlag() {} };
  globalThis.foundry = { utils: { randomID: () => "confirm" } };
  const result = await requestGm("confirm-damage-event", actor, {
    event: context,
    amount: 12,
    wasAlive: true,
    healthSignature: damageHealthSignature(actor, context.confirmationNonce)
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(card.flags.confirmedDamageKeys, [context.key]);
  actor.system.attributes.hp.value = 9;
  const changed = await requestGm("confirm-damage-event", actor, {
    event: context,
    amount: 12,
    wasAlive: true,
    healthSignature: "wrong"
  });
  assert.equal(changed.status, "needs-review");
});
