import assert from "node:assert/strict";
import { test } from "node:test";

// The GM relay checks that the requester owns the request's owner actor. Every
// other document a request names (activities, source tokens, targets, zones)
// must be checked by the handler. This audit sends each registered request as
// a player who owns the owner actor, with every *Uuid field forged to point at
// documents of another actor, and fails if the GM then writes to anything but
// the requester's own actor. Mock documents cannot satisfy every branch, so a
// pass is evidence rather than proof; a failure is always worth a look.

const MUTATORS = new Set([
  "update",
  "delete",
  "setFlag",
  "unsetFlag",
  "createEmbeddedDocuments",
  "updateEmbeddedDocuments",
  "deleteEmbeddedDocuments",
  "toggleStatusEffect",
  "applyDamage",
  "modifyTokenAttribute",
  "updateSource"
]);
let writes = [];

function mock(label, depth = 0) {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) return hint => (hint === "number" ? 1 : `mock:${label}`);
      if (prop === Symbol.iterator)
        return function* () {
          if (depth < 3) yield mock(`${label}[0]`, depth + 1);
        };
      if (typeof prop === "symbol" || prop === "then") return undefined;
      if (prop === "isOwner" || prop === "started" || prop === "active") return true;
      if (prop === "isGM") return false;
      if (prop === "id" || prop === "uuid" || prop === "_id") return `${label}.id`;
      if (prop === "length" || prop === "size") return 1;
      if (prop === "toJSON") return () => label;
      if (MUTATORS.has(prop))
        return () => {
          writes.push(`${label}.${prop}`);
          return Promise.resolve(mock(`${label}.${prop}()`, depth + 1));
        };
      return depth > 8 ? undefined : mock(`${label}.${prop}`, depth + 1);
    },
    apply: () => (depth > 8 ? undefined : mock(`${label}()`, depth + 1)),
    construct: () => mock(`new ${label}`, depth + 1)
  });
}

// Request data as a player would forge it: every uuid names another actor's document.
const forgedData = () =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (/Uuids$/.test(prop)) return [`Forged.${prop}`];
        if (/Uuid$/.test(prop)) return `Forged.${prop}`;
        return undefined;
      },
      has: () => false,
      ownKeys: () => []
    }
  );

const GM = { id: "gm", isGM: true, active: true },
  PLAYER = { id: "player", isGM: false, active: true };
globalThis.Hooks = { on() {}, once() {}, off() {}, call: () => true, callAll: () => true };
const emitted = [];
globalThis.game = {
  user: GM,
  userId: "gm",
  users: Object.assign([GM, PLAYER], { activeGM: GM, get: id => (id === "gm" ? GM : PLAYER) }),
  settings: { get: () => true, register() {}, registerMenu() {} },
  socket: { on() {}, emit: (_channel, payload) => emitted.push(payload) },
  modules: new Map(),
  packs: new Map(),
  time: { worldTime: 0 },
  system: { id: "dnd5e", version: "6.0.6" },
  actors: mock("game.actors"),
  scenes: mock("game.scenes"),
  combat: mock("game.combat"),
  combats: mock("game.combats"),
  i18n: { localize: text => text, format: text => text }
};
for (const name of [
  "foundry",
  "CONFIG",
  "canvas",
  "ui",
  "ChatMessage",
  "Roll",
  "Actor",
  "Item",
  "ActiveEffect",
  "MidiQOL",
  "CONST"
])
  globalThis[name] ??= mock(name);
globalThis.fromUuid = async uuid =>
  uuid === "Owner.uuid" ? mock("owner") : mock(`foreign:${String(uuid).replace(/^Forged\./, "")}`);
globalThis.fromUuidSync = uuid => mock(`foreign:${String(uuid).replace(/^Forged\./, "")}`);

const { registerAutomation } = await import("../scripts/automation/runtime.mjs");
const { receiveGmRequest, registeredGmRequests } = await import("../scripts/automation/shared/gm-requests.mjs");
registerAutomation();

async function forgedWrites(type) {
  writes = [];
  const request = receiveGmRequest(
    { type, requestId: `forged-${type}`, ownerUuid: "Owner.uuid", userId: "player", data: forgedData() },
    "player"
  ).catch(() => {});
  await Promise.race([request, new Promise(resolve => setTimeout(resolve, 300))]);
  await new Promise(resolve => setTimeout(resolve, 20));
  return [...new Set(writes)].filter(write => !write.startsWith("owner"));
}

test("no GM request writes another actor's documents when its uuids are forged", async () => {
  const types = registeredGmRequests();
  assert.ok(types.length > 100, `only ${types.length} GM requests registered`);
  const offenders = [];
  for (const type of types) {
    const found = await forgedWrites(type);
    if (found.length) offenders.push(`${type}: ${found.join(", ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("the audit catches a handler that trusts a forged uuid and accepts one that checks it", async () => {
  const { registerGmRequest } = await import("../scripts/automation/shared/gm-requests.mjs");
  const { requireOwned } = await import("../scripts/automation/shared/request-validation.mjs");
  registerGmRequest("audit-trusting", async (_actor, data) => (await fromUuid(data.targetUuid)).update({ hp: 0 }));
  registerGmRequest("audit-checking", async (actor, data) =>
    (await requireOwned(data.targetUuid, actor)).update({ hp: 0 })
  );
  assert.deepEqual(await forgedWrites("audit-trusting"), ["foreign:targetUuid.update"]);
  assert.deepEqual(await forgedWrites("audit-checking"), []);
});
