import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import {
  createSummonedCreature,
  createSummonedGroup,
  installSummonSocket,
  updateManagedSummon
} from "../scripts/automation/shared/summons.mjs";
import { receiveGmRequest } from "../scripts/automation/shared/gm-requests.mjs";
import {
  summonUnfinishedBusinessSpirit,
  validateGhostWalkerSummonUse
} from "../scripts/automation/classes/ghost-walker.mjs";

let creations;
let tokenCreations;
let socketListener;
beforeEach(() => {
  creations = [];
  tokenCreations = [];
  const gm = { id: "gm", isGM: true };
  const player = { id: "player", isGM: false };
  const users = [gm, player];
  users.activeGM = gm;
  users.get = id => users.find(user => user.id === id);
  let sequence = 0;
  const scene = {
    id: "scene",
    tokens: [],
    grid: { size: 100 },
    async createEmbeddedDocuments(type, data) {
      const documents = data.map(value => ({
        ...value,
        id: `token${++sequence}`,
        uuid: `Scene.scene.Token.token${sequence}`
      }));
      tokenCreations.push(...documents);
      this.tokens.push(...documents);
      return documents;
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.tokens = this.tokens.filter(token => !ids.includes(token.id));
    }
  };
  const scenes = [scene];
  scenes.get = id => scenes.find(s => s.id === id);
  globalThis.game = {
    user: gm,
    users,
    actors: [],
    scenes,
    time: { worldTime: 0 },
    socket: {
      on: (_channel, listener) => {
        socketListener = listener;
      },
      emit() {}
    }
  };
  globalThis.canvas = { scene };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.foundry = {
    utils: {
      randomID: () => `request${++sequence}`,
      deepClone: structuredClone,
      mergeObject: (base, patch) => ({ ...base, ...patch }),
      getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object)
    }
  };
  globalThis.Actor = {
    async create(data) {
      creations.push(data);
      await new Promise(resolve => setImmediate(resolve));
      const id = `summon${++sequence}`;
      const actor = {
        ...data,
        id,
        uuid: `Actor.${id}`,
        getFlag: (module, key) => data.flags[module]?.[key],
        async delete() {
          game.actors = game.actors.filter(value => value !== actor);
        },
        async update(update) {
          for (const [path, value] of Object.entries(update)) {
            const keys = path.split("."),
              key = keys.pop();
            let target = actor;
            for (const part of keys) target = target[part] ??= {};
            target[key] = value;
          }
        }
      };
      game.actors.push(actor);
      return actor;
    }
  };
  globalThis.fromUuid = async uuid =>
    game.actors.find(actor => actor.uuid === uuid) ?? (uuid === owner.uuid ? owner : null);
});

const owner = { uuid: "Actor.owner", name: "Owner", testUserPermission: user => user.id === "player" };
const summon = {
  kind: "test",
  name: "Summon",
  img: "icons/svg/mystery-man.svg",
  unique: true,
  hp: 20,
  hpFormula: "2 × 10"
};

test("concurrent unique summons create only one actor and token", async () => {
  const [first, second] = await Promise.all([
    createSummonedCreature(owner, summon),
    createSummonedCreature(owner, summon)
  ]);
  assert.equal(first, second);
  assert.equal(creations.length, 1);
  assert.equal(tokenCreations.length, 1);
  assert.equal(creations[0].system.attributes.hp.formula, "2 * 10");
});

test("changing a legacy familiar form reuses the same unique ally", async () => {
  const original = await createSummonedCreature(owner, {
    ...summon,
    kind: "familiar-spider",
    source: "insect-familiar"
  });
  delete original.flags[MODULE_ID].summonFamily;
  delete original.flags[MODULE_ID].summonManaged;
  const changed = await createSummonedCreature(owner, {
    ...summon,
    kind: "familiar-scorpion",
    source: "insect-familiar"
  });
  assert.equal(changed, original);
  assert.equal(creations.length, 1);
});

test("an inherited pending request is not charged or created again by another GM", async () => {
  const caster = {
    ...owner,
    getFlag: (_module, key) =>
      key === "summonRequests" ? { pending: { status: "pending", requestId: "pending" } } : null
  };
  const result = await createSummonedGroup(caster, [summon], { requestId: "pending" });
  assert.equal(result.status, "pending");
  assert.equal(creations.length, 0);
});

test("failed owner effects roll back only this request's summon and effects", async () => {
  const caster = {
    ...owner,
    effects: [],
    async createEmbeddedDocuments(type, data) {
      if (this.effects.length) throw Error("second effect invalid");
      const effect = {
        ...data[0],
        async delete() {
          caster.effects = caster.effects.filter(entry => entry !== effect);
        }
      };
      this.effects.push(effect);
      return [effect];
    }
  };
  const result = await createSummonedGroup(caster, [
    {
      ...summon,
      ownerEffects: [
        { name: "Penalty", flags: { [MODULE_ID]: { penalty: true } } },
        { name: "Invalid", flags: { [MODULE_ID]: { invalid: true } } }
      ]
    }
  ]);
  assert.equal(result.status, "failed");
  assert.equal(caster.effects.length, 0);
  assert.equal(game.actors.length, 0);
  assert.equal(canvas.scene.tokens.length, 0);
});

