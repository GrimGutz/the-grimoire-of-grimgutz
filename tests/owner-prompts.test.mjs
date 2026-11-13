import assert from "node:assert/strict";
import { test } from "node:test";
import { askOwner, receiveOwnerPrompt, promptOwner } from "../scripts/automation/shared/owner-prompts.mjs";

test("owner prompt chooses an active character owner and rejects forged or out-of-choice replies", async () => {
  const gm = { id: "gm", active: true, isGM: true },
    player = { id: "player", active: true, character: { uuid: "Actor.one" } };
  const users = [gm, player];
  users.activeGM = gm;
  const actor = { uuid: "Actor.one", testUserPermission: user => user.id === "player" };
  const emitted = [];
  globalThis.game = {
    users,
    user: gm,
    socket: {
      on() {},
      emit(channel, payload) {
        emitted.push(payload);
      }
    }
  };
  assert.equal(promptOwner(actor).id, "player");
  let resolved = false;
  const answer = askOwner(
    actor,
    {
      choices: [
        ["yes", "Apply"],
        ["no", "Decline"]
      ]
    },
    { id: "owner-test" }
  ).then(value => {
    resolved = true;
    return value;
  });
  await Promise.resolve();
  await receiveOwnerPrompt({ automationPromptReply: true, id: "owner-test", value: "yes" }, "intruder");
  await receiveOwnerPrompt({ automationPromptReply: true, id: "owner-test", value: "inject" }, "player");
  assert.equal(resolved, false);
  await receiveOwnerPrompt({ automationPromptReply: true, id: "owner-test", value: "no" }, "player");
  assert.equal(await answer, "no");
  assert.equal(emitted.length, 1);
});
