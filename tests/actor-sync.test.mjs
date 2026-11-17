import assert from "node:assert/strict";
import { test } from "node:test";
import { createActorSynchronizer } from "../scripts/automation/shared/actor-sync.mjs";

test("one failed passive does not prevent other tasks or actors from synchronizing", async () => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  const calls = [],
    failures = [];
  const sync = createActorSynchronizer(
    [
      async function broken(actor) {
        if (actor.uuid === "one") throw Error("invalid feature");
      },
      async function rest(actor) {
        calls.push(actor.uuid);
      }
    ],
    { onError: (actor, task) => failures.push(`${actor.uuid}:${task}`) }
  );
  await sync.synchronize({ uuid: "one", isOwner: true });
  await sync.synchronize({ uuid: "two", isOwner: true });
  assert.deepEqual(calls, ["one", "two"]);
  assert.deepEqual(failures, ["one:broken"]);
});
test("parallel requests for the same actor do not overlap", async () => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
  let running = 0,
    maximum = 0;
  const sync = createActorSynchronizer([
    async () => {
      running++;
      maximum = Math.max(maximum, running);
      await new Promise(resolve => setImmediate(resolve));
      running--;
    }
  ]);
  const actor = { uuid: "one", isOwner: true };
  await Promise.all([sync.synchronize(actor), sync.synchronize(actor), sync.synchronize(actor)]);
  assert.equal(maximum, 1);
});

const gm = () => {
  globalThis.game = { settings: { get: () => true }, user: { id: "gm" }, users: { activeGM: { id: "gm" } } };
};

test("a sync whose own write fires the update hook settles after one confirming pass", async () => {
  gm();
  let sync,
    passes = 0,
    changed = false;
  sync = createActorSynchronizer([
    async function writeOnce(actor) {
      passes++;
      if (!changed) {
        changed = true;
        sync.schedule(actor); // the update hook of this task's write
      }
    }
  ]);
  await sync.synchronize({ uuid: "one", isOwner: true });
  assert.equal(passes, 2);
  assert.deepEqual(sync.pausedActors(), []);
});

test("a task that changes the actor on every pass is stopped, named and paused", async () => {
  gm();
  let sync,
    time = 1000,
    passes = 0;
  const loops = [];
  sync = createActorSynchronizer(
    [
      async function stable() {},
      async function nonIdempotent(actor) {
        passes++;
        sync.schedule(actor);
      }
    ],
    { onLoop: (actor, writers) => loops.push([actor.uuid, writers]), now: () => time }
  );
  const actor = { uuid: "loop", isOwner: true };
  await sync.synchronize(actor);
  assert.equal(passes, 5);
  assert.deepEqual(loops, [["loop", ["nonIdempotent"]]]);
  assert.equal(sync.pausedActors()[0]?.uuid, "loop");

  // Hook-triggered syncs are ignored while paused; explicit calls still run.
  sync.schedule(actor);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(passes, 5);
  time += 61000;
  assert.deepEqual(sync.pausedActors(), []);
});

test("writes that land after each pass are capped by the per-window pass limit", async () => {
  gm();
  let sync,
    passes = 0;
  const loops = [];
  sync = createActorSynchronizer(
    [
      async function deferredWriter() {
        passes++;
      }
    ],
    { onLoop: actor => loops.push(actor.uuid), now: () => 5000 }
  );
  const actor = { uuid: "deferred", isOwner: true };
  for (let index = 0; index < 60; index++) await sync.synchronize(actor, { fromHook: true });
  assert.equal(passes, 40);
  assert.deepEqual(loops, ["deferred"]);
});
