import assert from "node:assert/strict";
import {test} from "node:test";
import {emitConfirmedDamage, onConfirmedDamage} from "../scripts/automation/shared/damage-events.mjs";
import {MODULE_ID} from "../scripts/automation/shared/constants.mjs";
test("confirmed damage remains idempotent after GM reload and ledger history pruning", async () => {
  let events = [], claims = [], applied = 0;
  const journal = {getFlag: (_module, key) => key === "automationLedger" ? true : events,
    async setFlag(_module, _key, value) {events = value;}};
  const card = {uuid: "card", getFlag: () => claims, async setFlag(_module, _key, value) {claims = value;}};
  const source = {uuid: "actor", async setFlag() {}};
  globalThis.game = {user: {id: "gm", isGM: true}, users: {activeGM: {id: "gm"}}, settings: {get: () => true}, journal: [journal], time: {worldTime: 0}, scenes: new Map()};
  globalThis.fromUuid = async uuid => uuid === "card" ? card : source;
  const options = {[MODULE_ID]: {damageEvent: {key: "one-damage", sourceActorUuid: "actor", targetTokenUuid: "target", sceneId: "one", itemCardUuid: "card", benefits: []}}};
  const actor = {async setFlag() {}};
  onConfirmedDamage(() => {applied++;});
  await emitConfirmedDamage(actor, 12, options);
  assert.equal(applied, 1); assert.deepEqual(claims, ["one-damage"]);
  events = []; // Simulate pruning old completed events from the bounded journal.
  const reloaded = await import("../scripts/automation/shared/damage-events.mjs?test-new-gm");
  reloaded.onConfirmedDamage(() => {applied++;});
  await reloaded.emitConfirmedDamage(actor, 12, options);
  assert.equal(applied, 1); assert.deepEqual(claims, ["one-damage"]);
});
