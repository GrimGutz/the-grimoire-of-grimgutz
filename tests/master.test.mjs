import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { masterDocuments } from "../src/packs/master-features.mjs";
import { masterClassDocuments } from "../src/packs/master-class.mjs";
import { masterSubclassDocuments } from "../src/packs/master-subclasses.mjs";
import { MASTER_TECHNIQUES } from "../src/master-data.mjs";
import {
  masterConfiguration,
  masterMatchesWeapon,
  masterMatchesSpell,
  masterPassiveDefinitions,
  masterDC,
  masterPrerequisiteFailures,
  masterSeriesAllowed,
  recordMasterTechnique,
  releaseMasterTechnique,
  masterTechniqueUsage,
  extendMasterCasting,
  masterSettings,
  validateMasterAdvancement,
  masterFeatureAvailable
} from "../scripts/automation/classes/master.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import {
  prepareMasterActivity,
  prepareMasterAttack,
  applyMasterAttackConfig,
  applyMasterDamageConfig,
  masterCriticalThreshold,
  masterReliableFormula,
  selectedSchoolTempHp
} from "../scripts/automation/classes/master-combat.mjs";

const deepMerge = (base, patch) => {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes(".")) {
      const parts = key.split("."),
        end = parts.pop();
      let target = result;
      for (const p of parts) target = target[p] ??= {};
      target[end] = structuredClone(value);
    } else if (value && typeof value === "object" && !Array.isArray(value))
      result[key] = deepMerge(result[key] ?? {}, value);
    else result[key] = structuredClone(value);
  }
  return result;
};
function owned(data, actor) {
  const raw = structuredClone(data),
    item = {
      ...raw,
      id: raw._id,
      actor,
      uuid: `${actor.uuid}.Item.${raw._id}`,
      toObject: () => structuredClone(raw),
      clone: patch => owned(deepMerge(raw, patch), actor)
    };
  item.system = {
    ...raw.system,
    activities: new Map(
      Object.entries(raw.system.activities ?? {}).map(([id, body]) => [
        id,
        { ...body, id, actor, item, uuid: `${item.uuid}.Activity.${id}`, toObject: () => structuredClone(body) }
      ])
    )
  };
  return item;
}
let actor, answers, docs, seq;
function makeActor(level = 5, path = "blade") {
  const flags = {
    masterConfiguration: {
      path,
      weaponType: "greatsword",
      weaponUuid: "Actor.master.Item.sword",
      ability: path === "arcana" ? "int" : "str",
      school: "evo",
      casterUuid: "Actor.master.Item.wizard",
      held: true,
      proficiency: "skills.arc",
      secondProficiency: "tools.wood"
    }
  };
  const actor = {
    uuid: "Actor.master",
    isOwner: true,
    items: [],
    effects: [],
    system: {
      details: { level: 10 },
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 20, mod: 5, max: null }])
      ),
      skills: { arc: { value: 1, ability: "int" }, ath: { value: 1 } },
      tools: { wood: { value: 1 } },
      traits: { size: "med", weaponProf: { value: new Set(["mar"]) } },
      attributes: { prof: 3, hp: { value: 20, max: 20, temp: 0 }, movement: { walk: 30 }, concentration: {} },
      spells: { spell2: { value: 2, level: 2 } }
    },
    getFlag: (module, key) => (module === MODULE_ID ? flags[key] : null),
    async setFlag(_module, key, value) {
      flags[key] = structuredClone(value);
    },
    async unsetFlag(_module, key) {
      delete flags[key];
    },
    async update(patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (key.startsWith(`flags.${MODULE_ID}.`)) flags[key.slice(MODULE_ID.length + 7)] = structuredClone(value);
        else if (key.startsWith("system.")) this.system = deepMerge(this.system, { [key.slice(7)]: value });
      }
      this._source.system = structuredClone(this.system);
    },
    async createEmbeddedDocuments(_type, rows) {
      return rows.map(row => {
        const effect = {
          ...row,
          id: `e${this.effects.length}`,
          getFlag: (m, k) => row.flags?.[m]?.[k],
          toObject: () => row
        };
        this.effects.push(effect);
        return effect;
      });
    },
    async updateEmbeddedDocuments() {
      return [];
    }
  };
  actor._source = { system: structuredClone(actor.system) };
  actor.items = [
    { type: "class", system: { identifier: "master", levels: level } },
    { type: "subclass", system: { classIdentifier: "master" }, flags: { [MODULE_ID]: { masterSubclass: path } } },
    ...masterDocuments.map(data => owned(data, actor))
  ];
  actor.items.get = id => actor.items.find(i => i.id === id);
  return actor;
}
beforeEach(() => {
  seq = 0;
  answers = [];
  docs = new Map();
  actor = makeActor();
  const gm = { id: "gm", isGM: true },
    users = [];
  users.activeGM = gm;
  globalThis.game = {
    user: gm,
    users,
    combats: [],
    modules: new Map(),
    settings: { get: () => true },
    time: { worldTime: 0 },
    actors: [actor]
  };
  globalThis.canvas = {
    ready: true,
    scene: { id: "one", grid: { size: 100, distance: 5, units: "ft" } },
    tokens: { controlled: [] }
  };
  globalThis.CONFIG = {
    DND5E: { maxAbilityScore: 20, skills: {}, tools: {}, spellSchools: { evo: { label: "Evocation" } } },
    ActiveEffect: { documentClass: { getEffectStart: () => ({ time: 0 }) } }
  };
  globalThis.foundry = {
    utils: { randomID: () => `master-test-${++seq}`, escapeHTML: String },
    applications: { api: { DialogV2: { wait: async () => answers.shift() ?? null } } }
  };
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.fromUuid = async uuid => docs.get(uuid);
  for (const item of actor.items) {
    if (item.uuid) docs.set(item.uuid, item);
    for (const activity of item.system.activities?.values?.() ?? []) docs.set(activity.uuid, activity);
  }
});
function weapon(owner = actor, base = "greatsword") {
  const item = owned(
    {
      _id: "sword",
      type: "weapon",
      system: {
        type: { baseItem: base },
        equipped: true,
        properties: ["lod", "hvy"],
        range: { value: 30, long: 120, units: "ft", reach: 5 },
        damage: { base: { number: 2, denomination: 6, types: ["slashing"] } },
        activities: {
          attack: {
            _id: "attack",
            type: "attack",
            attack: { type: { value: "melee" }, critical: { threshold: 17 } },
            range: { value: 5, units: "ft" },
            target: { template: {} },
            damage: { parts: [] }
          }
        }
      }
    },
    owner
  );
  owner.items.push(item);
  return item;
}
function spell(owner = actor, school = "evo") {
  return owned(
    {
      _id: "spell",
      type: "spell",
      system: {
        school,
        level: 2,
        activities: {
          save: {
            _id: "save",
            type: "save",
            save: { dc: { value: 15, calculation: "spellcasting" } },
            range: { value: 60, units: "ft" },
            target: { template: { type: "sphere", size: "20", units: "ft" } },
            damage: { parts: [{ types: ["fire"], number: 3, denomination: 6 }] }
          }
        }
      }
    },
    owner
  );
}

