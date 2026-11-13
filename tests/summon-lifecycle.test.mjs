import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { synchronizeSummonLifecycle, manageSummons } from "../scripts/automation/shared/summon-lifecycle.mjs";

let actors, scene, owner;
beforeEach(() => {
  actors = [];
  const gm = { id: "gm", isGM: true },
    player = { id: "player", isGM: false };
  const users = new Map([
    [gm.id, gm],
    [player.id, player]
  ]);
  users.activeGM = gm;
  owner = { id: "owner", uuid: "Actor.owner" };
  scene = {
    tokens: [],
    async deleteEmbeddedDocuments(type, ids) {
      this.tokens = this.tokens.filter(token => !ids.includes(token.id));
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const update of updates)
        Object.assign(
          this.tokens.find(token => token.id === update._id),
          update
        );
    }
  };
  globalThis.game = { user: gm, users, actors, scenes: [scene], time: { worldTime: 0 } };
  globalThis.fromUuid = async uuid => (uuid === owner.uuid ? owner : null);
});
function summon({ seconds = 60, hp = 10, concentration = null } = {}) {
  const lifecycle = {
    seconds,
    expiresAt: seconds,
    controlled: true,
    ...(concentration ? { concentrationEffectUuid: concentration } : {})
  };
  const actor = {
    id: `summon${actors.length}`,
    uuid: `Actor.summon${actors.length}`,
    system: { attributes: { hp: { value: hp } } },
    ownership: { default: 2, player: 3 },
    flags: { [MODULE_ID]: { summonedBy: owner.uuid, summonRequestId: "created", summonLifecycle: lifecycle } },
    getFlag(module, key) {
      return this.flags[module]?.[key];
    },
    async delete() {
      game.actors = game.actors.filter(entry => entry !== actor);
    },
    async update(update) {
      if (update.ownership) this.ownership = update.ownership;
      if (update[`flags.${MODULE_ID}.summonLifecycle`])
        this.flags[MODULE_ID].summonLifecycle = update[`flags.${MODULE_ID}.summonLifecycle`];
    }
  };
  actors.push(actor);
  scene.tokens.push({ id: `${actor.id}-token`, actorId: actor.id, actor, disposition: 1 });
  return actor;
}
test("a temporary spirit disappears exactly at the deadline", async () => {
  summon();
  game.time.worldTime = 59;
  await synchronizeSummonLifecycle();
  assert.equal(game.actors.length, 1);
  game.time.worldTime = 60;
  await synchronizeSummonLifecycle();
  assert.equal(game.actors.length, 0);
  assert.equal(scene.tokens.length, 0);
});
test("zero HP on a synthetic token removes the temporary summon", async () => {
  summon();
  scene.tokens[0].actor = { system: { attributes: { hp: { value: 0 } } } };
  await synchronizeSummonLifecycle();
  assert.equal(game.actors.length, 0);
});

test("one inaccessible summon does not block expiration of the others", async () => {
  const broken = summon();
  broken.delete = async () => {
    throw Error("document unavailable");
  };
  const normal = summon();
  game.time.worldTime = 60;
  const previous = console.error;
  console.error = () => {};
  try {
    await synchronizeSummonLifecycle();
  } finally {
    console.error = previous;
  }
  assert.ok(game.actors.includes(broken));
  assert.ok(!game.actors.includes(normal));
});
test("lost ritualist concentration makes the spirit hostile without deleting it", async () => {
  const actor = summon({ seconds: 600, concentration: "Actor.owner.ActiveEffect.expired" });
  await synchronizeSummonLifecycle();
  assert.equal(game.actors.length, 1);
  assert.equal(actor.getFlag(MODULE_ID, "summonLifecycle").controlled, false);
  assert.equal(scene.tokens[0].disposition, -1);
  assert.equal(actor.ownership.player, 2);
  game.time.worldTime = 600;
  await synchronizeSummonLifecycle();
  assert.equal(game.actors.length, 0);
});

test("regaining spirits validates the concentration limit before action cost or roll", async () => {
  const spirit = summon({ seconds: 600 });
  spirit.flags[MODULE_ID].summonLifecycle.controlled = false;
  spirit.flags[MODULE_ID].summonLifecycle.activityUuid = "summoning";
  owner.concentration = { effects: new Set(["another-spell"]) };
  owner.system = { attributes: { concentration: { limit: 1 } } };
  owner.items = [];
  let cost = 0,
    rolls = 0;
  owner.rollConcentration = async () => {
    rolls++;
    return [{ total: 20 }];
  };
  owner.beginConcentrating = async () => ({ uuid: "new-concentration" });
  const action = {
    actor: owner,
    id: "regain",
    toObject: () => ({ type: "utility" }),
    item: { clone: () => ({ system: { activities: new Map([["regain", {}]]) } }) }
  };
  globalThis.fromUuid = async uuid => (uuid === "regain" ? action : uuid === "summoning" ? {} : owner);
  globalThis.foundry = { utils: { randomID: () => "busy-concentration" } };
  globalThis.MidiQOL = {
    completeActivityUse: async () => {
      cost++;
      return true;
    }
  };
  await assert.rejects(
    manageSummons(owner, { action: "regain", dc: 10, activityUuid: "regain" }),
    /другую концентрацию/
  );
  assert.equal(cost, 0);
  assert.equal(rolls, 0);
});
