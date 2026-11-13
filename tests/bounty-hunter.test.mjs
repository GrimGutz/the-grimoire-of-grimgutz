import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import {
  HUNTER_TROPHIES,
  HUNTER_CORE,
  hunterMaximum,
  hunterDie
} from "../scripts/automation/shared/bounty-hunter-definitions.mjs";
import { bountyHunterDocuments } from "../src/packs/bounty-hunter-features.mjs";
import { bountyHunterClassDocuments } from "../src/packs/bounty-hunter-class.mjs";
import { hunterTrophyRule } from "../src/bounty-hunter-data.mjs";
import {
  hunterDC,
  hunterPool,
  hunterConfig,
  hunterResourceState,
  hunterPassiveDefinitions,
  syncHunter,
  selectedHunterTrophies,
  trophyPossessed,
  hunterPrerequisiteFailures,
  validateHunterItem,
  hunterRestCompleted,
  hunterTraitChoices
} from "../scripts/automation/classes/bounty-hunter.mjs";
import { hunterExpenseData, hunterNativeActivity } from "../scripts/automation/classes/bounty-hunter-cost.mjs";
import {
  capturedHunterAction,
  freezeHunterFormula,
  unusedHunterDisposables,
  validateHunterDisposable
} from "../scripts/automation/classes/bounty-hunter-capture.mjs";
import {
  hunterIsolation,
  hunterHostile,
  prepareHunterAttack,
  applyHunterAttack,
  prepareHunterSave,
  offerHunterHit,
  finishHunterHit,
  applyHunterReach,
  installHunterCombatHooks
} from "../scripts/automation/classes/bounty-hunter-combat.mjs";
import {
  hunterCondition,
  activationFor,
  installHunterActionHooks
} from "../scripts/automation/classes/bounty-hunter-actions.mjs";
import {
  recoverHunter,
  hunterRecoveryKey,
  hunterHealingBlocked,
  hunterRegenSnapshot,
  regenerateHunter,
  installHunterEventHooks
} from "../scripts/automation/classes/bounty-hunter-events.mjs";
import * as zones from "../scripts/automation/classes/bounty-hunter-zones.mjs";
import { requestGm, receiveGmRequest } from "../scripts/automation/shared/gm-requests.mjs";
import { turnKey } from "../scripts/automation/shared/combat-benefits.mjs";

