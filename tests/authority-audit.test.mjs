import assert from "node:assert/strict";
import { test } from "node:test";

// Document and combat hooks fire on every connected client. This audit
// registers every hook as a connected player while a GM is active, calls each
// broadcast-hook handler with recording mock documents the player owns, and
// fails if any handler tries to write a document on that non-authority client.
// Mocks cannot satisfy every branch (identity comparisons, instanceof), so a
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
  "modifyTokenAttribute"
]);
const BROADCAST =
  /^(create|update|delete)(Item|Actor|ActiveEffect|Token|Combat|Combatant|ChatMessage|Region|MeasuredTemplate|Scene)$|^(combatTurnChange|combatRound|combatStart|canvasReady|updateWorldTime|moveToken)$/;
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
      if (prop === "documentName") {
        const hook = /^(?:create|update|delete)(\w+)\.doc$/.exec(label);
        if (hook) return hook[1];
        return label.endsWith(".parent") || label.endsWith(".actor") ? "Actor" : "Item";
      }
      if (prop === "type") return label.includes("Item") ? "class" : "character";
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

async function writesOnPlayerClient(handler, hook) {
  writes = [];
  try {
    const result = handler(mock(`${hook}.doc`), mock(`${hook}.changes`), mock(`${hook}.options`), "gm");
    if (result?.then) await Promise.race([result.catch(() => {}), new Promise(resolve => setTimeout(resolve, 200))]);
  } catch {
    // Mock documents can break deep code paths; only recorded writes matter.
  }
  await new Promise(resolve => setTimeout(resolve, 60));
  return [...new Set(writes)];
}

const hooks = [];
const GM = { id: "gm", isGM: true, active: true },
  PLAYER = { id: "player", isGM: false };
globalThis.Hooks = {
  on: (name, fn) => hooks.push([name, fn]),
  once: (name, fn) => hooks.push([name, fn]),
  off() {},
  call: () => true,
  callAll: () => true
};
globalThis.game = {
  user: PLAYER,
  userId: "player",
  users: Object.assign([GM, PLAYER], { activeGM: GM, get: id => (id === "gm" ? GM : PLAYER) }),
  settings: { get: () => true, register() {}, registerMenu() {} },
  socket: { on() {}, emit() {} },
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
globalThis.fromUuid = async () => mock("fromUuid");
globalThis.fromUuidSync = () => mock("fromUuidSync");
const { registerAutomation } = await import("../scripts/automation/runtime.mjs");
const { onAuthority } = await import("../scripts/automation/shared/authority.mjs");
registerAutomation();
const registered = hooks.filter(([name]) => BROADCAST.test(name));

test("no broadcast hook writes documents on a non-authority client", async () => {
  assert.ok(registered.length > 100, `only ${registered.length} broadcast hooks registered`);
  const offenders = [];
  for (const [name, handler] of registered) {
    const found = await writesOnPlayerClient(handler, name);
    if (found.length)
      offenders.push(`${name}: ${found.join(", ")} — ${String(handler).slice(0, 120).replace(/\s+/g, " ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("the audit catches an unguarded write and accepts onAuthority", async () => {
  const unguarded = effect => effect.parent.update({ flag: null });
  assert.notDeepEqual(await writesOnPlayerClient(unguarded, "deleteActiveEffect"), []);
  hooks.length = 0;
  onAuthority(
    "deleteActiveEffect",
    effect => effect.parent,
    actor => actor.update({ flag: null })
  );
  assert.deepEqual(await writesOnPlayerClient(hooks[0][1], "deleteActiveEffect"), []);
});