test("Master imports all 41 technique rules verbatim and grants 2/3/4/6/7 choices plus three true subclasses", async () => {
  assert.equal(MASTER_TECHNIQUES.length, 41);
  assert.equal(masterDocuments.length, 53);
  assert.equal(masterSubclassDocuments.length, 3);
  const cls = masterClassDocuments[0],
    choices = cls.system.advancement.filter(
      a => a.type === "ItemChoice" && !Object.values(a.configuration.choices)[0].replacement
    );
  assert.deepEqual(
    choices.map(a => Object.values(a.configuration.choices)[0].count),
    [2, 1, 1, 2, 1]
  );
  assert.ok(masterSubclassDocuments.every(s => s.system.classIdentifier === "master"));
  const source = await readFile(new URL("../src/content/master.md", import.meta.url), "utf8");
  for (const entry of MASTER_TECHNIQUES) {
    assert.ok(source.includes(`### ${entry.name}`));
    assert.ok(
      masterDocuments
        .find(i => i.system.identifier === entry.key)
        .system.description.value.includes("Автоматизация Foundry:")
    );
  }
  assert.ok(
    masterDocuments.every(i => i.effects.length === 0),
    "no text-only or invented permanent effects"
  );
});

test("Master weapon type and school are exact scopes, and a changed subclass cannot reuse old choices", () => {
  assert.equal(masterMatchesWeapon(actor, weapon()), true);
  assert.equal(masterMatchesWeapon(actor, weapon(actor, "longbow")), false);
  const mage = makeActor(5, "arcana");
  assert.equal(masterMatchesSpell(mage, spell(mage)), true);
  assert.equal(masterMatchesSpell(mage, spell(mage, "nec")), false);
  mage.items[1].flags[MODULE_ID].masterSubclass = "blade";
  assert.equal(masterConfiguration(mage), null);
  assert.equal(masterMatchesSpell(mage, spell(mage)), false);
});

