import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { DULLAHAN_FEATURES } from "../scripts/automation/shared/dullahan-definitions.mjs";
import { dullahanDocuments } from "../src/packs/dullahan-features.mjs";
import { dullahanTransformationDocuments } from "../src/packs/dullahan-transformation.mjs";
import {
  dullahanLevel,
  dullahanDC,
  dullahanHas,
  dullahanState,
  patchDullahan,
  dullahanPassiveDefinitions,
  syncDullahan,
  dullahanPactWaives,
  validateDullahanItem,
  validateDullahanAdvancement,
  inspectDullahan
} from "../scripts/automation/transformations/dullahan.mjs";
import { controlDullahan } from "../scripts/automation/transformations/dullahan-actions.mjs";
import { dullahanMountFailures } from "../scripts/automation/transformations/dullahan-mounts.mjs";
import { addDullahanBurn, cleanupDullahanBurns } from "../scripts/automation/transformations/dullahan-burning.mjs";
import {
  applyDullahanPacket,
  applyDullahanHealing,
  runDullahanFortitude
} from "../scripts/automation/transformations/dullahan-combat.mjs";
import {
  installDullahanHooks,
  captureDullahanHealing,
  observeDullahanHealing,
  revealDullahan,
  noticeDullahanTimers,
  endDullahanBurn
} from "../scripts/automation/transformations/dullahan-events.mjs";
import { dullahanHeadRecipe, dullahanHeads } from "../scripts/automation/transformations/dullahan-summons.mjs";
import { synchronizeSummonLifecycle } from "../scripts/automation/shared/summon-lifecycle.mjs";
import { processRepeatedSaves } from "../scripts/automation/effects/repeated-saves.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { emitConfirmedDamage, prepareConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
let ctx, actor, source, target, base;
const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);
function set(o, path, value) {
  const parts = path.split("."),
    last = parts.pop();
  let at = o;
  for (const p of parts) at = at[p] ??= {};
  if (last.startsWith("-=")) delete at[last.slice(2)];
  else at[last] = value;
}
function merge(raw, patch) {
  const out = structuredClone(raw);
  for (const [k, v] of Object.entries(patch)) {
    if (k.includes(".")) set(out, k, structuredClone(v));
    else if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Set)) out[k] = merge(out[k] ?? {}, v);
    else out[k] = structuredClone(v);
  }
  return out;
}
function owned(data, owner, register = true) {
  let raw = structuredClone(data);
  raw._id ??= `i${++ctx.seq}`;
  const item = {
    id: raw._id,
    actor: owner,
    parent: owner,
    isEmbedded: true,
    uuid: `${owner.uuid}.Item.${raw._id}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: patch => owned(merge(raw, patch), owner, false),
    async update(patch) {
      raw = merge(raw, patch);
      refresh();
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async delete() {
      owner.items.splice(owner.items.indexOf(this), 1);
      ctx.docs.delete(this.uuid);
    }
  };
  function refresh() {
    Object.assign(item, raw);
    item.system = {
      ...raw.system,
      activities: new Map(
        Object.entries(raw.system.activities ?? {}).map(([id, row]) => {
          const make = r => ({
            ...r,
            id,
            item,
            actor: owner,
            uuid: `${item.uuid}.Activity.${id}`,
            toObject: () => structuredClone(r),
            clone: patch => make(merge(r, patch))
          });
          return [id, make(row)];
        })
      )
    };
    if (String(item.system.uses?.max).includes("@abilities.con.mod"))
      item.system.uses = { ...item.system.uses, max: Math.max(0, owner.system.abilities.con.mod) };
  }
  refresh();
  if (register) {
    ctx.docs.set(item.uuid, item);
    for (const a of item.system.activities.values()) ctx.docs.set(a.uuid, a);
  }
  return item;
}
function effect(data, owner) {
  let raw = structuredClone(data);
  const e = {
    id: `e${++ctx.seq}`,
    parent: owner,
    uuid: `${owner.uuid}.ActiveEffect.e${ctx.seq}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: patch => ({ toObject: () => merge(raw, patch), ...merge(raw, patch) }),
    updateDuration() {
      return {
        ...this.duration,
        remaining:
          raw.duration?.units === "seconds" && raw.duration.value != null
            ? Number(raw.duration.value) - (Number(game.time.worldTime) - Number(raw.start?.time ?? 0))
            : null
      };
    },
    async update(patch) {
      raw = merge(raw, patch);
      refresh();
      owner.prepare();
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async delete() {
      owner.effects = owner.effects.filter(row => row !== this);
      ctx.docs.delete(this.uuid);
      owner.prepare();
    }
  };
  function refresh() {
    Object.assign(e, raw);
    e.statuses = new Set(raw.statuses ?? []);
  }
  refresh();
  ctx.docs.set(e.uuid, e);
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
        name: raw.name ?? id,
        type: raw.type ?? "character",
        system: structuredClone(raw.system),
        flags: raw.flags ?? {},
        ownership: raw.ownership ?? { default: 0 },
        prototypeToken: { toObject: () => structuredClone(raw.prototypeToken ?? {}) }
      });
      this.statuses = new Set();
      for (const e of this.effects)
        if (!e.disabled && !e.isSuppressed && !e.duration?.expired) {
          for (const s of e.statuses ?? []) this.statuses.add(s);
          for (const c of e.system?.changes ?? []) {
            const old = get(this, c.key);
            if (c.key === "system.traits.dr.value") {
              const values = new Set(old ?? []);
              values.add(c.value);
              set(this, c.key, [...values]);
            } else {
              const numeric = Number.isFinite(Number(c.value));
              set(
                this,
                c.key,
                c.type === "override"
                  ? numeric
                    ? Number(c.value)
                    : c.value
                  : c.type === "upgrade"
                    ? Math.max(Number(old ?? 0), Number(c.value))
                    : Number(old ?? 0) + Number(c.value)
              );
            }
          }
        }
      const hp = this.system.attributes.hp;
      hp.effectiveMax = Number(hp.max) + Number(hp.tempmax ?? 0);
      for (const v of Object.values(this.system.abilities)) v.mod = Math.floor((v.value - 10) / 2);
      this.concentration = {
        effects: new Set(this.effects.filter(e => !e.disabled && e.statuses.has("concentrating")))
      };
    },
    async update(patch) {
      raw = merge(raw, patch);
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
      const result = rows.map(d => (type === "Item" ? owned(d, this) : effect(d, this)));
      this[type === "Item" ? "items" : "effects"].push(...result);
      this.prepare();
      return result;
    },
    async updateEmbeddedDocuments(type, rows) {
      for (const r of rows) await this[type === "Item" ? "items" : "effects"].find(e => e.id === r._id)?.update(r);
      return rows;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const r of [...this[type === "Item" ? "items" : "effects"]]) if (ids.includes(r.id)) await r.delete();
    },
    async delete() {
      game.actors.splice(game.actors.indexOf(this), 1);
      ctx.docs.delete(this.uuid);
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
      return [e];
    },
    calculateDamage(rows) {
      return rows.map(p => ({
        ...p,
        value: p.type === "fire" && ctx.resistFire ? Number(p.value) / 2 : p.value,
        active: {}
      }));
    },
    async rollSavingThrow(config) {
      ctx.saves.push(config);
      return ctx.cancelSave ? null : [{ total: ctx.saveTotal }];
    }
  };
  a.prepare();
  ctx.docs.set(a.uuid, a);
  a.items.get = id => a.items.find(i => i.id === id);
  a.items.has = id => Boolean(a.items.get(id));
  return a;
}
function makeActor(level = 16, id = "dullahan", features = true) {
  const a = entity(
    {
      name: id,
      type: features ? "character" : "npc",
      system: {
        attributes: {
          prof: 5,
          hp: { value: 40, max: 60, temp: 0, tempmax: 0 },
          movement: { walk: 30, units: "ft" },
          senses: { units: "ft", truesight: 0, blindsight: 0 },
          ac: { flat: 14, value: 14 },
          concentration: { limit: 1 }
        },
        details: { type: { value: "humanoid" }, cr: 2 },
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
      owned({ name: "Fighter", type: "class", system: { identifier: "fighter", levels: level } }, a),
      ...dullahanTransformationDocuments.map(d => owned(d, a)),
      ...dullahanDocuments.map(d => owned(d, a))
    );
  return a;
}
function token(a, id, x = 0, scene = canvas.scene) {
  let raw = {
    name: id,
    x,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    disposition: 1,
    hidden: false,
    light: { bright: 0, dim: 0 },
    flags: {}
  };
  const t = {
    id,
    uuid: `${scene.uuid}.Token.${id}`,
    actor: a,
    actorId: a.id,
    parent: scene,
    documentName: "Token",
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async update(p) {
      raw = merge(raw, p);
      Object.assign(this, raw);
      return this;
    }
  };
  Object.assign(t, raw);
  scene.tokens.push(t);
  ctx.docs.set(t.uuid, t);
  return t;
}
function region() {
  const z = {
    id: `z${++ctx.seq}`,
    uuid: `Scene.one.Region.z${ctx.seq}`,
    parent: canvas.scene,
    documentName: "Region",
    shapes: [{ type: "circle", x: 250, y: 50, radius: 100 }],
    flags: {},
    getFlag(m, k) {
      return this.flags[m]?.[k];
    },
    async update(p) {
      for (const [k, v] of Object.entries(p)) set(this, k, v);
      return this;
    },
    async delete() {
      canvas.scene.regions.splice(canvas.scene.regions.indexOf(this), 1);
      ctx.docs.delete(this.uuid);
    }
  };
  canvas.scene.regions.push(z);
  ctx.docs.set(z.uuid, z);
  return z;
}
function attack(owner = actor, { spell = false, melee = true } = {}) {
  const i = owned(
    {
      name: "Attack",
      type: spell ? "spell" : "weapon",
      system: {
        identifier: "sample-attack",
        damage: { base: { number: 2, denomination: 6, bonus: "", types: ["slashing"] } },
        activities: {
          a: {
            _id: "a",
            type: "attack",
            activation: { type: "action" },
            attack: { type: { value: melee ? "melee" : "ranged", classification: spell ? "spell" : "weapon" } },
            damage: { includeBase: true, parts: [] },
            range: { value: "5", units: "ft" },
            consumption: { targets: [] }
          }
        }
      }
    },
    owner
  );
  owner.items.push(i);
  return [...i.system.activities.values()][0];
}
const item = id => actor.items.find(i => i.system.identifier === `dullahan-${id}`),
  act = (id, op) =>
    [...item(id).system.activities.values()].find(a => !op || a.flags?.[MODULE_ID]?.dullahanOperation === op),
  use = (id, op, requestId = `r${++ctx.seq}`) =>
    requestGm("dullahan-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
function encounter(turn = 0) {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, tokenId: t.id, actor: t.actor }));
  game.combat = {
    id: "combat",
    started: true,
    round: 1,
    turn,
    combatant: entries[turn],
    combatants: entries,
    turns: entries,
    previous: { round: 0, turn: 0 }
  };
  game.combats = [game.combat];
  return game.combat;
}
beforeEach(async () => {
  ctx = {
    docs: new Map(),
    seq: 0,
    answers: [],
    prompts: [],
    calls: [],
    messages: [],
    saves: [],
    hooks: new Map(),
    saveTotal: 30,
    nativeMode: "normal",
    failSaves: true,
    rollTotal: 6,
    rolls: [],
    createCount: 0
  };
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(u => u.id === id);
  globalThis.game = {
    user: gm,
    users,
    actors: [],
    items: [],
    combats: [],
    packs: new Map(),
    journal: [],
    scenes: [],
    time: { worldTime: 0 },
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    modules: new Map([["midi-qol", { active: true }]])
  };
  globalThis.foundry = {
    utils: {
      randomID: () => `n${++ctx.seq}`,
      deepClone: structuredClone,
      mergeObject: merge,
      getProperty: get,
      escapeHTML: s => String(s).replaceAll("<", "&lt;")
    },
    applications: {
      api: {
        DialogV2: {
          wait: async p => {
            ctx.prompts.push(p);
            return ctx.answers.shift() ?? null;
          }
        }
      }
    }
  };
  globalThis.CONFIG = {
    DND5E: {
      damageTypes: Object.fromEntries(
        ["fire", "cold", "necrotic", "radiant", "slashing", "piercing", "bludgeoning"].map(t => [t, { label: t }])
      )
    },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => ctx.docs.get(uuid);
  globalThis.Hooks = { on: (key, fn) => ctx.hooks.set(key, [...(ctx.hooks.get(key) ?? []), fn]) };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    create: async row => {
      ctx.messages.push(row);
      return row;
    }
  };
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
      this.total = ctx.rollTotal;
      ctx.rolls.push(formula);
    }
    async evaluate() {
      return this;
    }
    async toMessage(data) {
      ctx.messages.push({ formula: this.formula, ...data });
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
    computeTargetsFromTemplates: () => [{ actor: target.actor, document: target }],
    completeActivityUse: async (activity, config) => {
      ctx.calls.push({ activity, config });
      if (ctx.nativeMode !== "normal") return ctx.nativeMode;
      for (const c of activity.consumption?.targets ?? [])
        if (c.type === "itemUses") {
          const i = activity.actor.items.get(c.target || activity.item.id);
          await i.update({ "system.uses.spent": Number(i.system.uses.spent ?? 0) + Number(c.value) });
        }
      const targets = (config.midiOptions?.targetUuids ?? []).map(uuid => ({
        document: ctx.docs.get(uuid),
        actor: ctx.docs.get(uuid)?.actor
      }));
      return {
        id: `wf${++ctx.seq}`,
        activity,
        hitTargets: new Set(targets),
        failedSaves: new Set(ctx.failSaves ? targets : []),
        saves: new Set(ctx.failSaves ? [] : targets)
      };
    }
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
  game.scenes.push(canvas.scene);
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  game.actors.get = id => game.actors.find(a => a.id === id);
  game.user.targets = new Set();
  game.user.updateTokenTargets = () => {};
  canvas.scene.createEmbeddedDocuments = async (type, rows) =>
    rows.map(r =>
      type === "Region"
        ? region()
        : token(
            game.actors.find(a => a.id === r.actorId),
            `spawn${++ctx.seq}`,
            r.x,
            canvas.scene
          )
    );
  canvas.scene.deleteEmbeddedDocuments = async (type, ids) => {
    if (type === "Token")
      for (const t of [...canvas.scene.tokens])
        if (ids.includes(t.id)) {
          canvas.scene.tokens.splice(canvas.scene.tokens.indexOf(t), 1);
          ctx.docs.delete(t.uuid);
        }
  };
  globalThis.JournalEntry = {
    create: async data => {
      const j = {
        getFlag: (m, k) => data.flags?.[m]?.[k],
        setFlag: async (m, k, v) => {
          data.flags[m][k] = structuredClone(v);
        }
      };
      game.journal.push(j);
      return j;
    }
  };
  globalThis.Actor = {
    create: async data => {
      if (++ctx.createCount === ctx.createFailAt) throw Error("test creation failure");
      const a = entity(data, `child${++ctx.seq}`);
      a.items.push(...(data.items ?? []).map(d => owned(d, a)));
      a.effects.push(...(data.effects ?? []).map(d => effect(d, a)));
      a.prepare();
      game.actors.push(a);
      return a;
    }
  };
  actor = makeActor();
  source = token(actor, "source");
  target = token(makeActor(1, "target", false), "target", 100);
  base = makeActor(0, "Death's Head", false);
  await base.update({ "system.details.type.value": "undead", "system.traits.size": "sm" });
  attack(base);
  game.actors.push(actor, target.actor, base);
  canvas.tokens.controlled = [{ document: source, actor, center: { x: 50, y: 50 } }];
  canvas.tokens.placeables = [
    ...canvas.tokens.controlled,
    { document: target, actor: target.actor, center: { x: 150, y: 50 } }
  ];
  game.system = {
    canvas: {
      AbilityTemplate: { fromActivity: () => [{ drawPreview: async () => (ctx.cancelPlacement ? false : [region()]) }] }
    }
  };
});

