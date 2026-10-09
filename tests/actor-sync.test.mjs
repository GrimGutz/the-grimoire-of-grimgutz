import assert from "node:assert/strict";
import { test } from "node:test";
import { createActorSynchronizer } from "../scripts/automation/shared/actor-sync.mjs";

test("one failed passive does not prevent other tasks or actors from synchronizing", async () => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  const calls = [], failures = [];
  const sync = createActorSynchronizer([
    async function broken(actor) { if (actor.uuid === "one") throw Error("invalid feature"); },
    async function rest(actor) { calls.push(actor.uuid); }
  ], { onError: (actor, task) => failures.push(`${actor.uuid}:${task}`) });
  await sync.synchronize({ uuid: "one", isOwner: true });
  await sync.synchronize({ uuid: "two", isOwner: true });
  assert.deepEqual(calls, ["one", "two"]);
  assert.deepEqual(failures, ["one:broken"]);
});
test("parallel requests for the same actor do not overlap", async () => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  let running = 0, maximum = 0;
  const sync = createActorSynchronizer([async () => {
    running++; maximum = Math.max(maximum, running);
    await new Promise(resolve => setImmediate(resolve));
    running--;
  }]);
  const actor = { uuid: "one", isOwner: true };
  await Promise.all([sync.synchronize(actor), sync.synchronize(actor), sync.synchronize(actor)]);
  assert.equal(maximum, 1);
});
