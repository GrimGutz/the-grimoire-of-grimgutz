import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { DK_FEATURES, DK_SPECIALISTS } from "../scripts/automation/shared/deathknight-definitions.mjs";
import { deathknightDocuments } from "../src/packs/deathknight-features.mjs";
import { deathknightTransformationDocuments } from "../src/packs/deathknight-transformation.mjs";
import {
  dkState,
  dkHas,
  dkDC,
  dkTransformationLevel,
  dkPassiveDefinitions,
  syncDeathknight,
  dkPatch,
  dkAnchor,
  dkReaperActive,
  dkPrerequisiteFailures,
  validateDeathknightItem,
  inspectDeathknight
} from "../scripts/automation/transformations/deathknight.mjs";
import {
  controlDeathknight,
  deathknightSeparation,
  activateDeathknightReaper
} from "../scripts/automation/transformations/deathknight-actions.mjs";
import {
  addDeathLevels,
  healDeathLevels,
  dkLevelData,
  dkLevelEffects
} from "../scripts/automation/transformations/deathknight-levels.mjs";
import {
  prepareDeathknightDamageRoll,
  applyDeathknightHealing,
  offerDeathknightCritical,
  prepareDeathknightSave,
  prepareDeathknightAttack
} from "../scripts/automation/transformations/deathknight-combat.mjs";
import {
  applyDeathknightPacket,
  prepareDeathknightSpell
} from "../scripts/automation/transformations/deathknight-spells.mjs";
import {
  deathknightRegeneration,
  handleDeathknightTurn,
  captureDeathknightHealing,
  observeDeathknightHealing,
  revealDeathknight,
  installDeathknightHooks
} from "../scripts/automation/transformations/deathknight-events.mjs";
import { DEATHKNIGHT_AURAS, dkCylinderContains } from "../scripts/automation/transformations/deathknight-auras.mjs";
import {
  deathknightSkeletonRecipe,
  deathknightSpecialistItems
} from "../scripts/automation/transformations/deathknight-summons.mjs";
import { controlDeathknightMinion } from "../scripts/automation/transformations/deathknight-minions.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { cleanupZoneTemplates } from "../scripts/automation/shared/zones.mjs";
import { emitConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
import { auraIndicatorData } from "../scripts/automation/shared/aura-templates.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
let actor,
  source,
  target,
  base,
  docs,
  answers,
  prompts,
  calls,
  messages,
  hooks,
  seq,
  nativeMode,
  saveSuccess,
  rollTotal,
  cancelPlacement,
  createFails;
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
    clone: (updates, options = {}) => owned(merge(raw, updates), options.parent ?? owner, false),
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async delete() {
      owner.items.splice(owner.items.indexOf(this), 1);
      docs.delete(this.uuid);
    },
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
  if (String(item.system.uses?.max).includes("@abilities.con.mod"))
    item.system.uses = { ...item.system.uses, max: Math.max(0, Number(owner.system.abilities.con.mod)) };
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

function makeActor(level = 16, id = "knight", features = true) {
  const a = entity(
    {
      name: id,
      type: features ? "character" : "npc",
      system: {
        skills: { prc: { value: 0 }, ath: { value: 1 } },
        attributes: {
          prof: 5,
          hp: { value: 20, max: 60, temp: 0, tempmax: 0 },
          movement: { walk: 30, climb: 0, units: "ft" },
          senses: { darkvision: 60 },
          ac: { flat: 14, value: 14, shield: 0, bonus: 0 },
          concentration: { limit: 1 },
          exhaustion: 0
        },
        details: { type: { value: "humanoid" }, cr: 1 },
        traits: { size: "med", ci: { value: [] }, di: { value: [] }, dr: { value: [] } },
        abilities: Object.fromEntries(
          ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 18, max: null }])
        )
      }
    },
    id
  );
  if (features)
    a.items.push(
      owned(
        {
          name: "Fighter",
          type: "class",
          system: {
            identifier: "fighter",
            levels: level,
            hd: { denomination: "d10", max: level, value: level, spent: 0 }
          }
        },
        a
      ),
      ...deathknightTransformationDocuments.map(d => owned(d, a)),
      ...deathknightDocuments.map(d => owned(d, a))
    );
  return a;
}
const item = id => actor.items.find(i => i.system.identifier === `deathknight-${id}`),
  act = (id, op) =>
    [...item(id).system.activities.values()].find(a => !op || a.flags?.[MODULE_ID]?.deathknightOperation === op);