test("source: fourteen boons, four flaws, separate root, no fake passive templates", () => {
  assert.equal(DULLAHAN_FEATURES.length, 18);
  assert.equal(DULLAHAN_FEATURES.filter(r => r.flaw).length, 4);
  assert.equal(dullahanDocuments.length, 18);
  assert.equal(dullahanTransformationDocuments[0].folder, null);
  assert.ok(
    dullahanDocuments.every(d => !d.effects.length && d.system.description.value.includes("Автоматизация Foundry:"))
  );
  assert.deepEqual(
    dullahanTransformationDocuments[0].system.advancement
      .filter(a => a.type === "ItemGrant")
      .map(a => [a.level, a.configuration.items.length]),
    [
      [1, 3],
      [6, 1],
      [11, 1],
      [16, 1]
    ]
  );
  assert.deepEqual(
    dullahanTransformationDocuments[0].system.advancement
      .filter(a => a.type === "ItemChoice")
      .map(a => a.configuration.pool.length),
    [4, 8, 12]
  );
});
test("tier boundaries and DC include transformation tier, never character level", async () => {
  for (const [level, tier] of [
    [1, 1],
    [5, 1],
    [6, 2],
    [10, 2],
    [11, 3],
    [15, 3],
    [16, 4]
  ]) {
    await actor.items.find(i => i.type === "class").update({ "system.levels": level });
    assert.equal(dullahanLevel(actor), tier);
    assert.equal(dullahanDC(actor), 8 + 5 + tier + 4);
  }
});
test("gaze and flame dependencies cannot be bypassed by dropping their cards", async () => {
  await item("skulls").delete();
  assert.ok(!dullahanHas(actor, "gaze"));
  assert.ok(!dullahanHas(actor, "unnerving"));
});
test("requirements are off by default, only CON 13 is required when enabled", async () => {
  await actor.update({ "system.abilities.con.value": 10 });
  const root = actor.items.find(i => i.system.identifier === "dullahan-transformation");
  assert.notEqual(validateDullahanItem({ ...root, parent: actor }, null, null, "gm"), false);
  game.settings.get = () => true;
  assert.equal(validateDullahanItem(root, null, null, "gm"), false);
});
test("advancement rejects missing prerequisite and duplicate boons", () => {
  const owned = actor.items.filter(i => i.system.identifier !== "dullahan-skulls");
  assert.equal(validateDullahanAdvancement({ actor: { items: owned } }, null, [item("gaze")], null, []), false);
  assert.equal(validateDullahanAdvancement({ actor }, null, [item("sight")], null, []), false);
});
test("native passive senses preserve greater values, scale units and sync once", async () => {
  await actor.update({ "system.attributes.senses.ranges.truesight": 150 });
  await syncDullahan(actor);
  await syncDullahan(actor);
  assert.equal(actor.system.details.type.value, "undead");
  assert.equal(actor.system.attributes.senses.ranges.truesight, 150);
  assert.equal(actor.system.attributes.senses.ranges.blindsight, 20);
  assert.equal(actor.effects.filter(e => e.getFlag(MODULE_ID, "dullahanPassive") === "sight").length, 1);
  await actor.update({ "system.attributes.senses.units": "m" });
  assert.equal(
    Number(
      dullahanPassiveDefinitions(actor).find(e => e.flags[MODULE_ID].dullahanPassive === "sight").system.changes[0]
        .value
    ),
    36.576
  );
});
test("cancelled oath is free and only the selected actor is marked", async () => {
  ctx.answers.push(null);
  assert.equal((await use("oath", "oath")).status, "cancelled");
  assert.equal(ctx.calls.length, 0);
  ctx.answers.push([target.uuid], "yes");
  assert.equal((await use("oath", "oath")).status, "success");
  assert.equal(dullahanState(actor).oath.targetActorUuid, target.actor.uuid);
  assert.equal(ctx.calls[0].activity.activation.type, "bonus");
  await assert.rejects(use("oath", "oath"), /клятва/);
});
test("living marked target locks oath across long rest; death alone does not recharge", async () => {
  ctx.answers.push([target.uuid], "yes");
  await use("oath", "oath");
  await requestGm("dullahan-rest", actor, { long: true }, { requestId: "lr-alive" });
  assert.ok(dullahanState(actor).oath);
  ctx.answers.push("yes");
  await use("oath", "oath-death");
  assert.ok(dullahanState(actor).oath.deathConfirmed);
  await assert.rejects(use("oath", "oath"), /клятва/);
  await requestGm("dullahan-rest", actor, { long: true }, { requestId: "lr-dead" });
  assert.equal(dullahanState(actor).oath, null);
  assert.equal(target.actor.effects.length, 0);
});
test("broken oath starts only after 24h and confirmed living target; fading is scoped", async () => {
  await patchDullahan(actor, { oath: { startedAt: 0, targetActorUuid: target.actor.uuid, cr: 2 } });
  game.time.worldTime = 86400;
  await assert.rejects(use("broken", "broken"), /24/);
  game.time.worldTime = 86401;
  ctx.answers.push("yes");
  await use("broken", "broken");
  assert.equal(actor.system.attributes.hp.effectiveMax, 27);
  assert.equal(actor.system.abilities.dex.bonuses.save, -4);
  const before = actor.system.attributes.hp.value;
  ctx.answers.push("yes");
  await use("oath", "oath-death");
  assert.equal(actor.system.attributes.hp.effectiveMax, 60);
  assert.equal(actor.system.attributes.hp.value, before);
});
test("head holder suppresses previous flaws only while it is the oath target", async () => {
  await patchDullahan(actor, {
    oath: { targetActorUuid: target.actor.uuid, withered: true, cr: 2, penaltyMode: "sum" },
    pawn: { active: true, holderActorUuid: target.actor.uuid }
  });
  assert.ok(dullahanPactWaives(actor));
  await syncDullahan(actor);
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "dullahanPassive") === "broken"));
  await patchDullahan(actor, { pawn: null });
  await syncDullahan(actor);
  assert.equal(actor.system.attributes.hp.effectiveMax, 27);
});
test("oath adds one weapon die only to its target, doubles on critical, never rerolls callback", async () => {
  await item("unnerving").delete();
  ctx.answers.push([target.uuid], "yes");
  await use("oath", "oath");
  const activity = attack(),
    workflow = {
      id: "oath-hit",
      actor,
      item: activity.item,
      activity,
      token: source,
      hitTargets: new Set([{ document: target }]),
      isCritical: true,
      attackRoll: {}
    },
    packet = { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] };
  await applyDullahanPacket({ actor: target.actor, document: target }, { workflow, damageItem: packet });
  assert.deepEqual(ctx.rolls, ["2d6"]);
  assert.equal(packet.totalDamage, 14);
  await applyDullahanPacket({ actor: target.actor, document: target }, { workflow, damageItem: packet });
  assert.equal(ctx.rolls.length, 1);
  const other = token(base, "other", 200);
  await applyDullahanPacket(
    { actor: base, document: other },
    {
      workflow: { ...workflow, hitTargets: new Set([{ document: other }]) },
      damageItem: { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] }
    }
  );
  assert.equal(ctx.rolls.length, 1);
});
test("passive flame applies only to already wounded melee targets, respects fire resistance", async () => {
  const activity = attack(actor, { spell: true }),
    workflow = {
      id: "fire-hit",
      actor,
      item: activity.item,
      activity,
      token: source,
      hitTargets: new Set([{ document: target }])
    },
    packet = { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] };
  ctx.resistFire = true;
  await applyDullahanPacket({ actor: target.actor, document: target }, { workflow, damageItem: packet });
  assert.equal(packet.damageDetail.find(p => p.type === "fire").value, 3);
  assert.deepEqual(ctx.rolls, ["1d6"]);
  await target.actor.update({ "system.attributes.hp.value": 60 });
  await applyDullahanPacket(
    { actor: target.actor, document: target },
    {
      workflow: { ...workflow, id: "full-health" },
      damageItem: { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] }
    }
  );
  assert.equal(ctx.rolls.length, 1);
});
test("flame scar uses only its recorded roll after confirmed hit and only once", async () => {
  const activity = attack(),
    event = {
      key: "scar-one",
      workflowId: "scar-hit",
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: target.uuid,
      sceneId: canvas.scene.id,
      activityUuid: activity.uuid,
      dullahanFireRoll: 6
    };
  await emitConfirmedDamage(target.actor, 12, { [MODULE_ID]: { damageEvent: event } });
  assert.equal(target.actor.system.attributes.hp.effectiveMax, 54);
  await emitConfirmedDamage(target.actor, 12, { [MODULE_ID]: { damageEvent: { ...event, key: "scar-two" } } });
  assert.equal(target.actor.system.attributes.hp.effectiveMax, 54);
});
test("foreign healing becomes temp HP and recalculated callbacks cannot restore healing", async () => {
  await syncDullahan(actor);
  const cast = attack(target.actor, { spell: true }),
    workflow = { actor: target.actor, item: cast.item },
    p = { damageDetail: [{ type: "healing", value: -12 }] };
  applyDullahanHealing({ actor }, { workflow, damageItem: p });
  assert.equal(p.newHP, 40);
  assert.equal(p.newTempHP, 12);
  p.damageDetail = [{ type: "healing", value: -12 }];
  p.damageDetails.combinedDamage = p.damageDetail;
  applyDullahanHealing({ actor }, { workflow, damageItem: p });
  assert.equal(p.newHP, 40);
  assert.equal(p.newTempHP, 12);
  const own = { damageDetail: [{ type: "healing", value: -6 }] };
  applyDullahanHealing({ actor }, { workflow: { ...workflow, actor }, damageItem: own });
  assert.equal(own.damageDetail[0].value, -6);
});
test("healing at zero leaves one HP unconscious, fortitude is not mistaken for healing", async () => {
  await syncDullahan(actor);
  await actor.update({ "system.attributes.hp.value": 0 });
  const cast = attack(target.actor, { spell: true }),
    p = { damageDetail: [{ type: "healing", value: -12 }] };
  applyDullahanHealing({ actor }, { workflow: { actor: target.actor, item: cast.item }, damageItem: p });
  assert.equal(p.newHP, 1);
  const options = p.calcDamageOptions,
    changes = { "system.attributes.hp.value": 1 };
  captureDullahanHealing(actor, changes, options);
  await actor.update(changes);
  await observeDullahanHealing(actor, changes, options);
  assert.ok(actor.statuses.has("unconscious"));
  const manual = {};
  captureDullahanHealing(actor, changes, manual);
  assert.equal(manual[MODULE_ID], undefined);
});
test("fortitude uses native CON with tier bonus, no radiant bonus, no duplicate save", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("yes");
  assert.equal((await runDullahanFortitude(actor, { amount: 8, requestId: "fortitude" })).status, "success");
  assert.equal(actor.system.attributes.hp.value, 1);
  assert.equal(ctx.saves[0].target, 13);
  assert.deepEqual(ctx.saves[0].rolls, [{ parts: ["4"] }]);
  await actor.update({ "system.attributes.hp.value": 0 });
  await runDullahanFortitude(actor, { amount: 8, requestId: "fortitude" });
  assert.equal(ctx.saves.length, 1);
  ctx.answers.push("yes");
  await runDullahanFortitude(actor, { amount: 8, radiant: true, requestId: "radiant-fortitude" });
  assert.equal(ctx.saves[1].rolls, undefined);
});
test("declining fortitude or cancelling its save leaves zero HP", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("no");
  await runDullahanFortitude(actor, { amount: 8, requestId: "no-fortitude" });
  assert.equal(actor.system.attributes.hp.value, 0);
  ctx.cancelSave = true;
  ctx.answers.push("yes");
  await runDullahanFortitude(actor, { amount: 8, requestId: "cancel-save" });
  assert.equal(actor.system.attributes.hp.value, 0);
});
test("mount eligibility includes size, intelligence, fear/incapacity, CR and charm immunity", async () => {
  assert.ok(dullahanMountFailures(actor, target).length);
  await target.actor.update({ "system.traits.size": "lg", "system.abilities.int.value": 5 });
  await target.actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Fear", statuses: ["frightened"], system: { changes: [] } }
  ]);
  assert.deepEqual(dullahanMountFailures(actor, target), []);
  await target.actor.update({ "system.traits.ci.value": ["charmed"] });
  assert.ok(dullahanMountFailures(actor, target).some(s => s.includes("иммунитета")));
});
test("mount resistance requires confirmed riding, no radiant resistance or statblock replacement", async () => {
  await target.actor.update({ "system.traits.size": "lg", "system.abilities.int.value": 5 });
  await target.actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Fear", statuses: ["frightened"], system: { changes: [] } }
  ]);
  const stats = structuredClone(target.actor._source.system);
  ctx.answers.push([target.uuid], "yes");
  await use("mount", "mount");
  assert.deepEqual(target.actor._source.system, stats);
  await syncDullahan(actor);
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "dullahanPassive") === "mount"));
  ctx.answers.push([target.uuid], "yes");
  await use("mount", "ride");
  assert.ok(actor.system.traits.dr.value.includes("fire"));
  assert.ok(!actor.system.traits.dr.value.includes("radiant"));
  await target.update({ x: 1000 });
  await syncDullahan(actor);
  assert.ok(!actor.system.traits.dr.value.includes("fire"));
});
test("cancelled skull placement leaves attack replacement available", async () => {
  encounter();
  ctx.cancelPlacement = true;
  ctx.answers.push("yes");
  await use("skulls", "skulls");
  assert.equal(dullahanState(actor).skullMoment, null);
  assert.equal(ctx.calls.length, 0);
  assert.equal(canvas.scene.regions.length, 0);
});
test("skulls use native sphere/DEX/8d6, burn on failure, replace at most one attack per turn", async () => {
  encounter();
  ctx.answers.push("yes");
  assert.equal((await use("skulls", "skulls")).status, "success");
  const a = ctx.calls[0].activity;
  assert.equal(a.save.ability[0], "dex");
  assert.equal(a.damage.parts[0].number, 8);
  assert.equal(a.damage.onSave, "half");
  assert.equal(a.activation.type, "special");
  assert.equal(canvas.scene.regions.length, 0);
  const burn = target.actor.effects.find(e => e.getFlag(MODULE_ID, "dullahanBurn"));
  assert.equal(burn.getFlag(MODULE_ID, "repeatSave").damage[0].formula, "1d6");
  assert.equal(burn.duration.value, 60);
  assert.equal(target.light.bright, 30);
  await assert.rejects(use("skulls", "skulls"), /этом ходу/);
});
test("unknown skull outcome reserves the attack instead of allowing a second expenditure", async () => {
  encounter();
  ctx.nativeMode = undefined;
  ctx.answers.push("yes");
  assert.equal((await use("skulls", "skulls")).status, "needs-review");
  await assert.rejects(use("skulls", "skulls"), /этом ходу/);
});
test("repeated burning save uses only the shared dispatcher and ends on success", async () => {
  const burn = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" });
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "turn-1" });
  assert.ok(target.actor.effects.includes(burn));
  assert.equal(ctx.calls.at(-1).activity.damage.parts[0].number, 1);
  ctx.failSaves = false;
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "turn-2" });
  assert.ok(!target.actor.effects.includes(burn));
  await endDullahanBurn(burn);
  assert.equal(target.light.bright, 0);
});
test("overlapping burn light restores once and preserves manual light changes", async () => {
  const skull = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" }),
    gaze = await addDullahanBurn(source, target, item("gaze"), { kind: "gaze" });
  await skull.delete();
  await endDullahanBurn(skull);
  assert.equal(target.light.dim, 60);
  await target.update({ "light.bright": 50 });
  await gaze.delete();
  await endDullahanBurn(gaze);
  assert.equal(target.light.bright, 50);
  assert.equal(target.light.dim, 0);
});
test("gaze requires prerequisite, selected target, concentration and explicit action ruling", async () => {
  ctx.answers.push([target.uuid], "action");
  assert.equal((await use("gaze", "gaze")).status, "success");
  assert.equal(item("gaze").system.uses.spent, 1);
  const burn = target.actor.effects.find(e => e.getFlag(MODULE_ID, "dullahanBurn")?.kind === "gaze");
  assert.ok(burn.statuses.has("frightened"));
  assert.equal(burn.getFlag(MODULE_ID, "repeatSave").damage[0].formula, "1d8");
  const concentration = [...actor.concentration.effects][0];
  await concentration.delete();
  await cleanupDullahanBurns();
  assert.ok(!target.actor.effects.includes(burn));
});
test("frightened immunity prevents gaze condition and burning", async () => {
  await target.actor.update({ "system.traits.ci.value": ["frightened"] });
  const result = await addDullahanBurn(source, target, item("gaze"), { kind: "gaze" });
  assert.equal(result, false);
  assert.equal(target.actor.effects.length, 0);
});
test("howl targets chosen nearby creatures and temp HP never replaces higher temp HP", async () => {
  ctx.answers.push([target.uuid]);
  await use("howl", "howl");
  assert.equal(item("howl").system.uses.spent, 1);
  assert.equal(actor.system.attributes.hp.temp, 4);
  assert.equal(ctx.calls[1].activity.damage.parts[0].number, 3);
  await item("howl").update({ "system.uses.spent": 0 });
  await actor.update({ "system.attributes.hp.temp": 20 });
  ctx.answers.push([target.uuid]);
  await use("howl", "howl");
  assert.equal(actor.system.attributes.hp.temp, 20);
});
test("head recipe preserves real attacks, defenses and minute lifecycle", () => {
  const r = dullahanHeadRecipe(actor, base);
  assert.equal(r.hp, base.system.attributes.hp.max);
  assert.equal(r.hpFormula, String(r.hp));
  assert.equal(r.extraItems[0].system.identifier, "sample-attack");
  assert.equal(r.lifecycle.seconds, 60);
});
test("three heads spawn atomically near source and expire after one minute", async () => {
  ctx.answers.push(base.uuid, "yes");
  assert.equal((await use("heads", "heads")).status, "success");
  assert.equal(dullahanHeads(actor).length, 3);
  assert.equal(item("heads").system.uses.spent, 1);
  const positions = canvas.scene.tokens
    .filter(t => t.actor.getFlag(MODULE_ID, "summonSource") === "dullahan-heads")
    .map(t => [t.x, t.y]);
  assert.deepEqual(positions, [
    [100, 0],
    [0, 100],
    [-100, 0]
  ]);
  game.time.worldTime = 60;
  await synchronizeSummonLifecycle();
  assert.equal(dullahanHeads(actor).length, 0);
  assert.ok(game.actors.includes(base));
});
test("partial summon creation is rolled back and confirmed use is refunded", async () => {
  ctx.createFailAt = 2;
  ctx.answers.push(base.uuid, "yes");
  assert.equal((await use("heads", "heads")).status, "needs-review");
  assert.equal(dullahanHeads(actor).length, 0);
  assert.equal(item("heads").system.uses.spent, 0);
  assert.equal(canvas.scene.tokens.length, 2);
});
test("cancelled head selection spends no resource and creates no NPC", async () => {
  ctx.answers.push(null);
  await use("heads", "heads");
  assert.equal(ctx.calls.length, 0);
  assert.equal(item("heads").system.uses.spent, 0);
});
test("rebirth does not restart 48h, needs GM confirmation and restores only HP", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("yes");
  await use("defiant", "rebirth-start");
  const time = dullahanState(actor).rebirth.readyAt;
  game.time.worldTime = 100;
  await assert.rejects(use("defiant", "rebirth-start"), /Срок/);
  assert.equal(dullahanState(actor).rebirth.readyAt, time);
  await assert.rejects(use("defiant", "rebirth"), /48/);
  game.time.worldTime = time;
  ctx.answers.push("yes");
  await item("heads").update({ "system.uses.spent": 1 });
  await use("defiant", "rebirth");
  assert.equal(actor.system.attributes.hp.value, 60);
  assert.equal(item("heads").system.uses.spent, 1);
});
test("mist report remains GM-only and does not reveal hidden tokens", async () => {
  await target.update({ hidden: true });
  ctx.answers.push(120);
  await use("mists", "mists");
  assert.equal(item("mists").system.uses.spent, 1);
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "dullahanMists")).duration.value, 7200);
  ctx.answers.push("yes");
  await use("mists", "mist-report");
  const report = ctx.messages.at(-1);
  assert.deepEqual(report.whisper, ["gm"]);
  assert.ok(report.content.includes("target"));
  assert.ok(target.hidden);
});
test("prophecy and Sending use independent resources and native action", async () => {
  await use("prophecy", "prophecy");
  assert.equal(item("prophecy").system.uses.spent, 1);
  const spell = attack(actor, { spell: true });
  await spell.item.update({ "system.identifier": "sending" });
  ctx.answers.push("yes");
  await use("prophecy", "sending");
  assert.equal(item("prophecy").system.uses.spent, 1);
  assert.deepEqual(ctx.calls.at(-1).activity.consumption, { spellSlot: false, targets: [] });
});
test("head hunter exception deals 6d8 but never removes a token", async () => {
  ctx.answers.push([target.uuid], "damage");
  await use("headhunter", "headhunter");
  assert.equal(ctx.calls[0].activity.damage.parts[0].number, 6);
  assert.equal(ctx.calls[0].activity.damage.parts[0].types[0], "slashing");
  assert.ok(canvas.scene.tokens.includes(target));
});
test("decapitation requires separate survival ruling and no automatic actor deletion", async () => {
  ctx.answers.push([target.uuid], "save", "survives");
  await use("headhunter", "headhunter");
  assert.equal(target.actor.system.attributes.hp.value, 40);
  assert.equal(target.actor.getFlag(MODULE_ID, "dullahanDecapitation").outcome, "survives");
});
test("appearance responds to concentration without changing art or inventory", async () => {
  await patchDullahan(actor, { appearance: "humanoid" });
  const n = actor.items.length;
  await actor.beginConcentrating({}, {});
  await revealDullahan(actor);
  assert.equal(dullahanState(actor).appearance, "true");
  assert.equal(actor.items.length, n);
});
test("timer notices do not apply unconfirmed curses or heal bodies", async () => {
  await patchDullahan(actor, { oath: { startedAt: 0, targetActorUuid: target.actor.uuid }, rebirth: { readyAt: 1 } });
  game.time.worldTime = 86401;
  await noticeDullahanTimers(actor);
  assert.ok(dullahanState(actor).oath.noticed);
  assert.ok(!dullahanState(actor).oath.withered);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("diagnostics is read-only and links cannot contaminate other transformations", () => {
  const raw = JSON.stringify(actor.flags);
  assert.equal(inspectDullahan(actor).level, 4);
  assert.equal(JSON.stringify(actor.flags), raw);
  const other = {
    _id: "old",
    name: "Old",
    system: { identifier: "old-form", description: { value: "<p>Форма нежити и Клятва охотника.</p>" } },
    flags: {}
  };
  linkDocumentDescriptions([
    { name: "features", documents: [...dullahanDocuments, other] },
    { name: "transformations", documents: dullahanTransformationDocuments }
  ]);
  assert.equal(other.system.description.value, "<p>Форма нежити и Клятва охотника.</p>");
});
test("real hooks intercept native cards and secondary GM cannot mutate automation", async () => {
  installDullahanHooks();
  for (const name of [
    "dnd5e.preUseActivity",
    "midi-qol.preTargetingV2",
    "dnd5e.restCompleted",
    "updateToken",
    "deleteActiveEffect"
  ])
    assert.ok(ctx.hooks.get(name)?.some(fn => typeof fn === "function"));
  await actor.update({ "system.attributes.hp.value": 0 });
  game.user = { id: "gm2", isGM: true };
  assert.equal(await runDullahanFortitude(actor, { amount: 8, requestId: "secondary-gm" }), false);
  assert.equal(ctx.saves.length, 0);
  assert.equal(actor.system.attributes.hp.value, 0);
});

test("approved gaze stock uses long rest; burning stops at sixty seconds", async () => {
  assert.equal(item("gaze").system.uses.recovery[0].period, "lr");
  const burn = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" });
  game.time.worldTime = 59;
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "before-minute" });
  const count = ctx.calls.length;
  game.time.worldTime = 60;
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "at-minute" });
  await cleanupDullahanBurns();
  assert.equal(ctx.calls.length, count);
  assert.equal(target.light.bright, 0);
  assert.equal(burn.duration.value, 60);
});
test("explicit reapplication refreshes burning, ordinary updates do not", async () => {
  const burn = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" });
  game.time.worldTime = 20;
  await burn.update({ name: "Manual caption" });
  assert.equal(burn.start.time, 0);
  const refreshed = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" });
  assert.equal(refreshed, burn);
  assert.equal(burn.start.time, 20);
  assert.equal(target.actor.effects.length, 1);
});
test("successful gaze save leaves no empty concentration", async () => {
  ctx.failSaves = false;
  ctx.answers.push([target.uuid], "action");
  await use("gaze", "gaze");
  assert.equal(actor.concentration.effects.size, 0);
  assert.equal(target.actor.effects.length, 0);
});
test("cancelled gaze action preserves previous concentration and resources", async () => {
  const old = await actor.beginConcentrating({}, {});
  ctx.answers.push([target.uuid], null);
  await use("gaze", "gaze");
  assert.ok(actor.effects.includes(old));
  assert.equal(item("gaze").system.uses.spent, 0);
  assert.equal(ctx.calls.length, 0);
});
test("packet correlation carries the rolled fire value, not resisted or total damage", async () => {
  ctx.resistFire = true;
  const activity = attack(),
    workflow = {
      id: "native-fire",
      actor,
      item: activity.item,
      activity,
      token: source,
      hitTargets: new Set([{ actor: target.actor, document: target }]),
      targets: new Set([{ actor: target.actor, document: target }])
    },
    damageItem = { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] },
    tokenRef = { actor: target.actor, document: target };
  await applyDullahanPacket(tokenRef, { workflow, damageItem });
  await prepareConfirmedDamage(tokenRef, { workflow, damageItem });
  const event = damageItem.calcDamageOptions[MODULE_ID].damageEvent;
  assert.equal(event.dullahanFireRoll, 6);
  assert.equal(damageItem.damageDetail.find(p => p.type === "fire").value, 3);
  assert.equal(target.actor.effects.length, 0);
  await emitConfirmedDamage(target.actor, 11, damageItem.calcDamageOptions);
  assert.equal(target.actor.system.attributes.hp.effectiveMax, 54);
});
test("confirmed zero-HP damage offers fortitude once, not on unrelated callbacks", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  const incoming = attack(target.actor),
    event = {
      key: "incoming",
      workflowId: "incoming-hit",
      beforeHp: 40,
      sourceActorUuid: target.actor.uuid,
      sourceTokenUuid: target.uuid,
      targetTokenUuid: source.uuid,
      sceneId: canvas.scene.id,
      activityUuid: incoming.uuid,
      damageTypes: ["slashing"]
    };
  ctx.answers.push("yes");
  await emitConfirmedDamage(actor, 8, { [MODULE_ID]: { damageEvent: event } });
  assert.equal(actor.system.attributes.hp.value, 1);
  await emitConfirmedDamage(actor, 8, { [MODULE_ID]: { damageEvent: event } });
  assert.equal(ctx.saves.length, 1);
});
test("disabled oath mark stops its damage bonus without refunding the oath", async () => {
  await item("unnerving").delete();
  ctx.answers.push([target.uuid], "yes");
  await use("oath", "oath");
  await target.actor.effects[0].update({ disabled: true });
  const activity = attack(),
    workflow = {
      id: "suppressed-mark",
      actor,
      item: activity.item,
      activity,
      token: source,
      hitTargets: new Set([{ document: target }])
    };
  await applyDullahanPacket(
    { actor: target.actor, document: target },
    {
      workflow,
      damageItem: { rawDamageDetail: [{ type: "slashing", value: 8 }], damageDetail: [{ type: "slashing", value: 8 }] }
    }
  );
  assert.equal(ctx.rolls.length, 0);
  assert.ok(dullahanState(actor).oath);
});
test("manual passive edits and disabled state survive synchronization", async () => {
  await syncDullahan(actor);
  const sight = actor.effects.find(e => e.getFlag(MODULE_ID, "dullahanPassive") === "sight");
  await sight.update({
    disabled: true,
    "system.changes": [
      {
        key: "system.attributes.senses.ranges.truesight",
        value: "200",
        type: "upgrade",
        phase: "initial",
        priority: 20
      }
    ]
  });
  await syncDullahan(actor);
  assert.equal(sight.disabled, true);
  assert.equal(sight.system.changes[0].value, "200");
});
test("a synthetic actor outside the world collection gets actual passive effects", async () => {
  const synthetic = makeActor(11, "synthetic");
  synthetic.uuid = "Scene.one.Token.unlinked.Actor.synthetic";
  token(synthetic, "unlinked", 300);
  await syncDullahan(synthetic);
  assert.equal(synthetic.system.details.type.value, "undead");
  assert.equal(synthetic.system.attributes.senses.ranges.truesight, 120);
  assert.ok(!game.actors.includes(synthetic));
});
test("concurrent native interception shares one application and one expense", async () => {
  const activity = act("prophecy", "prophecy"),
    first = controlDullahan(actor, activity),
    second = controlDullahan(actor, activity);
  assert.equal(first, second);
  await first;
  assert.equal(ctx.calls.length, 1);
  assert.equal(item("prophecy").system.uses.spent, 1);
});
test("ending old burning concurrently with new burning cannot extinguish its light", async () => {
  const old = await addDullahanBurn(source, target, item("skulls"), { kind: "skulls" });
  await old.delete();
  let entered, release;
  const enteredPromise = new Promise(resolve => {
      entered = resolve;
    }),
    gate = new Promise(resolve => {
      release = resolve;
    }),
    update = target.update.bind(target);
  target.update = async patch => {
    if (patch["light.bright"] === 0) {
      entered();
      await gate;
    }
    return update(patch);
  };
  const ending = endDullahanBurn(old);
  await enteredPromise;
  const starting = addDullahanBurn(source, target, item("gaze"), { kind: "gaze" });
  await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.all([ending, starting]);
  assert.equal(target.light.bright, 30);
  assert.equal(target.light.dim, 60);
});
