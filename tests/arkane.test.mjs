import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import {
  ARKANE_FEATURES,
  ARKANE_RARITY_POINTS,
  arkaneUnlockedTier,
  arkaneIdentity,
  arkaneSpellPools,
  arkaneExactSlots
} from "../scripts/automation/shared/arkane-definitions.mjs";
import { arkaneDocuments } from "../src/packs/arkane-features.mjs";
import { arkaneTransformationDocuments } from "../src/packs/arkane-transformation.mjs";
import { arkaneDescription } from "../src/arkane-data.mjs";
import {
  arkaneState,
  arkaneTransformationLevel,
  arkaneHas,
  arkaneDC,
  arkaneAvailable,
  syncArkane,
  arkanePassiveDefinitions,
  changeArkaneFusion,
  validateArkaneAdvancement,
  arkanePrerequisiteFailures,
  arkaneBodyActive,
  inspectArkane
} from "../scripts/automation/transformations/arkane.mjs";
import { controlArkane } from "../scripts/automation/transformations/arkane-actions.mjs";
import { chooseArkaneSlots, arkaneSlotCosts } from "../scripts/automation/transformations/arkane-use.mjs";
import {
  useArkaneStorm,
  moveArkaneStorm,
  arkaneStormData,
  arkaneStormRecord,
  runArkaneStormRecord,
  captureArkaneStormEntry,
  cleanArkaneStorms,
  installArkaneStormHooks,
  captureArkaneMovement,
  applyArkaneMovement
} from "../scripts/automation/transformations/arkane-storm.mjs";
import {
  arkaneBarrierActive,
  activateArkaneBarrier,
  carryArkaneBarrierDamage,
  guardArkaneBarrierUpdate,
  cleanupArkaneBarrier,
  prepareArkaneSpellSave,
  prepareArkaneSpellImmunity
} from "../scripts/automation/transformations/arkane-spells.mjs";
import { observeArkaneAppearance, installArkaneHooks } from "../scripts/automation/transformations/arkane-events.mjs";
import { applySpellSourceResistance } from "../scripts/automation/midi/spell-resistance.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
let actor,
  source,
  target,
  docs,
  answers,
  prompts,
  calls,
  messages,
  hooks,
  seq,
  nativeMode,
  saveSuccess,
  actorCreateFails,
  tokenCreateFails;
function merge(raw, updates) {
  const out = structuredClone(raw);
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes(".")) {
      const parts = key.split("."),
        last = parts.pop();
      let obj = out;
      for (const part of parts) obj = obj[part] ??= {};
      if (last.startsWith("-=")) delete obj[last.slice(2)];
      else obj[last] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) out[key] = merge(out[key] ?? {}, value);
    else out[key] = structuredClone(value);
  }
  return out;
}
const property = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);
function owned(data, owner, register = true) {
  let raw = structuredClone(data);
  raw._id ??= `item${++seq}`;
  const item = {
    id: raw._id,
    actor: owner,
    parent: owner,
    isEmbedded: true,
    uuid: `${owner.uuid}.Item.${raw._id}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: updates => owned(merge(raw, updates), owner, false),
    async update(updates) {
      raw = merge(raw, updates);
      refresh();
      owner.prepare();
      return this;
    }
  };
  function refresh() {
    Object.assign(item, raw);
    const activities = new Map(
      Object.entries(raw.system.activities ?? {}).map(([id, row]) => {
        const create = r => ({
          ...r,
          id,
          item,
          actor: owner,
          uuid: `${item.uuid}.Activity.${id}`,
          toObject: () => structuredClone(r),
          clone: updates => create(merge(r, updates))
        });
        return [id, create(row)];
      })
    );
    item.system = { ...raw.system, activities };
  }
  refresh();
  if (register) {
    docs.set(item.uuid, item);
    for (const a of item.system.activities.values()) docs.set(a.uuid, a);
  }
  return item;
}
function effect(data, owner) {
  let raw = structuredClone(data);
  const e = {
    id: `e${++seq}`,
    parent: owner,
    uuid: `${owner.uuid}.ActiveEffect.e${seq}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: updates => ({ toObject: () => merge(raw, updates), ...merge(raw, updates) }),
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async update(updates) {
      raw = merge(raw, updates);
      refresh();
      owner.prepare();
      return this;
    },
    async delete() {
      owner.effects = owner.effects.filter(row => row !== this);
      docs.delete(this.uuid);
      owner.prepare();
    }
  };
  function refresh() {
    Object.assign(e, raw);
    e.statuses = new Set(raw.statuses ?? []);
  }
  refresh();
  docs.set(e.uuid, e);
  return e;
}
function entity(data, id) {
  let raw = structuredClone(data);
  const a = {
    id,
    uuid: `Actor.${id}`,
    documentName: "Actor",
    isOwner: true,
    items: [],
    effects: [],
    testUserPermission: () => true,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    getRollData: () => structuredClone(a.system),
    toObject: () => structuredClone(raw),
    prepare() {
      this._source = structuredClone(raw);
      Object.assign(this, {
        system: structuredClone(raw.system),
        flags: raw.flags ?? {},
        name: raw.name ?? id,
        type: raw.type ?? "character",
        ownership: raw.ownership ?? { default: 0 },
        prototypeToken: { toObject: () => structuredClone(raw.prototypeToken ?? {}) }
      });
      this.system.attributes.prof ??= 2;
      this.system.attributes.hp.effectiveMax =
        this.system.attributes.hp.max + Number(this.system.attributes.hp.tempmax ?? 0);
      this.statuses = new Set();
      for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
        this.system.abilities[key] ??= { value: 10, max: null };
        this.system.abilities[key].mod = Math.floor((this.system.abilities[key].value - 10) / 2);
      }
      for (const e of this.effects)
        if (!e.disabled && !e.isSuppressed && !e.duration?.expired) {
          for (const status of e.statuses ?? []) this.statuses.add(status);
          for (const c of e.system?.changes ?? [])
            if (/system\.abilities\.\w+\.(value|max)$/.test(c.key)) {
              const key = c.key.split(".")[2],
                field = c.key.split(".")[3];
              this.system.abilities[key][field] =
                c.type === "add" ? Number(this.system.abilities[key][field] ?? 0) + Number(c.value) : Number(c.value);
            }
        }
      for (const key of Object.keys(this.system.abilities))
        this.system.abilities[key].mod = Math.floor((this.system.abilities[key].value - 10) / 2);
      this.concentration = {
        effects: new Set(this.effects.filter(e => !e.disabled && e.statuses.has("concentrating")))
      };
    },
    async update(updates) {
      raw = merge(raw, updates);
      this.prepare();
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async unsetFlag(m, k) {
      return this.update({ [`flags.${m}.-=${k}`]: null });
    },
    async createEmbeddedDocuments(type, rows) {
      const out = rows.map(row => (type === "Item" ? owned(row, this) : effect(row, this)));
      this[type === "Item" ? "items" : "effects"].push(...out);
      this.prepare();
      return out;
    },
    async updateEmbeddedDocuments(type, rows) {
      for (const row of rows)
        await this[type === "Item" ? "items" : "effects"].find(e => e.id === row._id)?.update(row);
      return rows;
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (type === "ActiveEffect")
        for (const e of [...this.effects]) {
          if (ids.includes(e.id)) await e.delete();
        }
      else for (const i of [...this.items]) if (ids.includes(i.id)) this.items.splice(this.items.indexOf(i), 1);
    },
    async delete() {
      game.actors.splice(game.actors.indexOf(this), 1);
      docs.delete(this.uuid);
    },
    async beginConcentrating(activity, data) {
      this.concentrationActivity = activity;
      const [e] = await this.createEmbeddedDocuments("ActiveEffect", [
        { name: "Concentration", type: "base", statuses: ["concentrating"], system: { changes: [] }, ...data }
      ]);
      return e;
    },
    async endConcentration(e) {
      if (e) await e.delete();
      else for (const f of [...this.concentration.effects]) await f.delete();
      return [e];
    }
  };
  a.prepare();
  docs.set(a.uuid, a);
  a.items.get = id => a.items.find(i => i.id === id);
  a.items.has = id => Boolean(a.items.get(id));
  return a;
}

