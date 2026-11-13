import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import { MODULE_ID, SETTINGS, FLAGS } from "../scripts/automation/shared/constants.mjs";
import {
  DOOMED_CURSES,
  DOOMED_FEATURES,
  doomedSlots,
  doomedCritical
} from "../scripts/automation/shared/doomed-definitions.mjs";
import {
  doomedLevel,
  doomedState,
  doomedAccepted,
  doomedOccupied,
  doomedCapacity,
  doomedDC,
  doomedCurseActive,
  doomedGiftActive,
  doomedEmpowered
} from "../scripts/automation/shared/doomed-state.mjs";
import { doomedDocuments } from "../src/packs/doomed-features.mjs";
import { doomedClassDocuments } from "../src/packs/doomed-class.mjs";
import { doomedSection } from "../src/doomed-data.mjs";
import {
  doomedAvailable,
  doomedPassiveDefinitions,
  syncDoomed,
  doomedPrerequisiteFailures,
  validateDoomedItem,
  prepareDoomedRest,
  doomedRestCompleted
} from "../scripts/automation/classes/doomed.mjs";
import {
  doomedExpense,
  suppressDoomedGift,
  doomedTransferredChanges
} from "../scripts/automation/classes/doomed-actions.mjs";
import {
  applyDoomedAttackConfig,
  applyDoomedDeathSave,
  applyDoomedHealthRules,
  prepareDoomedHealing,
  blockDoomedActivity,
  recordDoomedDamage,
  doomedOutcastAttack,
  handleDoomedInitiative,
  endDoomedInvisibility,
  installDoomedHooks
} from "../scripts/automation/classes/doomed-events.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { AURA_DEFINITIONS } from "../scripts/automation/shared/aura-definitions.mjs";
import { processRepeatedSaves } from "../scripts/automation/effects/repeated-saves.mjs";
import { benefitData } from "../scripts/automation/shared/combat-benefits.mjs";
import { linkDocumentDescriptions as linkPackDescriptions } from "../tools/link-descriptions.mjs";

