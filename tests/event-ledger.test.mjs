import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventLedger } from "../scripts/automation/shared/event-ledger.mjs";

const fixture = () => {
  let records = [],
    authority = true,
    calls = 0;
  const ledger = createEventLedger({
    read: async () => structuredClone(records),
    write: async data => {
      records = structuredClone(data);
    },
    authority: () => authority
  });
  return {
    ledger,
    record: { id: "event-1", kind: "pulse", sceneId: "one" },
    operation: async () => {
      calls++;
      return {};
    },
    calls: () => calls,
    authority: value => {
      authority = value;
    }
  };
};
test("concurrent callbacks persist before execution and perform an event only once", async () => {
  const f = fixture();
  await Promise.all([f.ledger.run(f.record, f.operation), f.ledger.run(f.record, f.operation)]);
  assert.equal(f.calls(), 1);
  assert.equal((await f.ledger.list())[0].state, "completed");
});
test("off-scene event waits for explicit GM choice and skip never executes", async () => {
  const f = fixture();
  await f.ledger.run(f.record, f.operation, { queued: true });
  assert.equal(f.calls(), 0);
  await f.ledger.resolve(f.record.id, "skip", f.operation);
  await f.ledger.resolve(f.record.id, "apply", f.operation);
  assert.equal(f.calls(), 0);
});
test("unknown completion and inherited running events are never replayed", async () => {
  const f = fixture();
  await f.ledger.run(f.record, async () => undefined);
  assert.equal((await f.ledger.resolve(f.record.id, "apply", f.operation)).status, "needs-review");
  assert.equal(f.calls(), 0);
});
test("another GM cannot create or resolve ledger entries", async () => {
  const f = fixture();
  f.authority(false);
  assert.equal((await f.ledger.run(f.record, f.operation)).status, "forbidden");
  assert.equal(f.calls(), 0);
});
test("a native workflow can await a nested event without deadlocking the ledger", async () => {
  const f = fixture();
  await f.ledger.run(f.record, () => f.ledger.run({ ...f.record, id: "nested" }, f.operation));
  assert.equal(f.calls(), 1);
  assert.equal((await f.ledger.list()).filter(event => event.state === "completed").length, 2);
});
test("the ledger keeps the newest events of each kind and warns about dropped unresolved ones", async () => {
  const { LEDGER_LIMITS } = await import("../scripts/automation/shared/event-ledger.mjs");
  let records = [];
  const ledger = createEventLedger({
    read: async () => structuredClone(records),
    write: async data => {
      records = structuredClone(data);
    },
    authority: () => true
  });
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    for (let index = 0; index < LEDGER_LIMITS.review + 5; index++)
      await ledger.run({ id: `review-${index}`, kind: "pulse", sceneId: "one" }, async () => undefined);
    for (let index = 0; index < LEDGER_LIMITS.finished + 5; index++)
      await ledger.run({ id: `done-${index}`, kind: "pulse", sceneId: "one" }, async () => ({}));
  } finally {
    console.warn = warn;
  }
  const states = records.map(event => event.state);
  assert.equal(states.filter(state => state === "needs-review").length, LEDGER_LIMITS.review);
  assert.equal(states.filter(state => state === "completed").length, LEDGER_LIMITS.finished);
  assert.ok(!records.some(event => event.id === "review-0"), "oldest unresolved event dropped");
  assert.ok(records.some(event => event.id === `review-${LEDGER_LIMITS.review + 4}`));
  assert.ok(warnings.length > 0);
});
test("the GM can mark an unresolved event as checked, and stale running events become reviewable", async () => {
  let records = [{ id: "old", kind: "pulse", sceneId: "one", state: "running", sessionId: "previous" }];
  const ledger = createEventLedger({
    read: async () => structuredClone(records),
    write: async data => {
      records = structuredClone(data);
    },
    authority: () => true,
    isStale: event => event.sessionId !== "current"
  });
  await ledger.run({ id: "new", kind: "pulse", sceneId: "one", sessionId: "current" }, async () => undefined);
  assert.equal(records.find(event => event.id === "old").state, "needs-review");
  assert.equal((await ledger.resolve("new", "dismiss")).status, "reviewed");
  assert.equal((await ledger.resolve("old", "dismiss")).status, "reviewed");
  assert.deepEqual(
    records.map(event => event.state),
    ["reviewed", "reviewed"]
  );
});
