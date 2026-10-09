import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventLedger } from "../scripts/automation/shared/event-ledger.mjs";

const fixture = () => { let records = [], authority = true, calls = 0;
  const ledger = createEventLedger({ read: async () => structuredClone(records), write: async data => { records = structuredClone(data); }, authority: () => authority });
  return { ledger, record: { id: "event-1", kind: "pulse", sceneId: "one" }, operation: async () => { calls++; return {}; },
    calls: () => calls, authority: value => { authority = value; } }; };
test("concurrent callbacks persist before execution and perform an event only once", async () => {
  const f = fixture(); await Promise.all([f.ledger.run(f.record, f.operation), f.ledger.run(f.record, f.operation)]);
  assert.equal(f.calls(), 1); assert.equal((await f.ledger.list())[0].state, "completed");
});
test("off-scene event waits for explicit GM choice and skip never executes", async () => {
  const f = fixture(); await f.ledger.run(f.record, f.operation, { queued: true }); assert.equal(f.calls(), 0);
  await f.ledger.resolve(f.record.id, "skip", f.operation); await f.ledger.resolve(f.record.id, "apply", f.operation);
  assert.equal(f.calls(), 0);
});
test("unknown completion and inherited running events are never replayed", async () => {
  const f = fixture(); await f.ledger.run(f.record, async () => undefined);
  assert.equal((await f.ledger.resolve(f.record.id, "apply", f.operation)).status, "needs-review"); assert.equal(f.calls(), 0);
});
test("another GM cannot create or resolve ledger entries", async () => {
  const f = fixture(); f.authority(false); assert.equal((await f.ledger.run(f.record, f.operation)).status, "forbidden"); assert.equal(f.calls(), 0);
});
test("a native workflow can await a nested event without deadlocking the ledger", async () => {
  const f = fixture();
  await f.ledger.run(f.record, () => f.ledger.run({ ...f.record, id: "nested" }, f.operation));
  assert.equal(f.calls(), 1); assert.equal((await f.ledger.list()).filter(event => event.state === "completed").length, 2);
});