const use = (id, op, requestId = `u${++seq}`) =>
  requestGm("deathknight-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
function token(a, id, x = 0, scene = canvas.scene, data = {}) {
  const t = {
    id,
    uuid: `${scene.uuid}.Token.${id}`,
    actor: a,
    actorId: a.id,
    parent: scene,
    name: id,
    documentName: "Token",
    x,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    disposition: 1,
    hidden: false,
    ...data,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    }
  };
  scene.tokens.push(t);
  docs.set(t.uuid, t);
  return t;
}
function region(row = {}, scene = canvas.scene) {
  let raw = {
    name: "region",
    documentName: "Region",
    hidden: false,
    shapes: [{ type: "polygon", points: [50, 0, 650, 0, 650, 80, 50, 80] }],
    flags: {},
    ...row
  };
  const z = {
    id: `z${++seq}`,
    uuid: `${scene.uuid}.Region.z${seq}`,
    parent: scene,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    toObject: () => structuredClone(raw),
    async update(changes) {
      raw = merge(raw, changes);
      Object.assign(this, raw);
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async delete() {
      this.deleted = true;
      scene.regions.splice(scene.regions.indexOf(this), 1);
      docs.delete(this.uuid);
    }
  };
  Object.assign(z, raw);
  scene.regions.push(z);
  docs.set(z.uuid, z);
  return z;
}
function attack(owner = actor, { type = "melee", spell = false } = {}) {
  const i = owned(
    {
      name: "Attack",
      type: spell ? "spell" : "weapon",
      system: {
        identifier: "sample-attack",
        level: 1,
        damage: { base: { number: 1, denomination: 8, bonus: "", types: ["piercing"] } },
        activities: {
          test: {
            _id: "test",
            type: "attack",
            attack: { flat: true, bonus: "5", type: { value: type, classification: "weapon" } },
            damage: { includeBase: true, parts: [] },
            range: { value: "5", units: "ft" },
            flags: {},
            consumption: { targets: [] },
            activation: { type: "action" }
          }
        }
      }
    },
    owner
  );
  owner.items.push(i);
  return [...i.system.activities.values()][0];
}
function encounter(turn = 0) {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, tokenId: t.id, actor: t.actor })),
    c = {
      id: "c",
      started: true,
      round: 1,
      turn,
      combatant: entries[turn],
      combatants: entries,
      turns: entries,
      previous: { round: 0, turn: 0 }
    };
  game.combat = c;
  game.combats = [c];
  return c;
}
async function native(activity, config) {
  calls.push({ activity, config });
  if (nativeMode !== "normal") return nativeMode;
  for (const cost of activity.consumption?.targets ?? []) {
    if (cost.type === "hitDice") {
      let n = Number(cost.value);
      for (const row of deathknightHitDice(activity.actor)) {
        const spent = Math.min(n, row.remaining);
        if (spent)
          await row.item.update({ "system.hd.spent": row.spent + spent, "system.hd.value": row.remaining - spent });
        n -= spent;
        if (!n) break;
      }
      if (n) return false;
    } else if (cost.type === "itemUses") {
      const original = activity.actor.items.find(i => i.id === (cost.target || activity.item.id));
      await original.update({ "system.uses.spent": Number(original.system.uses.spent ?? 0) + Number(cost.value) });
    }
  }
  const targets = (config.midiOptions?.targetUuids ?? []).map(uuid => ({
    actor: docs.get(uuid)?.actor,
    document: docs.get(uuid)
  }));
  return {
    id: `wf${++seq}`,
    activity,
    hitTargets: new Set(targets),
    failedSaves: new Set(saveSuccess ? [] : targets),
    saves: new Set(saveSuccess ? targets : [])
  };
}
beforeEach(async () => {
  docs = new Map();
  answers = [];
  prompts = [];
  calls = [];
  messages = [];
  hooks = new Map();
  seq = 0;
  nativeMode = "normal";
  saveSuccess = false;
  rollTotal = 7;
  cancelPlacement = false;
  createFails = false;
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(u => u.id === id);
  globalThis.game = {
    user: gm,
    users,
    actors: [],
    items: [],
    packs: new Map(),
    combats: [],
    journal: [],
    scenes: [],
    time: { worldTime: 0 },
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    modules: new Map([["midi-qol", { active: true }]])
  };
  globalThis.foundry = {
    utils: {
      randomID: () => `brood${++seq}`,
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
  globalThis.Hooks = { on: (key, fn) => hooks.set(key, [...(hooks.get(key) ?? []), fn]) };
  globalThis.CONFIG = {
    DND5E: {
      maxAbilityScore: 20,
      skills: { prc: { label: "Perception" }, ath: { label: "Athletics" } },
      damageTypes: { fire: { label: "Fire" }, cold: { label: "Cold" } }
    },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    create: async d => {
      messages.push(d);
      return d;
    }
  };
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
      this.total = rollTotal;
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
    computeTargetsFromTemplates: () => [{ actor: target.actor, document: target }]
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
  canvas.scene.regions.get = id => canvas.scene.regions.find(z => z.id === id);
  canvas.scene.createEmbeddedDocuments = async (type, rows) =>
    rows.map(row =>
      type === "Region"
        ? region(row)
        : token(
            game.actors.find(a => a.id === row.actorId),
            `spawn${++seq}`,
            row.x,
            canvas.scene,
            row
          )
    );
  canvas.scene.deleteEmbeddedDocuments = async (type, ids) => {
    if (type === "Token") canvas.scene.tokens = canvas.scene.tokens.filter(t => !ids.includes(t.id));
  };
  game.scenes.push(canvas.scene);
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  game.actors.get = id => game.actors.find(a => a.id === id);
  game.user.targets = new Set();
  game.user.updateTokenTargets = () => {};
  globalThis.JournalEntry = {
    create: async data => {
      let raw = structuredClone(data);
      const j = {
        uuid: "Journal.test",
        getFlag: (m, k) => raw.flags?.[m]?.[k],
        setFlag: async (m, k, v) => {
          raw.flags[m] ??= {};
          raw.flags[m][k] = structuredClone(v);
        }
      };
      game.journal.push(j);
      return j;
    }
  };
  globalThis.Actor = {
    create: async data => {
      if (createFails) throw Error("test creation failure");
      const a = entity(data, `child${++seq}`);
      a.items.push(...(data.items ?? []).map(d => owned(d, a)));
      game.actors.push(a);
      return a;
    }
  };
  actor = makeActor();
  game.actors.push(actor);
  source = token(actor, "source");
  target = token(makeActor(1, "target", false), "target", 200);
  game.actors.push(target.actor);
  base = makeActor(0, "Giant Spider", false);
  attack(base);
  game.actors.push(base);
  const controlled = { document: source, actor, center: { x: 50, y: 50 } };
  canvas.tokens.controlled = [controlled];
  canvas.tokens.placeables = [controlled, { document: target, actor: target.actor, center: { x: 250, y: 50 } }];
  game.system = {
    canvas: {
      AbilityTemplate: { fromActivity: () => [{ drawPreview: async () => (cancelPlacement ? false : [region()]) }] }
    }
  };
  const weapon = attack(actor);
  await actor.setFlag(MODULE_ID, "deathknightState", { anchorItemId: weapon.item.id });
  actor.rollSavingThrow = async () => [{ total: rollTotal }];
  target.actor.rollSavingThrow = async () => [{ total: rollTotal }];
});

test("source: separate transformation, 14 boons/4 flaws and five skeleton references", () => {
  assert.equal(DK_FEATURES.length, 18);
  assert.equal(DK_FEATURES.filter(r => r.flaw).length, 4);
  assert.equal(DK_SPECIALISTS.length, 5);
  assert.equal(deathknightDocuments.length, 23);
  assert.equal(deathknightTransformationDocuments[0].folder, null);
  const root = deathknightTransformationDocuments[0];
  assert.equal(root.system.identifier, "deathknight-transformation");
  assert.deepEqual(
    root.system.advancement.filter(a => a.type === "ItemChoice").map(a => a.configuration.pool.length),
    [4, 8, 12]
  );
  assert.equal(item("smog").system.uses.recovery[0].period, "sr");
  assert.equal(item("fireball").system.uses.max, "2");
  assert.equal(item("reaper").system.uses.max, "0");
  assert.deepEqual(item("reaper").system.uses.recovery, []);
  assert.ok(
    deathknightDocuments.every(d => !d.effects.length && d.system.description.value.includes("Автоматизация Foundry:"))
  );
});
test("native STR/CHA caps converge, preserve higher values and unrelated effects", async () => {
  await actor.update({ "system.abilities.str.value": 19, "system.abilities.cha.value": 22 });
  await syncDeathknight(actor);
  assert.equal(actor.system.abilities.str.value, 20);
  assert.equal(actor.system.abilities.cha.value, 22);
  await syncDeathknight(actor);
  assert.equal(actor.effects.filter(e => e.getFlag(MODULE_ID, "deathknightPassive") === "form").length, 1);
  const form = dkPassiveDefinitions(actor).find(e => e.flags[MODULE_ID].deathknightPassive === "form");
  assert.ok(form.system.changes.some(c => c.key === "system.details.type.value" && c.value === "undead"));
});
test("absent anchor disables boons but not undead form or flaws", async () => {
  assert.ok(dkHas(actor, "grave"));
  await dkPatch(actor, { anchorAway: true });
  assert.ok(!dkHas(actor, "grave"));
  assert.ok(!dkHas(actor, "general"));
  assert.ok(dkHas(actor, "form"));
  assert.ok(dkHas(actor, "anchor"));
  assert.ok(dkHas(actor, "outcast"));
  await syncDeathknight(actor);
  assert.deepEqual(
    actor.effects.map(e => e.getFlag(MODULE_ID, "deathknightPassive")),
    ["form"]
  );
});
test("strict requirements check CHA, ten paladin levels and actual level-four slots", async () => {
  assert.ok(dkPrerequisiteFailures(actor).includes("10 уровней Паладина"));
  await actor.items.find(i => i.type === "class").update({ "system.identifier": "paladin", "system.levels": 13 });
  await actor.update({ "system.spells.spell4": { max: 1, value: 0 } });
  assert.deepEqual(dkPrerequisiteFailures(actor), []);
});
test("anchor binding never lowers a stronger magical weapon", async () => {
  const w = dkAnchor(actor);
  await w.update({ "system.magicalBonus": "5" });
  answers.push(w.uuid, "yes");
  assert.equal((await use("anchor", "anchor")).status, "success");
  assert.equal(w.system.magicalBonus, "5");
  assert.equal(dkState(actor).anchorItemId, w.id);
});
test("death levels reject undead/constructs and cap at six with one chosen weakness", async () => {
  for (const type of ["undead", "construct"]) {
    await target.actor.update({ "system.details.type.value": type });
    assert.equal(await addDeathLevels(source, target, item("grave")), false);
  }
  await target.actor.update({ "system.details.type.value": "humanoid" });
  answers.push("str");
  await addDeathLevels(source, target, item("grave"), 6);
  const e = dkLevelEffects(target.actor)[0];
  assert.equal(dkLevelData(e).levels, 6);
  assert.ok(e.system.changes.some(c => c.key === "system.abilities.str.value" && c.value === "-5"));
  assert.ok(e.system.changes.some(c => c.key === "system.attributes.hp.tempmax" && c.value === "-30"));
  assert.equal(target.actor.system.attributes.hp.value, 20);
  await addDeathLevels(source, target, item("grave"), 1);
  assert.equal(dkLevelData(e).levels, 6);
});
test("healing removes one death level per real HP increase, not per hit point", async () => {
  answers.push("dex");
  await addDeathLevels(source, target, item("grave"), 6);
  const changes = { "system.attributes.hp.value": 50 },
    options = {};
  captureDeathknightHealing(target.actor, changes, options);
  await target.actor.update(changes);
  await observeDeathknightHealing(target.actor, changes, options);
  await observeDeathknightHealing(target.actor, changes, options);
  const e = dkLevelEffects(target.actor)[0];
  assert.equal(dkLevelData(e).levels, 5);
  assert.ok(!e.system.changes.some(c => c.key.includes("hp.tempmax")));
});
test("manual death-level edits and suppression are not silently overwritten", async () => {
  await addDeathLevels(source, target, item("grave"));
  const e = dkLevelEffects(target.actor)[0];
  await e.update({ "system.changes": [{ key: "system.attributes.ac.bonus", value: "1", type: "add" }] });
  assert.equal((await addDeathLevels(source, target, item("grave"))).status, "needs-review");
  assert.equal(dkLevelData(e).levels, 1);
  await e.update({ disabled: true });
  assert.equal((await addDeathLevels(source, target, item("grave"))).status, "needs-review");
  assert.equal(target.actor.effects.length, 1);
});
test("a second source of death levels is flagged for GM, not stacked automatically", async () => {
  await addDeathLevels(source, target, item("grave"));
  const other = makeActor(16, "other");
  const weapon = attack(other);
  await other.setFlag(MODULE_ID, "deathknightState", { anchorItemId: weapon.item.id });
  const t = token(other, "other");
  const result = await addDeathLevels(
    t,
    target,
    other.items.find(i => i.system.identifier === "deathknight-grave")
  );
  assert.equal(result.status, "needs-review");
  assert.equal(target.actor.effects.length, 1);
});
test("weapon hits add levels only on confirmed positive anchor damage, once", async () => {
  const attackActivity = [...dkAnchor(actor).system.activities.values()][0],
    event = {
      key: "anchor-hit",
      sceneId: canvas.scene.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: target.uuid,
      activityUuid: attackActivity.uuid,
      workflowId: "hit",
      damageTypes: ["slashing"]
    };
  await emitConfirmedDamage(target.actor, 5, { [MODULE_ID]: { damageEvent: event } });
  await emitConfirmedDamage(target.actor, 5, { [MODULE_ID]: { damageEvent: event } });
  assert.equal(dkLevelData(dkLevelEffects(target.actor)[0]).levels, 1);
  await emitConfirmedDamage(target.actor, 0, { [MODULE_ID]: { damageEvent: { ...event, key: "immune" } } });
  assert.equal(dkLevelData(dkLevelEffects(target.actor)[0]).levels, 1);
});
test("end-turn saves work without combat.scene and do not consume actions/resources", async () => {
  await addDeathLevels(source, target, item("grave"));
  const c = encounter(0);
  c.previous = { round: 1, turn: 1 };
  c.round = 2;
  await handleDeathknightTurn(c, { round: 2, turn: 0 });
  await handleDeathknightTurn(c, { round: 2, turn: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].activity.save.dc.formula, "17");
  assert.equal(calls[0].activity.damage.parts[0].custom.formula, "5");
  assert.deepEqual(calls[0].activity.consumption.targets, []);
});
test("regeneration includes exactly half HP, heals ten above half, never at zero", async () => {
  await actor.update({ "system.attributes.hp.value": 30 });
  assert.equal(deathknightRegeneration(actor), 10);
  const c = encounter();
  c.previous = { round: 0, turn: 1 };
  await handleDeathknightTurn(c, { round: 1, turn: 0 });
  assert.equal(actor.system.attributes.hp.value, 40);
  assert.equal(deathknightRegeneration(actor), 0);
  await actor.update({ "system.attributes.hp.value": 0 });
  assert.equal(deathknightRegeneration(actor), 0);
});
test("other-scene periodic events queue instead of rolling on GM's open scene", async () => {
  await addDeathLevels(source, target, item("grave"));
  const c = encounter();
  c.previous = { round: 1, turn: 1 };
  c.round = 2;
  canvas.ready = false;
  await handleDeathknightTurn(c, { round: 2, turn: 0 });
  assert.equal(calls.length, 0);
  assert.ok(
    game.journal.some(j =>
      j.getFlag(MODULE_ID, "events").some(e => e.kind === "deathknight-periodic" && e.state === "queued")
    )
  );
});
test("melee weapon damage adds separate necrotic dice, not ranged or spell damage", () => {
  const a = [...dkAnchor(actor).system.activities.values()][0],
    config = { subject: a, rolls: [{ parts: ["1d8"], options: { type: "slashing" }, data: {} }] };
  prepareDeathknightDamageRoll(config);
  prepareDeathknightDamageRoll(config);
  assert.equal(config.rolls.length, 2);
  assert.deepEqual(config.rolls[1].parts, ["2d8"]);
  assert.equal(config.rolls[1].options.type, "necrotic");
  const ranged = attack(actor, { type: "ranged" }),
    r = { subject: ranged, rolls: [{ parts: ["1d8"] }] };
  prepareDeathknightDamageRoll(r);
  assert.equal(r.rolls.length, 1);
});
test("foreign healing becomes temp HP; own abilities still heal normally", async () => {
  await syncDeathknight(actor);
  const cast = attack(target.actor, { spell: true }),
    p = { damageDetail: [{ type: "healing", value: -12 }] },
    workflow = { actor: target.actor, item: cast.item, activity: cast };
  applyDeathknightHealing({ actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail.find(x => x.type === "healing").value, 0);
  assert.equal(p.newHP, 20);
  assert.equal(p.newTempHP, 12);
  applyDeathknightHealing({ actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail.filter(x => x.type === "temphp").length, 1);
  const own = { damageDetail: [{ type: "healing", value: -8 }] };
  applyDeathknightHealing({ actor }, { workflow: { ...workflow, actor }, damageItem: own });
  assert.equal(own.damageDetail[0].value, -8);
});
test("zero-HP healing leaves one HP and unconsciousness after confirmed HP update", async () => {
  await syncDeathknight(actor);
  await actor.update({ "system.attributes.hp.value": 0 });
  const cast = attack(target.actor, { spell: true }),
    p = { damageDetail: [{ type: "healing", value: -12 }] };
  applyDeathknightHealing({ actor }, { workflow: { actor: target.actor, item: cast.item }, damageItem: p });
  assert.equal(p.newHP, 1);
  assert.equal(p.newTempHP, 0);
  const changes = { "system.attributes.hp.value": 1 },
    options = {};
  captureDeathknightHealing(actor, changes, options);
  await actor.update(changes);
  await observeDeathknightHealing(actor, changes, options);
  assert.ok(actor.effects.some(e => e.getFlag(MODULE_ID, "deathknightRecovery") && e.statuses.has("unconscious")));
});
test("cancelled smog placement spends no resource, minute-long smog can end early", async () => {
  cancelPlacement = true;
  assert.equal((await use("smog", "smog")).status, "cancelled");
  assert.equal(item("smog").system.uses.spent, 0);
  cancelPlacement = false;
  answers.push("yes");
  assert.equal((await use("smog", "smog")).status, "success");
  assert.equal(item("smog").system.uses.spent, 1);
  assert.equal(canvas.scene.regions.length, 1);
  assert.equal(canvas.scene.regions[0].getFlag(MODULE_ID, "zoneExpiresAt"), 60);
  await use("smog", "end-smog");
  assert.equal(canvas.scene.regions.length, 0);
});

test("smog minute starts after native confirmation, not during template placement", async () => {
  game.time.worldTime = 125;
  MidiQOL.completeActivityUse = async (...args) => {
    const result = await native(...args);
    game.time.worldTime = 145;
    return result;
  };
  answers.push("yes");
  assert.equal((await use("smog", "smog")).status, "success");
  assert.equal(canvas.scene.regions[0].getFlag(MODULE_ID, "zoneExpiresAt"), 205);
});

test("common zone cleanup expires smog at sixty seconds without deleting other regions", async () => {
  answers.push("yes");
  await use("smog", "smog");
  const smog = canvas.scene.regions[0],
    manual = region(),
    later = region({ flags: { [MODULE_ID]: { zoneTemplate: true, sourceActor: actor.uuid, zoneExpiresAt: 120 } } });
  game.time.worldTime = 59;
  await cleanupZoneTemplates();
  assert.ok(!smog.deleted);
  game.time.worldTime = 60;
  await cleanupZoneTemplates();
  assert.ok(smog.deleted);
  assert.deepEqual(
    canvas.scene.regions.map(z => z.uuid),
    [manual.uuid, later.uuid]
  );
});

test("expired smog cannot request another start-of-turn save before zone cleanup", async () => {
  answers.push("yes");
  await use("smog", "smog");
  canvas.scene.regions[0].polygonTree = { testPoint: () => true };
  game.time.worldTime = 60;
  const count = calls.length,
    combat = encounter(1);
  combat.previous = { round: 1, turn: 0 };
  await handleDeathknightTurn(combat, { turn: 1 });
  assert.equal(calls.length, count);
  assert.equal(dkLevelEffects(target.actor).length, 0);
});
test("hellfire ball is 20-ft sphere, 120-ft placement, DEX and two damage types", async () => {
  answers.push("yes");
  const result = await use("fireball", "fireball");
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(item("fireball").system.uses.spent, 1);
  const a = calls[0].activity;
  assert.equal(a.save.ability[0], "dex");
  assert.deepEqual(
    a.damage.parts.map(p => [p.number, p.denomination, p.types[0]]),
    [
      [10, 6, "fire"],
      [10, 6, "necrotic"]
    ]
  );
  assert.equal(a.damage.onSave, "half");
  assert.ok(dkState(actor).lastFireball.targets.includes(target.uuid));
  assert.equal(canvas.scene.regions.length, 0);
});
test("crucible uses a token-attached 100-ft cylinder, controlled undead excluded", async () => {
  assert.equal((await use("crucible", "crucible")).status, "success");
  const d = DEATHKNIGHT_AURAS.find(a => a.id === "deathknight-crucible-20");
  assert.ok(d.sourceCondition({ actor }));
  const indicator = auraIndicatorData(d, { actor, document: source }, canvas.scene);
  assert.equal(indicator.shapes[0].type, "circle");
  assert.equal(indicator.attachment.token, source.id);
  assert.equal(indicator.elevation.top, 100);
  target.elevation = 90;
  target.x = 100;
  assert.ok(dkCylinderContains(source, target, 20));
  assert.ok(d.targetCondition({ actor, document: source }, { actor: target.actor, document: target }));
  await target.actor.update({ "system.details.type.value": "undead" });
  await target.actor.setFlag(MODULE_ID, "deathknightControlledBy", actor.uuid);
  assert.ok(!d.targetCondition({ actor, document: source }, { actor: target.actor, document: target }));
  target.elevation = 101;
  assert.ok(!dkCylinderContains(source, target, 20));
  answers.push("yes");
  await use("crucible", "expand");
  assert.equal(dkState(actor).crucibleRadius, 30);
  assert.equal(item("crucible").system.uses.spent, 1);
  await use("crucible", "end-crucible");
  assert.ok(!d.sourceCondition({ actor }));
});
test("general aura is passive only while conscious; targets allied undead, heals 1d6", () => {
  const d = DEATHKNIGHT_AURAS.find(d => d.id === "deathknight-general");
  assert.ok(d.sourceCondition({ actor }));
  assert.equal(d.affects, "allies");
  assert.equal(d.targetType, "undead");
  assert.equal(d.radius, 20);
  assert.equal(d.effect().changes.length, 6);
  assert.equal(d.events[0].trigger, "targetStart");
  assert.deepEqual(d.events[0].damage, [{ formula: "1d6", type: "healing" }]);
  actor.statuses.add("unconscious");
  assert.ok(!d.sourceCondition({ actor }));
});
test("Reaper drains six levels once, grants one-minute resist/flight/size, no bonus at zero", async () => {
  answers.push("str");
  await addDeathLevels(source, target, item("grave"), 6);
  answers.push("yes");
  const result = await use("reaper", "reaper");
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(dkLevelEffects(target.actor).length, 0);
  assert.ok(dkReaperActive(actor));
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "deathknightReaper"));
  assert.equal(e.duration.value, 60);
  assert.ok(e.system.changes.some(c => c.key === "system.traits.dr.value" && c.value === "all"));
  await use("reaper", "end-reaper");
  assert.ok(!dkReaperActive(actor));
});
test("optional critical spends its LR use only after consent; duplicate callback is inert", async () => {
  const activity = [...dkAnchor(actor).system.activities.values()][0],
    w = {
      id: "critical-hit",
      actor,
      item: activity.item,
      activity,
      hitTargets: new Set([{ actor: target.actor, document: target }]),
      isCritical: false
    };
  answers.push("yes");
  await offerDeathknightCritical(w);
  assert.ok(w.isCritical);
  assert.equal(item("annihilate").system.uses.spent, 1);
  const n = prompts.length;
  await offerDeathknightCritical(w);
  assert.equal(prompts.length, n);
});
test("declining critical does not spend the resource or change the workflow", async () => {
  const activity = [...dkAnchor(actor).system.activities.values()][0],
    w = {
      id: "declined-critical",
      actor,
      item: activity.item,
      activity,
      hitTargets: new Set([{ actor: target.actor, document: target }])
    };
  answers.push("no");
  await offerDeathknightCritical(w);
  assert.equal(item("annihilate").system.uses.spent, 0);
  assert.ok(!w.isCritical);
});
test("magical save advantage is narrow and can coexist with outcast disadvantage", async () => {
  await syncDeathknight(actor);
  await target.actor.update({ "system.details.type.value": "celestial" });
  const spell = attack(target.actor, { spell: true }),
    details = {};
  await prepareDeathknightSave(
    { actor, document: source },
    { actor: target.actor, item: spell.item, activity: spell },
    details
  );
  assert.ok(details.advantage);
  assert.ok(details.disadvantage);
  const ordinary = {};
  answers.push("no");
  const mundane = attack(target.actor);
  await prepareDeathknightSave(
    { actor, document: source },
    { id: "ordinary", actor: target.actor, item: mundane.item, activity: mundane },
    ordinary
  );
  assert.ok(!ordinary.advantage);
});
test("skeleton recipe preserves real base statistics, no invented summon duration", () => {
  const r = deathknightSkeletonRecipe(actor, base, { id: "warrior" });
  assert.equal(r.type, "undead");
  assert.equal(r.hp, base.system.attributes.hp.max);
  assert.equal(r.hpFormula, String(r.hp));
  assert.equal(r.lifecycle, undefined);
  const a = Object.values(r.extraItems.find(i => i.system.identifier === "deathknight-warrior").system.activities)[0];
  assert.ok(a.damage.parts[0].custom.formula.startsWith("2d6"));
  const bow = deathknightSpecialistItems(base, { id: "artillery" })[0],
    shot = Object.values(bow.system.activities)[0];
  assert.equal(shot.attack.critical.threshold, 18);
  assert.equal(shot.flags[MODULE_ID].longRange, 160);
});
test("returning anchor unlocks exhaustion but does not remove it for free", async () => {
  answers.push("yes");
  await deathknightSeparation(actor, "away");
  assert.ok(!dkHas(actor, "grave"));
  game.time.worldTime = 3600;
  answers.push("yes");
  await deathknightSeparation(actor, "exhaustion");
  assert.equal(actor.system.attributes.exhaustion, 2);
  const changes = { "system.attributes.exhaustion": 0 };
  captureDeathknightHealing(actor, changes, {});
  assert.equal(changes["system.attributes.exhaustion"], 2);
  answers.push("yes");
  await deathknightSeparation(actor, "return");
  assert.equal(dkState(actor).lockedExhaustion, 0);
  assert.equal(actor.system.attributes.exhaustion, 2);
  assert.ok(dkHas(actor, "grave"));
});
test("true form is revealed by concentration without changing art, race or inventory", async () => {
  await dkPatch(actor, { appearance: "humanoid" });
  await actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Concentration", statuses: ["concentrating"], system: { changes: [] } }
  ]);
  await revealDeathknight(actor);
  assert.equal(dkState(actor).appearance, "true");
  assert.equal(actor.items.length, 26);
});
test("scoped links never rewrite prestige cards; diagnostics is read-only", () => {
  const old = {
    _id: "old-knight",
    name: "Prestige",
    system: { identifier: "death-knight", description: { value: "<p>Якорь и Форма нежити.</p>" } },
    flags: {}
  };
  const sets = [
    { name: "features", documents: [...deathknightDocuments, old] },
    { name: "transformations", documents: deathknightTransformationDocuments }
  ];
  linkDocumentDescriptions(sets);
  assert.equal(old.system.description.value, "<p>Якорь и Форма нежити.</p>");
  const previous = JSON.stringify(actor.flags);
  assert.equal(inspectDeathknight(actor).level, 4);
  assert.equal(JSON.stringify(actor.flags), previous);
});
test("actual registrations exist and secondary GM cannot run turn automation", async () => {
  installDeathknightHooks();
  for (const h of [
    "dnd5e.preUseActivity",
    "midi-qol.preTargetSave",
    "midi-qol.preDamageRoll",
    "dnd5e.preRollDamage",
    "preUpdateActor",
    "updateCombat"
  ])
    assert.ok(hooks.get(h)?.some(fn => typeof fn === "function"));
  game.user = { id: "second", isGM: true };
  const before = actor.system.attributes.hp.value;
  await handleDeathknightTurn(encounter(), { round: 1, turn: 0 });
  assert.equal(actor.system.attributes.hp.value, before);
});