test("Master prerequisites use total level, the specified five abilities, and genuine proficiency", () => {
  assert.deepEqual(masterPrerequisiteFailures(actor), []);
  actor.system.details.level = 9;
  actor.system.abilities.str.value = 19;
  actor.system.abilities.dex.value = 19;
  actor.system.abilities.int.value = 19;
  actor.system.abilities.wis.value = 19;
  actor.system.abilities.cha.value = 19;
  actor.system.skills = { arc: { value: 0.5 } };
  actor.system.tools = {};
  actor.system.traits.weaponProf.value.clear();
  assert.equal(
    masterPrerequisiteFailures(actor).length,
    3,
    "Constitution 20 and half proficiency do not satisfy the entry rules"
  );
});

test("expertise, reliable craft and concentration produce narrow real changes, not broad Constitution advantage", () => {
  weapon();
  const defs = masterPassiveDefinitions(actor),
    changes = defs.flatMap(e => e.system.changes);
  assert.ok(changes.some(c => c.key === "system.skills.arc.value" && c.value === "2"));
  assert.ok(changes.some(c => c.key === "system.tools.wood.value" && c.value === "2"));
  assert.ok(changes.some(c => c.key === "system.skills.arc.roll.min" && c.value === "10"));
  assert.ok(changes.some(c => c.key === "system.attributes.concentration.roll.mode"));
  assert.ok(!changes.some(c => c.key.includes("abilities.con")));
  assert.ok(changes.some(c => c.key === "system.attributes.ac.bonus"));
  actor.getFlag(MODULE_ID, "masterConfiguration").held = false;
  assert.ok(
    !masterPassiveDefinitions(actor)
      .flatMap(e => e.system.changes)
      .some(c => c.key === "system.attributes.ac.bonus")
  );
});

test("Master apex reduces an existing better threshold only for an eligible attack", () => {
  const sword = weapon();
  assert.equal(masterCriticalThreshold(17, actor, sword), 16);
  assert.equal(masterCriticalThreshold(17, actor, weapon(actor, "longbow")), 17);
  const config = {
    subject: { actor, item: sword, attack: { critical: { threshold: 17 } } },
    rolls: [{ options: { criticalSuccess: 17 } }]
  };
  applyMasterAttackConfig(config);
  applyMasterAttackConfig(config);
  assert.equal(config.rolls[0].options.criticalSuccess, 16);
});

test("path ranged corrections preserve disadvantage from blindness and never affect another weapon", () => {
  actor = makeActor(5, "archer");
  const sword = weapon(),
    state = {
      attribution: { DIS: { range: "range", nearbyFoe: "enemy", blind: "blind" } },
      disadvantage: { active: true, override: false }
    };
  const tracker = { toJSON: () => structuredClone(state), restore: data => Object.assign(state, data) };
  prepareMasterAttack({ actor, item: sword, activity: {}, attackRollModifierTracker: tracker });
  assert.deepEqual(state.attribution.DIS, { blind: "blind" });
  assert.equal(state.disadvantage.active, true);
  state.attribution.DIS.range = "range";
  prepareMasterAttack({ actor, item: weapon(actor, "longbow"), activity: {}, attackRollModifierTracker: tracker });
  assert.ok(state.attribution.DIS.range);
});

