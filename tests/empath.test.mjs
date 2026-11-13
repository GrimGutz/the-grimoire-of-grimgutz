import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import {
  EMPATH_FEATURES,
  EMPATH_MASKS,
  empathDice,
  empathTemporaryDice
} from "../scripts/automation/shared/empath-definitions.mjs";
import {
  empathLevel,
  empathState,
  empathMask,
  empathSnapshot,
  empathEffects,
  empathEffectData
} from "../scripts/automation/shared/empath-state.mjs";
import { empathClassDocuments } from "../src/packs/empath-class.mjs";
import { empathDocuments } from "../src/packs/empath-features.mjs";
import { empathSpellDocuments } from "../src/packs/empath-spells.mjs";
import { empathSpellRule, empathSection } from "../src/empath-data.mjs";
import {
  syncEmpath,
  empathPassiveDefinitions,
  empathPrerequisiteFailures,
  validateEmpathItem
} from "../scripts/automation/classes/empath.mjs";
import {
  empathExpense,
  setEmpathMask,
  empathWaveActivity,
  controlEmpath
} from "../scripts/automation/classes/empath-actions.mjs";
import {
  createEmpathEffect,
  empathEffectDefinition,
  empathPulse
} from "../scripts/automation/classes/empath-effects.mjs";
import {
  blockEmpathActivity,
  applyEmpathHealingBan,
  applyEmpathSave,
  resolveEmpathEvent,
  empathTurnRecords,
  observeEmpathDamage,
  removeEmpathConcentration,
  installEmpathHooks
} from "../scripts/automation/classes/empath-events.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { processRepeatedSaves } from "../scripts/automation/effects/repeated-saves.mjs";
import { cleanupCombatBenefits } from "../scripts/automation/shared/combat-benefits.mjs";
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