test("max-HP penalty cannot restore hidden source HP when its level is removed", async () => {
  await target.actor.update({ "system.attributes.hp.value": 55 });
  answers.push("str");
  await addDeathLevels(source, target, item("grave"), 6);
  assert.equal(target.actor._source.system.attributes.hp.value, 30);
  await healDeathLevels(target.actor);
  assert.equal(target.actor._source.system.attributes.hp.value, 30);
  assert.equal(dkLevelData(dkLevelEffects(target.actor)[0]).levels, 5);
});
test("Restless spends ten actual lay-on-hands uses and summons selected base once", async () => {
  target.x = 100;
  await target.actor.update({ "system.attributes.hp.value": 0 });
  const pool = owned(
    {
      name: "Lay on Hands",
      type: "feat",
      system: { identifier: "lay-on-hands", uses: { max: "50", spent: 0 }, activities: {} }
    },
    actor
  );
  actor.items.push(pool);
  answers.push([target.uuid], "yes", base.uuid, "none", pool.uuid);
  const result = await use("restless", "restless");
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(pool.system.uses.spent, 10);
  const children = game.actors.filter(a => a.getFlag(MODULE_ID, "summonSource") === "deathknight-skeleton");
  assert.equal(children.length, 1);
  assert.equal(children[0].system.attributes.hp.max, base.system.attributes.hp.max);
  assert.ok(target.actor.getFlag(MODULE_ID, "deathknightRaised"));
  assert.ok(canvas.scene.tokens.includes(target));
});
test("confirmed failed skeleton creation refunds only its confirmed lay-on-hands expense", async () => {
  target.x = 100;
  await target.actor.update({ "system.attributes.hp.value": 0 });
  const pool = owned(
    {
      name: "Lay on Hands",
      type: "feat",
      system: { identifier: "lay-on-hands", uses: { max: "50", spent: 0 }, activities: {} }
    },
    actor
  );
  actor.items.push(pool);
  createFails = true;
  answers.push([target.uuid], "yes", base.uuid, "none", pool.uuid);
  const result = await use("restless", "restless");
  assert.equal(result.status, "needs-review");
  assert.equal(pool.system.uses.spent, 0);
  assert.ok(!target.actor.getFlag(MODULE_ID, "deathknightRaised"));
});
test("raising never converts a still-living target into a free skeleton", async () => {
  target.x = 100;
  answers.push([target.uuid]);
  await assert.rejects(use("restless", "restless"), /смерть|жив/);
  assert.equal(calls.length, 0);
});
test("sapper has an actual native blast and cannot explode twice", async () => {
  const minion = makeActor(0, "sapper", false);
  await minion.setFlag(MODULE_ID, "summonSource", "deathknight-skeleton");
  const data = deathknightSpecialistItems(minion, { id: "sapper", dc: 14 })[0],
    i = owned(data, minion);
  minion.items.push(i);
  game.actors.push(minion);
  const t = token(minion, "sapper", 100);
  canvas.tokens.placeables.push({ actor: minion, document: t, center: { x: 150, y: 50 } });
  const a = [...i.system.activities.values()][0];
  const result = await controlDeathknightMinion(minion, a);
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(minion.system.attributes.hp.value, 0);
  assert.equal(calls[0].activity.save.dc.formula, "14");
  assert.equal(calls[0].activity.damage.parts[0].number, 4);
  const count = calls.length;
  await controlDeathknightMinion(minion, a);
  assert.equal(calls.length, count);
});
test("backlash from own Existence pulse cannot recursively trigger itself", async () => {
  const activity = act("existence", "declare"),
    event = {
      key: "own-backlash",
      sceneId: canvas.scene.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: source.uuid,
      activityUuid: activity.uuid,
      damageTypes: ["radiant"]
    };
  await emitConfirmedDamage(actor, 3, { [MODULE_ID]: { damageEvent: event } });
  assert.equal(calls.length, 0);
  assert.equal(prompts.length, 0);
});
test("critical on a multi-target workflow never promotes all hits or spends a use", async () => {
  const activity = [...dkAnchor(actor).system.activities.values()][0],
    w = {
      id: "multi-critical",
      actor,
      item: activity.item,
      activity,
      hitTargets: new Set([
        { actor: target.actor, document: target },
        { actor: base, document: source }
      ])
    };
  await offerDeathknightCritical(w);
  assert.equal(prompts.length, 0);
  assert.equal(item("annihilate").system.uses.spent, 0);
});
test("new tier-IV separation never charges hourly exhaustion retroactively", async () => {
  await dkPatch(actor, { anchorAway: true, missingSince: 0, exhaustionClaim: 2, lockedExhaustion: 2 });
  game.time.worldTime = 3 * 86400;
  await syncDeathknight(actor);
  assert.equal(dkState(actor).outcastSince, game.time.worldTime);
  answers.push("yes");
  await deathknightSeparation(actor, "exhaustion");
  assert.equal(dkState(actor).exhaustionClaim, 3);
  assert.equal(actor.system.attributes.exhaustion, 1);
});
test("known Divine Smite retypes only its own packet and recalculates necrotic defense", async () => {
  const spell = attack(actor, { spell: true });
  await spell.item.update({ "system.identifier": "divine-smite" });
  const p = {
    damageDetail: [{ type: "radiant", value: 8, active: {} }],
    rawDamageDetail: [{ type: "radiant", value: 8 }]
  };
  target.actor.calculateDamage = rows =>
    rows.map(r => ({
      ...r,
      value: r.type === "necrotic" ? Math.floor(r.value / 2) : r.value,
      active: { resistance: r.type === "necrotic" }
    }));
  applyDeathknightPacket(
    { actor: target.actor },
    { workflow: { actor, item: spell.item, activity: spell }, damageItem: p }
  );
  assert.equal(p.damageDetail[0].type, "necrotic");
  assert.equal(p.damageDetail[0].value, 4);
  const mundane = attack(actor),
    other = { damageDetail: [{ type: "slashing", value: 8 }], rawDamageDetail: [{ type: "slashing", value: 8 }] };
  applyDeathknightPacket(
    { actor: target.actor },
    { workflow: { actor, item: mundane.item, activity: mundane }, damageItem: other }
  );
  assert.equal(other.damageDetail[0].type, "slashing");
});