let docs, actor, source, target, answers, prompts, calls, messages, hooks, seq, nativeResult;
function patch(raw, updates) {
  const out = structuredClone(raw);
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes(".")) {
      const parts = key.split("."),
        last = parts.pop();
      let cursor = out;
      for (const part of parts) cursor = cursor[part] ??= {};
      if (last.startsWith("-=")) delete cursor[last.slice(2)];
      else cursor[last] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) out[key] = patch(out[key] ?? {}, value);
    else out[key] = structuredClone(value);
  }
  return out;
}
function owned(data, owner, register = true) {
  let raw = structuredClone(data);
  raw._id ??= `item${++seq}`;
  const item = {
    id: raw._id,
    actor: owner,
    parent: owner,
    uuid: `${owner.uuid}.Item.${raw._id}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: updates => owned(patch(raw, updates), owner, false),
    async update(updates) {
      raw = patch(raw, updates);
      refresh();
      owner.prepare();
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
  if (register) {
    docs.set(item.uuid, item);
    for (const a of item.system.activities.values()) docs.set(a.uuid, a);
  }
  return item;
}
function effect(data, owner) {
  let raw = structuredClone(data);
  const e = {
    id: `effect${++seq}`,
    parent: owner,
    uuid: `${owner.uuid}.ActiveEffect.e${seq}`,
    toObject: () => structuredClone(raw),
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    clone: updates => ({ toObject: () => patch(raw, updates), ...patch(raw, updates) }),
    async setFlag(m, k, v) {
      return this.update({ [`flags.${m}.${k}`]: v });
    },
    async update(updates) {
      raw = patch(raw, updates);
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
function makeActor(level = 5, id = "doomed") {
  let raw = {
    system: {
      details: { level: 10 },
      attributes: {
        prof: 4,
        hp: { value: 20, max: 40, tempmax: 0, temp: 0 },
        movement: { walk: 30, fly: 0, units: "ft" },
        senses: { units: "ft" }
      },
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 18, mod: 4, max: null }])
      )
    },
    flags: { [MODULE_ID]: { doomedState: { ability: "wis", accepted: [], suppressed: [], freeLevels: [] } } }
  };
  const a = {
    id,
    uuid: `Actor.${id}`,
    documentName: "Actor",
    name: id,
    isOwner: true,
    items: [],
    effects: [],
    statuses: new Set(),
    testUserPermission: () => true,
    getFlag: (m, k) => raw.flags?.[m]?.[k],
    getRollData: () => structuredClone(a.system),
    prepare() {
      a._source = structuredClone(raw);
      a.flags = raw.flags;
      a.system = structuredClone(raw.system);
      let offset = 0;
      for (const e of a.effects)
        if (!e.disabled && !e.isSuppressed && !e.duration?.expired)
          for (const c of e.system?.changes ?? [])
            if (c.key === "system.attributes.hp.tempmax") offset += Number(c.value);
      a.system.attributes.hp.tempmax += offset;
      a.system.attributes.hp.effectiveMax = Math.max(1, a.system.attributes.hp.max + a.system.attributes.hp.tempmax);
      a.system.attributes.hp.value = Math.min(a.system.attributes.hp.value, a.system.attributes.hp.effectiveMax);
    },
    async update(updates) {
      raw = patch(raw, updates);
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
      const created = rows.map(row => (type === "Item" ? owned(row, this) : effect(row, this)));
      this[type === "Item" ? "items" : "effects"].push(...created);
      this.prepare();
      return created;
    },
    async updateEmbeddedDocuments(type, rows) {
      const list = this[type === "Item" ? "items" : "effects"];
      for (const row of rows) await list.find(e => e.id === row._id)?.update(row);
      return rows;
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (type === "ActiveEffect")
        for (const e of [...this.effects])
          if (ids.includes(e.id)) await e.delete();
          else {
          }
      else this.items = this.items.filter(i => !ids.includes(i.id));
    },
    async endConcentration() {
      this.endedConcentration = true;
    }
  };
  a.prepare();
  a.items = [
    { type: "class", system: { identifier: "doomed", levels: level } },
    ...doomedDocuments.map(row => owned(row, a))
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  docs.set(a.uuid, a);
  return a;
}
const item = id => actor.items.find(row => row.system.identifier === `doomed-${id}`),
  curse = id => item(`curse-${id}`),
  activity = (id, op) =>
    [...item(id).system.activities.values()].find(row => !op || row.flags?.[MODULE_ID]?.doomedOperation === op);
function token(a, id, x = 0) {
  const t = {
    id,
    uuid: `Scene.one.Token.${id}`,
    parent: canvas.scene,
    actor: a,
    name: id,
    x,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    disposition: 1,
    hidden: false
  };
  canvas.scene.tokens.push(t);
  docs.set(t.uuid, t);
  return t;
}
async function accept(...ids) {
  await actor.setFlag(MODULE_ID, "doomedState", { ...structuredClone(doomedState(actor)), accepted: ids });
  await syncDoomed(actor);
}
function combat(turn = 0) {
  const entries = [source, target].map((t, i) => ({ id: `c${i}`, token: t, actor: t.actor })),
    c = { id: "c", started: true, round: 1, turn, turns: entries, combatants: entries, combatant: entries[turn] };
  game.combat = c;
  game.combats = [c];
  return c;
}
async function use(id, op, requestId = `use-${++seq}`) {
  return requestGm(
    "doomed-action",
    actor,
    { activityUuid: activity(id, op).uuid, sourceUuid: source.uuid },
    { requestId }
  );
}
async function native(a, config) {
  calls.push({ activity: a, config });
  if (nativeResult !== "normal") return nativeResult;
  for (const cost of a.consumption?.targets ?? []) {
    const original = cost.target ? a.actor.items.get(cost.target) : a.actor.items.get(a.item.id);
    await original.update({ "system.uses.spent": Number(original.system.uses.spent) + Number(cost.value) });
  }
  if (a.type === "save") {
    const failedSaves = new Set((config.midiOptions.targetUuids ?? []).map(uuid => ({ document: docs.get(uuid) })));
    return { saves: new Set(), failedSaves };
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
  nativeResult = "normal";
  const gm = { id: "gm", isGM: true, active: true },
    users = [gm];
  users.activeGM = gm;
  users.get = id => users.find(user => user.id === id);
  globalThis.game = {
    user: gm,
    users,
    time: { worldTime: 0 },
    settings: { get: (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES },
    combats: [],
    modules: new Map([["midi-qol", { active: true }]]),
    packs: new Map()
  };
  globalThis.canvas = {
    ready: true,
    scene: { id: "one", uuid: "Scene.one", grid: { size: 100, distance: 5, units: "ft" }, tokens: [] },
    tokens: { placeables: [] }
  };
  canvas.scene.tokens.get = id => canvas.scene.tokens.find(t => t.id === id);
  game.scenes = [canvas.scene];
  game.scenes.get = id => game.scenes.find(s => s.id === id);
  globalThis.foundry = {
    utils: { randomID: () => `doomed-${++seq}`, escapeHTML: String },
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
  globalThis.Hooks = { on: (key, fn) => hooks.set(key, [...(hooks.get(key) ?? []), fn]) };
  globalThis.CONFIG = {
    DND5E: { maxAbilityScore: 20, abilities: {} },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: game.time.worldTime }) } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }
    async evaluate() {
      this.total = Number(this.formula) || 12;
      return this;
    }
    async toMessage(data) {
      messages.push({ ...data, formula: this.formula, total: this.total });
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    create: async data => messages.push(data)
  };
  class Workflow {
    constructor(actor, activity, speaker, targets, options) {
      Object.assign(this, { actor, activity, targets, workflowOptions: options.workflowOptions });
    }
  }
  globalThis.MidiQOL = { Workflow, TrapWorkflow: class extends Workflow {}, completeActivityUse: native };
  actor = makeActor();
  target = token(makeActor(0, "target"), "target", 400);
  source = token(actor, "source");
  canvas.tokens.placeables = [
    { actor, document: source },
    { actor: target.actor, document: target }
  ];
  game.actors = [actor, target.actor];
  game.actors.get = id => game.actors.find(a => a.id === id);
  const journal = {
    events: [],
    getFlag: (_m, k) => (k === "automationLedger" ? true : journal[k]),
    async setFlag(_m, k, value) {
      journal[k] = structuredClone(value);
    }
  };
  game.journal = [journal];
  game.packs.set(`${MODULE_ID}.features`, {
    getIndex: async () => doomedDocuments,
    getDocument: async id => ({ toObject: () => structuredClone(doomedDocuments.find(d => d._id === id)) })
  });
});

test("all 23 curses and nine features preserve source rules, costs, links and distinct native IDs", async () => {
  const text = await readFile(new URL("../src/content/doomed.md", import.meta.url), "utf8");
  assert.match(text, /половину урона каждого типа/);
  assert.equal(DOOMED_CURSES.length, 23);
  assert.equal(DOOMED_FEATURES.length, 9);
  assert.equal(doomedDocuments.length, 32);
  assert.equal(new Set(doomedDocuments.map(d => d._id)).size, 32);
  for (const entry of [...DOOMED_FEATURES, ...DOOMED_CURSES]) {
    assert.ok(doomedSection(entry.name).length > 100);
    assert.ok(
      doomedDocuments
        .find(d => d.system.identifier === entry.key)
        .system.description.value.includes("Автоматизация Foundry:")
    );
  }
  assert.ok(doomedDocuments.every(d => !d.effects.length));
  const c = doomedClassDocuments[0];
  assert.equal(c.system.hitDice, "d8");
  assert.equal(c.system.spellcasting.progression, "none");
  assert.match(c.system.description.value, /@UUID\[/);
  assert.deepEqual(
    c.system.advancement.filter(a => a.type === "ItemGrant").map(a => [a.level, a.configuration.items.length]),
    [
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 1],
      [5, 2]
    ]
  );
  assert.ok(!c.system.advancement.some(a => a.type === "ItemChoice"));
});
test("capacity follows exact 2/4/6/8/10 progression; duplicate/unknown flags do not multiply slots", async () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 7].map(doomedSlots), [0, 2, 4, 6, 8, 10, 10]);
  await accept("bones", "bones", "chains", "unknown");
  assert.equal(doomedOccupied(actor), 5);
  assert.deepEqual(doomedCapacity(actor), { maximum: 10, occupied: 5 });
});
test("requirements use incoming total level and optional strict setting", async () => {
  await actor.update({ "system.details.level": 4 });
  assert.deepEqual(doomedPrerequisiteFailures(actor), []);
  await actor.update({
    "system.details.level": 3,
    "system.abilities.con.value": 15,
    "system.abilities.wis.value": 15,
    "system.abilities.cha.value": 15
  });
  assert.equal(doomedPrerequisiteFailures(actor).length, 3);
  const c = { type: "class", system: { identifier: "doomed", levels: 1 }, parent: actor };
  assert.equal(validateDoomedItem(c, {}, {}, "gm"), undefined);
  game.settings.get = () => true;
  assert.equal(validateDoomedItem(c, {}, {}, "gm"), false);
});
test("corruption ability is eligible, immutable and cancellation makes no choice", async () => {
  await actor.setFlag(MODULE_ID, "doomedState", { accepted: [] });
  answers.push(null);
  assert.equal((await use("curses", "ability")).status, "cancelled");
  assert.equal(doomedDC(actor), null);
  answers.push("cha");
  await use("curses", "ability");
  assert.equal(doomedDC(actor), 16);
  answers.push("wis");
  await use("curses", "ability");
  assert.equal(doomedState(actor).ability, "cha");
});
test("importing all curse cards does not accept curses or create passive effects", async () => {
  await syncDoomed(actor);
  assert.equal(actor.effects.length, 0);
  assert.equal(doomedOccupied(actor), 0);
  assert.equal(doomedAvailable(actor, curse("bones")), false);
});
test("accepted curse actually creates boon and drawback on Actor, not Item", async () => {
  await accept("bones");
  assert.equal(actor.effects.length, 2);
  assert.ok(
    actor.effects.some(e => e.system.changes.some(c => c.key === "system.traits.dv.value" && c.value === "bludgeoning"))
  );
  assert.ok(
    actor.effects.some(e => e.system.changes.some(c => c.key === "system.attributes.movement.fly" && c.value === "30"))
  );
});
test("accept checks capacity, uses a native action and cancellation/replay do not accept twice", async () => {
  actor.items[0].system.levels = 1;
  answers.push("bones");
  const result = await use("curses", "accept", "accept-a");
  assert.equal(result.status, "success");
  assert.equal(doomedOccupied(actor), 2);
  assert.equal(calls[0].activity.activation.type, "action");
  assert.equal(calls[0].activity.consumption.targets.length, 0);
  await use("curses", "accept", "accept-a");
  assert.equal(calls.length, 1);
  assert.equal((await use("curses", "accept")).status, "cancelled");
  assert.equal(doomedOccupied(actor), 2);
});
test("accept cancellation and cancelled native expense leave no curse or effects", async () => {
  answers.push(null);
  await use("curses", "accept");
  assert.equal(calls.length, 0);
  answers.push("heart");
  nativeResult = false;
  await use("curses", "accept");
  assert.equal(doomedAccepted(actor).length, 0);
  assert.equal(actor.effects.length, 0);
});
test("a missing owned curse card is fetched from compendium instead of granting every option", async () => {
  actor.items = actor.items.filter(i => i.system.identifier !== "doomed-curse-heart");
  actor.items.get = id => actor.items.find(i => i.id === id);
  answers.push("heart");
  assert.equal((await use("curses", "accept")).status, "success");
  assert.ok(curse("heart"));
  assert.deepEqual(
    doomedAccepted(actor).map(e => e.id),
    ["heart"]
  );
});
test("suppression disables only gift; drawback and occupied slots persist", async () => {
  await accept("bones");
  await suppressDoomedGift(actor, "bones");
  assert.equal(doomedOccupied(actor), 2);
  assert.equal(doomedGiftActive(actor, "bones"), false);
  assert.equal(actor.effects.length, 2);
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:curse").disabled, false);
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:gift").disabled, true);
});
test("manual disabled/edited passives survive repeated synchronization", async () => {
  await accept("bones");
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:gift");
  await e.update({
    disabled: true,
    "system.changes": [{ key: "system.attributes.movement.fly", value: "77", type: "override" }]
  });
  await syncDoomed(actor);
  await syncDoomed(actor);
  assert.ok(actor.effects.includes(e));
  assert.equal(e.disabled, true);
  assert.equal(e.system.changes[0].value, "77");
  assert.equal(doomedGiftActive(actor, "bones"), false);
});
test("suppression/rest preserve edited gift values and do not re-enable a manually disabled gift", async () => {
  await accept("bones");
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:gift");
  await e.update({
    disabled: true,
    "system.changes": [{ key: "system.attributes.movement.fly", value: "77", type: "override" }]
  });
  await suppressDoomedGift(actor, "bones");
  await doomedRestCompleted(actor, { type: "long", grimgutzDoomedRestId: "edited-gift" });
  assert.ok(actor.effects.includes(e));
  assert.equal(e.system.changes[0].value, "77");
  assert.equal(e.disabled, true);
});
test("enhancement changes only selected curse, persists one minute, cannot end/restart early, and replay is free", async () => {
  await accept("bones", "heart");
  answers.push("bones");
  assert.equal((await use("empower", null, "amp-a")).status, "success");
  assert.equal(item("empower").system.uses.spent, 1);
  assert.equal(doomedEmpowered(actor, "bones"), true);
  assert.equal(doomedEmpowered(actor, "heart"), false);
  assert.ok(
    actor.effects.some(e => e.system.changes.some(c => c.key === "system.attributes.movement.fly" && c.value === "60"))
  );
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "doomedAmplification")).duration.units, "seconds");
  await use("empower", null, "amp-a");
  assert.equal(calls.length, 1);
  await assert.rejects(use("empower"), /усиление ещё/);
  game.time.worldTime = 60;
  await syncDoomed(actor);
  assert.equal(doomedEmpowered(actor, "bones"), false);
  answers.push("heart");
  await use("empower");
  assert.equal(item("empower").system.uses.spent, 2);
});
test("suppressed empowered gift stops while empowered drawback stays", async () => {
  await accept("bones");
  answers.push("bones");
  await use("empower");
  await suppressDoomedGift(actor, "bones");
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:gift").disabled, true);
  assert.deepEqual(
    actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "bones:curse").system.changes.map(c => c.value),
    ["bludgeoning", "piercing", "slashing"]
  );
});
test("max HP combines gift and rot, clips once, never heals when curse is removed", async () => {
  await actor.update({ "system.attributes.hp.value": 40 });
  await accept("wounds", "flesh");
  assert.equal(actor.system.attributes.hp.effectiveMax, 30);
  assert.equal(actor._source.system.attributes.hp.value, 30);
  await accept("wounds");
  assert.equal(actor.system.attributes.hp.effectiveMax, 50);
  assert.equal(actor.system.attributes.hp.value, 30);
  assert.equal(actor._source.system.attributes.hp.max, 40);
});
test("combined maximum cannot drop below one and external maximum adjustments survive", async () => {
  await actor.update({
    "system.attributes.hp.max": 12,
    "system.attributes.hp.tempmax": 3,
    "system.attributes.hp.value": 12
  });
  await accept("flesh");
  assert.equal(actor.system.attributes.hp.effectiveMax, 1);
  assert.equal(actor._source.system.attributes.hp.tempmax, 3);
  await accept();
  assert.equal(actor.system.attributes.hp.effectiveMax, 15);
  assert.equal(actor.system.attributes.hp.value, 1);
});
test("Doomed synchronization never clamps raw HP of an unrelated actor", async () => {
  const other = target.actor;
  await other.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Other module",
      disabled: false,
      system: { changes: [{ key: "system.attributes.hp.tempmax", value: "-35" }] }
    }
  ]);
  assert.equal(other.system.attributes.hp.value, 5);
  await syncDoomed(other);
  assert.equal(other._source.system.attributes.hp.value, 20);
});
test("enhanced wounds add current HP only once; timer expiry cannot preserve a larger raw value", async () => {
  await accept("wounds");
  answers.push("wounds");
  await use("empower", null, "wounds-a");
  assert.equal(actor.system.attributes.hp.effectiveMax, 60);
  assert.equal(actor.system.attributes.hp.value, 30);
  await use("empower", null, "wounds-a");
  assert.equal(actor.system.attributes.hp.value, 30);
  await actor.update({ "system.attributes.hp.value": 60 });
  game.time.worldTime = 60;
  await syncDoomed(actor);
  assert.equal(actor._source.system.attributes.hp.value, 50);
  await accept();
  assert.equal(actor._source.system.attributes.hp.value, 40);
});
test("short rest only refills four core features at level five; long rest restores gifts before final full HP", async () => {
  await accept("wounds");
  await suppressDoomedGift(actor, "wounds");
  await item("endurance").update({ "system.uses.spent": 2 });
  await item("delayed-end").update({ "system.uses.spent": 1 });
  await doomedRestCompleted(actor, { type: "short", grimgutzDoomedRestId: "short" });
  assert.equal(item("endurance").system.uses.spent, 0);
  assert.equal(item("delayed-end").system.uses.spent, 1);
  assert.equal(doomedGiftActive(actor, "wounds"), false);
  const result = { type: "long", updateData: { "system.attributes.hp.value": 40 }, grimgutzDoomedRestId: "long" };
  prepareDoomedRest(actor, result, { type: "long" });
  await doomedRestCompleted(actor, result);
  assert.equal(doomedGiftActive(actor, "wounds"), true);
  assert.equal(actor.system.attributes.hp.value, 50);
  assert.equal(item("delayed-end").system.uses.spent, 0);
});
test("level four short rest does not refill core powers or suppressed gifts", async () => {
  actor.items[0].system.levels = 4;
  await accept("bones");
  await suppressDoomedGift(actor, "bones");
  await item("endurance").update({ "system.uses.spent": 2 });
  await doomedRestCompleted(actor, { type: "short", grimgutzDoomedRestId: "l4-short" });
  assert.equal(item("endurance").system.uses.spent, 2);
  assert.equal(doomedGiftActive(actor, "bones"), false);
});
test("free level replacement consumes no action, preserves owned cards and cannot repeat", async () => {
  await accept("bones");
  answers.push("bones", "level", "yes", "heart");
  assert.equal((await use("curses", "remove", "replace")).status, "success");
  assert.deepEqual(doomedState(actor).accepted, ["heart"]);
  assert.deepEqual(doomedState(actor).freeLevels, [5]);
  assert.ok(curse("bones"));
  assert.equal(calls.length, 0);
  answers.push("heart", null);
  await use("curses", "remove");
  assert.deepEqual(doomedState(actor).accepted, ["heart"]);
});
test("cancelled removal does not delete curse, slots, effects or manual documents", async () => {
  await accept("bones");
  answers.push("bones", "level", "yes", null);
  await use("curses", "remove");
  assert.equal(doomedOccupied(actor), 2);
  assert.equal(actor.effects.length, 2);
});
test("native death-save hook adds one extra failure, enhanced adds two, dedup and nat1 cap at three", async () => {
  await accept("wounds");
  const roll = { total: 4, options: { target: 10 } },
    details = { subject: actor, updates: { "system.attributes.death.failure": 1 } };
  applyDoomedDeathSave([roll], details);
  applyDoomedDeathSave([roll], details);
  assert.equal(details.updates["system.attributes.death.failure"], 2);
  answers.push("wounds");
  await use("empower");
  const enhanced = { subject: actor, updates: { "system.attributes.death.failure": 2 } };
  applyDoomedDeathSave([roll], enhanced);
  assert.equal(enhanced.updates["system.attributes.death.failure"], 3);
  const success = { subject: actor, updates: { "system.attributes.death.success": 1 } };
  applyDoomedDeathSave([{ total: 15 }], success);
  assert.ok(!success.updates["system.attributes.death.failure"]);
});
test("critical threshold is narrow, includes spell attacks and preserves a better existing range", async () => {
  await accept("rage");
  assert.equal(doomedCritical(17, { hp: 40, maximum: 40, empowered: false }), 17);
  assert.equal(doomedCritical(20, { hp: 20, maximum: 40, empowered: false }), 19);
  const config = { subject: { actor, type: "attack" }, rolls: [{ options: { criticalSuccess: 20 } }] };
  applyDoomedAttackConfig(config);
  assert.equal(config.rolls[0].options.criticalSuccess, 19);
  answers.push("rage");
  await use("empower");
  const another = { subject: { actor }, rolls: [{ options: { criticalSuccess: 20 } }] };
  applyDoomedAttackConfig(another);
  assert.equal(another.rolls[0].options.criticalSuccess, 18);
});
test("restrictions block only the proper action, not ordinary actions or saves", async () => {
  await accept("moment", "disruption");
  assert.equal(blockDoomedActivity({ actor, type: "utility", activation: { type: "reaction" } }), false);
  assert.equal(blockDoomedActivity({ actor, type: "save", activation: { type: "action" } }), undefined);
  assert.equal(blockDoomedActivity({ actor, type: "utility", duration: { concentration: true } }), false);
  answers.push("moment");
  await use("empower");
  assert.equal(blockDoomedActivity({ actor, activation: { type: "bonus" } }), false);
});
test("HP loss is real, once per own turn, ignores temporary HP and cannot heal at zero", async () => {
  await accept("decay");
  await actor.update({ "system.attributes.hp.temp": 50 });
  const event = {
    sourceActorUuid: actor.uuid,
    targetTokenUuid: target.uuid,
    sourceTokenUuid: source.uuid,
    damageTypes: ["slashing"],
    doomedApplication: { id: "damage", own: true, turn: "c:1:0", suitable: true, automatic: false, decayLoss: 4 }
  };
  await recordDoomedDamage({ amount: 5, event });
  await recordDoomedDamage({ amount: 5, event });
  assert.equal(actor.system.attributes.hp.value, 16);
  assert.equal(actor.system.attributes.hp.temp, 50);
  assert.equal(actor.getFlag(MODULE_ID, "doomedDamageApplications").length, 1);
  await actor.update({ "system.attributes.hp.value": 2 });
  await recordDoomedDamage({
    amount: 5,
    event: { ...event, doomedApplication: { ...event.doomedApplication, id: "next", turn: "c:2:0" } }
  });
  assert.equal(actor.system.attributes.hp.value, 0);
});
test("suppression does not remove decay drawback; off-turn and self damage do not charge it", async () => {
  await accept("decay");
  await suppressDoomedGift(actor, "decay");
  const event = {
    sourceActorUuid: actor.uuid,
    targetTokenUuid: target.uuid,
    sourceTokenUuid: source.uuid,
    doomedApplication: { id: "damage", own: false, turn: "c:1:0", decayLoss: 4 }
  };
  await recordDoomedDamage({ amount: 5, event });
  assert.equal(actor.system.attributes.hp.value, 20);
  event.doomedApplication.own = true;
  await recordDoomedDamage({ amount: 5, event });
  assert.equal(actor.system.attributes.hp.value, 16);
  event.targetTokenUuid = source.uuid;
  event.doomedApplication.turn = "c:2:0";
  await recordDoomedDamage({ amount: 5, event });
  assert.equal(actor.system.attributes.hp.value, 16);
});
test("decay bonus chooses a confirmed original damage type, uses native Midi without recursive HP price", async () => {
  await accept("decay");
  combat();
  await actor.setFlag(MODULE_ID, "doomedDamageApplications", [
    {
      id: "hit",
      turn: "c:1:0",
      sourceUuid: source.uuid,
      amount: 5,
      targets: [{ uuid: target.uuid, types: ["slashing"] }]
    }
  ]);
  answers.push(target.uuid, "slashing");
  assert.equal((await use("curse-decay")).status, "success");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].activity.damage.parts[0].number, 3);
  assert.equal(calls[1].activity.damage.parts[0].denomination, 8);
  assert.equal(calls[1].activity.damage.parts[0].types[0], "slashing");
  assert.equal((await use("curse-decay")).status, "cancelled");
});
test("blood hunger blocks other healing but permits its proven gift and ordinary rest; heart rejects tempHP", async () => {
  await accept("hunger", "heart");
  const updates = { "system.attributes.hp.value": 30, "system.attributes.hp.temp": 8 };
  applyDoomedHealthRules(actor, -10, updates);
  assert.equal(updates["system.attributes.hp.value"], 20);
  assert.equal(updates["system.attributes.hp.temp"], 0);
  const gift = { "system.attributes.hp.value": 30 };
  applyDoomedHealthRules(actor, -10, gift, { [MODULE_ID]: { doomedHungerHealing: "request" } });
  assert.equal(gift["system.attributes.hp.value"], 30);
  await suppressDoomedGift(actor, "hunger");
  const noGift = { "system.attributes.hp.value": 30 };
  applyDoomedHealthRules(actor, -10, noGift, { [MODULE_ID]: { doomedHungerHealing: "request" } });
  assert.equal(noGift["system.attributes.hp.value"], 20);
});
test("enhanced hunger forbids rest healing but not a full non-healing rest or gift restoration", async () => {
  await accept("hunger");
  answers.push("hunger");
  await use("empower");
  const result = { updateData: { "system.attributes.hp.value": 40 }, longRest: true };
  prepareDoomedRest(actor, result, { type: "long" });
  assert.equal(result.updateData["system.attributes.hp.value"], 20);
  assert.equal(result.doomedRest.full, false);
});
test("a completed eight-hour rest outlasts one-minute empowerment even with native advanceTime disabled", async () => {
  await accept("hunger");
  answers.push("hunger");
  await use("empower");
  const result = { type: "long", updateData: { "system.attributes.hp.value": 40 }, grimgutzDoomedRestId: "timed-rest" };
  prepareDoomedRest(actor, result, { type: "long", duration: 480, advanceTime: false });
  assert.equal(result.updateData["system.attributes.hp.value"], 40);
  await doomedRestCompleted(actor, result);
  assert.equal(doomedEmpowered(actor, "hunger"), false);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("native healing permission is carried only by actual owner hunger activity, not an unrelated spell", async () => {
  await accept("hunger");
  const a = activity("curse-hunger");
  a.flags[MODULE_ID].doomedHungerHealing = "verified";
  const damageItem = {};
  prepareDoomedHealing({ actor }, { workflow: { activity: a }, damageItem });
  assert.equal(damageItem.calcDamageOptions[MODULE_ID].doomedHungerHealing, "verified");
  const other = {};
  prepareDoomedHealing({ actor: target.actor }, { workflow: { activity: a }, damageItem: other });
  assert.equal(other.calcDamageOptions, undefined);
});
test("grave and flying movement/senses convert feet to metres; story rules create no fake broad buffs", async () => {
  await actor.update({ "system.attributes.movement.units": "m", "system.attributes.senses.units": "m" });
  await accept("grave", "bones", "revelation", "mind", "truth");
  const changes = doomedPassiveDefinitions(actor).flatMap(e => e.system.changes);
  assert.ok(changes.some(c => c.key === "system.attributes.movement.fly" && Number(c.value) === 9.144));
  assert.ok(changes.some(c => c.key === "system.attributes.senses.ranges.truesight" && Number(c.value) === 18.288));
  assert.ok(!changes.some(c => c.key === "system.abilities.wis.save.roll.mode"));
});
test("cold aura timing is targetStart only, radius 10/20, suppression and incapacity disable it", async () => {
  await accept("cold");
  const normal = AURA_DEFINITIONS.find(d => d.id === "doomed-cold-normal"),
    amp = AURA_DEFINITIONS.find(d => d.id === "doomed-cold-empowered");
  assert.equal(normal.radius, 10);
  assert.equal(normal.events[0].trigger, "targetStart");
  assert.equal(normal.sourceCondition({ actor }), true);
  assert.equal(amp.sourceCondition({ actor }), false);
  answers.push("cold");
  await use("empower");
  assert.equal(amp.radius, 20);
  assert.equal(amp.sourceCondition({ actor }), true);
  assert.equal(amp.events[0].damage[0].formula, "2d8");
  await suppressDoomedGift(actor, "cold");
  assert.equal(amp.sourceCondition({ actor }), false);
});
test("outcast gives disadvantage only against someone else, with GM sight/hostility confirmation once", async () => {
  await accept("outcast");
  target.x = 100;
  const enemy = token(makeActor(0, "enemy"), "enemy", 100),
    context = { actor: enemy.actor, attacker: enemy, target, data: { workflowId: "outcast-1" } };
  answers.push("yes");
  const result = await doomedOutcastAttack(context);
  assert.equal(result.length, 1);
  await doomedOutcastAttack(context);
  assert.equal(prompts.length, 1);
  assert.equal((await doomedOutcastAttack({ ...context, target: source })).length, 0);
  actor.statuses.add("incapacitated");
  assert.equal((await doomedOutcastAttack({ ...context, data: { workflowId: "outcast-2" } })).length, 0);
});
test("shared fate copies only drawback with source level, repeat save and no duplicate from a second source", async () => {
  await accept("soul");
  answers.push("soul", [target.uuid], "yes", "yes");
  assert.equal((await use("shared-fate")).status, "success");
  const e = target.actor.effects[0];
  assert.equal(e.system.changes.length, 2);
  assert.ok(e.system.changes.every(c => c.value === "-2"));
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").event, "turnEnd");
  assert.equal(e.getFlag(MODULE_ID, "doomedTransferred").level, 10);
  assert.equal(item("shared-fate").system.uses.spent, 1);
  const pulses = [];
  await processRepeatedSaves(target.actor, "turnEnd", { eventKey: "end", pulse: async data => pulses.push(data) });
  assert.equal(pulses.length, 1);
  assert.equal(pulses[0].event.save, "wis");
  assert.equal(pulses[0].event.damage.length, 0);
});
test("grave chains save/damage applies restraints only to failed targets; first-save disadvantage not repeated", async () => {
  await accept("chains");
  answers.push([target.uuid], "yes");
  assert.equal((await use("curse-chains")).status, "success");
  const nativeSave = calls[1].activity;
  assert.equal(nativeSave.save.ability[0], "str");
  assert.equal(nativeSave.damage.parts[0].number, 4);
  assert.equal(nativeSave.damage.parts[0].denomination, 8);
  assert.ok(target.actor.effects[0].statuses.has("restrained"));
  assert.equal(target.actor.effects[0].getFlag(MODULE_ID, "repeatSave").ability, "str");
  assert.ok(!target.actor.effects[0].getFlag(MODULE_ID, "repeatSave").doomedChainsDisadvantage);
});
test("immunity to restraint prevents only chains' condition, not native damage or valid expense", async () => {
  await accept("chains");
  await target.actor.update({ "system.traits.ci.value": ["restrained"] });
  answers.push([target.uuid], "yes");
  assert.equal((await use("curse-chains")).status, "success");
  assert.equal(target.actor.effects.length, 0);
  assert.equal(calls.length, 2);
  assert.equal(curse("chains").system.uses.spent, 1);
});
test("soul transfer expenses only its reaction/use and requires confirmation of both original damage packets", async () => {
  await accept("soul");
  answers.push([target.uuid], "yes", "yes", "yes");
  assert.equal((await use("curse-soul")).status, "success");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].activity.activation.type, "reaction");
  assert.equal(curse("soul").system.uses.spent, 1);
  assert.equal(actor.system.attributes.hp.value, 20);
  assert.equal(target.actor.system.attributes.hp.value, 20);
});
test("disruption uses a narrow native Charisma save and never silently refunds target slots", async () => {
  await accept("disruption");
  answers.push([target.uuid], "yes", "yes", "yes");
  assert.equal((await use("curse-disruption")).status, "success");
  assert.equal(calls[1].activity.save.ability[0], "cha");
  assert.equal(calls[1].activity.damage.parts.length, 0);
  assert.equal(curse("disruption").system.uses.spent, 1);
});
test("initiative replenishes luck only on a real native message, no rest, duplicate callback or numeric edit", async () => {
  await accept("luck");
  await curse("luck").update({ "system.uses.spent": 1 });
  const message = {
    uuid: "ChatMessage.init",
    flags: { core: { initiativeRoll: true } },
    speaker: { actor: actor.id, scene: canvas.scene.id, token: source.id }
  };
  docs.set(message.uuid, message);
  await handleDoomedInitiative(message);
  assert.equal(curse("luck").system.uses.spent, 0);
  await curse("luck").update({ "system.uses.spent": 1 });
  await handleDoomedInitiative(message);
  assert.equal(curse("luck").system.uses.spent, 1);
  await doomedRestCompleted(actor, { type: "long", grimgutzDoomedRestId: "luck-rest" });
  assert.equal(curse("luck").system.uses.spent, 1);
});
test("shadow expiry retains amplified attack invisibility only while amplification still runs", async () => {
  await accept("shadow");
  combat();
  answers.push("shadow");
  await use("empower");
  answers.push("yes");
  await use("curse-shadow");
  const e = actor.effects.find(e => benefitData(e)?.kind === "doomed-invisibility");
  assert.ok(e);
  await endDoomedInvisibility({ actor, activity: { type: "attack" } });
  assert.ok(actor.effects.includes(e));
  game.time.worldTime = 60;
  await endDoomedInvisibility({ actor, activity: { type: "attack" } });
  assert.ok(!actor.effects.includes(e));
});
test("uncertain native applications reserve outcome; replay neither spends, prompts nor rerolls", async () => {
  await accept("bones");
  answers.push("bones");
  nativeResult = undefined;
  assert.equal((await use("empower", null, "unknown-amp")).status, "needs-review");
  assert.equal(doomedEmpowered(actor, "bones"), false);
  const count = prompts.length;
  nativeResult = "normal";
  await use("empower", null, "unknown-amp");
  assert.equal(calls.length, 1);
  assert.equal(prompts.length, count);
});
test("one-time increase preserves raw scores and cap, mutually exclusive feat; replay cannot stack", async () => {
  answers.push("abilities", "wis", "str");
  await use("increase", null, "increase");
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "doomedPassive") === "increase");
  assert.equal(e.system.changes.find(c => c.key === "system.abilities.wis.max").value, "23");
  assert.equal(actor._source.system.abilities.wis.value, 18);
  await use("increase", null, "increase");
  assert.equal(actor.effects.filter(e => e.getFlag(MODULE_ID, "doomedPassive") === "increase").length, 1);
});
test("delayed end confirms damage/not instant death, suppresses one gift, respects inability to gain tempHP", async () => {
  await accept("bones", "heart");
  await actor.update({ "system.attributes.hp.value": 0 });
  answers.push("yes", "bones");
  assert.equal((await use("delayed-end")).status, "success");
  assert.equal(actor.system.attributes.hp.value, 1);
  assert.equal(actor.system.attributes.hp.temp, 0);
  assert.equal(doomedGiftActive(actor, "bones"), false);
  assert.equal(doomedOccupied(actor), 3);
});
test("registered hooks are executable and group actors without HP are safe", async () => {
  installDoomedHooks();
  for (const key of [
    "dnd5e.preRollAttack",
    "dnd5e.rollDeathSaveV2",
    "dnd5e.preUseActivity",
    "midi-qol.preTargetSave",
    "dnd5e.preApplyDamage",
    "dnd5e.preRestCompleted",
    "createChatMessage"
  ])
    assert.ok(hooks.get(key)?.length);
  const group = { uuid: "Actor.group", system: {}, effects: [], items: [] };
  await syncDoomed(group);
  assert.equal(blockDoomedActivity({ actor: group, type: "utility" }), undefined);
  assert.deepEqual(
    doomedTransferredChanges(actor, "soul").map(c => c.value),
    ["-2", "-2"]
  );
});
test("Doomed short names are not linked into unrelated features", () => {
  const unrelated = {
    _id: "unrelated",
    name: "Old feature",
    system: { description: { value: "Распад и проклятая удача здесь — обычные слова." } }
  };
  linkPackDescriptions([{ name: "features", documents: [...structuredClone(doomedDocuments), unrelated] }]);
  assert.ok(!unrelated.system.description.value.includes("@UUID["));
});
