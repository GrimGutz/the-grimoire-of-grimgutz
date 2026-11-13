import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bloodSongHealing,
  spiritIsFriendly,
  ritualSpiritRules,
  installRitualistSpiritHooks
} from "../scripts/automation/classes/ritualist-spirits.mjs";
import { summonActivities } from "../scripts/automation/shared/summon-activities.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
test("blood song heals from confirmed final damage, including resistance, odd values and immunity", () => {
  assert.equal(bloodSongHealing(9), 4);
  assert.equal(bloodSongHealing(4), 2);
  assert.equal(bloodSongHealing(0), 0);
});
test("spirit relation follows current disposition after losing or restoring control", () => {
  const source = { disposition: 1 },
    target = { disposition: 1 };
  assert.equal(spiritIsFriendly(source, target), true);
  source.disposition = -1;
  assert.equal(spiritIsFriendly(source, target), false);
});
test("spirit snapshot parameters do not depend on the owner's subsequent level", () => {
  const actor = { getFlag: () => ({ ritualistRules: { level: 2, dc: 15, conMod: 3 } }) };
  assert.deepEqual(ritualSpiritRules(actor), { level: 2, dc: 15, conMod: 3 });
});
test("generated blood song preserves metadata, real damage and normal/long range", () => {
  globalThis.foundry = { utils: { randomID: () => "a" } };
  const activity = summonActivities([
    {
      name: "Song",
      attackType: "ranged",
      formula: "2d6 + 2",
      damageType: "necrotic",
      range: 30,
      longRange: 60,
      metadata: { ritualistBloodSong: true }
    }
  ]).a;
  assert.equal(activity.damage.parts[0].custom.formula, "2d6 + 2");
  assert.equal(activity.flags[MODULE_ID].longRange, 60);
  assert.equal(activity.flags[MODULE_ID].ritualistBloodSong, true);
});
test("canceling sorrow's condition chooser cancels native use before consumption", async () => {
  const callbacks = new Map();
  globalThis.Hooks = { on: (key, handler) => callbacks.set(key, handler) };
  const users = [];
  users.activeGM = { id: "gm", isGM: true };
  globalThis.game = { settings: { get: () => true }, users, user: users.activeGM };
  globalThis.foundry = {
    utils: { randomID: () => "prompt", escapeHTML: String },
    applications: { api: { DialogV2: { wait: async () => null } } }
  };
  installRitualistSpiritHooks();
  const activity = {
    actor: { uuid: "Actor.spirit" },
    flags: { [MODULE_ID]: { ritualistSorrow: true } },
    updateSource() {
      throw Error("cancel cannot write");
    }
  };
  assert.equal(await callbacks.get("midi-qol.preTargetingV2")({ workflow: { activity } }), false);
});