test("Soul Bond offers one owner choice per spell, without a GM interpretation prompt", async () => {
  await syncDeathknight(actor);
  const activity = attack(actor, { spell: true }),
    original = activity.item.toObject(),
    workflow = { id: "soul-choice", actor, item: activity.item, activity };
  answers.push("yes");
  await prepareDeathknightSpell(workflow);
  assert.equal(workflow.grimgutzDeathknightNecrotic, true);
  assert.equal(prompts.length, 1);
  assert.equal(calls.length, 0);
  assert.deepEqual(activity.item.toObject(), original);
  await prepareDeathknightSpell(workflow);
  const replay = { id: workflow.id, actor, item: activity.item, activity };
  await prepareDeathknightSpell(replay);
  assert.equal(replay.grimgutzDeathknightNecrotic, true);
  assert.equal(prompts.length, 1);
});

test("Soul Bond retypes every damage component, recalculates defenses once and preserves healing", async () => {
  await syncDeathknight(actor);
  const activity = attack(actor, { spell: true }),
    workflow = { id: "soul-packet", actor, item: activity.item, activity };
  answers.push("yes");
  await prepareDeathknightSpell(workflow);
  const raw = [
      { type: "fire", value: 8 },
      { type: "cold", value: 6 },
      { type: "healing", value: -4 },
      { type: "temphp", value: 3 },
      { type: "maximum", value: 2 },
      { type: "midi-none", value: 1 }
    ],
    packet = { rawDamageDetail: structuredClone(raw), damageDetail: structuredClone(raw) };
  let calculations = 0;
  target.actor.calculateDamage = rows => {
    calculations++;
    return rows.map(p => (p.type === "necrotic" ? { ...p, value: p.value / 2, active: { resistance: true } } : p));
  };
  applyDeathknightPacket({ actor: target.actor }, { workflow, damageItem: packet });
  assert.deepEqual(
    packet.damageDetail.map(p => [p.type, p.value]),
    [
      ["necrotic", 4],
      ["necrotic", 3],
      ["healing", -4],
      ["temphp", 3],
      ["maximum", 2],
      ["midi-none", 1]
    ]
  );
  assert.deepEqual(packet.rawDamageDetail, raw);
  applyDeathknightPacket({ actor: target.actor }, { workflow, damageItem: packet });
  assert.equal(calculations, 1);
});

