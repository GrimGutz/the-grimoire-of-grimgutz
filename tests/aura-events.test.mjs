import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { AURA_DEFINITIONS } from "../scripts/automation/shared/aura-definitions.mjs";
import { createAuraEventEngine, clearSoulAuraTemporaryHpOnRest, grantSoulAuraTemporaryHp, trackSoulAuraTemporaryHp } from "../scripts/automation/shared/aura-events.mjs";

let frames, tokens, pulses, scene, authority, active, automation, syncs;
function setPath(target, key, value) {
  const parts = key.split("."), last = parts.pop();
  for (const part of parts) target = target[part] ??= {};
  if (last.startsWith("-=")) delete target[last.slice(2)]; else target[last] = value;
}
function actor(id, type = "npc", feature = null) {
  return { uuid: `Actor.${id}`, type, isOwner: true, flags: {}, effects: [], statuses: new Set(),
    items: feature ? [{ uuid: `Actor.${id}.Item.feature`, system: { identifier: feature }, flags: { [MODULE_ID]: { feature } } }] : [],
    system: { attributes: { hp: { value: 20, temp: 0 } }, traits: { size: "med", ci: { value: new Set() } }, details: { type: { value: "humanoid" } } },
    getFlag(module, key) { return this.flags[module]?.[key]; },
    async setFlag(module, key, value) { this.flags[module] ??= {}; this.flags[module][key] = value; },
    async unsetFlag(module, key) { delete this.flags[module]?.[key]; },
    async update(data) { for (const [key, value] of Object.entries(data)) setPath(this, key, value); } };
}
function token(actor, id, x = 0) {
  return { actor, center: { x: x + 50, y: 50 }, document: { id, uuid: `Scene.one.Token.${id}`, x, y: 0, width: 1, height: 1,
    flags: {}, getFlag(module, key) { return this.flags[module]?.[key]; },
    async setFlag(module, key, value) { this.flags[module] ??= {}; this.flags[module][key] = value; } } };
}
function frame(id, source, targets) {
  return { definition: AURA_DEFINITIONS.find(definition => definition.id === id), sourceToken: source, targets, isActive: () => active,
    template: { uuid: "Scene.one.Region.aura", polygonTree: { testPoint: () => true }, elevation: {} } };
}
const context = () => ({ synchronize: async () => { syncs++; }, framesForScene: () => frames, tokensForScene: () => tokens, isAuthority: () => authority,
  pulse: async data => { pulses.push(data); return { aborted: false }; } });
const combat = (tokenId, turn = 0) => ({ id: "combat", started: true, round: 1, turn, scene, combatant: { tokenId }, previous: { round: 0, turn: -1 } });
beforeEach(() => {
  frames = []; tokens = []; pulses = []; authority = true; active = true; automation = true; syncs = 0;
  scene = { id: "one", uuid: "Scene.one", grid: { size: 100, distance: 5, units: "ft", type: 1 } };
  globalThis.game = { settings: { get: () => automation }, scenes: [scene], modules: new Map(), user: { isGM: true } };
  globalThis.canvas = { scene }; globalThis.ui = { notifications: { warn() {} } };
});

test("aura pulses use the specified source/target turn, never movement sync", async () => {
  const fiend = token(actor("fiend", "character", "spirit-fiend"), "fiend"), plague = token(actor("plague", "npc", "аура-заражения-10"), "plague"), enemy = token(actor("enemy"), "enemy", 100);
  tokens = [fiend, plague, enemy]; frames = [frame("spirit-vessel-fiend-flames", fiend, [enemy]), frame("npc-plague-infection", plague, [enemy])];
  const engine = createAuraEventEngine(context());
  await context().synchronize(); await context().synchronize(); assert.equal(pulses.length, 0);
  await engine.turn(combat("fiend"), { round: 1, turn: 0 });
  assert.equal(pulses.length, 1); assert.equal(pulses[0].event.trigger, "sourceStart"); assert.deepEqual(pulses[0].event.damage, [{ formula: "1d6", type: "fire" }]);
  await engine.turn(combat("enemy", 1), { turn: 1 });
  assert.equal(pulses.length, 2); assert.equal(pulses[1].event.trigger, "targetStart"); assert.equal(pulses[1].event.save, "con");
});

test("duplicate callbacks and a GM reload do not repeat an already claimed aura pulse", async () => {
  const source = token(actor("fiend", "character", "spirit-fiend"), "fiend"), enemy = token(actor("enemy"), "enemy", 100);
  frames = [frame("spirit-vessel-fiend-flames", source, [enemy])]; tokens = [source, enemy];
  const c = combat("fiend"), engine = createAuraEventEngine(context());
  await Promise.all([engine.turn(c, { turn: 0 }), engine.turn(c, { turn: 0 })]);
  await createAuraEventEngine(context()).turn(c, { turn: 0 }); assert.equal(pulses.length, 1);
  c.previous = { round: 1, turn: 1 }; await engine.turn(c, { turn: 0 }); assert.equal(pulses.length, 1);
});