test("Master clones range/properties changes and leaves equipped source items untouched", async () => {
  actor = makeActor(5, "archer");
  actor.getFlag(MODULE_ID, "masterConfiguration").reloadProperty = "lod";
  const item = weapon(),
    original = item.toObject();
  const workflow = {
    id: "wf",
    actor,
    item,
    activity: item.system.activities.get("attack"),
    token: { document: { uuid: "token", parent: canvas.scene } }
  };
  prepareMasterActivity(workflow);
  assert.equal(workflow.item.system.range.value, 60);
  assert.equal(workflow.item.system.range.long, 210);
  assert.deepEqual(workflow.item.system.properties, ["hvy"]);
  assert.deepEqual(item.toObject(), original);
});

test("school specialist changes save DC only in the selected school and never changes the original spell", () => {
  actor = makeActor(5, "arcana");
  const item = spell(actor),
    workflow = { id: "spell", actor, item, activity: item.system.activities.get("save") };
  prepareMasterActivity(workflow);
  assert.equal(workflow.activity.save.dc.formula, "16");
  assert.equal(item.system.activities.get("save").save.dc.value, 15);
  const other = spell(actor, "nec"),
    unrelated = { id: "other", actor, item: other, activity: other.system.activities.get("save") };
  prepareMasterActivity(unrelated);
  assert.equal(unrelated.grimgutzMaster, undefined);
});

test("reliable formula only raises dice floors and preserves stronger existing floors", () => {
  assert.equal(masterReliableFormula("3d6 + 2d4min1 + 1d8min5 + 7"), "3d6min2 + 2d4min2 + 1d8min5 + 7");
});

test("an inapplicable prepared formula is not spent by self-range or an unrelated attack", async () => {
  actor = makeActor(5, "arcana");
  await actor.setFlag(MODULE_ID, "masterReady", { id: "distant-formula", nonce: "ready" });
  const item = spell(actor);
  item.system.activities.get("save").range.value = 0;
  const data = item.toObject();
  data.system.activities.save.range = { units: "self", value: null };
  const self = owned(data, actor);
  const workflow = { id: "self", actor, item: self, activity: self.system.activities.get("save") };
  prepareMasterActivity(workflow);
  assert.equal(workflow.grimgutzMaster.preparedApplied, false);
  assert.equal(actor.getFlag(MODULE_ID, "masterReady").nonce, "ready");
});

test("protective formula requires one real spent slot of the cast level, not merely a spell level", () => {
  const before = { spell2: { level: 2, value: 2 }, pact: { level: 3, value: 1 } };
  assert.equal(selectedSchoolTempHp(before, before, 2, 3), 0);
  assert.equal(selectedSchoolTempHp(before, { ...before, spell2: { level: 2, value: 1 } }, 2, 3), 5);
  assert.equal(
    selectedSchoolTempHp(before, { spell2: { level: 2, value: 1 }, pact: { level: 3, value: 0 } }, 2, 3),
    0,
    "ambiguous multiple slot expenditures must not guess"
  );
});

test("Master series limits and once-per-turn counters are shared across workflows and idempotent", async () => {
  actor = makeActor(3);
  assert.equal(await recordMasterTechnique(actor, "one", "master-risky-maneuver", "combat:1:0"), true);
  assert.equal(await recordMasterTechnique(actor, "one", "master-steel-barrier", "combat:1:0"), true);
  assert.deepEqual(actor.getFlag(MODULE_ID, "masterSeries"), { round: "combat:1", series: 1, effects: 2 });
  assert.equal(await recordMasterTechnique(actor, "one", "master-disrupting-shot", "combat:1:0"), false);
  assert.equal(masterTechniqueUsage(actor, "another", "master-risky-maneuver", "combat:1:0"), false);
  assert.equal(masterTechniqueUsage(actor, "another", "master-risky-maneuver", "combat:1:1"), true);
  assert.equal(await recordMasterTechnique(actor, "one", "master-steel-barrier", "combat:1:0"), false);
  assert.equal(masterSeriesAllowed(3, { round: "c:1", series: 2, effects: 4 }, "c:1", 2), false);
  assert.equal(masterSeriesAllowed(5, { round: "c:1", series: 2, effects: 4 }, "c:1", 3), false);
  assert.equal(masterSeriesAllowed(5, { round: "c:1", series: 2, effects: 4 }, "c:2", 3), true);
});

