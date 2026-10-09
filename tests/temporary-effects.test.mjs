import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import {
  automationActors,
  deleteExpiredModuleTemporaryEffects,
  isEffectActive,
  prepareModuleTemporaryEffectExpiry,
  temporaryEffectTiming
} from "../scripts/automation/effects/temporary-effects.mjs";

function setProperty(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let target = object;
  for (const key of keys) target = target[key] ??= {};
  target[last] = value;
}

beforeEach(() => {
  globalThis.foundry = { utils: { setProperty } };
  globalThis.game = {
    time: { worldTime: 120 }, combat: null,
    modules: new Map([["dae", { active: true }]]),
    users: { activeGM: { isSelf: true } }, actors: [], scenes: []
  };
  globalThis.CONFIG = { ActiveEffect: {
    expiryEvents: { updateWorldTime: "elapsed" },
    documentClass: { getEffectStart: () => ({ time: game.time.worldTime, combat: null, combatant: null, round: null, turn: null, initiative: null }) }
  } };
});

function effect({ value = 60, units = "seconds", expired = false, expiry = "updateWorldTime", flags = { [MODULE_ID]: { temporary: true } } } = {}) {
  return {
    id: "effect1", disabled: false, transfer: false,
    _source: { flags, start: { time: 0 }, duration: { value, units, expired, expiry } },
    updateSource(update) { this.createdUpdate = update; },
    updateDuration() {
      const raw = this._source.duration;
      return { ...raw, remaining: raw.value === null ? Infinity : raw.value - game.time.worldTime,
        secondsRemaining: raw.value === null ? Infinity : raw.value - game.time.worldTime };
    }
  };
}

test("Foundry 14 canonical duration receives a start and DAE delete mode", () => {
  const doc = effect();
  prepareModuleTemporaryEffectExpiry(doc);
  assert.equal(doc.createdUpdate.duration.value, 60);
  assert.equal(doc.createdUpdate.duration.units, "seconds");
  assert.equal(doc.createdUpdate.duration.expiry, "updateWorldTime");
  assert.equal(doc.createdUpdate.flags.dae.expiryMode, "delete");
  assert.equal(doc.createdUpdate.start.time, 0); // Creation preserves a supplied start.
});

test("renaming or updating a flag does not renew or revive an expired effect", () => {
  const update = { name: "Renamed", [`flags.${MODULE_ID}.rollTotal`]: 6 };
  prepareModuleTemporaryEffectExpiry(effect({ expired: true }), update);
  assert.deepEqual(update, { name: "Renamed", [`flags.${MODULE_ID}.rollTotal`]: 6 });
});

test("saving unchanged duration fields in a form does not restart the clock", () => {
  const update = { name: "Edited", duration: { value: 60, units: "seconds", expired: false } };
  const expected = structuredClone(update);
  prepareModuleTemporaryEffectExpiry(effect(), update);
  assert.deepEqual(update, expected);
});

test("an explicit activation start or changed duration restarts a running effect", () => {
  for (const update of [{ start: { time: 120 }, duration: { value: 60, units: "seconds" } }, { "duration.value": 90 }]) {
    prepareModuleTemporaryEffectExpiry(effect(), update);
    assert.equal(update.start.time, 120);
  }
});

test("nested and flat reapplication restart at the current game time", () => {
  for (const update of [{ duration: { value: 60, units: "seconds", expired: false } }, { "duration.seconds": 60 }]) {
    prepareModuleTemporaryEffectExpiry(effect({ expired: true }), update);
    assert.equal(update.start.time, 120);
    assert.equal(update.duration.expired, false);
    assert.equal(update.duration.value, 60);
    assert.equal(update.flags.dae.expiryMode, "delete");
  }
});

test("DAE expiry updates are never rewritten", () => {
  for (const update of [{ "duration.expired": true }, { duration: { expired: true } }]) {
    const expected = structuredClone(update);
    prepareModuleTemporaryEffectExpiry(effect(), update);
    assert.deepEqual(update, expected);
  }
});

test("permanent passives and effects belonging to other modules are left alone", () => {
  for (const doc of [effect({ value: null }), effect({ flags: { dae: {} } })]) {
    prepareModuleTemporaryEffectExpiry(doc);
    assert.equal(doc.createdUpdate, undefined);
  }
  assert.equal(isEffectActive(effect({ value: null })), true);
  assert.equal(isEffectActive(effect()), false);
});

test("timed effect templates on Items are not started or given an expiry override", () => {
  const doc = effect();
  doc.parent = { documentName: "Item" };
  prepareModuleTemporaryEffectExpiry(doc);
  assert.equal(doc.createdUpdate, undefined);
});

test("native timing supports turns and a specified end-of-turn event", () => {
  const timing = temporaryEffectTiming({ turns: 0, expiry: "turnEnd" });
  assert.equal(timing.duration.value, 0);
  assert.equal(timing.duration.units, "turns");
  assert.equal(timing.duration.expiry, "turnEnd");
  assert.equal(timing.start.time, 120);
  assert.equal(isEffectActive(effect({ value: 0, units: "turns", expiry: "turnEnd" })), true);
});

test("cleanup covers synthetic actors, deduplicates linked actors and keeps permanent effects", async () => {
  const calls = [];
  const world = { uuid: "Actor.world", effects: [effect({ value: null })] };
  const synthetic = {
    uuid: "Scene.one.Token.two.Actor.actor", effects: [effect(), effect({ value: null })],
    async deleteEmbeddedDocuments(type, ids) { calls.push({ type, ids }); this.effects = this.effects.filter(e => !ids.includes(e.id)); }
  };
  synthetic.effects[1].id = "passive";
  game.actors = [world];
  game.scenes = [{ tokens: [{ actor: world }, { actor: synthetic }] }];
  assert.equal(automationActors().length, 2);
  await deleteExpiredModuleTemporaryEffects("updateWorldTime");
  assert.deepEqual(calls, [{ type: "ActiveEffect", ids: ["effect1"] }]);
  assert.equal(synthetic.effects[0].id, "passive");
});

test("cleanup respects a turn-end event and only writes on the active GM", async () => {
  const doc = effect({ value: 0, units: "turns", expiry: "turnEnd" });
  doc.isExpiryEvent = event => event === "turnEnd";
  let calls = 0;
  game.actors = [{ uuid: "Actor.one", effects: [doc], async deleteEmbeddedDocuments() { calls++; } }];
  await deleteExpiredModuleTemporaryEffects("turnStart");
  assert.equal(calls, 0);
  await deleteExpiredModuleTemporaryEffects("turnEnd");
  assert.equal(calls, 1);
  game.users.activeGM.isSelf = false;
  await deleteExpiredModuleTemporaryEffects("turnEnd");
  assert.equal(calls, 1);
});
