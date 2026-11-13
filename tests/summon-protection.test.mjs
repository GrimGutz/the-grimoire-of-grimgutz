import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { applySummonProtection } from "../scripts/automation/shared/summon-combat.mjs";

test("protection caps reduction and damages the spirit only after confirmed application", async () => {
  const gm = { id: "gm", isGM: true },
    users = new Map([[gm.id, gm]]);
  users.activeGM = gm;
  globalThis.game = { user: gm, users, settings: { get: () => true } };
  globalThis.foundry = { utils: { randomID: () => Math.random().toString() } };
  const target = {
    uuid: "Actor.target",
    effects: [],
    system: { attributes: { hp: { value: 10, max: 10, temp: 0, damage: 0 } } }
  };
  const damages = [],
    spirit = {
      uuid: "Actor.spirit",
      async applyDamage(parts) {
        damages.push(parts);
      }
    };
  const flags = { summonProtection: { amount: 8, spiritUuid: spirit.uuid } };
  let deleted = false;
  const effect = {
    uuid: "Actor.target.ActiveEffect.protection",
    parent: target,
    _source: { duration: { value: 6, units: "seconds" } },
    updateDuration: () => ({ remaining: 6 }),
    getFlag: (_module, key) => flags[key],
    async setFlag(module, key, value) {
      flags[key] = value;
    },
    async delete() {
      deleted = true;
    }
  };
  target.effects = [effect];
  globalThis.fromUuid = async uuid =>
    uuid === effect.uuid ? (deleted ? null : effect) : uuid === spirit.uuid ? spirit : target;
  const item = { damageDetail: [{ type: "fire", value: 5 }] };
  const token = { id: "target", actor: target };
  await applySummonProtection(token, { workflow: { id: "workflow", actor: target }, damageItem: item });
  assert.equal(item.damageDetail[0].value, 0);
  assert.equal(damages.length, 0);
  const data = item.calcDamageOptions[MODULE_ID].protection;
  assert.equal(data.reduction, 5);
  await requestGm("commit-spirit-protection", target, data);
  assert.deepEqual(damages, [[{ value: 5, type: "force" }]]);
  await requestGm("commit-spirit-protection", target, data);
  assert.equal(damages.length, 1);
});