test("the arcana descriptor extends only its chosen caster and does not change class levels", () => {
  actor = makeActor(4, "arcana");
  const caster = { uuid: "Actor.master.Item.wizard", system: { levels: 6 } },
    descriptor = { levels: 6 };
  assert.equal(extendMasterCasting(actor, caster, descriptor), 4);
  assert.equal(descriptor.levels, 10);
  assert.equal(caster.system.levels, 6);
  assert.equal(extendMasterCasting(actor, caster, descriptor), 0);
  assert.equal(extendMasterCasting(actor, { uuid: "other" }, { levels: 5 }), 0);
  assert.equal(masterDC(actor), 16);
});

test("cancelling Master configuration leaves all stored choices untouched", async () => {
  const item = actor.items.find(i => i.system.identifier === "master-perfection-path"),
    previous = structuredClone(actor.getFlag(MODULE_ID, "masterConfiguration"));
  answers = [null];
  assert.equal((await masterSettings(actor, item)).status, "cancelled");
  assert.deepEqual(actor.getFlag(MODULE_ID, "masterConfiguration"), previous);
});

test("Master level-4 ability increase updates the selected raw value and cap once, or chooses a feat without it", async () => {
  const item = actor.items.find(i => i.system.identifier === "master-ability-improvement");
  answers = ["ability"];
  assert.equal((await masterSettings(actor, item)).status, "success");
  assert.equal(actor.system.abilities.str.value, 22);
  assert.equal(actor.system.abilities.str.max, 22);
  answers = ["ability"];
  assert.equal((await masterSettings(actor, item)).status, "cancelled");
  assert.equal(actor.system.abilities.str.value, 22);
  actor = makeActor(4);
  for (const i of actor.items) if (i.uuid) docs.set(i.uuid, i);
  const featItem = actor.items.find(i => i.system.identifier === "master-ability-improvement");
  answers = ["feat"];
  assert.equal((await masterSettings(actor, featItem)).status, "success");
  assert.equal(actor.system.abilities.str.value, 20);
  assert.equal(actor.system.abilities.str.max, null);
});

test("advancement rejects wrong paths, duplicate techniques and levels that exceed the known-technique count", () => {
  actor = makeActor(1);
  actor.items = actor.items.slice(0, 2);
  actor.items.forEach((i, n) => {
    i.id = `i${n}`;
    i.toObject = () => structuredClone({ type: i.type, system: i.system, flags: i.flags });
  });
  const technique = masterDocuments.find(i => i.system.identifier === "master-school-specialist");
  assert.equal(validateMasterAdvancement({ actor }, {}, [technique], [], []), false);
  const valid = masterDocuments.find(i => i.system.identifier === "master-point-blank");
  assert.equal(validateMasterAdvancement({ actor }, {}, [valid], [], []), undefined);
  assert.equal(validateMasterAdvancement({ actor }, {}, [valid, { ...valid, _id: "duplicate" }], [], []), false);
});

test("weapon-only general techniques remain unavailable to the arcana path", () => {
  actor = makeActor(5, "arcana");
  for (const id of ["risky-maneuver", "pinning-maneuver", "answer-magic"])
    assert.equal(
      masterFeatureAvailable(
        actor,
        actor.items.find(i => i.system.identifier === `master-${id}`)
      ),
      false
    );
});

