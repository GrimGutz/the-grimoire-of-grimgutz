import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { automationData } from "../scripts/automation/shared/helpers.mjs";
import { useNativeUtility, reactionAttack } from "../scripts/automation/shared/native-actions.mjs";
import { installLeaderStratagemHooks, useLeaderStratagem } from "../scripts/automation/classes/leader-stratagems.mjs";
import { leaderDocuments } from "../src/packs/leader-features.mjs";

function merge(original, patch) {
  const result = structuredClone(original);
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes(".")) {
      const path = key.split("."),
        last = path.pop();
      let parent = result;
      for (const part of path) parent = parent[part] ??= {};
      parent[last] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value))
      result[key] = merge(result[key] ?? {}, value);
    else result[key] = structuredClone(value);
  }
  return result;
}

let actor, ally, source, recipient, scene, activity, prompts, nativeCalls, callbacks, documents, nativeResult;
function ownedItem(data, owner = actor) {
  const item = {
    ...data,
    uuid: `${owner.uuid}.Item.${data._id}`,
    actor: owner,
    toObject: () => structuredClone(data),
    clone: patch => ownedItem(merge(data, patch), owner)
  };
  item.system = {
    ...data.system,
    activities: new Map(
      Object.entries(data.system.activities ?? {}).map(([id, body]) => [
        id,
        { ...body, id, uuid: `${item.uuid}.Activity.${id}`, item, actor: owner, toObject: () => structuredClone(body) }
      ])
    )
  };
  return item;
}
function makeActor(uuid) {
  const flags = {};
  return {
    uuid,
    name: uuid,
    isOwner: true,
    items: [],
    effects: [],
    statuses: new Set(),
    system: { attributes: { prof: 3, hp: { value: 20, temp: 0 }, movement: { walk: 30, units: "ft" } } },
    getFlag: (module, key) => flags[module]?.[key],
    async setFlag(module, key, value) {
      flags[module] ??= {};
      flags[module][key] = value;
    },
    async createEmbeddedDocuments(type, rows) {
      assert.equal(type, "ActiveEffect");
      return rows.map(data => {
        const effect = { ...data, uuid: `${uuid}.ActiveEffect.${this.effects.length}`, parent: this };
        this.effects.push(effect);
        return effect;
      });
    }
  };
}