test("failed actor creation does not attempt token placement and permits a retry", async () => {
  const original = Actor.create;
  Actor.create = async () => undefined;
  const oldError = console.error;
  console.error = () => {};
  try {
    assert.equal(await createSummonedCreature(owner, summon), false);
    assert.equal(tokenCreations.length, 0);
    Actor.create = original;
    assert.ok(await createSummonedCreature(owner, summon));
    assert.equal(tokenCreations.length, 1);
  } finally {
    console.error = oldError;
  }
});

test("only the active GM processes a socket request, and repeated requests are ignored", async () => {
  installSummonSocket();
  globalThis.fromUuid = async () => owner;
  const request = {
    type: "create-summon",
    requestId: "once",
    ownerUuid: owner.uuid,
    userId: "player",
    data: { summons: [summon], sceneId: "scene" }
  };
  game.user = { id: "secondGM", isGM: true };
  socketListener(request, "player");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(creations.length, 0);
  game.user = game.users.activeGM;
  await Promise.all([receiveGmRequest(request, "player"), receiveGmRequest(request, "player")]);
  assert.equal(creations.length, 1);
  assert.equal(tokenCreations.length, 1);
  assert.ok(creations[0].flags[MODULE_ID].summoned);
});

test("requested scene is used even when GM views a different scene", async () => {
  const target = {
    id: "player-scene",
    tokens: [],
    grid: { size: 100 },
    async createEmbeddedDocuments(type, data) {
      const token = { ...data[0], id: "other-token", uuid: "Scene.player-scene.Token.other-token" };
      this.tokens.push(token);
      return [token];
    }
  };
  game.scenes.push(target);
  await createSummonedCreature(owner, summon, { sceneId: target.id });
  assert.equal(target.tokens.length, 1);
  assert.equal(canvas.scene.tokens.length, 0);
});

test("a partially failed group removes its documents and refunds only its resource cost", async () => {
  const resource = {
    uuid: "Actor.owner.Item.points",
    parent: owner,
    system: { uses: { max: "3", spent: 0 } },
    async update(update) {
      this.system.uses.spent = update["system.uses.spent"];
    }
  };
  const originalFromUuid = fromUuid;
  globalThis.fromUuid = async uuid => (uuid === resource.uuid ? resource : originalFromUuid(uuid));
  const originalCreate = Actor.create;
  let attempts = 0;
  Actor.create = async data => (++attempts === 2 ? undefined : originalCreate(data));
  const result = await createSummonedGroup(
    owner,
    [
      { ...summon, unique: false },
      { ...summon, unique: false }
    ],
    {
      resource: { itemUuid: resource.uuid, cost: 2 }
    }
  );
  assert.equal(result.status, "failed");
  assert.equal(game.actors.length, 0);
  assert.equal(canvas.scene.tokens.length, 0);
  assert.equal(resource.system.uses.spent, 0);
});

test("unique summon updates preserve wounds and never heal a dead ally", async () => {
  const actor = await createSummonedCreature(owner, summon);
  actor.system.attributes.hp.value = 12;
  await updateManagedSummon(actor, { ...summon, hp: 30 });
  assert.equal(actor.system.attributes.hp.value, 22);
  actor.system.attributes.hp.value = 0;
  await updateManagedSummon(actor, { ...summon, hp: 40 });
  assert.equal(actor.system.attributes.hp.value, 0);
  actor.system.attributes.ac.flat = 25;
  await updateManagedSummon(actor, { ...summon, hp: 40, ac: 12 });
  assert.equal(actor.system.attributes.ac.flat, 25);
});

test("a native consumed ghost summon is not rejected or charged twice", async () => {
  const caster = { ...owner, items: [{ type: "class", system: { identifier: "ghost-walker", levels: 5 } }] };
  const feature = {
    id: "spirit-use",
    uuid: "Actor.owner.Item.spirit-use",
    parent: caster,
    system: { uses: { max: "1", spent: 0 } },
    async update(update) {
      this.system.uses.spent = update["system.uses.spent"];
    }
  };
  const original = fromUuid;
  globalThis.fromUuid = async uuid => (uuid === feature.uuid ? feature : original(uuid));
  assert.equal(validateGhostWalkerSummonUse(caster, { item: feature }), true);
  feature.system.uses.spent = 1;
  assert.ok(await summonUnfinishedBusinessSpirit(caster, { item: feature }, { consumed: true }));
  assert.equal(feature.system.uses.spent, 1);
});
