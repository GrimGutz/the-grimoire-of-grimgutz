import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { applyNativeOnce, nativeApplicationReply } from "../scripts/automation/shared/native-applications.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";

let actor;
beforeEach(() => {
  globalThis.game = { user: { isGM: true, id: "gm" }, time: { worldTime: 0 } };
  actor = {
    uuid: "Actor.test",
    flags: {},
    getFlag(module, key) {
      return this.flags[module]?.[key];
    },
    async update(changes) {
      this.flags[MODULE_ID] ??= {};
      this.flags[MODULE_ID].nativeApplications = changes[`flags.${MODULE_ID}.nativeApplications`];
    }
  };
});
const receipt = { requestId: "one-use", action: "test", activityUuid: "Actor.test.Item.a.Activity.b" };

test("one confirmed native application is never repeated by concurrent or later callbacks", async () => {
  let uses = 0,
    results = 0;
  const use = async () => {
    uses++;
    await Promise.resolve();
    return true;
  };
  const apply = async () => {
    results++;
    return true;
  };
  await Promise.all([applyNativeOnce(actor, receipt, use, apply), applyNativeOnce(actor, receipt, use, apply)]);
  assert.equal((await applyNativeOnce(actor, receipt, use, apply)).status, "success");
  assert.equal(uses, 1);
  assert.equal(results, 1);
});

test("native cancellation does not apply a result or mark an expense confirmed", async () => {
  const result = await applyNativeOnce(
    actor,
    receipt,
    async () => false,
    async () => assert.fail("cancelled native use")
  );
  assert.equal(result.status, "cancelled");
  assert.equal(actor.getFlag(MODULE_ID, "nativeApplications")[receipt.requestId].expenseConfirmed, undefined);
});

test("an undefined native outcome stays reviewable across reload, without refund or retry", async () => {
  assert.equal(
    (
      await applyNativeOnce(
        actor,
        receipt,
        async () => undefined,
        async () => assert.fail()
      )
    ).status,
    "needs-review"
  );
  actor.flags = structuredClone(actor.flags);
  const result = await applyNativeOnce(
    actor,
    receipt,
    async () => assert.fail("retry"),
    async () => assert.fail()
  );
  assert.equal(result.status, "needs-review");
  assert.equal(nativeApplicationReply(actor, receipt.requestId).status, "needs-review");
});

test("post-expense document failure retains its receipt instead of claiming cancellation", async () => {
  const result = await applyNativeOnce(
    actor,
    receipt,
    async () => true,
    async () => {
      throw Error("target changed");
    }
  );
  assert.equal(result.status, "needs-review");
  assert.match(result.error, /target changed/);
  assert.equal(actor.getFlag(MODULE_ID, "nativeApplications")[receipt.requestId].expenseConfirmed, true);
  await applyNativeOnce(
    actor,
    receipt,
    async () => assert.fail("second cost"),
    async () => assert.fail()
  );
});
