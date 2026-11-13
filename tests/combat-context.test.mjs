import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID, FLAGS } from "../scripts/automation/shared/constants.mjs";
import { combatTurnSnapshot, encounterForScene } from "../scripts/automation/shared/combat-flow.mjs";
import { cleanupCombatBenefits } from "../scripts/automation/shared/combat-benefits.mjs";
import { registerGmRequest, requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { validateStratagemUse, handleStratagemUse } from "../scripts/automation/classes/leader.mjs";
test("scene-unlinked encounters preserve participant identity and immutable turn numbers", () => {
  const scene = { id: "one" },
    token = { uuid: "Scene.one.Token.a", id: "a", parent: scene };
  const combat = {
    id: "c",
    started: true,
    scene: null,
    round: 2,
    turn: 1,
    combatant: { token },
    previous: { round: 2, turn: 0 },
    turns: [{ token }]
  };
  globalThis.game = { combats: [combat] };
  const snapshot = combatTurnSnapshot(combat);
  combat.previous.round = 3;
  assert.equal(snapshot.previous.round, 2);
  assert.equal(snapshot.current.scene, scene);
  assert.equal(encounterForScene(scene, token), combat);
});
test("a scene-unlinked encounter does not delete another participant's still-active bonus", async () => {
  const scene = { id: "one", tokens: [] },
    token = { uuid: "Scene.one.Token.a", id: "a", parent: scene };
  scene.tokens.push(token);
  let deleted = 0;
  const data = {
    combatId: "c",
    createdTurn: "c:1:0",
    sourceTokenUuid: token.uuid,
    targetTokenUuid: token.uuid,
    expiry: "targetStart"
  };
  const actor = {
    uuid: "Actor.a",
    effects: [
      {
        getFlag: (_m, key) => (key === "combatBenefit" ? data : null),
        async delete() {
          deleted++;
        }
      }
    ]
  };
  globalThis.game = {
    user: { isGM: true },
    settings: { get: () => true },
    actors: [actor],
    scenes: new Map([["one", scene]])
  };
  await cleanupCombatBenefits(
    {
      id: "c",
      started: true,
      scene: null,
      round: 1,
      turn: 1,
      previous: { round: 1, turn: 0 },
      combatant: { token: { ...token, uuid: "Scene.one.Token.b", id: "b" } },
      turns: [{ token }]
    },
    { turn: 1 }
  );
  assert.equal(deleted, 0);
});
test("local GM retries share one operation instead of repeating prompts and expenditure", async () => {
  let count = 0;
  globalThis.game = { user: { isGM: true, id: "gm" } };
  registerGmRequest("retry-test", async () => {
    count++;
    await Promise.resolve();
    return { status: "success" };
  });
  const actor = { uuid: "Actor.retry" };
  await Promise.all([
    requestGm("retry-test", actor, {}, { requestId: "one" }),
    requestGm("retry-test", actor, {}, { requestId: "one" })
  ]);
  assert.equal(count, 1);
});
test("boolean GM results are explicit cancellations, not truthy empty receipts", async () => {
  globalThis.game = { user: { isGM: true, id: "gm" } };
  registerGmRequest("boolean-test", async () => false);
  assert.equal((await requestGm("boolean-test", { uuid: "Actor.a" }, {}, { requestId: "cancel" })).status, "cancelled");
});

test("leader stratagem lock uses the actor's encounter, not the GM's selected combat", () => {
  const actor = { uuid: "Actor.leader", getFlag: (_m, key) => key === FLAGS.LEADER_STRATAGEM_LOCK };
  globalThis.game = {
    combat: { started: false },
    combats: [{ id: "actual", started: true, scene: null, turns: [{ actor }] }]
  };
  globalThis.ui = { notifications: { warn() {} } };
  assert.equal(validateStratagemUse({ actor, item: { flags: { [MODULE_ID]: { stratagem: true } } } }), false);
});

test("leader state and frontline speed retain their original turn across document awaits", async () => {
  const flags = {};
  let created;
  const actor = {
    uuid: "Actor.leader",
    isOwner: true,
    effects: [],
    items: [{ type: "feat", system: { identifier: "frontline-commander" } }],
    system: { attributes: { movement: { walk: 30 } } },
    getFlag: (_m, key) => flags[key],
    async setFlag(_m, key, value) {
      flags[key] = value;
      combat.round = 99;
      combat.combatant = { actor: { uuid: "other" } };
    },
    async createEmbeddedDocuments(_type, rows) {
      created = rows[0];
      return rows;
    }
  };
  const combat = {
    id: "actual",
    started: true,
    scene: null,
    round: 1,
    turn: 0,
    combatant: { actor },
    turns: [{ actor }]
  };
  globalThis.game = {
    user: { isGM: true },
    users: [],
    settings: { get: () => true },
    combat: { started: false },
    combats: [combat]
  };
  await handleStratagemUse({ actor, item: { flags: { [MODULE_ID]: { stratagem: true } } } });
  assert.deepEqual(flags[FLAGS.LEADER_STRATAGEM_LOCK], { combat: "actual", round: 1, turn: 0 });
  assert.equal(created.flags[MODULE_ID][FLAGS.FRONTLINE_EFFECT].skipCurrentTurnEnd, true);
});