function makeActor(level = 5, id = "empath") {
  const a = entity(
    {
      name: id,
      type: "character",
      system: {
        attributes: {
          prof: 4,
          hp: { value: 20, max: 40, temp: 0, tempmax: 0 },
          movement: { walk: 30, fly: 60, units: "ft" },
          concentration: { limit: 1 }
        },
        spells: { spell4: { value: 2, max: 2 }, spell3: { value: 3, max: 3 }, pact: { value: 1, max: 1, level: 5 } },
        traits: { ci: { value: [] } },
        abilities: Object.fromEntries(
          ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 18, max: null }])
        )
      }
    },
    id
  );
  a.items.push(
    { type: "class", system: { identifier: "empath", levels: level } },
    { type: "class", system: { identifier: "fighter", levels: 5 } },
    ...empathDocuments.map(row => owned(row, a)),
    ...empathSpellDocuments.map(row => owned(row, a))
  );
  return a;
}
const item = id => actor.items.find(i => i.system.identifier === `empath-${id}`),
  act = (id, op) =>
    [...item(id).system.activities.values()].find(a => !op || a.flags?.[MODULE_ID]?.empathOperation === op);
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
  requestGm("empath-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
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
    const original = activity.actor.items.get(cost.target || activity.item.id);
    await original.update({ "system.uses.spent": Number(original.system.uses.spent) + Number(cost.value) });
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
    packs: new Map()
  };
  globalThis.foundry = {
    utils: {
      randomID: () => `empath${++seq}`,
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
      this.total = 10;
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
    scene: { id: "one", uuid: "Scene.one", grid: { size: 100, distance: 5, units: "ft" }, tokens: [], templates: [] },
    tokens: { controlled: [], placeables: [] }
  };
  canvas.scene.tokens.get = id => canvas.scene.tokens.find(t => t.id === id);
  game.scenes.push(canvas.scene);
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  game.actors.get = id => game.actors.find(a => a.id === id);
  game.user.targets = new Set();
  game.system = {
    canvas: {
      AbilityTemplate: {
        fromActivity: () => [
          {
            drawPreview: async () => {
              if (nativeMode === "placement-cancel") return false;
              const t = {
                id: "template",
                uuid: "Scene.one.MeasuredTemplate.t",
                x: 50,
                y: 50,
                flags: {},
                async update(data) {
                  this.flags = merge(
                    this.flags,
                    Object.fromEntries(
                      Object.entries(data)
                        .filter(([k]) => k.startsWith("flags."))
                        .map(([k, v]) => [k.slice(6), v])
                    )
                  );
                },
                async delete() {
                  canvas.scene.templates = [];
                }
              };
              canvas.scene.templates = [t];
              return [t];
            }
          }
        ]
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
test("source-faithful nine features, four masks, five level grants and separate spell", () => {
  assert.equal(empathDocuments.length, 9);
  assert.equal(EMPATH_MASKS.length, 4);
  assert.equal(empathClassDocuments[0].system.hitDice, "d8");
  const grants = empathClassDocuments[0].system.advancement.filter(a => a.type === "ItemGrant");
  assert.deepEqual(
    grants.slice(0, 5).map(a => a.level),
    [1, 2, 3, 4, 5]
  );
  assert.equal(
    grants.slice(0, 5).reduce((n, a) => n + a.configuration.items.length, 0),
    9
  );
  assert.equal(grants[5].level, 3);
  assert.match(grants[5].configuration.items[0].uuid, /\.spells\./);
  assert.equal(empathSpellDocuments[0].system.level, 4);
  assert.equal(empathSpellDocuments[0].system.preparation.mode, "always");
});
test("all source sections preserved and no empty passive templates", () => {
  for (const entry of EMPATH_FEATURES) {
    assert.ok(empathSection(entry.name).length > 100);
    const row = empathDocuments.find(d => d.system.identifier === entry.key);
    assert.equal(row.effects.length, 0);
    assert.match(row.system.description.value, /Автоматизация Foundry:/);
    assert.equal(row.flags[MODULE_ID].automation.version, 1);
  }
  assert.match(empathSpellRule, /включая союзников/);
  assert.match(empathSpellDocuments[0].system.description.value, /Входящие позже/);
});
test("entry requires five prior class levels, not five including incoming Empath", () => {
  actor.items = actor.items.filter(i => i.type !== "class");
  actor.items.push({ type: "class", system: { levels: 4 } });
  assert.ok(empathPrerequisiteFailures(actor).some(s => s.includes("уровень")));
  actor.items.find(i => i.type === "class").system.levels = 5;
  assert.deepEqual(empathPrerequisiteFailures(actor), []);
});
test("both mental abilities 14, one at least 16", async () => {
  await actor.update({ "system.abilities.wis.value": 14, "system.abilities.cha.value": 15 });
  assert.equal(empathPrerequisiteFailures(actor).length, 1);
  await actor.update({ "system.abilities.cha.value": 16 });
  assert.deepEqual(empathPrerequisiteFailures(actor), []);
  await actor.update({ "system.abilities.wis.value": 13 });
  assert.equal(empathPrerequisiteFailures(actor).length, 1);
});
test("strict entry validation is opt-in", () => {
  const card = { type: "class", system: { identifier: "empath" }, parent: target.actor };
  target.actor.items = [];
  assert.equal(validateEmpathItem(card, null, null, "gm"), undefined);
  game.settings.get = () => true;
  assert.equal(validateEmpathItem(card, null, null, "gm"), false);
});
test("initial calm, numeric passive, resource synchronization preserves spent", async () => {
  await item("masks").update({ "system.uses.spent": 2 });
  await syncEmpath(actor);
  assert.equal(empathMask(actor).id, "calm");
  assert.equal(item("masks").system.uses.max, "4");
  assert.equal(item("masks").system.uses.spent, 2);
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "empathPassive") === "mask").system.changes[0].value, "1");
});
test("joy walk bonus converts units, no hover or extra movement modes", async () => {
  await actor.update({ "system.attributes.movement.units": "m" });
  await setEmpathMask(actor, "joy");
  const changes = empathPassiveDefinitions(actor).find(e => e.flags[MODULE_ID].empathPassive === "mask").system.changes;
  assert.equal(changes.length, 1);
  assert.equal(changes[0].value, "3.048");
});
test("nature replaces ability and maximum with mask, feat disables it", async () => {
  await syncEmpath(actor);
  assert.equal(actor.system.abilities.wis.value, 20);
  await setEmpathMask(actor, "anger");
  assert.equal(actor.system.abilities.wis.value, 18);
  assert.equal(actor.system.abilities.str.value, 20);
  await actor.setFlag(MODULE_ID, "empathState", { mask: "anger", nature: "feat" });
  await syncEmpath(actor);
  assert.equal(actor.system.abilities.str.value, 18);
  assert.equal(actor.effects.length, 0);
});
test("calm initiative uses increased Wisdom once and updates after feat choice", async () => {
  await syncEmpath(actor);
  await syncEmpath(actor);
  assert.equal(empathPassiveDefinitions(actor)[0].system.changes.find(c => c.key.includes("init")).value, "5");
  await actor.setFlag(MODULE_ID, "empathState", { mask: "calm", nature: "feat" });
  await syncEmpath(actor);
  assert.equal(empathPassiveDefinitions(actor)[0].system.changes.find(c => c.key.includes("init")).value, "4");
});
test("levels and missing features prevent extra passives", () => {
  actor.items.find(i => i.system.identifier === "empath").system.levels = 1;
  assert.equal(empathPassiveDefinitions(actor).length, 1);
  assert.equal(empathPassiveDefinitions(actor)[0].system.changes.length, 1);
  actor.items = actor.items.filter(i => i.system.identifier !== "empath-masks");
  assert.deepEqual(empathPassiveDefinitions(actor), []);
});
test("unrelated actors untouched", async () => {
  target.actor.items = [];
  await syncEmpath(target.actor);
  assert.equal(target.actor.effects.length, 0);
  assert.deepEqual(empathState(target.actor), {});
});
test("outside switch consumes native action and common mask use only", async () => {
  answers.push("joy");
  assert.equal((await use("masks", "outside-mask")).status, "success");
  assert.equal(empathMask(actor).id, "joy");
  assert.equal(item("masks").system.uses.spent, 1);
  assert.equal(calls[0].activity.activation.type, "action");
  assert.equal(item("impulse").system.uses.spent, 0);
});
test("cancel outside mask spends nothing", async () => {
  assert.equal((await use("masks", "outside-mask")).status, "cancelled");
  assert.equal(calls.length, 0);
});
test("same mask causes no expense", async () => {
  answers.push("calm");
  await use("masks", "outside-mask");
  assert.equal(calls.length, 0);
});
test("combat blocks unrestricted outside action", async () => {
  encounter();
  answers.push("joy");
  await assert.rejects(() => use("masks", "outside-mask"), /только после события/);
  assert.equal(calls.length, 0);
});
test("voluntary change records one reaction, does not spend outside resource", async () => {
  encounter();
  answers.push("joy", "voluntary", "yes", null);
  assert.equal((await use("masks", "combat-mask")).status, "success");
  assert.equal(empathMask(actor).id, "joy");
  assert.equal(item("masks").system.uses.spent, 0);
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse").used, 1);
});
test("successful preservation save causes no change or recursive prompt", async () => {
  encounter();
  saveSuccess = true;
  answers.push("sorrow", "involuntary", "yes", "save");
  assert.equal((await use("masks", "combat-mask")).status, "success");
  assert.equal(empathMask(actor).id, "calm");
  assert.equal(prompts.length, 4);
  assert.equal(calls.filter(c => c.activity.type === "save").length, 1);
});
test("failed preservation save changes without spending reaction unless response", async () => {
  encounter();
  answers.push("sorrow", "involuntary", "yes", "save", null);
  assert.equal((await use("masks", "combat-mask")).status, "success");
  assert.equal(empathMask(actor).id, "sorrow");
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse"), undefined);
});
test("same request is idempotent after native application", async () => {
  answers.push("joy");
  await use("masks", "outside-mask", "same");
  const n = prompts.length;
  await use("masks", "outside-mask", "same");
  assert.equal(item("masks").system.uses.spent, 1);
  assert.equal(prompts.length, n);
});
test("unknown native use never changes mask and is not replayed", async () => {
  nativeMode = undefined;
  answers.push("joy");
  assert.equal((await use("masks", "outside-mask", "unknown")).status, "needs-review");
  await use("masks", "outside-mask", "unknown");
  assert.equal(calls.length, 1);
  assert.equal(empathMask(actor).id, "calm");
});
test("depleted resource no native consumption", async () => {
  await syncEmpath(actor);
  await item("masks").update({ "system.uses.spent": 4 });
  answers.push("joy");
  await assert.rejects(() => use("masks", "outside-mask"), /Нет использований/);
  assert.equal(calls.length, 0);
});
test("snapshot does not change after mask switch or level change", async () => {
  await syncEmpath(actor);
  const snapshot = empathSnapshot(actor);
  await setEmpathMask(actor, "joy");
  assert.equal(snapshot.mask, "calm");
  assert.equal(snapshot.dc, 16);
  assert.equal(empathSnapshot(actor).dc, 16);
});
for (const level of [1, 3, 5])
  test(`impulse anger native dice at level ${level}`, async () => {
    actor.items.find(i => i.system.identifier === "empath").system.levels = level;
    await setEmpathMask(actor, "anger");
    answers.push([target.uuid], "yes");
    assert.equal((await use("impulse")).status, "success");
    const pulse = calls.find(c => c.activity.type === "save").activity;
    assert.equal(pulse.damage.parts[0].number, empathDice(level));
    assert.equal(pulse.damage.onSave, "half");
    assert.deepEqual(pulse.save.ability, ["dex"]);
    assert.equal(item("impulse").system.uses.spent, 1);
    assert.equal(target.actor.effects.length, 0);
  });
test("impulse sorrow halves all movement modes dynamically without global save bonus", async () => {
  await setEmpathMask(actor, "sorrow");
  answers.push([target.uuid], "yes");
  await use("impulse");
  const effect = empathEffects(target.actor)[0];
  assert.equal(empathEffectData(effect).mask, "sorrow");
  assert.equal(effect.system.changes.length, 5);
  assert.ok(effect.system.changes.every(c => c.type === "multiply" && c.value === "0.5"));
  assert.equal(effect.duration.value, null);
});
test("successful impulse save creates no restriction", async () => {
  saveSuccess = true;
  answers.push([target.uuid], "yes");
  await use("impulse");
  assert.equal(empathEffects(target.actor).length, 0);
});
test("joy temporary hit points are maximum not added", async () => {
  await setEmpathMask(actor, "joy");
  await target.actor.update({ "system.attributes.hp.temp": 30 });
  answers.push([target.uuid], "yes");
  await use("impulse");
  assert.equal(target.actor.system.attributes.hp.temp, 30);
  assert.equal(messages.at(-1).formula, `${empathTemporaryDice(5)}d8 + 4`);
});
test("empathy calm gives only AC and concentration advantage", async () => {
  answers.push([target.uuid], "yes", "yes");
  await use("empathy");
  const effect = empathEffects(target.actor)[0];
  assert.equal(effect.system.changes[0].value, "3");
  assert.ok(effect.system.changes[1].key.includes("concentration"));
  assert.ok(!effect.system.changes.some(c => c.key.includes("abilities.con")));
  assert.equal(item("empathy").system.uses.spent, 1);
});
test("voice joy charisma checks, not attacks or saves; 600 second lifetime", async () => {
  await setEmpathMask(actor, "joy");
  answers.push([target.uuid], "yes", "yes");
  await use("voice");
  const e = empathEffects(target.actor)[0];
  assert.deepEqual(
    e.system.changes.map(c => c.key),
    ["system.abilities.cha.bonuses.check"]
  );
  assert.equal(e.duration.value, 600);
});
test("voice anger exact Insight and Persuasion", () => {
  assert.deepEqual(
    empathEffectDefinition("voice", { mask: "anger" }, actor).changes.map(c => c.key),
    ["system.skills.per.roll.mode", "system.skills.ins.roll.mode"]
  );
});
test("reapply only replaces same source feature, mask remains snapshot", async () => {
  const snap = empathSnapshot(actor);
  await createEmpathEffect(source, target, item("impulse"), "impulse", snap, { requestId: "first" });
  await setEmpathMask(actor, "sorrow");
  assert.equal(empathEffectData(empathEffects(target.actor)[0]).mask, "calm");
  await createEmpathEffect(source, target, item("impulse"), "impulse", empathSnapshot(actor), { requestId: "second" });
  assert.equal(empathEffects(target.actor).length, 1);
});
test("combat without scene expires on next source end, not current end", async () => {
  const c = encounter();
  await createEmpathEffect(source, target, item("impulse"), "impulse", empathSnapshot(actor), { requestId: "x" });
  c.previous = { round: 1, turn: 0 };
  c.turn = 1;
  c.combatant = c.turns[1];
  await cleanupCombatBenefits(c, { turn: 1 });
  assert.equal(empathEffects(target.actor).length, 1);
  c.previous = { round: 2, turn: 0 };
  c.round = 2;
  c.turn = 1;
  await cleanupCombatBenefits(c, { turn: 1 });
  assert.equal(empathEffects(target.actor).length, 0);
});
test("wave is single snapshot circle; no periodic aura or later entrants", () => {
  const data = empathWaveActivity(act("wave"), empathSnapshot(actor)).toObject();
  assert.equal(data.target.template.type, "sphere");
  assert.equal(data.target.template.size, "30");
  assert.equal(data.flags[MODULE_ID].area.periodic, undefined);
  assert.equal(data.flags[MODULE_ID].area.excludeSelf, true);
  assert.equal(data.flags[MODULE_ID].area.immuneCondition, "charmed");
  assert.equal(data.duration.concentration, true);
});
test("wave repeat save metadata preserves fixed DC and original source", async () => {
  const e = await createEmpathEffect(source, target, item("wave"), "wave", empathSnapshot(actor), {
    requestId: "wave",
    seconds: 60,
    repeat: true
  });
  await setEmpathMask(actor, "joy");
  const s = e.getFlag(MODULE_ID, "repeatSave");
  assert.equal(s.dc, 16);
  assert.equal(s.sourceItemUuid, item("wave").uuid);
  assert.equal(e.duration.value, 60);
  saveSuccess = true;
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "turn", effectUuid: e.uuid });
  assert.equal(empathEffects(target.actor).length, 0);
});
test("wave charm immunity excludes from native targeting", async () => {
  await target.actor.update({ "system.traits.ci.value": ["charmed"] });
  const result = await use("wave");
  assert.equal(result.status, "success");
  assert.equal(calls[0].config.midiOptions.targetUuids.length, 0);
  assert.equal(empathEffects(target.actor).length, 0);
  assert.equal(item("wave").system.uses.spent, 1);
});
test("wave failed save attaches concentration-dependent fixed effect", async () => {
  assert.equal((await use("wave")).status, "success");
  const e = empathEffects(target.actor)[0];
  assert.equal(empathEffectData(e).mask, "calm");
  assert.ok(empathEffectData(e).concentrationUuid);
  await setEmpathMask(actor, "joy");
  assert.equal(empathEffectData(e).mask, "calm");
});
test("wave canceled placement spends no use and retains concentration", async () => {
  const existing = await actor.beginConcentrating(null, { name: "old" });
  nativeMode = "placement-cancel";
  await use("wave");
  assert.equal(item("wave").system.uses.spent, 0);
  assert.ok(actor.effects.includes(existing));
});
test("wave slot selection only level4+ including pact, cancel no expense", async () => {
  await use("wave-spell");
  assert.equal(calls.length, 0);
  answers.push("pact");
  assert.equal((await use("wave-spell")).status, "success");
  assert.equal(actor.system.spells.pact.value, 0);
  assert.equal(item("wave").system.uses.spent, 0);
});
test("source concentration deletion only removes related wave effects", async () => {
  await createEmpathEffect(source, target, item("wave"), "wave", empathSnapshot(actor), {
    requestId: "x",
    seconds: 60,
    concentrationUuid: "conc"
  });
  await createEmpathEffect(source, target, item("voice"), "voice", empathSnapshot(actor), {
    requestId: "other",
    seconds: 600
  });
  await removeEmpathConcentration({ uuid: "conc" });
  assert.equal(empathEffects(target.actor).length, 1);
  assert.equal(empathEffectData(empathEffects(target.actor)[0]).feature, "voice");
});
test("suppressed wave effect blocks no actions or healing", async () => {
  const e = await createEmpathEffect(source, target, item("wave"), "wave", empathSnapshot(actor), {
    requestId: "x",
    seconds: 60
  });
  assert.equal(blockEmpathActivity({ actor: target.actor, type: "attack" }), false);
  e.isSuppressed = true;
  assert.equal(blockEmpathActivity({ actor: target.actor, type: "attack" }), undefined);
});
test("despair blocks healing and rest HP gain, not temporary HP", async () => {
  await createEmpathEffect(
    source,
    target,
    item("catharsis"),
    "catharsis",
    { ...empathSnapshot(actor), mask: "sorrow" },
    { requestId: "x", seconds: 60 }
  );
  const updates = { "system.attributes.hp.value": 40, "system.attributes.hp.temp": 30 };
  applyEmpathHealingBan(target.actor, -10, updates);
  assert.equal(updates["system.attributes.hp.value"], 20);
  assert.equal(updates["system.attributes.hp.temp"], 30);
});
test("despair start-turn snapshot captured with scene-less combat and repeated saves single engine", async () => {
  const c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  await createEmpathEffect(
    source,
    target,
    item("catharsis"),
    "catharsis",
    { ...empathSnapshot(actor), mask: "sorrow" },
    { requestId: "x", seconds: 60, repeat: true }
  );
  const rows = empathTurnRecords(c, { turn: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sceneId, canvas.scene.id);
  answers.push("actions");
  assert.equal(await resolveEmpathEvent(rows[0]), true);
  assert.equal(blockEmpathActivity({ actor: target.actor, activation: { type: "action" } }), false);
  assert.equal(blockEmpathActivity({ actor: target.actor, activation: { type: "reaction" } }), undefined);
});
test("calm wave ends on confirmed damage only; joy gets advantage", async () => {
  const e = await createEmpathEffect(source, target, item("wave"), "wave", empathSnapshot(actor), {
    requestId: "x",
    seconds: 60
  });
  await observeEmpathDamage({ actor: target.actor, amount: 0, event: { targetTokenUuid: target.uuid, key: "zero" } });
  assert.ok(target.actor.effects.includes(e));
  await observeEmpathDamage({
    actor: target.actor,
    amount: 2,
    event: { targetTokenUuid: target.uuid, key: "positive" }
  });
  assert.ok(!target.actor.effects.includes(e));
  const details = {};
  applyEmpathSave(null, { activity: { flags: { [MODULE_ID]: { empathSaveAdvantage: true } } } }, details);
  assert.equal(details.advantage, true);
});
test("off-scene damage queues without automatically performing save", async () => {
  await createEmpathEffect(
    source,
    target,
    item("wave"),
    "wave",
    { ...empathSnapshot(actor), mask: "joy" },
    { requestId: "x", seconds: 60 }
  );
  canvas.scene = { id: "other" };
  await observeEmpathDamage({ actor: target.actor, amount: 2, event: { targetTokenUuid: target.uuid, key: "off" } });
  assert.equal(calls.length, 0);
  assert.equal(game.journal[0].events[0].state, "queued");
});
test("two GMs: inactive GM neither creates turn events nor damages", async () => {
  const c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  game.users.activeGM = { id: "another", isGM: true, active: true };
  assert.deepEqual(empathTurnRecords(c, { turn: 1 }), []);
  await observeEmpathDamage({ actor: target.actor, amount: 2, event: { key: "x" } });
  assert.equal(calls.length, 0);
});
test("actual hooks registered, no empty prose-only cards attached", () => {
  installEmpathHooks();
  for (const k of [
    "midi-qol.preTargetingV2",
    "dnd5e.preUseActivity",
    "midi-qol.preTargetSave",
    "updateCombat",
    "dnd5e.preApplyDamage",
    "deleteActiveEffect"
  ])
    assert.ok(hooks.get(k)?.length);
  for (const id of ["response", "facets"])
    assert.equal(
      Object.keys(empathDocuments.find(d => d.system.identifier === `empath-${id}`).system.activities).length,
      0
    );
});
test("scoped names do not modify unrelated class text", async () => {
  const unrelated = {
    _id: "other",
    name: "Other",
    system: { description: { value: "Голос сердца. Волна чувств." } },
    flags: {}
  };
  const documents = [...empathDocuments, unrelated];
  linkDocumentDescriptions([{ name: "features", documents }]);
  assert.equal(unrelated.system.description.value, "Голос сердца. Волна чувств.");
});
test("native slot cost selects pact attribute and correct casting level", () => {
  const cast = empathWaveActivity(act("wave-spell"), empathSnapshot(actor), { slot: "pact" });
  assert.equal(cast.consumption.targets[0].type, "attribute");
  assert.equal(cast.consumption.targets[0].target, "spells.pact.value");
  assert.equal(cast.consumption.spellSlot, false);
  assert.equal(cast.item.system.level, 5);
  assert.equal(item("wave-spell").system.level, 4);
});
test("voluntary response shares reaction and original mask quota", async () => {
  encounter();
  await setEmpathMask(actor, "anger");
  answers.push("calm", "voluntary", "yes", "yes");
  assert.equal((await use("masks", "combat-mask")).status, "success");
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse").used, 1);
  assert.equal(calls.filter(c => c.activity.activation.type === "reaction").length, 1);
  assert.equal(actor.system.attributes.hp.temp, 10);
});
test("involuntary response records separate consented reaction", async () => {
  encounter();
  await setEmpathMask(actor, "anger");
  answers.push("calm", "involuntary", "yes", "accept", "yes");
  assert.equal((await use("masks", "combat-mask")).status, "success");
  assert.equal(actor.getFlag(MODULE_ID, "reactionUse").used, 1);
  assert.equal(item("masks").system.uses.spent, 0);
});
test("replacement never deletes another caster's effect", async () => {
  await createEmpathEffect(source, target, item("impulse"), "impulse", empathSnapshot(actor), { requestId: "one" });
  const other = token(makeActor(1, "other"), "other", 100);
  await createEmpathEffect(
    other,
    target,
    other.actor.items.find(i => i.system.identifier === "empath-impulse"),
    "impulse",
    empathSnapshot(other.actor),
    { requestId: "two" }
  );
  assert.equal(empathEffects(target.actor).length, 2);
  await createEmpathEffect(source, target, item("impulse"), "impulse", empathSnapshot(actor), { requestId: "three" });
  assert.equal(empathEffects(target.actor).length, 2);
});
test("retaliation on confirmed melee damage only once per turn", async () => {
  encounter();
  await createEmpathEffect(
    source,
    target,
    item("empathy"),
    "empathy",
    { ...empathSnapshot(actor), mask: "anger" },
    { requestId: "cover" }
  );
  const enemy = token(makeActor(0, "enemy"), "enemy", 400),
    attack = act("impulse");
  attack.type = "attack";
  attack.attack = { type: { value: "melee" } };
  answers.push("yes");
  const event = {
    key: "hit",
    targetTokenUuid: target.uuid,
    sourceTokenUuid: enemy.uuid,
    activityUuid: attack.uuid,
    sceneId: target.parent.id
  };
  await observeEmpathDamage({ actor: target.actor, amount: 4, event });
  await observeEmpathDamage({ actor: target.actor, amount: 4, event: { ...event, key: "hit2" } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].activity.damage.parts[0].number, 2);
});
test("no retaliation on ranged damage", async () => {
  encounter();
  await createEmpathEffect(
    source,
    target,
    item("empathy"),
    "empathy",
    { ...empathSnapshot(actor), mask: "anger" },
    { requestId: "cover" }
  );
  const attack = act("impulse");
  attack.type = "attack";
  attack.attack = { type: { value: "ranged" } };
  await observeEmpathDamage({
    actor: target.actor,
    amount: 4,
    event: { key: "hit", targetTokenUuid: target.uuid, sourceTokenUuid: source.uuid, activityUuid: attack.uuid }
  });
  assert.equal(calls.length, 0);
  assert.equal(prompts.length, 0);
});
test("catharsis sorrow damage, despair and repeated save", async () => {
  await setEmpathMask(actor, "sorrow");
  answers.push([target.uuid], "yes");
  assert.equal((await use("catharsis")).status, "success");
  assert.equal(calls.find(c => c.activity.type === "save").activity.damage.parts[0].number, 6);
  const e = empathEffects(target.actor)[0];
  assert.equal(e.duration.value, 60);
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").dc, 17);
  assert.equal(item("catharsis").system.uses.spent, 1);
});
test("catharsis calm strips emotions but preserves other mechanics and status", async () => {
  const original = effect(
    { name: "mixed", statuses: ["charmed", "poisoned"], system: { changes: [{ key: "x", value: "1" }] } },
    target.actor
  );
  target.actor.effects.push(original);
  answers.push([target.uuid], "yes");
  assert.equal((await use("catharsis")).status, "success");
  assert.deepEqual([...original.statuses], ["poisoned"]);
  assert.equal(original.system.changes.length, 1);
  const own = empathEffects(target.actor)[0];
  assert.equal(own.system.changes.length, 6);
  assert.ok(own.system.changes.every(c => c.key.endsWith("save.roll.mode")));
});
test("harmful wave cannot evade calm utility guard", async () => {
  await createEmpathEffect(source, source, item("wave"), "wave", empathSnapshot(actor), {
    requestId: "x",
    seconds: 60
  });
  assert.equal(blockEmpathActivity(act("wave")), false);
  assert.equal(blockEmpathActivity(act("impulse")), false);
  await setEmpathMask(actor, "joy");
  assert.equal(blockEmpathActivity(act("impulse")), undefined);
});
test("manual mechanics and disabled passive not overwritten on unchanged mask", async () => {
  await syncEmpath(actor);
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "empathPassive") === "mask");
  await e.update({ disabled: true });
  await syncEmpath(actor);
  assert.equal(e.disabled, true);
  await e.update({
    "system.changes": [{ key: "system.attributes.ac.bonus", value: "9", type: "add", phase: "final", priority: 20 }]
  });
  await syncEmpath(actor);
  assert.equal(e.system.changes[0].value, "9");
});
test("pending callbacks share one owner prompt and expense", async () => {
  answers.push("joy");
  await Promise.all([
    controlEmpath(actor, act("masks", "outside-mask")),
    controlEmpath(actor, act("masks", "outside-mask"))
  ]);
  assert.equal(item("masks").system.uses.spent, 1);
  assert.equal(prompts.length, 1);
});
test("failed replacement preserves the previously valid effect", async () => {
  const old = await createEmpathEffect(source, target, item("voice"), "voice", empathSnapshot(actor), {
    requestId: "old",
    seconds: 600
  });
  target.actor.createEmbeddedDocuments = async () => {
    throw Error("validation failed");
  };
  await assert.rejects(
    () =>
      createEmpathEffect(
        source,
        target,
        item("voice"),
        "voice",
        { ...empathSnapshot(actor), mask: "joy" },
        { requestId: "new", seconds: 600 }
      ),
    /validation failed/
  );
  assert.ok(target.actor.effects.includes(old));
});