test("two different flame sources each retaliate against the same confirmed melee attempt", async () => {
  const first = token(actor("first", "character", "spirit-fiend"), "first"), second = token(actor("second", "character", "spirit-fiend"), "second"), attacker = token(actor("attacker"), "attacker", 1000);
  frames = [frame("spirit-vessel-fiend-flames", first, []), frame("spirit-vessel-fiend-flames", second, [])];
  const engine = createAuraEventEngine(context()), data = { attacker, targets: [first.document.uuid, second.document.uuid], scene, eventKey: "attack-card" };
  await engine.meleeAttempt(data); await engine.meleeAttempt(data);
  assert.equal(pulses.length, 2); assert.ok(pulses.every(pulse => pulse.targets[0] === attacker));
});

test("disabled automation, another GM or an inactive source cannot roll aura damage", async () => {
  const source = token(actor("fiend", "character", "spirit-fiend"), "fiend"), enemy = token(actor("enemy"), "enemy");
  frames = [frame("spirit-vessel-fiend-flames", source, [enemy])]; const engine = createAuraEventEngine(context());
  authority = false; await engine.turn(combat("fiend"), { turn: 0 });
  authority = true; automation = false; await engine.turn(combat("fiend"), { turn: 0 });
  automation = true; active = false; await engine.turn(combat("fiend"), { turn: 0 }); assert.equal(pulses.length, 0);
});

test("latent infections are not reapplied each turn, and disease immunity is not poison immunity", async () => {
  const source = token(actor("plague", "npc", "аура-заражения-10"), "plague"), enemy = token(actor("enemy"), "enemy");
  frames = [frame("npc-plague-infection", source, [enemy])]; const engine = createAuraEventEngine(context());
  enemy.actor.system.traits.ci.value.add("poisoned"); await engine.turn(combat("enemy"), { turn: 0 }); assert.equal(pulses.length, 1);
  enemy.actor.effects.push({ flags: { [MODULE_ID]: { auraPersistentCondition: "hidden-intellect-plague" } } });
  await engine.turn(combat("enemy", 1), { turn: 1 }); assert.equal(pulses.length, 1);
  enemy.actor.effects = []; enemy.actor.system.traits.ci.value.add("diseased");
  await engine.turn(combat("enemy", 2), { turn: 2 }); assert.equal(pulses.length, 1);
});

test("NPC death grants size-based temporary HP once; character 0 HP is not death", async () => {
  const source = token(actor("devil", "character", "aura-of-devastated-souls"), "devil"), deceased = token(actor("npc"), "npc", 100);
  tokens = [source, deceased]; frames = [frame("devil-devastated-souls", source, [])];
  const engine = createAuraEventEngine(context()); engine.seed(deceased.actor);
  deceased.actor.system.attributes.hp.value = 0; await engine.observeActor(deceased.actor, { "system.attributes.hp.value": 0 });
  assert.equal(source.actor.system.attributes.hp.temp, 20); assert.equal(source.actor.flags[MODULE_ID].soulAuraTempHp.remaining, 20);
  source.actor.system.attributes.hp.temp = 0; await engine.death(deceased.actor); assert.equal(source.actor.system.attributes.hp.temp, 0);
  const pc = token(actor("pc", "character"), "pc", 100); tokens.push(pc); engine.seed(pc.actor);
  pc.actor.system.attributes.hp.value = 0; await engine.observeActor(pc.actor, { "system.attributes.hp.value": 0 }); assert.equal(source.actor.system.attributes.hp.temp, 0);
  await engine.death(pc.actor); assert.equal(source.actor.system.attributes.hp.temp, 20); // Explicit dead status.
});

test("soul temporary HP expire after rest, but never overwrite a higher unrelated total", async () => {
  const owner = actor("owner", "character"); await grantSoulAuraTemporaryHp(owner, 30);
  const damage = { "system.attributes.hp.temp": 18 }; trackSoulAuraTemporaryHp(owner, damage); await owner.update(damage);
  assert.equal(owner.flags[MODULE_ID].soulAuraTempHp.remaining, 18);
  await clearSoulAuraTemporaryHpOnRest(owner); assert.equal(owner.system.attributes.hp.temp, 0); assert.equal(owner.flags[MODULE_ID].soulAuraTempHp, undefined);
  owner.system.attributes.hp.temp = 40; assert.equal(await grantSoulAuraTemporaryHp(owner, 20), false);
  await clearSoulAuraTemporaryHpOnRest(owner); assert.equal(owner.system.attributes.hp.temp, 40);
  owner.system.attributes.hp.temp = 0; await grantSoulAuraTemporaryHp(owner, 20);
  const other = { "system.attributes.hp.temp": 50 }; trackSoulAuraTemporaryHp(owner, other); await owner.update(other);
  await clearSoulAuraTemporaryHpOnRest(owner); assert.equal(owner.system.attributes.hp.temp, 50);
});
