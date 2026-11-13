import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import {
  automationActors,
  everyActor,
  hasModuleData,
  installActorIndexHooks,
  invalidateActorIndex
} from "../scripts/automation/shared/actor-index.mjs";

const moduleFlags = { [MODULE_ID]: { feature: "x" } };
let reads, hooks;
const actor = (id, { items = [], effects = [], flags = {} } = {}) => ({
  id,
  uuid: `Actor.${id}`,
  items,
  effects,
  flags
});
// A token whose synthetic actor (base data plus delta) is only built, and counted, when read.
const unlinked = (scene, id, base, delta = {}) => {
  const source = () => game.actors.get(base);
  const synthetic = {
    ...actor(`${scene}.${id}`),
    get items() {
      return [...source().items, ...(delta.items ?? [])];
    },
    get effects() {
      return [...source().effects, ...(delta.effects ?? [])];
    },
    get flags() {
      return { ...source().flags, ...(delta.flags ?? {}) };
    }
  };
  return {
    id,
    actorLink: false,
    actorId: base,
    _source: { actorId: base, actorLink: false, delta: { flags: {}, items: [], effects: [], ...delta } },
    get actor() {
      reads++;
      return synthetic;
    }
  };
};

beforeEach(() => {
  reads = 0;
  hooks = new Map();
  globalThis.Hooks = { on: (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn]) };
  const pc = actor("pc", { items: [{ flags: moduleFlags }] }),
    bestiary = actor("bestiary", {
      items: [{ _stats: { compendiumSource: `Compendium.${MODULE_ID}.bestiary.Actor.x` } }]
    }),
    plain = actor("plain"),
    cursed = actor("cursed", { effects: [{ _source: { flags: moduleFlags } }] });
  const actors = [pc, bestiary, plain, cursed];
  globalThis.game = {
    ready: false,
    actors: Object.assign(actors, { get: id => actors.find(a => a.id === id) }),
    scenes: [
      {
        tokens: [
          {
            id: "linked",
            actorLink: true,
            actorId: "pc",
            _source: { actorId: "pc", actorLink: true },
            get actor() {
              reads++;
              return pc;
            }
          },
          unlinked("s", "goblin1", "plain"),
          unlinked("s", "goblin2", "plain"),
          unlinked("s", "hexed", "plain", { flags: moduleFlags }),
          unlinked("s", "drake", "bestiary")
        ]
      }
    ]
  };
});
const fire = (name, ...args) => {
  for (const fn of hooks.get(name) ?? []) fn(...args);
};

test("module data is found on flags, items, effects and compendium sources", () => {
  assert.equal(hasModuleData(actor("a", { flags: moduleFlags })), true);
  assert.equal(
    hasModuleData(actor("a", { items: [{ flags: { [MODULE_ID]: {} } }] })),
    false,
    "empty module flags do not count"
  );
  assert.equal(hasModuleData(actor("a", { effects: [{ flags: moduleFlags }] })), true);
  assert.equal(hasModuleData(actor("a")), false);
});

test("the index skips plain actors and never builds their tokens' synthetic actors", () => {
  const uuids = automationActors()
    .map(a => a.uuid)
    .sort();
  assert.deepEqual(uuids, ["Actor.bestiary", "Actor.cursed", "Actor.pc", "Actor.s.drake", "Actor.s.hexed"]);
  assert.equal(reads, 2, "only the module-bearing unlinked tokens are read");
});

test("everyActor still visits every token for seeding transition caches", () => {
  assert.equal(everyActor().length, 4 + 4);
  assert.equal(reads, 5);
});

test("once installed and ready the index is cached until module data changes", () => {
  installActorIndexHooks();
  game.ready = true;
  invalidateActorIndex();
  automationActors();
  const afterBuild = reads;
  automationActors();
  fire("updateActor", game.actors[0], { system: { attributes: { hp: { value: 3 } } } });
  fire("createActiveEffect", { flags: {} });
  fire("updateToken", game.scenes[0].tokens[1], { x: 100, delta: { system: { attributes: { hp: { value: 1 } } } } });
  automationActors();
  assert.equal(reads, afterBuild, "HP, movement and non-module effects reuse the cached index");
  fire("createActiveEffect", { flags: moduleFlags });
  automationActors();
  assert.ok(reads > afterBuild, "a module effect rebuilds the index");
  const rebuilt = reads;
  fire("updateActor", game.actors[2], { flags: { [MODULE_ID]: { state: 1 } } });
  automationActors();
  assert.ok(reads > rebuilt, "module flag updates rebuild the index");
});