let cancelPlacement, point, templates;
function makeActor(level = 16, id = "arkane") {
  const a = entity(
    {
      name: id,
      type: "character",
      system: {
        attributes: {
          prof: 5,
          hp: { value: 20, max: 40, temp: 0, tempmax: 0 },
          movement: { walk: 30, units: "ft" },
          concentration: { limit: 1 }
        },
        spells: {
          spell1: { value: 4, max: 4 },
          spell4: { value: 2, max: 2 },
          spell7: { value: 1, max: 1 },
          pact: { value: 1, max: 1, level: 5 }
        },
        traits: { ci: { value: [] } },
        abilities: Object.fromEntries(
          ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 18, max: null }])
        )
      }
    },
    id
  );
  a.items.push(
    { type: "class", system: { identifier: "wizard", levels: level } },
    ...arkaneTransformationDocuments.map(row => owned(row, a)),
    ...arkaneDocuments.map(row => owned(row, a))
  );
  return a;
}
const item = id => actor.items.find(i => i.system.identifier === `arkane-${id}`),
  act = (id, op) =>
    [...item(id).system.activities.values()].find(a => !op || a.flags?.[MODULE_ID]?.arkaneOperation === op);
function token(a, id, x = 0, scene = canvas.scene) {
  const t = {
    id,
    uuid: `${scene.uuid}.Token.${id}`,
    actor: a,
    actorId: a.id,
    parent: scene,
    name: id,
    x,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    disposition: 1,
    hidden: false
  };
  scene.tokens.push(t);
  docs.set(t.uuid, t);
  return t;
}
function encounter(turn = 0) {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, tokenId: t.id, actor: t.actor })),
    c = {
      id: "c",
      started: true,
      round: 1,
      turn,
      turns: entries,
      combatants: entries,
      combatant: entries[turn],
      previous: { round: 0, turn: 0 }
    };
  game.combat = c;
  game.combats = [c];
  return c;
}
const use = (id, op, requestId = `use${++seq}`) =>
  requestGm("arkane-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
async function native(activity, config) {
  calls.push({ activity, config });
  if (nativeMode !== "normal") return nativeMode;
  for (const cost of activity.consumption?.targets ?? []) {
    if (cost.type === "attribute") {
      await activity.actor.update({
        [`system.${cost.target}`]: property(activity.actor.system, cost.target) - Number(cost.value)
      });
      continue;
    }
    const original = activity.actor.items.find(item => item.id === (cost.target || activity.item.id));
    if (cost.type === "material") {
      if (Number(original.system.quantity) < Number(cost.value)) return false;
      await original.update({ "system.quantity": Number(original.system.quantity) - Number(cost.value) });
    } else await original.update({ "system.uses.spent": Number(original.system.uses.spent) + Number(cost.value) });
  }
  if (activity.type === "save") {
    const targets = (config.midiOptions.targetUuids ?? []).map(uuid => ({ document: docs.get(uuid) }));
    return {
      id: `native${++seq}`,
      activity,
      saves: new Set(saveSuccess ? targets : []),
      failedSaves: new Set(saveSuccess ? [] : targets)
    };
  }
  return { id: `native${++seq}` };
}
function region(radius = 30) {
  let raw = {
    name: "circle",
    documentName: "Region",
    hidden: false,
    shapes: [{ type: "circle", x: point.x, y: point.y, radius: (radius / 5) * 100 }],
    flags: {}
  };
  const zone = {
    id: `z${++seq}`,
    uuid: `Scene.one.Region.z${seq}`,
    parent: canvas.scene,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async update(updates) {
      raw = merge(raw, updates);
      Object.assign(this, raw);
      return this;
    },
    async delete() {
      this.deleted = true;
      this.parent.regions.splice(this.parent.regions.indexOf(this), 1);
      docs.delete(this.uuid);
    }
  };
  Object.assign(zone, raw);
  canvas.scene.regions.push(zone);
  docs.set(zone.uuid, zone);
  return zone;
}
async function storm() {
  answers.push("yes");
  assert.equal((await use("storm", "storm")).status, "success");
  return canvas.scene.regions.at(-1);
}
function spell(owner = target.actor, id = "test-fire") {
  const doc = owned(
    {
      _id: `s${++seq}`,
      name: id,
      type: "spell",
      system: {
        identifier: id,
        level: 3,
        activities: {
          test: { _id: "test", type: "save", flags: {}, activation: { type: "action" }, consumption: { targets: [] } }
        }
      }
    },
    owner
  );
  owner.items.push(doc);
  return doc;
}
beforeEach(() => {
  docs = new Map();
  answers = [];
  prompts = [];
  calls = [];
  messages = [];
  hooks = new Map();
  seq = 0;
  nativeMode = "normal";
  saveSuccess = false;
  cancelPlacement = false;
  point = { x: 250, y: 50 };
  templates = [];
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(u => u.id === id);
  globalThis.game = {
    user: gm,
    users,
    time: { worldTime: 0 },
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    modules: new Map([["midi-qol", { active: true }]]),
    combats: [],
    actors: [],
    scenes: [],
    items: [],
    packs: new Map()
  };
  globalThis.foundry = {
    utils: {
      randomID: () => `arkane${++seq}`,
      deepClone: structuredClone,
      mergeObject: merge,
      getProperty: property,
      escapeHTML: String
    },
    applications: {
      api: {
        DialogV2: {
          wait: async p => {
            prompts.push(p);
            return answers.shift() ?? null;
          }
        }
      }
    }
  };
  globalThis.Hooks = { on: (k, f) => hooks.set(k, [...(hooks.get(k) ?? []), f]) };
  globalThis.CONFIG = {
    DND5E: { maxAbilityScore: 20, abilities: {} },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    create: async data => {
      messages.push(data);
      return data;
    }
  };
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
      this.total = 7;
    }
    async evaluate() {
      return this;
    }
    async toMessage(data) {
      messages.push({ formula: this.formula, ...data });
    }
  };
  class Workflow {
    constructor(actor, activity, speaker, targets, options) {
      Object.assign(this, { actor, activity, targets, workflowOptions: options.workflowOptions });
    }
  }
  globalThis.MidiQOL = {
    Workflow,
    TrapWorkflow: class extends Workflow {},
    completeActivityUse: native,
    computeTargetsFromTemplates: () => [{ document: target, actor: target.actor }],
    addDependent: async () => true
  };
  globalThis.canvas = {
    ready: true,
    scene: {
      id: "one",
      uuid: "Scene.one",
      grid: { size: 100, distance: 5, units: "ft" },
      tokens: [],
      regions: [],
      templates: []
    },
    tokens: { controlled: [], placeables: [] }
  };
  canvas.scene.tokens.get = id => canvas.scene.tokens.find(t => t.id === id);
  canvas.scene.regions.get = id => canvas.scene.regions.find(t => t.id === id);
  game.scenes.push(canvas.scene);
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  game.actors.get = id => game.actors.find(a => a.id === id);
  game.user.targets = new Set();
  game.system = {
    canvas: {
      AbilityTemplate: {
        fromActivity: activity => {
          templates.push(activity);
          return [
            { drawPreview: async () => (cancelPlacement ? false : [region(Number(activity.target.template.size))]) }
          ];
        }
      }
    }
  };
  actor = makeActor();
  game.actors.push(actor);
  source = token(actor, "source");
  target = token(makeActor(0, "target"), "target", 400);
  game.actors.push(target.actor);
  canvas.tokens.placeables = [
    { actor, document: source, center: { x: 50, y: 50 } },
    { actor: target.actor, document: target }
  ];
  const journal = {
    events: [],
    getFlag: (_m, k) => (k === "automationLedger" ? true : journal[k]),
    async setFlag(_m, k, v) {
      journal[k] = structuredClone(v);
    }
  };
  game.journal = [journal];
});
test("one root, fourteen boons and four mandatory flaws; all PDF sections preserved", () => {
  assert.equal(arkaneTransformationDocuments.length, 1);
  assert.equal(arkaneDocuments.length, 18);
  assert.equal(ARKANE_FEATURES.filter(e => e.flaw).length, 4);
  for (const entry of ARKANE_FEATURES) {
    assert.ok(arkaneDescription(entry).length > 100);
    assert.equal(arkaneDocuments.find(d => d.system.identifier === entry.key).effects.length, 0);
  }
  assert.match(arkaneDescription(ARKANE_FEATURES.find(e => e.id === "nullification")), /восстанавливает свои ячейки/);
});
test("the two Nullifications have distinct IDs, names and prerequisites", () => {
  const a = ARKANE_FEATURES.find(e => e.id === "nullification"),
    b = ARKANE_FEATURES.find(e => e.id === "barrier");
  assert.notEqual(a.key, b.key);
  assert.notEqual(a.name, b.name);
  assert.equal(a.level, 2);
  assert.equal(b.level, 4);
  assert.equal(ARKANE_FEATURES.find(e => e.id === "bestowal").requires, "nullification");
});
test("source requirement intelligence16, character13", async () => {
  assert.deepEqual(arkanePrerequisiteFailures(actor), []);
  actor.items[0].system.levels = 12;
  assert.ok(arkanePrerequisiteFailures(actor).length);
  await actor.update({ "system.abilities.int.value": 15 });
  assert.equal(arkanePrerequisiteFailures(actor).length, 2);
});
for (const [level, tier] of [
  [1, 1],
  [5, 1],
  [6, 2],
  [10, 2],
  [11, 3],
  [13, 3],
  [15, 3],
  [16, 4],
  [20, 4]
])
  test(`character ${level} unlocks at most tier ${tier}`, () => {
    actor.items[0].system.levels = level;
    assert.equal(arkaneTransformationLevel(actor), tier);
    assert.equal(arkaneUnlockedTier(level), tier);
    assert.equal(arkaneHas(actor, "body"), tier === 4);
  });