function merge(base, patch) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes(".")) {
      const parts = key.split("."),
        last = parts.pop();
      let obj = out;
      for (const part of parts) obj = obj[part] ??= {};
      if (last.startsWith("-=")) delete obj[last.slice(2)];
      else obj[last] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Set))
      out[key] = merge(out[key] ?? {}, value);
    else out[key] = structuredClone(value);
  }
  return out;
}
let actor, answers, docs, prompts, seq, rolls, hooks, nativeCalls;
function owned(data, owner) {
  let raw = structuredClone(data);
  const item = {
    id: raw._id,
    actor: owner,
    parent: owner,
    uuid: `${owner.uuid}.Item.${raw._id}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async setFlag(m, k, v) {
      await this.update({ [`flags.${m}.${k}`]: v });
    },
    clone: patch => owned(merge(raw, patch), owner),
    async update(patch) {
      raw = merge(raw, patch);
      refresh();
      return this;
    }
  };
  function refresh() {
    Object.assign(item, raw);
    item.system = {
      ...raw.system,
      activities: new Map(
        Object.entries(raw.system.activities ?? {}).map(([id, row]) => [
          id,
          { ...row, id, item, actor: owner, uuid: `${item.uuid}.Activity.${id}`, toObject: () => structuredClone(row) }
        ])
      )
    };
  }
  refresh();
  docs.set(item.uuid, item);
  for (const activity of item.system.activities.values()) docs.set(activity.uuid, activity);
  return item;
}
function makeActor(level = 5, id = "hunter") {
  let raw = {
    system: {
      details: { level: 11, cr: 10, type: { value: "humanoid" } },
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 18, mod: 4, max: null }])
      ),
      skills: { sur: { value: 1 }, prc: { value: 0.5 } },
      tools: {},
      traits: { weaponProf: { value: new Set(["mar"]) }, size: "med", ci: { value: new Set() } },
      attributes: {
        prof: 4,
        hp: { value: 20, max: 40, temp: 0 },
        movement: { walk: 30, units: "ft" },
        senses: { units: "ft" }
      }
    },
    flags: { [MODULE_ID]: { hunterConfiguration: { ability: "wis", selected: {} } } }
  };
  const owner = {
    uuid: `Actor.${id}`,
    id,
    type: "character",
    isOwner: true,
    name: id,
    statuses: new Set(),
    items: [],
    effects: [],
    testUserPermission: () => true,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async setFlag(m, k, v) {
      raw = merge(raw, { [`flags.${m}.${k}`]: v });
      refresh();
    },
    async unsetFlag(m, k) {
      raw = merge(raw, { [`flags.${m}.-=${k}`]: null });
      refresh();
    },
    async update(patch) {
      raw = merge(raw, patch);
      refresh();
      return this;
    },
    async createEmbeddedDocuments(type, rows) {
      if (type === "Item") {
        const result = rows.map(r => owned(r, this));
        this.items.push(...result);
        return result;
      }
      const result = rows.map(r => effect(r, this));
      this.effects.push(...result);
      return result;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.effects = this.effects.filter(e => !ids.includes(e.id));
    },
    async updateEmbeddedDocuments(_type, rows) {
      for (const row of rows) await this.effects.find(e => e.id === row._id)?.update(row);
      return rows;
    }
  };
  function refresh() {
    owner.system = structuredClone(raw.system);
    owner.flags = raw.flags;
    owner._source = structuredClone(raw);
  }
  refresh();
  owner.items = [
    { type: "class", system: { identifier: "bounty-hunter", levels: level } },
    ...bountyHunterDocuments.map(row => owned(row, owner))
  ];
  owner.items.get = id => owner.items.find(i => i.id === id);
  docs.set(owner.uuid, owner);
  return owner;
}
function effect(data, owner) {
  let raw = structuredClone(data);
  const e = {
    id: `e${++seq}`,
    parent: owner,
    uuid: `${owner.uuid}.ActiveEffect.${seq}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async update(patch) {
      raw = merge(raw, patch);
      Object.assign(this, raw);
      return this;
    },
    async delete() {
      owner.effects = owner.effects.filter(row => row !== this);
    }
  };
  Object.assign(e, raw);
  return e;
}
function feature(key) {
  return actor.items.find(i => i.system.identifier === key);
}
function activity(key, operation = "activate") {
  return [...feature(key).system.activities.values()].find(a => a.flags[MODULE_ID].hunterOperation === operation);
}
async function select(key, patch = {}) {
  const def = HUNTER_TROPHIES.find(e => e.key === key),
    item = feature(key);
  await item.setFlag(MODULE_ID, "hunterTrophyState", {
    confirmed: true,
    carried: true,
    destroyed: false,
    cr: def.cr,
    creatureType: def.creatureType,
    damageType: "fire",
    ...patch
  });
  await actor.setFlag(MODULE_ID, "hunterConfiguration", {
    ...hunterConfig(actor),
    selected: { ...hunterConfig(actor).selected, [def.tier]: item.id }
  });
  return item;
}
function token(owner = actor, id = "source", x = 0, disposition = 1, scene = canvas.scene) {
  const t = {
    id,
    uuid: `Scene.${scene.id}.Token.${id}`,
    actor: owner,
    parent: scene,
    x,
    y: 0,
    width: 1,
    height: 1,
    disposition
  };
  scene.tokens.push(t);
  docs.set(t.uuid, t);
  return t;
}
function encounter(source, target) {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, actor: t.actor }));
  const combat = {
    id: "combat",
    started: true,
    round: 1,
    turn: 0,
    previous: { round: 0, turn: 0 },
    turns: entries,
    combatants: entries,
    combatant: entries[0]
  };
  game.combat = combat;
  game.combats = [combat];
  return combat;
}
function weapon() {
  const w = owned(
    {
      _id: "sword",
      name: "Sword",
      type: "weapon",
      system: {
        damage: { base: { types: ["slashing"] } },
        range: { reach: 5, units: "ft" },
        activities: {
          attack: {
            _id: "attack",
            type: "attack",
            attack: { type: { value: "melee" } },
            activation: { type: "action" },
            range: { units: "ft", value: 5 },
            damage: { parts: [] },
            consumption: { targets: [] }
          }
        }
      }
    },
    actor
  );
  actor.items.push(w);
  return w;
}
class FakeRoll {
  constructor(formula, _data = {}, options = {}) {
    this.formula = formula;
    this.options = options;
    this.terms = [{ formula }];
  }
  async evaluate() {
    rolls++;
    this.evaluated = true;
    this.total = 4;
    return this;
  }
  static fromData(data) {
    return Object.assign(new FakeRoll(data.formula, {}, data.options), data);
  }
}
beforeEach(() => {
  seq = 0;
  rolls = 0;
  prompts = 0;
  nativeCalls = 0;
  answers = [];
  docs = new Map();
  hooks = new Map();
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(u => u.id === id);
  globalThis.game = {
    user: gm,
    users,
    combats: [],
    actors: [],
    scenes: [],
    modules: new Map(),
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    time: { worldTime: 10 }
  };
  globalThis.canvas = {
    ready: true,
    scene: { id: "one", grid: { size: 100, distance: 5, units: "ft" }, tokens: [], regions: [], templates: [] },
    tokens: { controlled: [] }
  };
  game.scenes = [canvas.scene];
  globalThis.Hooks = {
    on: (name, fn) => {
      hooks.set(name, [...(hooks.get(name) ?? []), fn]);
    }
  };
  globalThis.CONFIG = {
    DND5E: {
      maxAbilityScore: 20,
      damageTypes: { slashing: {}, fire: {}, acid: {} },
      tools: { wood: { ability: "dex" } },
      languages: { standard: { selectable: false, children: { common: "Common", elvish: "Elvish" } } }
    },
    Dice: { DamageRoll: FakeRoll },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.foundry = {
    utils: { randomID: () => `hunter-test-${++seq}`, escapeHTML: String },
    applications: {
      api: {
        DialogV2: {
          wait: async () => {
            prompts++;
            return answers.shift() ?? null;
          }
        }
      }
    }
  };
  globalThis.Roll = FakeRoll;
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.MidiQOL = {
    completeActivityUse: async () => {
      nativeCalls++;
      return false;
    }
  };
  actor = makeActor();
  game.actors = [actor];
});

test("Hunter archives the supplied source and all 42 trophy rules, with 52 linked cards and no empty passives", async () => {
  const source = await readFile(new URL("../src/content/bounty-hunter.md", import.meta.url), "utf8");
  assert.equal(
    createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex"),
    "f3199a5981021e429f624c922894f5f92f35c2180d883620da9b7382eccdef82"
  );
  assert.equal(HUNTER_TROPHIES.length, 42);
  assert.equal(bountyHunterDocuments.length, 52);
  for (const trophy of HUNTER_TROPHIES) {
    assert.ok(hunterTrophyRule(trophy).length > 60, trophy.key);
    assert.ok(
      bountyHunterDocuments
        .find(i => i.system.identifier === trophy.key)
        .system.description.value.includes("Автоматизация Foundry:")
    );
  }
  assert.ok(bountyHunterDocuments.every(i => i.effects.length === 0));
  assert.ok(bountyHunterClassDocuments[0].system.description.value.includes("@UUID["));
});
test("Hunter has native d10 HP and all ten feature grants at source levels, without free trophies or extra proficiencies", () => {
  const cls = bountyHunterClassDocuments[0];
  assert.equal(cls.system.hitDice, "d10");
  const grants = cls.system.advancement.filter(a => a.type === "ItemGrant");
  assert.deepEqual(
    grants.map(a => a.level),
    [1, 2, 3, 4, 5]
  );
  assert.equal(
    grants.reduce((n, a) => n + a.configuration.items.length, 0),
    HUNTER_CORE.length
  );
  assert.ok(!cls.system.advancement.some(a => ["ItemChoice", "Trait"].includes(a.type)));
  assert.equal(cls.system.spellcasting.progression, "none");
  assert.deepEqual([1, 2, 3, 4, 5].map(hunterMaximum), [4, 7, 10, 13, 16]);
  assert.deepEqual([1, 2, 3, 4, 5].map(hunterDie), [6, 6, 8, 8, 10]);
});
test("unconfirmed, unselected, absent, destroyed and premature trophies cannot grant bonuses", async () => {
  assert.equal(selectedHunterTrophies(actor).length, 0);
  const i = await select("hunter-aberration-minor");
  assert.equal(trophyPossessed(actor, i), true);
  for (const patch of [
    { confirmed: false },
    { carried: false },
    { destroyed: true },
    { cr: 9 },
    { creatureType: "beast" }
  ]) {
    await select("hunter-aberration-minor", patch);
    assert.equal(selectedHunterTrophies(actor).length, 0);
  }
  await select("hunter-beast-medium");
  actor.items[0].system.levels = 2;
  assert.equal(trophyPossessed(actor, feature("hunter-beast-medium")), false);
});
test("passive costs add across tiers, clamp excess, and raising maximum never restores uses", async () => {
  await select("hunter-aberration-minor");
  await select("hunter-beast-medium");
  await select("hunter-dragon-major");
  assert.deepEqual(hunterResourceState(actor, { remaining: 16 }), { maximum: 7, remaining: 7, spent: 0 });
  await hunterPool(actor).update({ "system.uses.max": "7", "system.uses.spent": 5 });
  await actor.setFlag(MODULE_ID, "hunterConfiguration", { ...hunterConfig(actor), selected: {} });
  await syncHunter(actor);
  assert.equal(hunterPool(actor).system.uses.max, "16");
  assert.equal(hunterPool(actor).system.uses.spent, 14);
});
test("actual passives use narrow fields and metric units; text-only rules get no fake immunity or broad advantage", async () => {
  await select("hunter-construct-minor");
  await select("hunter-beast-medium");
  await select("hunter-monstrosity-major");
  actor.system.attributes.movement.units = "m";
  actor.system.attributes.senses.units = "m";
  const changes = hunterPassiveDefinitions(actor).flatMap(e => e.system.changes);
  assert.ok(changes.some(c => c.key === "system.traits.dr.value" && c.value === "poison"));
  assert.ok(changes.some(c => c.key.includes("blindsight") && Number(c.value) === 6.096));
  assert.ok(changes.some(c => c.key.endsWith("movement.walk") && Number(c.value) === 3.048));
  assert.ok(!changes.some(c => c.key.includes("ci.value") || c.key.includes("abilities.con")));
  await select("hunter-fey-minor");
  await actor.setFlag(MODULE_ID, "hunterConfiguration", {
    ability: "wis",
    selected: { minor: feature("hunter-fey-minor").id }
  });
  assert.deepEqual(hunterPassiveDefinitions(actor), []);
});
test("humanoid language/tool choices use native child IDs and a typed non-proficient tool baseline", async () => {
  assert.deepEqual(hunterTraitChoices(CONFIG.DND5E.languages), [
    ["common", "Common"],
    ["elvish", "Elvish"]
  ]);
  await select("hunter-humanoid-minor", { language: "elvish", tool: "wood" });
  await syncHunter(actor);
  assert.deepEqual(actor._source.system.tools.wood, { value: 0, ability: "dex" });
  assert.ok(actor.effects[0].system.changes.some(c => c.key === "system.tools.wood.value" && c.value === "1"));
});
test("sync preserves a manually disabled passive and manual changes, and only removes its own obsolete effects", async () => {
  await select("hunter-aberration-minor");
  await syncHunter(actor);
  const e = actor.effects[0];
  await e.update({ disabled: true, "system.changes": [{ key: "system.attributes.ac.bonus", value: "3" }] });
  await syncHunter(actor);
  assert.equal(e.disabled, true);
  assert.equal(e.system.changes[0].value, "3");
  const manual = effect({ name: "Manual", system: { changes: [] } }, actor);
  actor.effects.push(manual);
  await select("hunter-aberration-minor", { carried: false });
  await syncHunter(actor);
  assert.deepEqual(actor.effects, [manual]);
});
test("requirements are disabled by default; strict mode checks two abilities, actual martial and whole skill proficiency", () => {
  actor.system.details.level = 6;
  actor.system.skills = { sur: { value: 0.5 } };
  actor.system.traits.weaponProf.value = new Set(["sim"]);
  actor.system.abilities.str.value = 15;
  actor.system.abilities.dex.value = 15;
  assert.equal(hunterPrerequisiteFailures(actor).length, 4);
  const item = { parent: actor, type: "class", system: { identifier: "bounty-hunter" } };
  assert.equal(validateHunterItem(item, {}, {}, "gm"), undefined);
  game.settings.get = () => true;
  assert.equal(validateHunterItem(item, {}, {}, "gm"), false);
});
test("hunt ability is immutable and ASI raises the raw score AND cap once", async () => {
  await actor.setFlag(MODULE_ID, "hunterConfiguration", {});
  answers.push("str");
  assert.equal(
    (await requestGm("hunter-settings", actor, { itemUuid: hunterPool(actor).uuid, operation: "ability" })).status,
    "success"
  );
  answers.push("dex");
  assert.equal(
    (await requestGm("hunter-settings", actor, { itemUuid: hunterPool(actor).uuid, operation: "ability" })).status,
    "cancelled"
  );
  assert.equal(hunterConfig(actor).ability, "str");
  answers = [];
  answers.push("ability");
  await requestGm("hunter-settings", actor, { itemUuid: feature("hunter-ability-improvement").uuid, operation: "asi" });
  assert.equal(actor.system.abilities.str.value, 20);
  assert.equal(actor.system.abilities.str.max, 22);
  await requestGm("hunter-settings", actor, { itemUuid: feature("hunter-ability-improvement").uuid, operation: "asi" });
  assert.equal(actor.system.abilities.str.value, 20);
  assert.equal(hunterDC(actor), 16);
});
test("recording an early physical source does not unlock a future tier; cancelling source proof writes nothing", async () => {
  actor.items[0].system.levels = 1;
  const item = feature("hunter-beast-medium");
  answers.push("yes", 15);
  assert.equal(
    (await requestGm("hunter-settings", actor, { itemUuid: item.uuid, operation: "source" })).status,
    "success"
  );
  assert.equal(trophyPossessed(actor, item), false);
  answers.push(null);
  assert.equal(
    (
      await requestGm("hunter-settings", actor, {
        itemUuid: feature("hunter-aberration-minor").uuid,
        operation: "source"
      })
    ).status,
    "cancelled"
  );
  assert.equal(feature("hunter-aberration-minor").getFlag(MODULE_ID, "hunterTrophyState"), undefined);
});
test("rest cancellation keeps selections; short rest does not refill and long rest refills after passive choice", async () => {
  await select("hunter-aberration-minor");
  await syncHunter(actor);
  await hunterPool(actor).update({ "system.uses.spent": 5 });
  const before = structuredClone(hunterConfig(actor));
  answers.push(null);
  await hunterRestCompleted(actor, { longRest: false });
  assert.deepEqual(hunterConfig(actor), before);
  assert.equal(hunterPool(actor).system.uses.spent, 5);
  answers.push("none");
  await hunterRestCompleted(actor, { longRest: true });
  assert.equal(hunterPool(actor).system.uses.max, "16");
  assert.equal(hunterPool(actor).system.uses.spent, 0);
  assert.equal(actor.getFlag(MODULE_ID, "hunterRestSelection"), undefined);
});
test("switching selected tiers outside rest cannot open choices or refill", async () => {
  await select("hunter-aberration-minor");
  const before = structuredClone(hunterConfig(actor));
  assert.equal(
    (await requestGm("hunter-settings", actor, { itemUuid: hunterPool(actor).uuid, operation: "select" })).status,
    "cancelled"
  );
  assert.equal(prompts, 0);
  assert.deepEqual(hunterConfig(actor), before);
});
test("a player's native rest delegates to active GM once, even without foreign-actor write permission", async () => {
  const gm = game.user,
    player = { id: "player", isGM: false, active: false };
  game.users.push(player);
  const messages = [];
  game.socket = { on() {}, emit: (_channel, data) => messages.push(data) };
  await hunterPool(actor).update({ "system.uses.spent": 3 });
  game.user = player;
  const task = hunterRestCompleted(actor, { type: "long", grimgutzHunterRestId: "rest-1" });
  assert.equal(messages[0].type, "hunter-rest");
  assert.equal(hunterPool(actor).system.uses.spent, 3);
  game.user = gm;
  await receiveGmRequest(messages[0], "player");
  const reply = messages[1];
  assert.equal(hunterPool(actor).system.uses.spent, 0);
  game.user = player;
  await receiveGmRequest(reply, "gm");
  assert.equal((await task).status, "success");
  game.user = gm;
  await hunterPool(actor).update({ "system.uses.spent": 1 });
  await receiveGmRequest(messages[0], "player");
  assert.equal(hunterPool(actor).system.uses.spent, 1);
});
test("native costs charge the shared pool, validate selection and reject passive activation or insufficient balance", async () => {
  await select("hunter-celestial-minor");
  const a = activity("hunter-celestial-minor"),
    data = hunterExpenseData(a, { activation: "bonus" });
  assert.equal(data.consumption.targets[0].target, hunterPool(actor).id);
  assert.equal(data.consumption.targets[0].value, "2");
  const original = a.item.toObject(),
    resolved = hunterNativeActivity(a, { type: "heal" }, { activation: "bonus" });
  assert.equal(resolved.type, "heal");
  assert.deepEqual(a.item.toObject(), original);
  await hunterPool(actor).update({ "system.uses.spent": 4 });
  assert.throws(() => hunterExpenseData(a), /Недостаточно/);
  await select("hunter-aberration-minor");
  assert.throws(() => hunterExpenseData(activity("hunter-aberration-minor", "source")), /Активный/);
});
test("one-off formulas and attack/save/damage parameters are frozen to the source, not the hunter", () => {
  const item = {
    name: "Claw",
    img: "icons/svg/sword.svg",
    system: { range: { reach: 5 } },
    toObject: () => ({ system: { description: { value: "Source action" } }, effects: [] })
  };
  const source = {
    type: "attack",
    name: "Claw",
    uuid: "NPC.Action",
    actor: { name: "Beast", uuid: "Actor.beast", system: { details: { cr: 10, type: { value: "beast" } } } },
    item,
    range: { value: 5, units: "ft" },
    save: { dc: { value: 17 } },
    damage: { parts: [] },
    getAttackData: () => ({ parts: ["@prof", "@mod"], data: { prof: 4, mod: 5 } }),
    getDamageConfig: () => ({
      rolls: [{ parts: ["2d6", "@mod"], data: { mod: 5 }, options: { types: new Set(["slashing"]) } }]
    }),
    toObject: () => ({
      type: "attack",
      attack: {},
      save: { dc: {} },
      damage: {},
      consumption: { targets: [] },
      effects: []
    })
  };
  const data = capturedHunterAction(source, actor, { itemId: "one", activityId: "a", poolId: hunterPool(actor).id }),
    a = data.system.activities.a;
  assert.equal(a.attack.ability, "none");
  assert.equal(a.attack.flat, true);
  assert.equal(a.attack.bonus, "(4) + (5)");
  assert.equal(a.save.dc.formula, "17");
  assert.equal(a.damage.parts[0].number, 2);
  assert.equal(a.damage.parts[0].denomination, 6);
  assert.equal(a.damage.parts[0].bonus, "+ (5)");
  assert.equal(data.system.uses.max, "1");
  assert.deepEqual(data.system.uses.recovery, []);
  assert.equal(a.consumption.targets.length, 2);
  assert.equal(a.activation.type, "action");
  assert.equal(freezeHunterFormula("@a + 2", { a: "1d6 + @b", b: 3 }), "(1d6 + (3)) + 2");
  assert.throws(() => freezeHunterFormula("@missing", {}));
  source.toObject = () => ({ consumption: { targets: [{ type: "material" }] } });
  assert.throws(() => capturedHunterAction(source, actor, { poolId: "pool" }), /связанные/);
});
test("one-off cards retain spent state and require both their own use and pool; spent cards do not occupy crafting limit", () => {
  const i = owned(
    {
      _id: "one",
      type: "feat",
      flags: {
        [MODULE_ID]: {
          hunterFeature: true,
          minimumLevel: 1,
          hunterDisposable: true,
          hunterTrophyState: { confirmed: true, carried: true, cr: 10 }
        }
      },
      system: { uses: { max: "1", spent: 0 }, activities: { a: { type: "utility" } } }
    },
    actor
  );
  actor.items.push(i);
  const a = i.system.activities.get("a");
  assert.equal(unusedHunterDisposables(actor).length, 1);
  assert.equal(validateHunterDisposable(a), undefined);
  i.system.uses.spent = 1;
  assert.equal(unusedHunterDisposables(actor).length, 0);
  assert.equal(validateHunterDisposable(a), false);
});
test("isolation includes hidden capable allies, excludes incapacity, and does not guess neutral relationships", () => {
  const source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    ally = token(makeActor(0, "ally"), "ally", 900, -1);
  ally.hidden = true;
  assert.equal(hunterIsolation(target), "no");
  ally.actor.statuses.add("incapacitated");
  assert.equal(hunterIsolation(target), "yes");
  ally.actor.statuses.clear();
  ally.disposition = 0;
  assert.equal(hunterIsolation(target), "unknown");
  assert.equal(hunterHostile(source, target), true);
});
test("duel attack is target-scoped and applies once; multi-target attacks receive no broad d4", async () => {
  const source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    w = weapon(),
    workflow = {
      id: "attack",
      actor,
      item: w,
      activity: w.system.activities.get("attack"),
      token: source,
      targets: new Set([target])
    };
  await prepareHunterAttack(workflow);
  const config = { workflow, rolls: [{ parts: ["@mod"] }] };
  applyHunterAttack(config);
  applyHunterAttack(config);
  assert.deepEqual(config.rolls[0].parts, ["@mod", "1d4"]);
  const other = { ...workflow, id: "multi", grimgutzHunterAttack: null, targets: new Set([target, source]) };
  await prepareHunterAttack(other);
  assert.equal(other.grimgutzHunterAttack, null);
});
test("duel save d4 changes only this target's native DC, replays do not reroll or apply twice", async () => {
  const source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    w = weapon(),
    workflow = { id: "save", actor, item: w, activity: w.system.activities.get("attack"), token: source };
  const details = { rollType: "save", rollDC: 16 };
  await prepareHunterSave(target, workflow, details);
  await prepareHunterSave(target, workflow, details);
  assert.equal(details.rollDC, 20);
  assert.equal(rolls, 1);
  const again = { rollType: "save", rollDC: 16 };
  await prepareHunterSave(target, workflow, again);
  assert.equal(again.rollDC, 20);
  assert.equal(rolls, 1);
});
test("Breakdown appends a correctly typed die without rerolling base damage; duplicate callbacks never repeat it", async () => {
  const source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    w = weapon();
  encounter(source, target);
  answers.push("wound");
  const base = Object.assign(new FakeRoll("2d6+4", {}, { type: "slashing", isCritical: true }), {
    evaluated: true,
    total: 12
  });
  const workflow = {
    id: "hit",
    actor,
    item: w,
    activity: w.system.activities.get("attack"),
    token: source,
    hitTargets: new Set([target]),
    attackRoll: { total: 20 },
    damageRolls: [base],
    async setDamageRolls(data) {
      this.damageRolls = data;
    }
  };
  await offerHunterHit(workflow);
  await offerHunterHit(workflow);
  await finishHunterHit(workflow);
  await finishHunterHit(workflow);
  assert.equal(prompts, 1);
  assert.equal(rolls, 1);
  assert.equal(workflow.damageRolls.length, 2);
  assert.equal(workflow.damageRolls[0].total, 12);
  assert.equal(workflow.damageRolls[1].formula, "1d10");
  assert.equal(workflow.damageRolls[1].options.type, "slashing");
  assert.equal(workflow.damageRolls[1].options.isCritical, true);
});
test("declining Breakdown records no turn usage and cancelled damage does not complete it", async () => {
  const source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    w = weapon();
  encounter(source, target);
  answers.push(null);
  const workflow = {
    id: "cancel",
    actor,
    item: w,
    activity: w.system.activities.get("attack"),
    token: source,
    hitTargets: new Set([target]),
    attackRoll: { total: 20 },
    damageRolls: [],
    aborted: false
  };
  await offerHunterHit(workflow);
  assert.deepEqual(actor.getFlag(MODULE_ID, "hunterHitUses").turns, {});
  workflow.aborted = true;
  await finishHunterHit(workflow);
  assert.equal(rolls, 0);
});
test("temporary Giant reach is melee-only, respects disabled passive, and never edits the weapon", async () => {
  await select("hunter-giant-medium");
  await syncHunter(actor);
  const w = weapon(),
    original = w.toObject(),
    workflow = { actor, item: w, activity: w.system.activities.get("attack") };
  applyHunterReach(workflow);
  applyHunterReach(workflow);
  assert.equal(workflow.activity.range.value, 10);
  assert.deepEqual(w.toObject(), original);
  actor.effects[0].disabled = true;
  const other = { actor, item: w, activity: w.system.activities.get("attack") };
  applyHunterReach(other);
  assert.equal(other.activity.range.value, 5);
});
test("critical plus kill uses one recovery key, replay restores nothing and maximum is never exceeded", async () => {
  await hunterPool(actor).update({ "system.uses.max": "12", "system.uses.spent": 6 });
  const critical = hunterRecoveryKey({ workflowId: "hit", critical: true });
  assert.equal(critical, hunterRecoveryKey({ workflowId: "hit", targetTokenUuid: "target", critical: true }));
  await recoverHunter(actor, critical);
  await recoverHunter(actor, critical);
  assert.equal(hunterPool(actor).system.uses.spent, 2);
  assert.equal(rolls, 1);
  await recoverHunter(actor, "second");
  assert.equal(hunterPool(actor).system.uses.spent, 0);
  await recoverHunter(actor, "third");
  assert.equal(rolls, 2);
});
test("regeneration heals prof+2 only at positive HP, uses turn-start snapshot, and leaves later fire hits pending", async () => {
  const item = await select("hunter-plant-major");
  actor.effects.push(effect({ flags: { [MODULE_ID]: { hunterRegeneration: { itemUuid: item.uuid } } } }, actor));
  const start = hunterRegenSnapshot(actor, "c");
  await actor.setFlag(MODULE_ID, "hunterFireDamage", { combatId: "c", key: "later" });
  await regenerateHunter(actor, "c", start);
  assert.equal(actor.system.attributes.hp.value, 26);
  assert.equal(actor.getFlag(MODULE_ID, "hunterFireDamage").key, "later");
  assert.equal(await regenerateHunter(actor, "c"), false);
  assert.equal(actor.system.attributes.hp.value, 26);
  await actor.update({ "system.attributes.hp.value": 0 });
  assert.equal(await regenerateHunter(actor, "c"), false);
  assert.equal(actor.system.attributes.hp.value, 0);
});
test("healing ban is bounded by the active effect; regeneration cannot ignore it or revive an absent trophy", async () => {
  const item = await select("hunter-plant-major"),
    regen = effect({ flags: { [MODULE_ID]: { hunterRegeneration: { itemUuid: item.uuid } } } }, actor),
    ban = effect({ flags: { [MODULE_ID]: { hunterHealingBlocked: true } } }, actor);
  actor.effects.push(regen, ban);
  assert.equal(hunterHealingBlocked(actor), true);
  assert.equal(await regenerateHunter(actor, "c"), false);
  ban.disabled = true;
  assert.equal(hunterHealingBlocked(actor), false);
  await select("hunter-plant-major", { carried: false });
  await regenerateHunter(actor, "c");
  assert.ok(!actor.effects.includes(regen));
});
test("native pre-damage hook blocks healing without removing temp HP, and losing/replacing own undead temp removes its scope", async () => {
  installHunterEventHooks();
  actor.effects.push(effect({ flags: { [MODULE_ID]: { hunterHealingBlocked: true } } }, actor));
  const patch = { "system.attributes.hp.value": 30, "system.attributes.hp.temp": 7 };
  for (const fn of hooks.get("dnd5e.preApplyDamage")) fn(actor, -10, patch);
  assert.equal(patch["system.attributes.hp.value"], 20);
  assert.equal(patch["system.attributes.hp.temp"], 7);
  await actor.setFlag(MODULE_ID, "hunterUndeadTemp", { remaining: 5 });
  const replacement = { "system.attributes.hp.temp": 12 };
  for (const fn of hooks.get("preUpdateActor")) fn(actor, replacement);
  assert.equal(replacement[`flags.${MODULE_ID}.-=hunterUndeadTemp`], null);
});
test("condition immunity creates no false condition; minute service renewal preserves manual changes", async () => {
  const source = token();
  actor.system.traits.ci.value.add("frightened");
  assert.equal(await hunterCondition(actor, hunterPool(actor), source, source, { statuses: ["frightened"] }), false);
  assert.equal(actor.effects.length, 0);
  await hunterCondition(actor, hunterPool(actor), source, source, { flags: { hunterRegeneration: { itemUuid: "i" } } });
  const e = actor.effects[0];
  await e.update({ "system.changes": [{ key: "manual", value: "7" }], disabled: true });
  game.time.worldTime = 50;
  await hunterCondition(actor, hunterPool(actor), source, source, { flags: { hunterRegeneration: { itemUuid: "i" } } });
  assert.equal(actor.effects.length, 1);
  assert.equal(e.disabled, false);
  assert.equal(e.system.changes[0].value, "7");
  assert.equal(e.start.time, 50);
});
test("storm uses the same ledger key for entry and start, snapshot type/DC and no concentration or extra expense", async () => {
  const item = await select("hunter-elemental-major"),
    source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1);
  const zone = {
    uuid: "Zone.storm",
    parent: canvas.scene,
    shapes: [{ type: "circle", x: 850, y: 50, radius: 400 }],
    flags: {
      [MODULE_ID]: {
        zoneExpiresAt: 70,
        hunterZone: { mode: "storm", sourceTokenUuid: source.uuid, itemUuid: item.uuid, dc: 16, damageType: "fire" }
      }
    }
  };
  const inputs = [];
  await zones.pulseHunterStorm(zone, target, "c:1:0", { pulse: async input => inputs.push(input) });
  await zones.pulseHunterStorm(zone, target, "c:1:0", { pulse: async input => inputs.push(input) });
  assert.equal(inputs[0].eventKey, inputs[1].eventKey);
  assert.deepEqual(inputs[0].event.damage, [{ formula: "4d8", type: "fire" }]);
  assert.equal(inputs[0].event.onSave, "half");
  assert.equal(nativeCalls, 0);
  game.time.worldTime = 71;
  assert.equal(await zones.pulseHunterStorm(zone, target, "c:1:1"), false);
});
test("root cleanup only removes the matching scene/target/zone instance, not another caster's restraint", async () => {
  const t = token(),
    other = effect(
      { flags: { [MODULE_ID]: { hunterRootZone: { sceneId: "elsewhere", targetUuid: t.uuid, zoneUuid: "gone" } } } },
      actor
    ),
    own = effect(
      { flags: { [MODULE_ID]: { hunterRootZone: { sceneId: "one", targetUuid: t.uuid, zoneUuid: "gone" } } } },
      actor
    );
  actor.effects.push(own, other);
  await zones.cleanupHunterRoots(canvas.scene);
  assert.deepEqual(actor.effects, [other]);
});
test("lost source item removes its own region and legacy template but leaves other zones intact", async () => {
  const item = await select("hunter-elemental-major"),
    source = token(),
    state = { sourceTokenUuid: source.uuid, itemUuid: item.uuid, mode: "storm" };
  let removed = 0;
  const zone = kind => ({
    uuid: `Zone.${kind}`,
    parent: canvas.scene,
    flags: { [MODULE_ID]: { hunterZone: state, zoneExpiresAt: 70 } },
    async delete() {
      removed++;
    }
  });
  canvas.scene.regions = [zone("region")];
  canvas.scene.templates = [zone("template"), { uuid: "Other", flags: { [MODULE_ID]: { zoneTemplate: true } } }];
  await select("hunter-elemental-major", { carried: false });
  await zones.cleanupHunterZoneSources(canvas.scene);
  assert.equal(removed, 2);
});
test("concurrent retry requests with different callback IDs can only repeat the miss once per own turn", async () => {
  const item = await select("hunter-construct-major"),
    source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1),
    w = weapon(),
    combat = encounter(source, target);
  actor.effects.push(effect({ flags: { [MODULE_ID]: { hunterMissRetry: { itemUuid: item.uuid } } } }, actor));
  await actor.setFlag(MODULE_ID, "hunterLastAttack", {
    id: "miss",
    sourceUuid: source.uuid,
    activityUuid: w.system.activities.get("attack").uuid,
    turn: turnKey(combat),
    hitUuids: [],
    targetUuids: [target.uuid]
  });
  answers.push("yes", "yes");
  MidiQOL.completeActivityUse = async () => {
    nativeCalls++;
    await new Promise(r => setTimeout(r, 5));
    return { id: "retry" };
  };
  await Promise.all(
    ["a", "b"].map(requestId =>
      requestGm("hunter-retry", actor, { itemUuid: item.uuid, sourceUuid: source.uuid }, { requestId })
    )
  );
  assert.equal(nativeCalls, 1);
  assert.equal(prompts, 1);
});
test("player token movement triggers storm entry on GM without a local preUpdateToken callback", async () => {
  const item = await select("hunter-elemental-major"),
    source = token(),
    target = token(makeActor(0, "foe"), "foe", 800, -1);
  encounter(source, target);
  canvas.scene.regions = [
    {
      uuid: "storm",
      parent: canvas.scene,
      shapes: [{ type: "circle", x: 450, y: 50, radius: 100 }],
      flags: {
        [MODULE_ID]: {
          zoneExpiresAt: 70,
          hunterZone: { mode: "storm", sourceTokenUuid: source.uuid, itemUuid: item.uuid, dc: 16, damageType: "fire" }
        }
      }
    }
  ];
  const entries = [];
  zones.installHunterZoneHooks({ pulse: async (zone, t, turn) => entries.push({ zone, t, turn }) });
  for (const fn of hooks.get("canvasReady")) fn();
  await new Promise(r => setTimeout(r, 0));
  target.x = 400;
  for (const fn of hooks.get("updateToken")) fn(target, { x: 400 });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].turn, "combat:1:0");
  target.x = 420;
  for (const fn of hooks.get("updateToken")) fn(target, { x: 420 });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(entries.length, 1);
});
test("declining or cancelling an active trophy never spends or creates its effect; a completed request never prompts twice", async () => {
  const reduction = await select("hunter-construct-medium"),
    source = token();
  answers.push("no");
  assert.equal(
    (
      await requestGm(
        "hunter-action",
        actor,
        { activityUuid: activity(reduction.system.identifier).uuid, sourceUuid: source.uuid },
        { requestId: "declined" }
      )
    ).status,
    "cancelled"
  );
  assert.equal(nativeCalls, 0);
  assert.equal(actor.effects.length, 0);
  const item = await select("hunter-plant-major"),
    a = activity(item.system.identifier);
  await requestGm(
    "hunter-action",
    actor,
    { activityUuid: a.uuid, sourceUuid: source.uuid },
    { requestId: "native-cancel" }
  );
  assert.equal(nativeCalls, 1);
  assert.equal(actor.effects.length, 0);
  MidiQOL.completeActivityUse = async () => {
    nativeCalls++;
    await hunterPool(actor).update({ "system.uses.spent": 4 });
    return { id: "regen" };
  };
  await requestGm(
    "hunter-action",
    actor,
    { activityUuid: a.uuid, sourceUuid: source.uuid },
    { requestId: "native-ok" }
  );
  const count = prompts;
  await requestGm(
    "hunter-action",
    actor,
    { activityUuid: a.uuid, sourceUuid: source.uuid },
    { requestId: "native-ok" }
  );
  assert.equal(prompts, count);
  assert.equal(actor.effects.length, 1);
  assert.equal(nativeCalls, 2);
});
test("cleansing does not silently delete a hand-edited effect carrying unrelated mechanical changes", async () => {
  const item = await select("hunter-celestial-medium"),
    source = token(),
    target = token(makeActor(0, "friend"), "friend", 100, 1);
  const manual = effect(
    { statuses: ["poisoned"], system: { changes: [{ key: "system.attributes.ac.bonus", value: "2" }] } },
    target.actor
  );
  target.actor.effects.push(manual);
  target.actor.statuses.add("poisoned");
  answers.push([target.uuid], "yes", ["poisoned"]);
  MidiQOL.completeActivityUse = async () => {
    nativeCalls++;
    return { id: "cleanse" };
  };
  const result = await requestGm("hunter-action", actor, {
    activityUuid: activity(item.system.identifier).uuid,
    sourceUuid: source.uuid
  });
  assert.equal(result.status, "cancelled");
  assert.equal(nativeCalls, 0);
  assert.ok(target.actor.effects.includes(manual));
});
test("actual hook registrations cover rolls, rest, zone entry/start, healing and raw item use without requiring combat.scene", () => {
  installHunterCombatHooks();
  installHunterActionHooks();
  installHunterEventHooks();
  zones.installHunterZoneHooks();
  for (const key of [
    "midi-qol.preTargetingV2",
    "midi-qol.preAttackRollConfig",
    "midi-qol.preTargetSave",
    "midi-qol.DamageRollComplete",
    "dnd5e.preApplyDamage",
    "updateToken",
    "updateCombat",
    "dnd5e.restCompleted"
  ])
    assert.ok(
      hooks.get(key)?.every(fn => typeof fn === "function"),
      key
    );
  assert.equal(activationFor("storm"), "action");
  assert.equal(activationFor("reduce-damage"), "reaction");
});