test("cancelled Master save/attack releases only that technique and its series contribution", async () => {
  await recordMasterTechnique(actor, "wf", "master-risky-maneuver", "c:1:0");
  await recordMasterTechnique(actor, "wf", "master-disarming-strike", "c:1:0");
  await releaseMasterTechnique(actor, "wf", "master-disarming-strike", "c:1:0");
  assert.deepEqual(actor.getFlag(MODULE_ID, "masterTechniqueUsage").events.wf, ["master-risky-maneuver"]);
  assert.deepEqual(actor.getFlag(MODULE_ID, "masterSeries"), { round: "c:1", series: 0, effects: 0 });
  assert.equal(masterTechniqueUsage(actor, "new", "master-risky-maneuver", "c:1:0"), false);
  assert.equal(masterTechniqueUsage(actor, "wf", "master-disarming-strike", "c:1:0"), true);
});

test("standard class/item IDs preserve Master choices on synthetic actors without broadening scopes", async () => {
  await actor.setFlag(MODULE_ID, "masterConfiguration", {
    ...actor.getFlag(MODULE_ID, "masterConfiguration"),
    weaponType: null,
    weaponUuid: "Actor.world.Item.sword"
  });
  const custom = weapon(actor, "");
  custom.uuid = "Scene.one.Token.synthetic.Actor.master.Item.sword";
  assert.equal(masterMatchesWeapon(actor, custom), true);
  assert.equal(masterMatchesWeapon(actor, { ...custom, id: "other" }), false);
  actor = makeActor(5, "arcana");
  const descriptor = { levels: 6 };
  assert.equal(
    extendMasterCasting(
      actor,
      { id: "wizard", uuid: "Scene.one.Token.synthetic.Actor.master.Item.wizard", system: { levels: 6 } },
      descriptor
    ),
    5
  );
  assert.equal(descriptor.levels, 11);
});

test("real GM protective-formula callbacks ask once, preserve higher HP, and retain one event", async () => {
  actor = makeActor(5, "arcana");
  const source = { uuid: "Scene.one.Token.master", actor, parent: canvas.scene };
  docs.set(source.uuid, source);
  docs.set(actor.uuid, actor);
  for (const item of actor.items) if (item.uuid) docs.set(item.uuid, item);
  await actor.setFlag(MODULE_ID, "masterLastUse", {
    workflowId: "cast-one",
    sourceUuid: source.uuid,
    spell: true,
    tempHp: 5,
    turn: "c:1:0"
  });
  actor.system.attributes.hp.temp = 9;
  const flags = { automationLedger: true, events: [] };
  game.journal = [
    {
      getFlag: (_m, k) => flags[k],
      async setFlag(_m, k, v) {
        flags[k] = v;
      }
    }
  ];
  answers = ["yes", "yes"];
  await requestGm("master-formula-offer", actor, { workflowId: "cast-one" }, { requestId: "formula-one" });
  await requestGm("master-formula-offer", actor, { workflowId: "cast-one" }, { requestId: "formula-one" });
  assert.equal(answers.length, 1);
  assert.equal(actor.system.attributes.hp.temp, 9);
  assert.equal(flags.events.length, 1);
  assert.equal(flags.events[0].state, "completed");
  assert.deepEqual(actor.getFlag(MODULE_ID, "masterTechniqueUsage").events["cast-one"], ["master-protective-formula"]);
});

test("partial nested/flat advancement updates cannot bypass Master technique limits", () => {
  actor = makeActor(5);
  actor.items = actor.items.slice(0, 2);
  actor.items.forEach((i, n) => {
    i.id = `i${n}`;
    i.toObject = () => structuredClone({ type: i.type, system: i.system, flags: i.flags });
  });
  const high = masterDocuments.find(i => i.system.identifier === "master-deadly-range");
  assert.equal(validateMasterAdvancement({ actor }, {}, [high], [{ _id: "i0", "system.levels": 1 }], []), false);
  assert.equal(validateMasterAdvancement({ actor }, {}, [high], [{ _id: "i0", system: { levels: 1 } }], []), false);
});