test("advancement grants base three, then flaws and one accumulated choice", () => {
  const all = arkaneTransformationDocuments[0].system.advancement,
    g = all.filter(a => a.type === "ItemGrant"),
    c = all.filter(a => a.type === "ItemChoice");
  assert.deepEqual(
    g.map(a => a.level),
    [1, 6, 11, 16]
  );
  assert.deepEqual(
    g.map(a => a.configuration.items.length),
    [3, 1, 1, 1]
  );
  assert.deepEqual(
    c.map(a => Object.keys(a.configuration.choices)[0]),
    ["6", "11", "16"]
  );
  assert.deepEqual(
    c.map(a => a.configuration.pool.length),
    [4, 8, 12]
  );
});
test("new choice cannot take Obsession without Persistence, or duplicate boon", () => {
  const row = arkaneDocuments.find(d => d.system.identifier === "arkane-obsession"),
    manager = { actor };
  actor.items = actor.items.filter(i => !["arkane-persistence", "arkane-obsession"].includes(i.system.identifier));
  assert.equal(validateArkaneAdvancement(manager, {}, [row], [], []), false);
  const persistence = arkaneDocuments.find(d => d.system.identifier === "arkane-persistence");
  assert.notEqual(validateArkaneAdvancement(manager, {}, [persistence, row], [], []), false);
  assert.equal(validateArkaneAdvancement({ actor: makeActor() }, {}, [row], [], []), false);
});
test("unowned prerequisite prevents manually dragged Obsession use", () => {
  actor.items = actor.items.filter(i => i.system.identifier !== "arkane-persistence");
  assert.equal(arkaneHas(actor, "obsession"), false);
  assert.equal(arkaneAvailable(actor, item("obsession")), false);
  assert.ok(inspectArkane(actor).unavailable.some(row => row.id === "obsession"));
});
test("magical form caps increases at22 and never reduces larger ability", async () => {
  await syncArkane(actor);
  assert.equal(actor.system.abilities.int.value, 22);
  assert.equal(actor.system.abilities.con.value, 20);
  assert.equal(arkaneDC(actor), 23);
  await actor.update({ "system.abilities.int.value": 24, "system.abilities.con.value": 21 });
  await syncArkane(actor);
  assert.equal(actor.system.abilities.int.value, 24);
  assert.equal(actor.system.abilities.con.value, 22);
});
test("form and body only necessary passives, int resources preserve spent and recover on LR", async () => {
  await item("siphon").update({ "system.uses.spent": 2 });
  await syncArkane(actor);
  assert.deepEqual(actor.effects.map(e => e.getFlag(MODULE_ID, "arkanePassive")).sort(), ["body", "form"]);
  assert.equal(item("siphon").system.uses.max, "6");
  assert.equal(item("siphon").system.uses.spent, 2);
  for (const id of ["siphon", "storm", "limitless"]) assert.equal(item(id).system.uses.recovery[0].period, "lr");
});
test("unrelated actor remains unchanged", async () => {
  target.actor.items = [];
  await syncArkane(target.actor);
  assert.deepEqual(arkaneState(target.actor), {});
  assert.equal(target.actor.effects.length, 0);
});
test("fusion current and cumulative counters are separate", async () => {
  await syncArkane(actor);
  await changeArkaneFusion(actor, 500);
  await changeArkaneFusion(actor, -100);
  assert.equal(arkaneState(actor).fusion, 400);
  assert.equal(arkaneState(actor).totalFusion, 500);
  await changeArkaneFusion(actor, -999);
  assert.equal(arkaneState(actor).fusion, 0);
});
test("daily consumption is50 atIII, once per day, no automatic death or slot destruction", async () => {
  await changeArkaneFusion(actor, 100);
  answers.push("yes");
  assert.equal((await use("fusion", "daily-fusion")).status, "success");
  await use("fusion", "daily-fusion");
  assert.equal(arkaneState(actor).fusion, 50);
  assert.equal(prompts.length, 1);
  game.time.worldTime = 86400;
  answers.push("yes");
  await use("fusion", "daily-fusion");
  assert.equal(arkaneState(actor).fusion, 0);
  game.time.worldTime = 172800;
  answers.push("yes");
  await use("fusion", "daily-fusion");
  assert.equal(arkaneState(actor).starvationReview.lack, 50);
  assert.equal(actor.system.spells.spell7.value, 1);
  assert.equal(actor.system.attributes.hp.value, 20);
});
test("tierI daily consumption is20, no synthetic50 from a high unearned flaw", async () => {
  actor.items[0].system.levels = 5;
  await changeArkaneFusion(actor, 100);
  answers.push("yes");
  await use("fusion", "daily-fusion");
  assert.equal(arkaneState(actor).fusion, 80);
});
test("item destruction consumes one actual quantity and native action, not arbitrary loot", async () => {
  const loot = owned(
    { _id: "loot", name: "Magical gem", type: "loot", system: { rarity: "rare", quantity: 2 } },
    actor
  );
  actor.items.push(loot);
  answers.push(loot.uuid, "yes");
  assert.equal((await use("fusion", "consume-item", "loot-use")).status, "success");
  assert.equal(loot.system.quantity, 1);
  assert.equal(arkaneState(actor).fusion, 500);
  assert.equal(calls[0].activity.activation.type, "action");
  await use("fusion", "consume-item", "loot-use");
  assert.equal(loot.system.quantity, 1);
  assert.equal(ARKANE_RARITY_POINTS.artifact, 1500);
});
test("canceling destruction has no expense", async () => {
  await use("fusion", "consume-item");
  assert.equal(calls.length, 0);
  assert.equal(arkaneState(actor).fusion, 0);
});
test("exact slot picker supports pact, rejects impossible sum before prompts", async () => {
  assert.equal(arkaneExactSlots(arkaneSpellPools(actor), 16), true);
  answers.push(1, 1, 1);
  const plan = await chooseArkaneSlots(actor, { total: 16 });
  assert.equal(
    plan.reduce((sum, p) => sum + p.level * p.count, 0),
    16
  );
  assert.ok(arkaneSlotCosts(plan).some(p => p.target === "spells.pact.value"));
  assert.equal(await chooseArkaneSlots(actor, { total: 100 }), null);
});
test("Siphon incapable target skips save, uses one roll then x10 force damage", async () => {
  actor.items = actor.items.filter(i => i.system.identifier !== "arkane-devouring");
  answers.push([target.uuid], "yes", "incapable", "tenfold");
  assert.equal((await use("siphon")).status, "success");
  assert.equal(calls.filter(c => c.activity.type === "save").length, 0);
  assert.equal(messages.filter(m => m.formula === "2d4 + 1").length, 1);
  assert.equal(calls.at(-1).activity.damage.parts[0].custom.formula, "70");
  assert.equal(item("siphon").system.uses.spent, 1);
});
test("successful Siphon save causes no damage or drain", async () => {
  actor.items = actor.items.filter(i => i.system.identifier !== "arkane-devouring");
  saveSuccess = true;
  answers.push([target.uuid], "yes", "capable");
  assert.equal((await use("siphon")).status, "success");
  assert.equal(calls.filter(c => c.activity.type === "damage").length, 0);
  assert.equal(actor.system.spells.spell7.value, 1);
  assert.equal(target.actor.system.spells.spell7.value, 1);
});
test("Siphon all uses self circle60, includes allies, one resource", async () => {
  point = { x: 50, y: 50 };
  answers.push("all", "yes", "incapable", "tenfold");
  assert.equal((await use("siphon")).status, "success");
  assert.equal(templates[0].target.template.size, "60");
  assert.equal(item("siphon").system.uses.spent, 1);
  assert.equal(canvas.scene.regions.length, 0);
});
test("Limitless cancellation before allocation consumes no slots or ability use", async () => {
  await use("limitless");
  assert.equal(calls.length, 0);
  assert.equal(actor.system.spells.spell7.value, 1);
  assert.equal(item("limitless").system.uses.spent, 0);
});
test("Limitless uses11 actual allocated d12, no attack or save", async () => {
  answers.push(0, 0, 0, 0, [target.uuid], "yes");
  assert.equal((await use("limitless")).status, "success");
  assert.ok(messages.some(m => m.formula === "11d12 + 11"));
  assert.equal(calls.at(-1).activity.type, "damage");
  assert.equal(item("limitless").system.uses.spent, 1);
});
test("Persistence pays exact sixteen actual slot levels and no action", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  answers.push("yes", 1, 1, 1);
  assert.equal((await use("persistence", "persistence")).status, "success");
  assert.equal(actor.system.spells.spell7.value, 0);
  assert.equal(actor.system.spells.pact.value, 0);
  assert.equal(actor.system.spells.spell4.value, 1);
  assert.equal(calls[0].activity.activation.type, "special");
  assert.ok(arkaneState(actor).persistence);
});
test("Persistence cannot trigger while still above0hp", async () => {
  await use("persistence", "persistence");
  assert.equal(calls.length, 0);
  assert.equal(arkaneState(actor).persistence, undefined);
});
test("parasite effect limited to spell attacks, spellDC and saves, not transformationDC", async () => {
  await syncArkane(actor);
  const dc = arkaneDC(actor);
  answers.push("yes");
  await use("parasite");
  const effect = actor.effects.find(e => e.getFlag(MODULE_ID, "arkaneParasite"));
  assert.equal(effect.duration.value, 60);
  assert.equal(effect.system.changes.length, 9);
  assert.ok(!effect.system.changes.some(c => c.key.includes("mwak") || c.key.includes("rwak")));
  assert.equal(arkaneDC(actor), dc);
});
test("Fractal seven-day limit neither creates duplicated actor nor resets resources", async () => {
  answers.push("yes");
  await use("fractal");
  assert.equal(arkaneState(actor).fractalNext, 604800);
  answers.push("yes");
  assert.equal((await use("fractal")).status, "cancelled");
  assert.equal(calls.length, 1);
  assert.equal(game.actors.length, 2);
});
test("private identification reports current numbers only, not hidden maxima", async () => {
  answers.push([target.uuid], "yes");
  await use("senses");
  const report = messages.at(-1);
  assert.deepEqual(report.whisper, ["gm"]);
  assert.match(report.content, /текущие хиты 20/);
  assert.ok(!report.content.includes("20/40"));
  assert.ok(!report.content.includes("4/4"));
});
test("manual or unknown Midi outcome never spends ability twice", async () => {
  nativeMode = undefined;
  actor.items = actor.items.filter(i => i.system.identifier !== "arkane-devouring");
  answers.push([target.uuid], "yes", "capable");
  assert.equal((await use("siphon", null, "same")).status, "needs-review");
  await use("siphon", null, "same");
  assert.equal(calls.length, 1);
});
test("storm placement has no initial damage and no concentration", async () => {
  const zone = await storm();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].activity.type, "utility");
  assert.equal(zone.flags[MODULE_ID].zoneExpiresAt, 60);
  assert.equal(zone.flags[MODULE_ID].zoneConcentrationEffect, undefined);
  assert.equal(actor.concentration.effects.size, 0);
  assert.equal(templates[0].target.template.size, "30");
});
test("cancel storm placement no resource or residual document", async () => {
  cancelPlacement = true;
  await use("storm", "storm");
  assert.equal(calls.length, 0);
  assert.equal(item("storm").system.uses.spent, 0);
  assert.equal(canvas.scene.regions.length, 0);
});
test("storm cannot place outside60feet", async () => {
  point = { x: 5000, y: 50 };
  await use("storm", "storm");
  assert.equal(calls.length, 0);
  assert.equal(item("storm").system.uses.spent, 0);
  assert.equal(canvas.scene.regions.length, 0);
});
test("storm turn event snapshot uses unlinked combat token scene and fixedDC", async () => {
  const zone = await storm(),
    c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  const record = arkaneStormRecord(zone, target, c);
  assert.equal(record.sceneId, "one");
  assert.equal(record.input.dc, 23);
  await actor.update({ "system.abilities.int.value": 10 });
  await runArkaneStormRecord(record);
  assert.equal(calls.at(-1).activity.save.dc.formula, "23");
  assert.equal(calls.at(-1).activity.damage.parts[0].number, 6);
  assert.equal(calls.at(-1).activity.damage.onSave, "half");
});
test("storm repeated callback and same-turn entry cause one save only", async () => {
  const zone = await storm(),
    c = encounter(1);
  const record = arkaneStormRecord(zone, target, c);
  await runArkaneStormRecord(record);
  await runArkaneStormRecord(record);
  assert.equal(calls.filter(c => c.activity.type === "save").length, 1);
});
test("storm excludes source", async () => {
  const zone = await storm();
  assert.equal(arkaneStormRecord(zone, source, encounter()), null);
});
test("only real outside-to-inside token movement triggers entry; no region motion hook", async () => {
  await storm();
  const c = encounter();
  target.x = 2000;
  assert.equal(captureArkaneStormEntry(target, { x: 400 }).length, 1);
  assert.equal(captureArkaneStormEntry(target, { x: 2200 }).length, 0);
  target.x = 400;
  assert.equal(captureArkaneStormEntry(target, { x: 450 }).length, 0);
  installArkaneStormHooks();
  assert.equal(hooks.get("updateRegion"), undefined);
  assert.ok(c.started);
});
test("off-scene storm event queued, not retrospectively applied automatically", async () => {
  const zone = await storm(),
    record = arkaneStormRecord(zone, target, encounter(1));
  canvas.scene = { id: "other" };
  await runArkaneStormRecord(record);
  assert.equal(calls.length, 1);
  assert.equal(game.journal[0].events[0].state, "queued");
});
test("storm expires after minute or unconsciousness, not mere stun", async () => {
  const zone = await storm();
  actor.statuses.add("stunned");
  await cleanArkaneStorms(canvas.scene);
  assert.equal(zone.deleted, undefined);
  actor.statuses.add("unconscious");
  await cleanArkaneStorms(canvas.scene);
  assert.equal(zone.deleted, true);
  actor.statuses.clear();
  const zone2 = await storm();
  game.time.worldTime = 61;
  await cleanArkaneStorms(canvas.scene);
  assert.equal(zone2.deleted, true);
});
test("storm move only on own later turn; expiry unchanged and no pulse", async () => {
  const c = encounter();
  const zone = await storm();
  answers.push(zone.uuid);
  await assert.rejects(() => use("storm", "move-storm"), /последующий ход/);
  c.round = 2;
  c.previous = { round: 1, turn: 1 };
  point = { x: 1250, y: 50 };
  answers.push(zone.uuid);
  assert.equal((await use("storm", "move-storm")).status, "success");
  assert.equal(zone.shapes[0].x, 1250);
  assert.equal(zone.flags[MODULE_ID].zoneExpiresAt, 60);
  assert.equal(calls.filter(c => c.activity.type === "save").length, 0);
  answers.push(zone.uuid);
  await assert.rejects(() => use("storm", "move-storm"), /последующий ход/);
});
test("body advantage only for spell saving throws, not nonspell or checks", async () => {
  await syncArkane(actor);
  const details = { rollType: "save" };
  prepareArkaneSpellSave({ actor }, { item: { type: "spell" } }, details);
  assert.equal(details.advantage, true);
  for (const [type, rollType] of [
    ["feat", "save"],
    ["spell", "check"]
  ]) {
    const d = { rollType };
    prepareArkaneSpellSave({ actor }, { item: { type } }, d);
    assert.equal(d.advantage, undefined);
  }
});
test("body spell resistance does not halve twice or affect mundane damage", async () => {
  await syncArkane(actor);
  const packet = {
    damageDetail: [
      { type: "force", value: 13 },
      { type: "fire", value: 8, active: { resistance: true } }
    ]
  };
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "spell" } }, damageItem: packet });
  assert.equal(packet.damageDetail[0].value, 6);
  assert.equal(packet.damageDetail[1].value, 8);
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "spell" } }, damageItem: packet });
  assert.equal(packet.damageDetail[0].value, 6);
  const mundane = { damageDetail: [{ type: "force", value: 13 }] };
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "feat" } }, damageItem: mundane });
  assert.equal(mundane.damageDetail[0].value, 13);
});
test("disabled or suppressed body cannot protect", async () => {
  await syncArkane(actor);
  const effect = actor.effects.find(e => e.getFlag(MODULE_ID, "arkanePassive") === "body");
  effect.isSuppressed = true;
  assert.equal(arkaneBodyActive(actor), false);
  effect.isSuppressed = false;
  effect.disabled = true;
  assert.equal(arkaneBodyActive(actor), false);
});
test("spell immunity choices exactly2, once per long rest epoch", async () => {
  const a = spell(actor, "fireball"),
    b = spell(actor, "shield");
  answers.push([arkaneIdentity(a), arkaneIdentity(b)]);
  assert.equal((await use("body")).status, "success");
  assert.equal(arkaneState(actor).immunities.length, 2);
  answers.push([arkaneIdentity(a), arkaneIdentity(b)]);
  assert.equal((await use("body")).status, "cancelled");
  await requestGm("arkane-rest", actor, {}, { requestId: "lr" });
  assert.equal((await use("body")).status, "success");
  await requestGm("arkane-rest", actor, {}, { requestId: "lr" });
  assert.equal(arkaneState(actor).restEpoch, 1);
});
test("named spell immunity removes only protected target before saves/effects", async () => {
  await syncArkane(actor);
  const spellDoc = spell(),
    activity = [...spellDoc.system.activities.values()][0];
  await actor.setFlag(MODULE_ID, "arkaneState", {
    ...arkaneState(actor),
    immunities: [{ id: arkaneIdentity(spellDoc) }]
  });
  const protectedToken = { document: source, actor },
    otherToken = { document: target, actor: target.actor },
    workflow = {
      id: "wf",
      actor: target.actor,
      item: spellDoc,
      activity,
      targets: new Set([protectedToken, otherToken])
    };
  await prepareArkaneSpellImmunity(workflow);
  assert.deepEqual([...workflow.targets], [otherToken]);
});
test("barrier owns temporary HP, respects cancellation and uses no invented timer", async () => {
  await use("barrier");
  assert.equal(actor.system.attributes.hp.temp, 40);
  assert.equal(arkaneBarrierActive(actor), true);
  const state = actor.getFlag(MODULE_ID, "arkaneBarrier"),
    e = actor.effects.find(e => e.uuid === state.effectUuid);
  assert.equal(e.duration.value, null);
  await actor.update({ "system.attributes.hp.temp": 90 });
  answers.push("no");
  assert.equal((await use("barrier")).status, "cancelled");
  assert.equal(actor.system.attributes.hp.temp, 90);
});
test("barrier native damage tracks own remaining, foreign temp HP revokes protection", async () => {
  await use("barrier");
  const changes = { "system.attributes.hp.temp": 12 };
  carryArkaneBarrierDamage(actor, 28, changes);
  assert.equal(changes[`flags.${MODULE_ID}.arkaneBarrier`].remaining, 12);
  guardArkaneBarrierUpdate(actor, changes);
  await actor.update(changes);
  assert.equal(arkaneBarrierActive(actor), true);
  const replacement = { "system.attributes.hp.temp": 80 };
  guardArkaneBarrierUpdate(actor, replacement);
  await actor.update(replacement);
  await cleanupArkaneBarrier(actor);
  assert.equal(arkaneBarrierActive(actor), false);
  assert.equal(actor.system.attributes.hp.temp, 80);
  assert.equal(
    actor.effects.some(e => e.getFlag(MODULE_ID, "arkaneBarrierEffect")),
    false
  );
});
test("swallowed spell refills own barrier and spent slots once, not caller's slots", async () => {
  await use("barrier");
  await actor.update({
    "system.attributes.hp.temp": 20,
    [`flags.${MODULE_ID}.arkaneBarrier`]: { ...actor.getFlag(MODULE_ID, "arkaneBarrier"), remaining: 20 },
    "system.spells.spell1.value": 0
  });
  const doc = spell(),
    activity = [...doc.system.activities.values()][0],
    data = { activityUuid: activity.uuid, workflowId: "swallow", castLevel: 3, targets: [source.uuid] };
  answers.push(2);
  await requestGm("arkane-spell-immunity", target.actor, data, { requestId: "immune1" });
  assert.equal(actor.system.attributes.hp.temp, 25);
  assert.equal(actor.system.spells.spell1.value, 2);
  await requestGm("arkane-spell-immunity", target.actor, data, { requestId: "immune2" });
  assert.equal(actor.system.attributes.hp.temp, 25);
  assert.equal(actor.system.spells.spell1.value, 2);
  assert.equal(target.actor.system.spells.spell1.value, 4);
});
test("barrier does not protect against sixth-level cast", async () => {
  await use("barrier");
  const doc = spell(),
    data = {
      activityUuid: [...doc.system.activities.values()][0].uuid,
      workflowId: "six",
      castLevel: 6,
      targets: [source.uuid]
    };
  const result = await requestGm("arkane-spell-immunity", target.actor, data);
  assert.deepEqual(result.protectedTargets, []);
});
test("true appearance revealed by concentration without changing token image", async () => {
  await actor.setFlag(MODULE_ID, "arkaneState", { appearance: "humanoid" });
  await actor.beginConcentrating(null, {});
  await observeArkaneAppearance(actor);
  assert.equal(arkaneState(actor).appearance, "true");
  assert.equal(source.img, undefined);
});
test("diagnosis read-only; actual event and Midi hook registrations", async () => {
  await syncArkane(actor);
  const before = JSON.stringify(actor.toObject());
  inspectArkane(actor);
  assert.equal(JSON.stringify(actor.toObject()), before);
  installArkaneHooks();
  for (const key of [
    "midi-qol.preTargetingV2",
    "midi-qol.prePreambleComplete",
    "midi-qol.preTargetSave",
    "preUpdateToken",
    "updateCombat",
    "dnd5e.preApplyDamage"
  ])
    assert.ok(hooks.get(key)?.length);
});
test("second GM neither emits duplicate storm events nor applies passive requests", async () => {
  const zone = await storm(),
    c = encounter();
  game.users.activeGM = { id: "other", isGM: true, active: true };
  assert.equal(arkaneStormRecord(zone, target, c), null);
  await cleanArkaneStorms(canvas.scene);
  assert.equal(zone.deleted, undefined);
});
test("new generic names do not auto-link unrelated descriptions", () => {
  const other = {
    _id: "other",
    name: "other",
    flags: {},
    system: { description: { value: "Присутствие, Паразит и Аннулирование." } }
  };
  linkDocumentDescriptions([{ name: "features", documents: [...arkaneDocuments, other] }]);
  assert.equal(other.system.description.value, "Присутствие, Паразит и Аннулирование.");
});
test("player-initiated movement transported to active GM and checked against committed position", async () => {
  await storm();
  encounter();
  target.x = 2000;
  const gm = game.user;
  game.user = { id: "player", isGM: false };
  const options = {};
  captureArkaneMovement(target, { x: 400 }, options);
  assert.equal(options[MODULE_ID].arkaneStormFrom.x, 2000);
  target.x = 400;
  game.user = gm;
  await applyArkaneMovement(target, { x: 400 }, options);
  assert.equal(calls.filter(c => c.activity.type === "save").length, 1);
});
test("canceled movement without committed destination does not deal damage", async () => {
  await storm();
  encounter();
  target.x = 2000;
  const options = {};
  captureArkaneMovement(target, { x: 400 }, options);
  await applyArkaneMovement(target, { x: 400 }, options);
  assert.equal(calls.filter(c => c.activity.type === "save").length, 0);
});
test("turn changed during movement request queues original-turn event for GM review", async () => {
  await storm();
  const c = encounter();
  target.x = 2000;
  const options = {};
  captureArkaneMovement(target, { x: 400 }, options);
  target.x = 400;
  c.turn = 1;
  c.combatant = c.turns[1];
  await applyArkaneMovement(target, { x: 400 }, options);
  assert.equal(calls.length, 1);
  assert.equal(game.journal[0].events[0].state, "queued");
  assert.equal(game.journal[0].events[0].input.turn, "c:1:0");
});
test("barrier depletion cannot be revived by foreign temporary HP", async () => {
  await use("barrier");
  const changes = { "system.attributes.hp.temp": 0 };
  carryArkaneBarrierDamage(actor, 50, changes);
  await actor.update(changes);
  await cleanupArkaneBarrier(actor);
  await actor.update({ "system.attributes.hp.temp": 90 });
  assert.equal(arkaneBarrierActive(actor), false);
});
test("no normal-slot substitution when restoring pact slots", async () => {
  await use("barrier");
  await actor.update({ "system.spells.pact.value": 0 });
  const doc = spell(),
    data = {
      activityUuid: [...doc.system.activities.values()][0].uuid,
      workflowId: "pact-restore",
      castLevel: 5,
      targets: [source.uuid]
    };
  answers.push(1);
  await requestGm("arkane-spell-immunity", target.actor, data);
  assert.equal(actor.system.spells.pact.value, 1);
  assert.equal(actor.system.spells.spell4.value, 2);
});
test("simultaneous use callbacks share prompt and expenditure", async () => {
  answers.push("yes");
  await Promise.all([controlArkane(actor, act("fractal")), controlArkane(actor, act("fractal"))]);
  assert.equal(prompts.length, 1);
  assert.equal(calls.length, 1);
});
test("0hp Persistence explicitly bypasses Midi incapacitated validation only for its confirmed trigger", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  answers.push("yes", 1, 1, 1);
  await use("persistence", "persistence");
  assert.equal(calls[0].config.midiOptions.workflowOptions.allowIncapacitated, true);
  assert.equal(calls[0].config.midiOptions.workflowOptions.noOnUseMacro, true);
});
test("Magical Form respects other active ability bonuses without lowering them", async () => {
  await actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Other bonus", system: { changes: [{ key: "system.abilities.int.value", value: "3", type: "add" }] } }
  ]);
  await syncArkane(actor);
  assert.equal(actor.system.abilities.int.value, 22);
  await syncArkane(actor);
  assert.equal(actor.system.abilities.int.value, 22);
  const own = actor.effects.find(e => e.getFlag(MODULE_ID, "arkanePassive") === "form");
  assert.equal(own.system.changes.find(c => c.key === "system.abilities.int.value").value, "1");
});
test("partial native advancement updates do not erase prerequisite identity", () => {
  const prerequisite = item("persistence");
  actor.items = actor.items.filter(i => i.system.identifier !== "arkane-obsession");
  const created = arkaneDocuments.find(d => d.system.identifier === "arkane-obsession");
  assert.notEqual(
    validateArkaneAdvancement(
      { actor },
      {},
      [created],
      [{ _id: prerequisite.id, "system.description.value": "Manual edit" }],
      []
    ),
    false
  );
});
test("Fractal records completed ritual, not an invented one-action casting time", async () => {
  answers.push("yes");
  await use("fractal");
  assert.equal(calls[0].activity.activation.type, "special");
});
