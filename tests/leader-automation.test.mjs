import assert from "node:assert/strict";
import { test } from "node:test";
import { STRATAGEM_RULES, leaderDie, leaderDistance, movementChanges } from "../scripts/automation/classes/leader-stratagems.mjs";
import { maximizeHitDiceParts, resumeLeaderHitDie } from "../scripts/automation/classes/leader-events.mjs";
import { matchesAttackBenefit } from "../scripts/automation/shared/combat-benefits.mjs";
import { leaderDocuments as documents } from "../src/packs/leader-features.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";

test("all seventeen authored stratagems have explicit handlers", () => {
  const cards = documents.filter(card => card.flags[MODULE_ID].stratagem);
  assert.equal(cards.length, 17); assert.deepEqual(new Set(cards.map(card => card.system.identifier)), new Set(Object.keys(STRATAGEM_RULES)));
});
test("resuming a native Hit Die does not prepend a second native healing formula or double its hooks", async () => {
  const callbacks = new Map(); let prepared;
  globalThis.Hooks = {on: (name, callback) => {callbacks.set(name, callback); return name;}, off: name => callbacks.delete(name)};
  const users = []; users.activeGM = {id: "gm"};
  globalThis.game = {user: {id: "gm", isGM: true}, users, settings: {get: () => true}, time: {worldTime: 0}};
  globalThis.foundry = {utils: {randomID: () => "die-roll", escapeHTML: String}, applications: {api: {DialogV2: {wait: async () => "yes"}}}};
  const state = {kind: "maximize-hit-dice", remaining: 2}, effect = {uuid: "effect", name: "Comfort", getFlag: () => state,
    async setFlag(_module, _key, next) {Object.assign(state, next);}, async delete() {throw Error("One die cannot consume two bonuses");}};
  const actor = {uuid: "actor", effects: [effect], async rollHitDie(config) {
    const current = {...config, subject: this, rolls: [{parts: ["max(0, 1d8 + @abilities.con.mod)"]}, ...(config.rolls ?? [])]};
    callbacks.get("dnd5e.preRollHitDie")(current); prepared = current; return [{total: 10}];
  }}; effect.parent = actor; globalThis.fromUuid = async () => effect;
  await resumeLeaderHitDie({subject: actor, denomination: "d8", hookNames: ["hitDie"], rolls: [{parts: ["max(0, 1d8 + @abilities.con.mod)"]}]});
  assert.equal(prepared.rolls.length, 1);
  assert.deepEqual(prepared.rolls[0].parts, ["max(0, 8 + @abilities.con.mod)"]);
  assert.equal(prepared.hookNames, undefined); assert.equal(state.remaining, 1); assert.equal(state.reserved, null);
});
test("leader dice and battlefield-conductor distances scale without doubling unrelated ranges", () => {
  const actor = { items: [{ type: "class", system: { identifier: "leader", levels: 1 } }] };
  assert.equal(leaderDie(actor), 4); actor.items[0].system.levels = 3; assert.equal(leaderDie(actor), 6);
  actor.items[0].system.levels = 5; assert.equal(leaderDie(actor), 8);
  actor.items.push({ system: { identifier: "battlefield-conductor" } });
  assert.equal(leaderDistance(actor, 30), 60); assert.equal(leaderDistance(actor, 60), 120); assert.equal(leaderDistance(actor, 5), 5);
});
test("movement bonus converts to actor units and never grants a new movement mode", () => {
  globalThis.game = {}; globalThis.canvas = {};
  const changes = movementChanges({ system: { attributes: { movement: { units: "m", walk: 9, fly: 0 } } } }, 10);
  assert.equal(changes.length, 1); assert.ok(Math.abs(Number(changes[0].value) - 3.048) < 0.001);
});
test("hit die maximization changes only the allowed dice, preserving remaining dice and modifiers", () => {
  assert.deepEqual(maximizeHitDiceParts(["3d8", "2"], 2), { parts: ["16 + 1d8", "2"], used: 2 });
  assert.deepEqual(maximizeHitDiceParts(["1d10", "-1"], 0), { parts: ["1d10", "-1"], used: 0 });
});
test("dodge and marks distinguish the recipient's attacking and defending roles", () => {
  const effect = kind => ({ flags: { [MODULE_ID]: { combatBenefit: { kind, targetTokenUuid: "recipient" } } } });
  const attacker = { uuid: "recipient" }, target = { uuid: "enemy" };
  assert.equal(matchesAttackBenefit(effect("dodge"), { attacker, target }), false);
  assert.equal(matchesAttackBenefit(effect("attack-advantage"), { attacker, target }), true);
});
