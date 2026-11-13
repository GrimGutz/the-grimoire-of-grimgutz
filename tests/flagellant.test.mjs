import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import {
  FLAGELLANT_FEATURES,
  flagellantPain,
  flagellantPricePlan,
  flagellantMaximum,
  flagellantDie
} from "../scripts/automation/shared/flagellant-definitions.mjs";
import { flagellantDocuments } from "../src/packs/flagellant-features.mjs";
import { flagellantClassDocuments } from "../src/packs/flagellant-class.mjs";
import { flagellantSection } from "../src/flagellant-data.mjs";
import {
  syncFlagellant,
  payFlagellantPrice,
  flagellantMaxDebts,
  flagellantPassiveDefinitions,
  flagellantAvailable,
  flagellantRestCompleted,
  flagellantPrerequisiteFailures,
  validateFlagellantItem
} from "../scripts/automation/classes/flagellant.mjs";
import {
  grantFlagellantTechnique,
  flagellantExpense,
  flagellantHitDice
} from "../scripts/automation/classes/flagellant-actions.mjs";
import {
  installFlagellantHooks,
  seedFlagellantTracking,
  recordFlagellantHpLoss,
  observeFlagellantHp,
  captureFlagellantTurn,
  releaseFlagellantRetribution,
  applyFlagellantRetributionSave
} from "../scripts/automation/classes/flagellant-events.mjs";
import { requestGm, receiveGmRequest } from "../scripts/automation/shared/gm-requests.mjs";
import { benefitData, turnKey, cleanupCombatBenefits } from "../scripts/automation/shared/combat-benefits.mjs";
import { emitConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";

let actor, source, target, docs, answers, dice, prompts, messages, nativeCalls, hooks, seq, journal;
function patch(base, changes) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(changes)) {
    if (key.includes(".")) {
      const parts = key.split("."),
        last = parts.pop();
      let obj = out;
      for (const part of parts) obj = obj[part] ??= {};
      if (last.startsWith("-=")) delete obj[last.slice(2)];
      else obj[last] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) out[key] = patch(out[key] ?? {}, value);
    else out[key] = structuredClone(value);
  }
  return out;
}
function fire(name, ...args) {
  for (const fn of hooks.get(name) ?? []) fn(...args);
}
function owned(data, owner, register = true) {
  let raw = structuredClone(data);
  const item = {
    id: raw._id,
    actor: owner,
    parent: owner,
    uuid: `${owner.uuid}.Item.${raw._id}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: p => owned(patch(raw, p), owner, false),
    async update(p) {
      raw = patch(raw, p);
      refresh();
      owner.prepare();
      fire("updateItem", this, p);
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
    if (item.system.hd)
      item.system.hd = { ...item.system.hd, value: Number(item.system.levels) - Number(item.system.hd.spent) };
  }
  refresh();
  if (register) {
    docs.set(item.uuid, item);
    for (const a of item.system.activities.values()) docs.set(a.uuid, a);
  }
  return item;
}
function makeActor(level = 5, id = "owner", uuid = `Actor.${id}`) {
  let raw = {
    system: {
      details: { level: 10 },
      attributes: {
        prof: 4,
        hp: { value: 40, max: 100, temp: 20, tempmax: 0 },
        ac: { value: 15, bonus: 0 },
        movement: { walk: 30, units: "ft" }
      },
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 18, mod: 4, max: null }])
      )
    },
    flags: {}
  };
  const a = {
    id,
    uuid,
    name: id,
    isOwner: true,
    statuses: new Set(),
    items: [],
    effects: [],
    testUserPermission: () => true,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    applyDamage: () => {
      throw Error("A hit-point PRICE must not use damage API");
    },
    prepare() {
      this._source = structuredClone(raw);
      this.system = structuredClone(raw.system);
      this.flags = raw.flags;
      for (const e of this.effects.filter(e => !e.disabled && !e.isSuppressed))
        for (const c of e.system?.changes ?? []) {
          if (c.key === "system.attributes.hp.tempmax") this.system.attributes.hp.tempmax += Number(c.value);
          if (c.key === "system.attributes.ac.bonus") this.system.attributes.ac.value += Number(c.value);
          if (c.key === "system.attributes.movement.walk") this.system.attributes.movement.walk += Number(c.value);
        }
      const hp = this.system.attributes.hp;
      hp.effectiveMax = Math.max(0, hp.max + hp.tempmax);
      hp.value = Math.min(hp.value, hp.effectiveMax);
      hp.damage = hp.effectiveMax - hp.value;
    },
    async update(p, options = {}) {
      raw = patch(raw, p);
      this.prepare();
      fire("updateActor", this, p, options);
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async unsetFlag(m, k) {
      return this.update({ [`flags.${m}.-=${k}`]: null });
    },
    async createEmbeddedDocuments(type, rows) {
      if (type === "Item") {
        const out = rows.map(r => owned(r, this));
        this.items.push(...out);
        return out;
      }
      const out = rows.map(r => effect(r, this));
      this.effects.push(...out);
      this.prepare();
      for (const e of out) fire("createActiveEffect", e);
      return out;
    },
    async updateEmbeddedDocuments(_type, rows) {
      for (const row of rows) await this.effects.find(e => e.id === row._id)?.update(row);
      return rows;
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (type === "Item") {
        for (const i of this.items.filter(i => ids.includes(i.id))) {
          docs.delete(i.uuid);
          for (const a of i.system.activities.values()) docs.delete(a.uuid);
        }
        this.items = this.items.filter(i => !ids.includes(i.id));
        return;
      }
      const removed = this.effects.filter(e => ids.includes(e.id));
      this.effects = this.effects.filter(e => !ids.includes(e.id));
      this.prepare();
      for (const e of removed) {
        docs.delete(e.uuid);
        fire("deleteActiveEffect", e);
      }
    }
  };
  a.prepare();
  a.items = [
    owned(
      {
        _id: "class",
        type: "class",
        name: "Class",
        system: { identifier: "flagellant", levels: level, hd: { denomination: "d10", spent: 0 }, activities: {} }
      },
      a
    ),
    ...flagellantDocuments.map(row => owned(row, a))
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  docs.set(a.uuid, a);
  return a;
}
function effect(data, owner) {
  let raw = structuredClone(data);
  const e = {
    id: `e${++seq}`,
    uuid: `${owner.uuid}.ActiveEffect.e${seq}`,
    parent: owner,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    async update(p) {
      raw = patch(raw, p);
      Object.assign(this, raw);
      owner.prepare();
      fire("updateActiveEffect", this, p);
      return this;
    },
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async delete() {
      await owner.deleteEmbeddedDocuments("ActiveEffect", [this.id]);
    }
  };
  Object.assign(e, raw);
  docs.set(e.uuid, e);
  return e;
}
const item = (key, owner = actor) => owner.items.find(i => i.system.identifier === `flagellant-${key}`),
  activity = (key, owner = actor) => [...item(key, owner).system.activities.values()][0];
function token(owner, id, x = 0) {
  const t = { id, uuid: `Scene.one.Token.${id}`, actor: owner, parent: canvas.scene, x, y: 0, width: 1, height: 1 };
  canvas.scene.tokens.push(t);
  docs.set(t.uuid, t);
  return t;
}
function combat() {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, tokenId: t.id, actor: t.actor }));
  const c = {
    id: "combat",
    started: true,
    round: 1,
    turn: 0,
    previous: { round: 0, turn: 0 },
    turns: entries,
    combatants: entries,
    combatant: entries[0]
  };
  game.combat = c;
  game.combats = [c];
  return c;
}
const use = (key, id = `ff-${++seq}`) =>
  requestGm(
    "flagellant-action",
    actor,
    { activityUuid: activity(key).uuid, sourceUuid: source.uuid },
    { requestId: id }
  );
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
async function native(a, config) {
  nativeCalls.push({ activity: a, config });
  for (const cost of a.consumption?.targets ?? [])
    if (cost.type === "itemUses") {
      const original = a.actor.items.get(cost.target || a.item.id);
      await original.update({ "system.uses.spent": Number(original.system.uses.spent) + Number(cost.value) });
    } else if (cost.type === "hitDice") {
      const cls = a.actor.items.find(
        i => i.type === "class" && i.system.hd.denomination === cost.target && i.system.hd.value > 0
      );
      await cls.update({ "system.hd.spent": cls.system.hd.spent + 1 });
    }
  if (a.type === "heal") {
    const uuid = config.midiOptions.targetUuids[0],
      t = docs.get(uuid),
      hp = t.actor.system.attributes.hp;
    await t.actor.update({
      "system.attributes.hp.value": Math.min(hp.effectiveMax, hp.value + Number(a.healing.custom.formula))
    });
  }
  return { id: `native-${++seq}` };
}
beforeEach(() => {
  docs = new Map();
  answers = [];
  dice = [];
  prompts = [];
  messages = [];
  nativeCalls = [];
  hooks = new Map();
  seq = 0;
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(u => u.id === id);
  globalThis.game = {
    user: gm,
    users,
    time: { worldTime: 0 },
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    combats: [],
    modules: new Map([["midi-qol", { active: true }]])
  };
  globalThis.canvas = { ready: true, scene: { id: "one", grid: { size: 100, distance: 5, units: "ft" }, tokens: [] } };
  game.scenes = [canvas.scene];
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  globalThis.Hooks = { on: (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn]) };
  globalThis.foundry = {
    utils: { randomID: () => `ff-test-${++seq}`, escapeHTML: String },
    applications: {
      api: {
        DialogV2: {
          wait: async prompt => {
            prompts.push(prompt);
            return answers.shift() ?? null;
          }
        }
      }
    }
  };
  globalThis.CONFIG = {
    DND5E: { maxAbilityScore: 20 },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }
    async evaluate() {
      const [, n, side] = this.formula.match(/^(\d+)d(\d+)$/),
        values = dice.shift() ?? Array(Number(n)).fill(2);
      this.total = values.reduce((a, b) => a + b, 0);
      this.dice = [{ faces: Number(side), results: values.map(result => ({ result, active: true })) }];
      return this;
    }
    async toMessage(data) {
      messages.push({ ...data, formula: this.formula, total: this.total });
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  class Workflow {
    constructor(actor, activity, speaker, targets, options) {
      Object.assign(this, { actor, activity, targets, workflowOptions: options.workflowOptions });
    }
  }
  globalThis.MidiQOL = { Workflow, TrapWorkflow: class extends Workflow {}, completeActivityUse: native };
  journal = {
    events: [],
    getFlag: (_m, k) => (k === "automationLedger" ? true : journal[k]),
    async setFlag(_m, k, v) {
      journal[k] = structuredClone(v);
    }
  };
  game.journal = [journal];
  actor = makeActor();
  source = token(actor, "owner");
  target = token(makeActor(0, "target"), "target", 100);
  game.actors = [actor, target.actor];
  seedFlagellantTracking();
});

test("Flagellant preserves the source and all 13 sections/cards, grants d10 and dice d4/d6/d8/d10/d12 with no free proficiencies", async () => {
  const text = await readFile(new URL("../src/content/flagellant.md", import.meta.url), "utf8");
  assert.equal(
    createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex"),
    "ce821ee1a2bae638979169578c7e7fe18a141b277ff436aadf60ab2f3246d640"
  );
  assert.equal(flagellantDocuments.length, 13);
  for (const e of FLAGELLANT_FEATURES) assert.ok(flagellantSection(e.name, e.depth).length > 40, e.name);
  assert.ok(flagellantDocuments.every(i => i.effects.length === 0));
  const cls = flagellantClassDocuments[0];
  assert.equal(cls.system.hitDice, "d10");
  assert.deepEqual(
    cls.system.advancement.filter(a => a.type === "ItemGrant").map(a => a.level),
    [1, 2, 3, 4, 5]
  );
  assert.equal(
    cls.system.advancement.filter(a => a.type === "ItemGrant").reduce((n, a) => n + a.configuration.items.length, 0),
    13
  );
  assert.equal(cls.system.spellcasting.progression, "none");
  assert.ok(cls.system.description.value.includes("@UUID["));
  assert.deepEqual([1, 2, 3, 4, 5].map(flagellantDie), [4, 6, 8, 10, 12]);
});
test("strict entry counts the incoming class level: total five qualifies, four does not; default setting does not block", () => {
  actor.system.details.level = 5;
  actor.items[0].system.levels = 5;
  assert.deepEqual(flagellantPrerequisiteFailures(actor), []);
  actor.system.details.level = 4;
  actor.items[0].system.levels = 4;
  actor.system.abilities.con.value = 17;
  assert.equal(flagellantPrerequisiteFailures(actor).length, 2);
  const cls = { type: "class", system: { identifier: "flagellant", levels: 1 }, parent: actor };
  assert.equal(validateFlagellantItem(cls, {}, {}, "gm"), undefined);
  game.settings.get = () => true;
  assert.equal(validateFlagellantItem(cls, {}, {}, "gm"), false);
});
test("pain thresholds use strict fractions and effective maximum, not temporary HP or inferred threshold hierarchy", async () => {
  await actor.update({ "system.attributes.hp.value": 50 });
  assert.equal(flagellantPain(actor).taste, false);
  await actor.update({ "system.attributes.hp.value": 25 });
  assert.equal(flagellantPain(actor).thirst, false);
  await actor.update({ "system.attributes.hp.value": 24 });
  assert.equal(flagellantPain(actor).thirst, true);
  await actor.update({ "system.attributes.hp.value": 0 });
  assert.deepEqual(flagellantPain(actor), { alive: false, taste: false, thirst: false, rapture: false });
  await actor.update({ "system.attributes.hp.value": 1, "system.attributes.hp.max": 2 });
  assert.equal(flagellantPain(actor).rapture, true);
  assert.equal(flagellantPain(actor).taste, false);
});
test("HP price is not damage: full loss ignores temp HP, never calls damage API, and preserves original rolled amount", async () => {
  const paid = await payFlagellantPrice(actor, 8, { id: "price", sourceItem: item("surge") });
  assert.equal(paid.ok, true);
  assert.equal(paid.amount, 8);
  assert.equal(actor.system.attributes.hp.value, 32);
  assert.equal(actor.system.attributes.hp.temp, 20);
  await payFlagellantPrice(actor, 8, { id: "price", sourceItem: item("surge") });
  assert.equal(actor.system.attributes.hp.value, 32);
});
test("price that reaches zero is paid in full available HP but creates no effect; native action is not refunded", async () => {
  await actor.update({ "system.attributes.hp.value": 3 });
  dice.push([5]);
  const result = await use("surge", "fatal-price");
  assert.equal(result.status, "success");
  assert.equal(actor.system.attributes.hp.value, 0);
  assert.equal(nativeCalls[0].activity.activation.type, "bonus");
  assert.ok(!actor.effects.some(e => benefitData(e)?.flagellantTechnique));
  assert.deepEqual(flagellantPricePlan(actor, 4), { ok: false, mode: "hp", lost: 0, amount: 4 });
});
test("at one HP full prices stack against maximum while HP/temp remain unchanged, even on a recipient with no class", async () => {
  await target.actor.update({ "system.attributes.hp.value": 1 });
  await payFlagellantPrice(target.actor, 7, { id: "debt-a", sourceItem: item("lesson") });
  await payFlagellantPrice(target.actor, 5, { id: "debt-b", sourceItem: item("lesson") });
  assert.equal(flagellantMaximum(target.actor), 88);
  assert.equal(target.actor.system.attributes.hp.value, 1);
  assert.equal(target.actor.system.attributes.hp.temp, 20);
  assert.equal(flagellantMaxDebts(target.actor).length, 2);
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "flagellantPassive") === "max-loss");
  assert.equal(e.system.changes[0].key, "system.attributes.hp.tempmax");
  assert.equal(e.system.changes[0].phase, "initial");
  assert.equal(target.actor._source.system.attributes.hp.max, 100);
});
test("maximum price must leave one: impossible full price makes no partial reduction and no benefit", async () => {
  await actor.update({ "system.attributes.hp.value": 1, "system.attributes.hp.max": 5 });
  const paid = await payFlagellantPrice(actor, 5, { id: "too-large", sourceItem: item("surge") });
  assert.equal(paid.ok, false);
  assert.equal(flagellantMaximum(actor), 5);
  assert.deepEqual(flagellantMaxDebts(actor), []);
});
test("disabled/manually altered maximum-loss effect cannot grant a free unpaid buff", async () => {
  await actor.update({ "system.attributes.hp.value": 1 });
  await payFlagellantPrice(actor, 4, { id: "first", sourceItem: item("surge") });
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "flagellantPassive") === "max-loss");
  await e.update({ disabled: true });
  await assert.rejects(payFlagellantPrice(actor, 4, { id: "disabled", sourceItem: item("surge") }), /отключено/);
  assert.equal(flagellantMaxDebts(actor).length, 1);
});
test("short rest and donor rest do not clear recipient debt; recipient long rest clears only its temporary debt without invented healing", async () => {
  await target.actor.update({ "system.attributes.hp.value": 1 });
  await payFlagellantPrice(target.actor, 7, { id: "lesson-debt", sourceItem: item("lesson") });
  await requestGm("flagellant-rest", target.actor, { type: "short" }, { requestId: "short-recipient" });
  await requestGm("flagellant-rest", actor, { type: "long" }, { requestId: "long-donor" });
  assert.equal(flagellantMaximum(target.actor), 93);
  await requestGm(
    "flagellant-rest",
    target.actor,
    { type: "long", restoreFull: false },
    { requestId: "long-recipient" }
  );
  assert.equal(flagellantMaximum(target.actor), 100);
  assert.equal(target.actor.system.attributes.hp.value, 1);
});
test("real flesh passive gives CON saves only plus conditional BPS resistance, with no general immunity or discounted HP price", async () => {
  await syncFlagellant(actor);
  const changes = flagellantPassiveDefinitions(actor).flatMap(e => e.system.changes);
  assert.ok(changes.some(c => c.key === "system.abilities.con.save.roll.mode"));
  assert.equal(changes.filter(c => c.key === "system.traits.dr.value").length, 3);
  assert.ok(!changes.some(c => c.key.includes("ci.value") || c.key.includes("abilities.dex")));
  await actor.update({ "system.attributes.hp.value": 60 });
  await syncFlagellant(actor);
  assert.ok(
    !flagellantPassiveDefinitions(actor)
      .flatMap(e => e.system.changes)
      .some(c => c.key === "system.traits.dr.value")
  );
  await actor.update({ "system.attributes.hp.value": 10 });
  await payFlagellantPrice(actor, 6, { id: "not-resisted", sourceItem: item("surge") });
  assert.equal(actor.system.attributes.hp.value, 4);
});
test("Surge uses the paid dice and metric units, preserves temp HP, and repeats never add another effect or action", async () => {
  await actor.update({ "system.attributes.movement.units": "m", "system.attributes.movement.walk": 9 });
  dice.push([4]);
  await use("surge", "surge-a");
  const e = actor.effects.find(e => benefitData(e)?.flagellantTechnique?.kind === "surge");
  assert.equal(e.system.changes[0].value, String(20 * 0.3048));
  assert.equal(actor.system.attributes.hp.value, 36);
  await use("surge", "surge-a");
  assert.equal(nativeCalls.length, 1);
  assert.equal(e.duration.value, null, "outside combat do not invent a six-second duration");
});
test("Endurance recalculates biggest versus half sum on live recipient HP and does not overwrite a hand edit", async () => {
  await actor.update({ "system.attributes.hp.value": 28 });
  answers.push("yes");
  dice.push([2, 6]);
  await use("endurance", "endure-a");
  const e = actor.effects.find(e => benefitData(e)?.flagellantTechnique?.kind === "endurance");
  assert.equal(actor.system.attributes.hp.value, 20);
  assert.equal(e.system.changes[0].value, "6");
  await actor.update({ "system.attributes.hp.value": 60 });
  await syncFlagellant(actor);
  assert.equal(e.system.changes[0].value, "4");
  await e.update({ "system.changes": [{ key: "manual", value: "9" }] });
  await syncFlagellant(actor);
  assert.equal(e.system.changes[0].value, "9");
});
test("a successful new technique replaces the old one, but failed payment leaves the previous technique intact", async () => {
  dice.push([3]);
  await use("surge");
  const prior = actor.effects.find(e => benefitData(e)?.flagellantTechnique);
  await actor.update({ "system.attributes.hp.value": 2 });
  answers.push("yes");
  dice.push([4, 4]);
  await use("endurance");
  assert.ok(actor.effects.includes(prior));
});
test("Lesson uses donor pain dice, recipient thresholds/price and target-start Endurance without spending a new Attack action", async () => {
  await target.actor.update({ "system.attributes.hp.value": 22 });
  answers.push("yes", [target.uuid], "yes", "endurance");
  dice.push([2, 4]);
  await use("lesson");
  assert.equal(actor.system.attributes.hp.value, 40);
  assert.equal(target.actor.system.attributes.hp.value, 16);
  const e = target.actor.effects.find(e => benefitData(e)?.flagellantTechnique);
  assert.equal(e.system.changes[0].value, "4");
  assert.equal(benefitData(e).expiry, "targetStart");
  assert.equal(benefitData(e).flagellantTechnique.side, 12);
  assert.equal(nativeCalls[0].activity.activation.type, "special");
});
test("Lesson consent cancellation, invalid distance, and zero-HP recipient do not grant buffs", async () => {
  answers.push("yes", [target.uuid], "no");
  assert.equal((await use("lesson")).status, "cancelled");
  assert.equal(nativeCalls.length, 0);
  await target.actor.update({ "system.attributes.hp.value": 2 });
  answers.push("yes", [target.uuid], "yes", "surge");
  dice.push([5]);
  await use("lesson");
  assert.equal(target.actor.system.attributes.hp.value, 0);
  assert.ok(!target.actor.effects.some(e => benefitData(e)?.flagellantTechnique));
});
test("borrowed Onslaught needs no class, gives its own temporary button and deletes only that button on expiry", async () => {
  installFlagellantHooks();
  await grantFlagellantTechnique(
    source,
    target,
    item("lesson"),
    "onslaught",
    { amount: 5, values: [5], side: 12 },
    { borrowed: true }
  );
  const e = target.actor.effects.find(e => benefitData(e)?.flagellantTechnique);
  const card = target.actor.items.find(i => i.getFlag(MODULE_ID, "flagellantBorrowed") === e.uuid);
  assert.ok(card);
  assert.equal(flagellantAvailable(target.actor, card), true);
  await e.delete();
  await flush();
  assert.ok(!target.actor.items.includes(card));
  assert.ok(target.actor.items.includes(item("onslaught", target.actor)));
});
test("Gift of blood pays original amount once, heals a different ally natively, and never turns price into damage", async () => {
  answers.push([target.uuid], "yes", 2);
  dice.push([3, 5]);
  await use("blood-gift");
  assert.equal(actor.system.attributes.hp.value, 32);
  assert.equal(actor.system.attributes.hp.temp, 20);
  assert.equal(target.actor.system.attributes.hp.value, 48);
  assert.equal(nativeCalls[0].activity.activation.type, "action");
  assert.equal(nativeCalls[1].activity.type, "heal");
  assert.equal(nativeCalls[1].config.consume.resources, false);
});
test("Gift that reduces donor to zero does not heal and the action remains spent", async () => {
  await actor.update({ "system.attributes.hp.value": 3 });
  answers.push([target.uuid], "yes", 1);
  dice.push([4]);
  await use("blood-gift");
  assert.equal(actor.system.attributes.hp.value, 0);
  assert.equal(target.actor.system.attributes.hp.value, 40);
  assert.equal(nativeCalls.length, 1);
});
test("sacrificial ability/cap increase is once, maximum penalty grows with total level and preserves minimum one", async () => {
  answers.push("dex");
  await requestGm("flagellant-sacrifice", actor, { itemUuid: item("sacrifice").uuid });
  assert.equal(actor._source.system.abilities.dex.value, 21);
  assert.equal(actor._source.system.abilities.dex.max, 23);
  assert.equal(flagellantMaximum(actor), 90);
  await actor.update({ "system.details.level": 12 });
  await syncFlagellant(actor);
  assert.equal(flagellantMaximum(actor), 88);
  await requestGm("flagellant-sacrifice", actor, { itemUuid: item("sacrifice").uuid });
  assert.equal(actor._source.system.abilities.dex.value, 21);
  await actor.update({ "system.attributes.hp.max": 8 });
  await syncFlagellant(actor);
  assert.equal(flagellantMaximum(actor), 1);
});
test("feat alternative cannot also grant ability or maximum HP penalty", async () => {
  answers.push("feat");
  await requestGm("flagellant-sacrifice", actor, { itemUuid: item("sacrifice").uuid });
  await syncFlagellant(actor);
  assert.equal(actor._source.system.abilities.dex.value, 18);
  assert.equal(flagellantMaximum(actor), 100);
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "flagellantPassive") === "max-loss"));
});
test("changing class levels cannot keep the permanent +3 while silently removing its paid HP penalty", async () => {
  answers.push("dex");
  await requestGm("flagellant-sacrifice", actor, { itemUuid: item("sacrifice").uuid });
  actor.items[0].system.levels = 3;
  await syncFlagellant(actor);
  assert.equal(actor._source.system.abilities.dex.value, 21);
  assert.equal(flagellantMaximum(actor), 90);
});
test("Through force has proficiency uses, a single actual price, and no future-save passive; zero-price failure does not refund use", async () => {
  await syncFlagellant(actor);
  assert.equal(item("force").system.uses.max, "4");
  answers.push("yes", "yes");
  dice.push([4]);
  await use("force", "force-a");
  assert.equal(item("force").system.uses.spent, 1);
  assert.equal(actor.system.attributes.hp.value, 36);
  await use("force", "force-a");
  assert.equal(item("force").system.uses.spent, 1);
  await actor.update({ "system.attributes.hp.value": 2 });
  answers.push("yes");
  dice.push([3]);
  await use("force");
  assert.equal(item("force").system.uses.spent, 2);
  assert.equal(actor.system.attributes.hp.value, 0);
  assert.equal(nativeCalls[0].activity.activation.type, "special");
});
test("Retaliation counts actual real HP once, including prices, not temp-only loss or mere max reduction; concurrent changes sum exactly", async () => {
  installFlagellantHooks();
  const c = combat();
  await use("retribution");
  const e = actor.effects.find(e => benefitData(e)?.kind === "flagellant-retribution");
  seedFlagellantTracking();
  await Promise.all([
    recordFlagellantHpLoss(actor, 40, 35, { id: "a" }),
    recordFlagellantHpLoss(actor, 35, 32, { id: "b" })
  ]);
  assert.equal(benefitData(e).accumulated, 8);
  await recordFlagellantHpLoss(actor, 40, 35, { id: "a" });
  assert.equal(benefitData(e).accumulated, 8);
  await actor.update({ "system.attributes.hp.temp": 5 });
  assert.equal(benefitData(e).accumulated, 8);
  c.previous = { round: 1, turn: 1 };
  c.round = 2;
  c.turn = 0;
  c.combatant = c.turns[0];
  const records = captureFlagellantTurn(c, { round: 2, turn: 0 });
  assert.equal(records[0].input.amount, 8);
});
test("GM-side HP snapshot detects player changes without local preUpdate, and duplicate update cannot record another loss", async () => {
  installFlagellantHooks();
  await use("retribution");
  seedFlagellantTracking();
  await actor.update({ "system.attributes.hp.value": 35 });
  await flush();
  const e = actor.effects.find(e => benefitData(e)?.kind === "flagellant-retribution");
  assert.equal(benefitData(e).accumulated, 5);
  await observeFlagellantHp(actor, { "system.attributes.hp.value": 35 });
  assert.equal(benefitData(e).accumulated, 5);
});
test("Retaliation turn snapshot survives effect cleanup, uses CON/no damage on save, and scopes thirst disadvantage", async () => {
  const c = combat();
  await use("retribution");
  const e = actor.effects.find(e => benefitData(e)?.kind === "flagellant-retribution");
  await recordFlagellantHpLoss(actor, 40, 33, { id: "retaliation-loss" });
  await actor.update({ "system.attributes.hp.value": 20 });
  c.previous = { round: 1, turn: 1 };
  c.round = 2;
  c.turn = 0;
  c.combatant = c.turns[0];
  const record = captureFlagellantTurn(c, { turn: 0, round: 2 })[0];
  assert.equal(record.input.thirst, true);
  await cleanupCombatBenefits(c, { turn: 0, round: 2 });
  assert.ok(!actor.effects.includes(e));
  answers.push("yes", [target.uuid], "yes");
  MidiQOL.completeActivityUse = async (a, config) => {
    nativeCalls.push({ activity: a, config });
    return { saves: new Set([target]), failedSaves: new Set() };
  };
  await releaseFlagellantRetribution(record);
  assert.equal(nativeCalls.at(-1).activity.damage.onSave, "none");
  assert.equal(nativeCalls.at(-1).activity.save.ability[0], "con");
  const details = {};
  applyFlagellantRetributionSave(target, { activity: nativeCalls.at(-1).activity }, details);
  assert.equal(details.disadvantage, true);
  const ordinary = {};
  applyFlagellantRetributionSave(target, { activity: activity("blood-gift") }, ordinary);
  assert.equal(ordinary.disadvantage, undefined);
});
test("HP loss Feast heals once through Midi after optional sight approval; mere max/temporary changes do not feed it", async () => {
  installFlagellantHooks();
  await use("feast");
  seedFlagellantTracking();
  answers.push("yes");
  dice.push([4]);
  await recordFlagellantHpLoss(target.actor, 40, 35, { id: "victim-loss" });
  assert.equal(actor.system.attributes.hp.value, 44);
  await recordFlagellantHpLoss(target.actor, 40, 35, { id: "victim-loss" });
  assert.equal(actor.system.attributes.hp.value, 44);
  await actor.update({ "system.attributes.hp.temp": 1 });
  assert.equal(messages.length, 1);
});
test("Feast does not force optional healing, ignore sight, or reveal a hidden victim to a player", async () => {
  installFlagellantHooks();
  await use("feast");
  answers.push("no");
  await recordFlagellantHpLoss(target.actor, 40, 35, { id: "declined" });
  assert.equal(actor.system.attributes.hp.value, 40);
  actor.statuses.add("unconscious");
  await recordFlagellantHpLoss(target.actor, 35, 30, { id: "cannot-see" });
  assert.equal(actor.system.attributes.hp.value, 40);
  actor.statuses.clear();
  game.users.push({ id: "player", active: true, isGM: false });
  target.hidden = true;
  target.actor.testUserPermission = () => false;
  await recordFlagellantHpLoss(target.actor, 30, 25, { id: "hidden" });
  assert.equal(prompts.length, 1);
});
test("Feast off-scene loss is queued, not rolled retroactively or paid by a second GM", async () => {
  installFlagellantHooks();
  await use("feast");
  canvas.scene = { id: "elsewhere" };
  await recordFlagellantHpLoss(target.actor, 40, 35, { id: "offscene" });
  assert.equal(journal.events.at(-1).state, "queued");
  assert.equal(messages.length, 0);
  game.user = { id: "gm2", isGM: true };
  assert.equal(await recordFlagellantHpLoss(target.actor, 35, 30, { id: "gm2" }), false);
});
test("Onslaught chooses one confirmed target/type from own-turn attack/spell, preserves base damage, and avoids price/bonus replay", async () => {
  const c = combat();
  await actor.setFlag(MODULE_ID, "flagellantApplications", [
    {
      id: "hit",
      name: "Sword",
      turn: turnKey(c),
      sourceUuid: source.uuid,
      used: false,
      targets: [{ uuid: target.uuid, types: ["slashing"] }]
    }
  ]);
  answers.push("hit", [target.uuid], "none");
  dice.push([5]);
  await use("onslaught", "onslaught-a");
  assert.equal(actor.system.attributes.hp.value, 35);
  assert.equal(nativeCalls.at(-1).activity.damage.parts[0].custom.formula, "5");
  assert.equal(nativeCalls.at(-1).activity.damage.parts[0].types[0], "slashing");
  const count = nativeCalls.length;
  await use("onslaught", "onslaught-a");
  assert.equal(nativeCalls.length, count);
});
test("extra Hit Die is consumed natively without healing or adding CON modifier to the bonus", async () => {
  const c = combat();
  await actor.setFlag(MODULE_ID, "flagellantApplications", [
    {
      id: "hit-hd",
      name: "Spell",
      turn: turnKey(c),
      sourceUuid: source.uuid,
      used: false,
      targets: [{ uuid: target.uuid, types: ["fire"] }]
    }
  ]);
  answers.push("hit-hd", [target.uuid], "d10");
  dice.push([3], [6]);
  await use("onslaught");
  assert.equal(actor.items[0].system.hd.spent, 1);
  assert.equal(actor.system.attributes.hp.value, 37);
  assert.equal(nativeCalls.at(-1).activity.damage.parts[0].custom.formula, "9");
  assert.ok(!nativeCalls.some(c => c.activity.type === "heal"));
  assert.deepEqual(flagellantHitDice(actor), ["d10"]);
});
test("borrowed Onslaught ignores earlier damage, uses first later application without another price, and keeps source UUID through native damage", async () => {
  installFlagellantHooks();
  const c = combat(),
    recipient = target.actor;
  c.turn = 1;
  c.combatant = c.turns[1];
  await recipient.update({ "system.attributes.hp.value": 80 });
  const old = {
    id: "old",
    name: "Earlier",
    turn: turnKey(c),
    sourceUuid: target.uuid,
    used: false,
    targets: [{ uuid: source.uuid, types: ["fire"] }]
  };
  await recipient.setFlag(MODULE_ID, "flagellantApplications", [old]);
  await grantFlagellantTechnique(
    source,
    target,
    item("lesson"),
    "onslaught",
    { amount: 8, values: [8], side: 12 },
    { borrowed: true }
  );
  const e = recipient.effects.find(e => benefitData(e)?.flagellantTechnique),
    card = recipient.items.find(i => i.getFlag(MODULE_ID, "flagellantBorrowed") === e.uuid),
    a = [...card.system.activities.values()][0];
  await recipient.setFlag(MODULE_ID, "flagellantApplications", [
    old,
    { ...old, id: "next", name: "Next" },
    { ...old, id: "later", name: "Later" }
  ]);
  answers.push("old");
  assert.equal(
    (await requestGm("flagellant-action", recipient, { activityUuid: a.uuid, sourceUuid: target.uuid })).status,
    "cancelled"
  );
  assert.equal(nativeCalls.length, 0);
  const normal = native;
  MidiQOL.completeActivityUse = async (activity, config) => {
    if (activity.type === "damage") {
      assert.ok(await fromUuid(activity.uuid), "do not delete source before Midi's UUID lookup");
      const reply = await requestGm("prepare-damage-event", recipient, {
        key: "loan-source-proof",
        workflowId: "bonus",
        activityUuid: activity.uuid,
        attackerUuid: target.uuid,
        targetUuid: source.uuid,
        automatic: true,
        damageType: "fire",
        eligibleTargetUuids: [source.uuid]
      });
      assert.equal(reply.status, "success");
    }
    return normal(activity, config);
  };
  answers.push("next", [source.uuid]);
  const result = await requestGm("flagellant-action", recipient, { activityUuid: a.uuid, sourceUuid: target.uuid });
  assert.equal(result.status, "success");
  assert.equal(recipient.system.attributes.hp.value, 80);
  assert.equal(nativeCalls.at(-1).activity.damage.parts[0].custom.formula, "8");
  await flush();
  assert.ok(!recipient.items.includes(card));
});
test("opportunity protection only blocks marked movement OA during active Surge/Taste; ordinary attack still proceeds", async () => {
  dice.push([3]);
  await use("surge");
  const weapon = owned(
      {
        _id: "enemy-sword",
        type: "weapon",
        name: "Sword",
        system: { activities: { a: { type: "attack", attack: { type: { value: "melee" } }, flags: {} } } }
      },
      target.actor
    ),
    a = weapon.system.activities.get("a");
  target.actor.items.push(weapon);
  const data = {
    activityUuid: a.uuid,
    attackerUuid: target.uuid,
    targetUuid: source.uuid,
    workflowId: "oa",
    opportunity: true
  };
  const blocked = await requestGm("combat-attack-benefits", target.actor, data);
  assert.ok(blocked.results.some(r => r.kind === "prevent-attack"));
  answers.push("no");
  const ordinary = await requestGm("combat-attack-benefits", target.actor, {
    ...data,
    workflowId: "ordinary",
    opportunity: false
  });
  assert.ok(!ordinary.results.some(r => r.kind === "prevent-attack"));
});
test("partial max loss at one HP does not add to Retaliation or feed Feast when current HP is unchanged", async () => {
  installFlagellantHooks();
  combat();
  await actor.update({ "system.attributes.hp.value": 1 });
  await use("retribution");
  await use("feast");
  seedFlagellantTracking();
  await payFlagellantPrice(actor, 4, { id: "max-only", sourceItem: item("surge") });
  await flush();
  const state = actor.effects.find(e => benefitData(e)?.kind === "flagellant-retribution");
  assert.equal(benefitData(state).accumulated, 0);
  assert.equal(messages.length, 0);
  assert.equal(actor.system.attributes.hp.value, 1);
});
test("confirmed damage collector records real supported applications for later target selection, but not auras or outside-turn sources", async () => {
  await emitConfirmedDamage(target.actor, 3, {
    [MODULE_ID]: {
      damageEvent: {
        key: "ff-proof",
        workflowId: "wf",
        sourceActorUuid: actor.uuid,
        sourceTokenUuid: source.uuid,
        targetTokenUuid: target.uuid,
        sceneId: "one",
        damageTypes: ["fire"],
        flagellantApplication: { id: "wf", turn: "combat:1:0", own: true, name: "Spell" }
      }
    }
  });
  assert.equal(actor.getFlag(MODULE_ID, "flagellantApplications")[0].targets[0].types[0], "fire");
  await emitConfirmedDamage(target.actor, 3, {
    [MODULE_ID]: {
      damageEvent: {
        key: "ff-not-own",
        sourceActorUuid: actor.uuid,
        sourceTokenUuid: source.uuid,
        targetTokenUuid: target.uuid,
        sceneId: "one",
        flagellantApplication: { id: "outside", own: false }
      }
    }
  });
  assert.equal(actor.getFlag(MODULE_ID, "flagellantApplications").length, 1);
});
test("native cancellation occurs before rolling or paying price; no unsupported passive templates exist", async () => {
  MidiQOL.completeActivityUse = async () => false;
  const result = await use("surge");
  assert.equal(result.status, "cancelled");
  assert.equal(actor.system.attributes.hp.value, 40);
  assert.equal(messages.length, 0);
  assert.equal(actor.effects.length, 0);
});
test("player rest routes to GM for a classless recipient and clears only its debt, not permanently chosen sacrifice", async () => {
  await target.actor.update({ "system.attributes.hp.value": 1 });
  await payFlagellantPrice(target.actor, 4, { id: "rest-debt", sourceItem: item("lesson") });
  const gm = game.user,
    player = { id: "rest-player", isGM: false, active: false };
  game.users.push(player);
  const socket = [];
  game.socket = { on() {}, emit: (_name, value) => socket.push(value) };
  game.user = player;
  const waiting = flagellantRestCompleted(target.actor, { type: "long", flagellantRestId: "classless-rest" });
  game.user = gm;
  answers.push("no");
  await receiveGmRequest(socket[0], player.id);
  game.user = player;
  await receiveGmRequest(socket[1], gm.id);
  assert.equal((await waiting).status, "success");
  assert.equal(flagellantMaximum(target.actor), 100);
  assert.equal(target.actor.system.attributes.hp.value, 1);
});
test("all hooks are actually registered and manual/disabled mechanics are preserved", async () => {
  installFlagellantHooks();
  for (const name of [
    "midi-qol.preTargetingV2",
    "midi-qol.preTargetSave",
    "dnd5e.restCompleted",
    "updateActor",
    "updateToken",
    "updateCombat",
    "deleteActiveEffect"
  ])
    assert.ok(
      hooks.get(name)?.every(fn => typeof fn === "function"),
      name
    );
  const data = flagellantExpense(activity("force"), { use: true });
  assert.equal(data.activation.type, "special");
  assert.equal(data.consumption.targets[0].value, "1");
  game.settings.get = () => false;
  await syncFlagellant(actor);
  assert.equal(actor.effects.length, 0);
});
test("short Flagellant technique names never turn unrelated class text into false cross-class links", () => {
  const body = "<p>Натиск, Стойкость, Исступление.</p>",
    old = { _id: "unrelated", system: { description: { value: body } } },
    own = { _id: "own", flags: { [MODULE_ID]: { flagellantFeature: true } }, system: { description: { value: body } } };
  linkDocumentDescriptions([{ name: "features", documents: [...structuredClone(flagellantDocuments), old, own] }]);
  assert.equal(old.system.description.value, body);
  assert.ok(own.system.description.value.includes("@UUID["));
});