beforeEach(() => {
  let sequence = 0;
  prompts = [];
  nativeCalls = [];
  callbacks = new Map();
  documents = new Map();
  nativeResult = { id: "native-use" };
  const users = [];
  users.activeGM = { id: "gm", isGM: true };
  const ledgerFlags = { automationLedger: true, events: [] };
  globalThis.game = {
    user: users.activeGM,
    users,
    combats: [],
    settings: { get: () => true },
    time: { worldTime: 100 },
    journal: [
      {
        getFlag: (_module, key) => ledgerFlags[key],
        async setFlag(_module, key, value) {
          ledgerFlags[key] = value;
        }
      }
    ]
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.CONFIG = {
    ActiveEffect: { expiryEvents: { turnStart: {} }, documentClass: { getEffectStart: () => ({ time: 100 }) } }
  };
  globalThis.foundry = {
    utils: { escapeHTML: String, randomID: () => `id-${++sequence}`, deepClone: structuredClone },
    applications: {
      api: {
        DialogV2: {
          async wait(dialog) {
            prompts.push(dialog);
            return dialog.content.includes('type="checkbox"') ? [recipient.uuid] : "yes";
          }
        }
      }
    }
  };
  globalThis.Hooks = {
    on(name, handler) {
      const handlers = callbacks.get(name) ?? [];
      handlers.push(handler);
      callbacks.set(name, handlers);
      return handler;
    },
    off(name, handler) {
      callbacks.set(
        name,
        (callbacks.get(name) ?? []).filter(entry => entry !== handler)
      );
    },
    call(name, ...args) {
      return (callbacks.get(name) ?? []).some(handler => handler(...args) === false) ? false : true;
    }
  };
  actor = makeActor("Actor.leader");
  ally = makeActor("Actor.ally");
  actor.items = [{ type: "class", system: { identifier: "leader", levels: 3 } }];
  scene = { id: "scene", grid: { units: "ft", size: 100, distance: 5 }, tokens: [] };
  source = { uuid: "Scene.scene.Token.leader", id: "leader", actor, parent: scene, disposition: 1, x: 0, y: 0 };
  recipient = { uuid: "Scene.scene.Token.ally", id: "ally", actor: ally, parent: scene, disposition: 1, x: 100, y: 0 };
  scene.tokens = [source, recipient];
  globalThis.canvas = { ready: true, scene, tokens: { controlled: [{ actor, document: source }] } };
  for (const doc of [actor, ally, source, recipient]) documents.set(doc.uuid, doc);
  globalThis.fromUuid = async uuid => documents.get(uuid);
  const item = ownedItem(leaderDocuments.find(item => item.system.identifier === "stratagem-watch-out"));
  actor.items.push(item);
  activity = [...item.system.activities.values()][0];
  documents.set(activity.uuid, activity);
  globalThis.MidiQOL = {
    hasUsedReaction: () => false,
    async completeActivityUse(input, usage, dialog) {
      nativeCalls.push({ input, usage, dialog });
      // Midi and D&D5e clone the Item before firing the native hook. Check the
      // marker through the same parser, without allowing an unbounded recursion.
      const copy = input.item.clone({}).system.activities.get(input.id);
      assert.equal(automationData(copy).leaderResolved, true, "native replay must retain its resolved marker");
      assert.equal(Hooks.call("dnd5e.preUseActivity", copy, usage, dialog), true);
      return nativeResult;
    }
  };
  installLeaderStratagemHooks();
});

test("document flags containing only a replay marker survive normalization", () => {
  for (const flags of [
    { leaderResolved: true },
    { leaderResolved: true, action: "", moduleAction: "" },
    { areaResolved: true },
    { customMarker: true }
  ]) {
    const data = automationData({ flags: { [MODULE_ID]: flags } });
    for (const [key, value] of Object.entries(flags)) assert.equal(data[key], value, key);
  }
});

test("all stratagem variants keep the replay marker through native Item cloning", async () => {
  for (const card of leaderDocuments.filter(item => item.flags[MODULE_ID].stratagem)) {
    const item = ownedItem(card);
    for (const entry of item.system.activities.values()) {
      await useNativeUtility(entry);
      assert.equal(automationData(entry).leaderResolved, undefined, "owned documents must not be changed");
    }
  }
  assert.ok(nativeCalls.length >= 17);
  assert.equal(prompts.length, 0);
});

test("a confirmed stratagem reaches one native activation and applies its effect", async () => {
  const result = await useLeaderStratagem(activity);
  assert.equal(result.status, "completed", JSON.stringify(game.journal[0].getFlag(MODULE_ID, "events")));
  assert.equal(prompts.length, 2);
  assert.equal(nativeCalls.length, 1);
  assert.equal(ally.effects.length, 1);
  assert.equal(ally.effects[0].flags[MODULE_ID].combatBenefit.kind, "dodge");
  assert.equal(ally.getFlag(MODULE_ID, "leaderStratagemReceived").commandId, "native-use");
});

test("native bookkeeping does not ask Midi to choose the recipients a second time", async () => {
  await useNativeUtility(activity);
  const { input, usage } = nativeCalls[0];
  assert.equal(input.target.affects.type, "self");
  assert.equal(input.target.affects.choice, false);
  assert.equal(input.target.affects.count, "");
  assert.equal(input.target.prompt, false);
  assert.equal(input.range.units, "self");
  assert.equal(usage.midiOptions.ignoreUserTargets, true);
  assert.notEqual(usage.consume, false, "native action/resource consumption must remain enabled");
  assert.equal(activity.target.affects.type, "creature", "do not rewrite the owned card");
});

test("Midi interception selects recipients before native target validation", async () => {
  assert.ok(callbacks.has("midi-qol.preTargetingV2"));
  assert.equal(Hooks.call("midi-qol.preTargetingV2", { workflow: { activity } }), false);
  // All remaining work is asynchronous because Foundry's cancellable hooks are
  // synchronous. Wait for the original request to finish, not for another use.
  for (let i = 0; i < 20 && !ally.effects.length; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts.length, 2);
  assert.equal(nativeCalls.length, 1);
  assert.equal(ally.effects.length, 1);
  assert.equal(Hooks.call("midi-qol.preTargetingV2", { workflow: { activity: nativeCalls[0].input } }), true);
});

test("canceling recipient selection does not activate Midi or create effects", async () => {
  foundry.applications.api.DialogV2.wait = async () => null;
  assert.equal((await useLeaderStratagem(activity)).status, "cancelled");
  assert.equal(nativeCalls.length, 0);
  assert.equal(ally.effects.length, 0);
});

test("an aborted native activation does not apply a stratagem", async () => {
  nativeResult = { aborted: true };
  assert.equal((await useLeaderStratagem(activity)).status, "cancelled");
  assert.equal(ally.effects.length, 0);
  assert.equal(ally.getFlag(MODULE_ID, "leaderStratagemReceived"), undefined);
});

test("reaction attacks retain the replay marker and bypass stratagem selection", async () => {
  const item = ownedItem({
    _id: "weapon",
    type: "weapon",
    name: "Sword",
    flags: {},
    system: {
      activities: {
        attack: {
          _id: "attack",
          type: "attack",
          activation: { type: "action" },
          attack: { bonus: "" },
          flags: {},
          consumption: { targets: [] }
        }
      }
    }
  });
  const attack = item.system.activities.get("attack");
  await reactionAttack(source, recipient, { prepared: { item, activity: attack } });
  assert.equal(nativeCalls.length, 1);
  assert.equal(prompts.length, 0);
});