test("declining Soul Bond is remembered for that spell and does not affect later spells", async () => {
  await syncDeathknight(actor);
  const activity = attack(actor, { spell: true }),
    workflow = { id: "soul-declined", actor, item: activity.item, activity };
  answers.push("no");
  await prepareDeathknightSpell(workflow);
  assert.equal(workflow.grimgutzDeathknightNecrotic, false);
  await prepareDeathknightSpell({ ...workflow, grimgutzDeathknightSpellPrepared: false });
  assert.equal(prompts.length, 1);
  const packet = { rawDamageDetail: [{ type: "fire", value: 8 }], damageDetail: [{ type: "fire", value: 8 }] };
  applyDeathknightPacket({ actor: target.actor }, { workflow, damageItem: packet });
  assert.equal(packet.damageDetail[0].type, "fire");
  answers.push("yes");
  const next = { id: "soul-next", actor, item: activity.item, activity };
  await prepareDeathknightSpell(next);
  assert.equal(next.grimgutzDeathknightNecrotic, true);
  assert.equal(prompts.length, 2);
  assert.equal(calls.length, 0);
});

test("Soul Bond does not prompt for healing, mundane attacks or suppressed boons", async () => {
  await syncDeathknight(actor);
  const healing = attack(actor, { spell: true });
  await healing.item.update({ "system.damage.base.types": ["healing"] });
  const activity = [...healing.item.system.activities.values()][0];
  await prepareDeathknightSpell({ id: "healing-only", actor, item: activity.item, activity });
  const mundane = attack(actor);
  await prepareDeathknightSpell({ id: "mundane", actor, item: mundane.item, activity: mundane });
  actor.effects.find(e => e.getFlag(MODULE_ID, "deathknightPassive") === "souls").isSuppressed = true;
  const spell = attack(actor, { spell: true });
  await prepareDeathknightSpell({ id: "suppressed", actor, item: spell.item, activity: spell });
  assert.equal(prompts.length, 0);
});

test("separate damage packets of one hit do not give extra death levels", async () => {
  const a = [...dkAnchor(actor).system.activities.values()][0],
    event = {
      sceneId: canvas.scene.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: target.uuid,
      activityUuid: a.uuid,
      workflowId: "one-hit-two-packets",
      damageTypes: ["slashing"]
    };
  await emitConfirmedDamage(target.actor, 5, { [MODULE_ID]: { damageEvent: { ...event, key: "base-packet" } } });
  await emitConfirmedDamage(target.actor, 2, { [MODULE_ID]: { damageEvent: { ...event, key: "other-packet" } } });
  assert.equal(dkLevelData(dkLevelEffects(target.actor)[0]).levels, 1);
});
