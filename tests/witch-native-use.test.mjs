import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { activateWitchCrystallization } from "../scripts/automation/classes/witch-blade.mjs";
import { MODULE_ID, FLAGS } from "../scripts/automation/shared/constants.mjs";
import { automationData } from "../scripts/automation/shared/helpers.mjs";

let actor, activity, answers, calls, result;
beforeEach(() => {
  let sequence = 0;
  answers = ["Actor.witch.Item.weapon", "yes", "pact"];
  calls = [];
  result = { id: "native" };
  const flags = {};
  actor = {
    uuid: "Actor.witch",
    name: "Witch",
    items: [],
    effects: [],
    system: { spells: { spell1: { value: 0 }, pact: { value: 1, level: 3 } } },
    getFlag: (_m, key) => flags[key],
    async update(data) {
      flags.nativeApplications = data[`flags.${MODULE_ID}.nativeApplications`];
    },
    async createEmbeddedDocuments(_type, rows) {
      this.effects.push(...rows);
      return rows;
    }
  };
  const data = {
    _id: "activity",
    type: "utility",
    flags: { [MODULE_ID]: { action: "activate-witch-crystallization" } }
  };
  const item = {
    uuid: "Actor.witch.Item.feature",
    name: "Кристаллизация",
    img: "icon",
    system: { identifier: "witch-crystallization" },
    clone(patch) {
      const native = patch.system.activities.activity;
      const copy = { ...native, id: "activity", actor, toObject: () => structuredClone(native) };
      const cloned = { actor, system: { activities: new Map([["activity", copy]]) } };
      copy.item = cloned;
      return cloned;
    }
  };
  activity = {
    ...data,
    id: "activity",
    uuid: "Actor.witch.Item.feature.Activity.activity",
    actor,
    item,
    toObject: () => structuredClone(data)
  };
  actor.items = [
    { type: "class", system: { identifier: "witch-blade", levels: 2 } },
    item,
    {
      type: "weapon",
      name: "Sword",
      uuid: "Actor.witch.Item.weapon",
      system: {
        equipped: true,
        activities: new Map([["attack", { type: "attack", attack: { type: { value: "melee" } } }]])
      }
    }
  ];
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: [],
    combats: [],
    time: { worldTime: 100 },
    modules: new Map()
  };
  globalThis.CONFIG = { ActiveEffect: { documentClass: { getEffectStart: () => ({ time: 100 }) } } };
  globalThis.foundry = {
    utils: { randomID: () => `witch-${++sequence}`, escapeHTML: String },
    applications: { api: { DialogV2: { wait: async () => answers.shift() } } }
  };
  globalThis.fromUuid = async uuid => (uuid === activity.uuid ? activity : null);
  globalThis.MidiQOL = {
    async completeActivityUse(native) {
      assert.equal(automationData(native).leaderResolved, true);
      calls.push(native.consumption.targets);
      if (result) actor.system.spells.pact.value--;
      return result;
    }
  };
});

test("crystallization spends the chosen pact slot natively and scopes its effect to the chosen weapon", async () => {
  assert.equal((await activateWitchCrystallization(actor, activity)).status, "success");
  assert.deepEqual(calls, [[{ type: "attribute", target: "spells.pact.value", value: "1" }]]);
  assert.equal(actor.system.spells.pact.value, 0);
  assert.equal(actor.effects.length, 1);
  assert.deepEqual(actor.effects[0].flags[MODULE_ID][FLAGS.WEAPON_BUFF_DATA].weaponUuids, ["Actor.witch.Item.weapon"]);
  assert.equal(actor.effects[0].flags[MODULE_ID][FLAGS.WEAPON_BUFF_DATA].criticalThresholdReduction, 1);
});

test("cancelling a weapon or slot choice never reaches the native expense or creates an effect", async () => {
  for (const choice of [0, 2]) {
    answers = ["Actor.witch.Item.weapon", "yes", "pact"];
    answers[choice] = null;
    assert.equal((await activateWitchCrystallization(actor, activity)).status, "cancelled");
  }
  assert.equal(calls.length, 0);
  assert.equal(actor.system.spells.pact.value, 1);
  assert.equal(actor.effects.length, 0);
});

test("an unknown native crystallization result creates no guessed buff", async () => {
  result = undefined;
  assert.equal((await activateWitchCrystallization(actor, activity)).status, "needs-review");
  assert.equal(actor.effects.length, 0);
  assert.equal(calls.length, 1);
});
