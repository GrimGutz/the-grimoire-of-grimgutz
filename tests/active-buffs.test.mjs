import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { activeWeaponBuffs } from "../scripts/automation/shared/weapon-buffs.mjs";
import { applyDarkWarriorDamageAutomation } from "../scripts/automation/classes/dark-warrior.mjs";
import { beginDemonologistTurn } from "../scripts/automation/classes/demonologist.mjs";
import { forestRootEffect } from "../scripts/automation/classes/forest-lord.mjs";
import { rollDevilGlaiveDamage } from "../scripts/automation/classes/devil-worshipper.mjs";
import { useWitchBladeSealEvil } from "../scripts/automation/classes/witch-blade.mjs";

beforeEach(() => {
  globalThis.game = { user: { id: "gm" }, users: { activeGM: { id: "gm" } }, settings: { get: () => true } };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
});

test("suppressed roots and expired devil glaives are not usable active states", async () => {
  assert.equal(forestRootEffect({ effects: [buff(FLAGS.FOREST_ROOT_EFFECT, { isSuppressed: true })] }), undefined);
  const actor = { items: [{ type: "class", system: { identifier: "devil-worshipper" } }],
    effects: [buff(FLAGS.DEVIL_GLAIVE_EFFECT, { expired: true })] };
  assert.equal(await rollDevilGlaiveDamage(actor), false);
});

test("an evil seal with no selected targets does not spend Rage", async () => {
  game.user.targets = new Set();
  let writes = 0;
  const actor = { items: [{ type: "class", system: { identifier: "witch-blade", levels: 3 } },
    { system: { identifier: "witch-hunter", uses: { spent: 0 } }, async update() { writes++; } }],
    system: { attributes: { prof: 3 }, abilities: { int: { mod: 2 } } } };
  assert.equal(await useWitchBladeSealEvil(actor, {}), false);
  assert.equal(writes, 0);
});

function buff(flag, { disabled = false, expired = false, isSuppressed = false } = {}) {
  return {
    disabled, isSuppressed,
    _source: { duration: { value: 60, units: "seconds", expired } },
    updateDuration: () => ({ remaining: expired ? 0 : 60 }),
    getFlag: (module, key) => module === MODULE_ID && key === flag ? "buff" : null
  };
}

test("disabled, expired and suppressed weapon buffs contribute no automation", () => {
  const flag = FLAGS.WEAPON_BUFF_EFFECT;
  const actor = { effects: [buff(flag), buff(flag, { disabled: true }), buff(flag, { expired: true }), buff(flag, { isSuppressed: true })] };
  assert.equal(activeWeaponBuffs(actor).length, 1);
});

test("expired black magic oil does not add necrotic weapon damage", () => {
  const actor = { effects: [buff(FLAGS.DARK_WARRIOR_OIL_EFFECT, { expired: true })],
    items: [{ type: "class", system: { identifier: "dark-warrior" } }], system: { abilities: { cha: { mod: 3 } } } };
  const config = { subject: { actor, item: { type: "weapon" } }, rolls: [{ parts: [] }] };
  applyDarkWarriorDamageAutomation(config);
  assert.deepEqual(config.rolls[0].parts, []);
  actor.effects = [buff(FLAGS.DARK_WARRIOR_OIL_EFFECT)];
  applyDarkWarriorDamageAutomation(config);
  assert.deepEqual(config.rolls[0].parts, ["3[necrotic]"]);
});

test("demonic vitality stops granting HP on expiry and runs on only one client", async () => {
  let calls = 0;
  const actor = { effects: [buff(FLAGS.DEMONOLOGIST_VITALITY_EFFECT, { expired: true })],
    system: { attributes: { hp: { temp: 0 } } }, async update() { calls++; } };
  await beginDemonologistTurn(actor);
  assert.equal(calls, 0);
  actor.effects = [buff(FLAGS.DEMONOLOGIST_VITALITY_EFFECT)];
  await beginDemonologistTurn(actor);
  assert.equal(calls, 1);
  game.user.id = "player";
  await beginDemonologistTurn(actor);
  assert.equal(calls, 1);
});
