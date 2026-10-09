import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { createSummonedCreature, installSummonSocket } from "../scripts/automation/shared/summons.mjs";

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
  globalThis.game = { user: gm, users, actors: [], socket: { on: (_channel, listener) => { socketListener = listener; } } };
  globalThis.canvas = { scene: {
    grid: { size: 100 }, async createEmbeddedDocuments(type, data) { tokenCreations.push(...data); return data; }
  } };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.foundry = { utils: { deepClone: structuredClone, mergeObject: (base, patch) => ({ ...base, ...patch }) } };
  globalThis.Actor = { async create(data) {
    creations.push(data);
    await new Promise(resolve => setImmediate(resolve));
    const actor = { ...data, id: "summonActor", getFlag: (module, key) => data.flags[module]?.[key] };
    game.actors.push(actor);
    return actor;
  } };
});

const owner = { uuid: "Actor.owner", name: "Owner", testUserPermission: user => user.id === "player" };
const summon = { kind: "test", name: "Summon", img: "icons/svg/mystery-man.svg", unique: true,
  hp: 20, hpFormula: "2 × 10" };

test("concurrent unique summons create only one actor and token", async () => {
  const [first, second] = await Promise.all([createSummonedCreature(owner, summon), createSummonedCreature(owner, summon)]);
  assert.equal(first, second);
  assert.equal(creations.length, 1);
  assert.equal(tokenCreations.length, 1);
  assert.equal(creations[0].system.attributes.hp.formula, "2 * 10");
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
  } finally { console.error = oldError; }
});

test("only the active GM processes a socket request, and repeated requests are ignored", async () => {
  installSummonSocket();
  globalThis.fromUuid = async () => owner;
  const request = { type: "create-summon", requestId: "once", ownerUuid: owner.uuid, userId: "player", summon };
  game.user = { id: "secondGM", isGM: true };
  socketListener(request);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(creations.length, 0);
  game.user = game.users.activeGM;
  socketListener(request);
  socketListener(request);
  await new Promise(resolve => setImmediate(() => setImmediate(resolve)));
  assert.equal(creations.length, 1);
  assert.equal(tokenCreations.length, 1);
  assert.ok(creations[0].flags[MODULE_ID].summoned);
});
