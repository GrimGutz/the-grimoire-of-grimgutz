import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  gmRequestResult,
  receiveGmRequest,
  registerGmRequest,
  requestGm
} from "../scripts/automation/shared/gm-requests.mjs";

test("module manifest registers the custom socket channel", async () => {
  const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
  assert.equal(manifest.socket, true);
});
test("timeout remains pending and a later authenticated GM result is retained", async () => {
  const player = { id: "player" },
    gm = { id: "gm", isGM: true };
  const users = new Map([
    [player.id, player],
    [gm.id, gm]
  ]);
  users.activeGM = gm;
  let sent;
  globalThis.game = {
    user: player,
    users,
    socket: {
      on() {},
      emit(channel, data) {
        sent = data;
      }
    }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  registerGmRequest("timeout-test", async () => ({ status: "success" }));
  const result = await requestGm(
    "timeout-test",
    { uuid: "Actor.one" },
    { sceneId: "requested" },
    { timeoutMs: 5, requestId: "slow" }
  );
  assert.equal(sent.data.sceneId, "requested");
  assert.equal(result.status, "pending");
  await receiveGmRequest({ recipientUserId: player.id, requestId: "slow", result: { status: "success" } }, player.id);
  assert.equal(gmRequestResult("slow").status, "pending");
  await receiveGmRequest({ recipientUserId: player.id, requestId: "slow", result: { status: "success" } }, gm.id);
  assert.equal(gmRequestResult("slow").status, "success");
});
test("GM verifies the authenticated sender instead of trusting payload userId", async () => {
  const gm = { id: "gm", isGM: true },
    player = { id: "player" };
  const users = new Map([
    [gm.id, gm],
    [player.id, player]
  ]);
  users.activeGM = gm;
  globalThis.game = { user: gm, users, socket: { emit() {} } };
  let called = 0;
  registerGmRequest("spoof-test", async () => {
    called++;
    return { status: "success" };
  });
  await receiveGmRequest(
    { type: "spoof-test", ownerUuid: "Actor.one", userId: "gm", requestId: "spoof", data: {} },
    player.id
  );
  assert.equal(called, 0);
});
