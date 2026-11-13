import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  ctx,
  actor,
  source,
  target,
  item,
  act,
  use,
  setupFactory,
  owned,
  encounter,
  attack
} from "./factory-fixture.mjs";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { FACTORY_AUGMENTS } from "../scripts/automation/shared/factory-augments.mjs";
import { FACTORY_FEATURES } from "../scripts/automation/shared/factory-definitions.mjs";
import { factoryDocuments, factoryFolders } from "../src/packs/factory-features.mjs";
import { factoryTransformationDocuments } from "../src/packs/factory-transformation.mjs";
import {
  factoryLevel,
  factoryDC,
  factoryHas,
  factoryState,
  patchFactory,
  factoryRecords,
  factoryActiveRecords,
  factoryAugment,
  factoryCapacity,
  factoryInstallFailures,
  factoryAddicted,
  factoryRegeneration,
  validateFactoryItem,
  validateFactoryAdvancement,
  inspectFactory
} from "../scripts/automation/transformations/factory.mjs";
import { factoryPassiveDefinitions, syncFactory } from "../scripts/automation/transformations/factory-passives.mjs";
import {
  factoryUpgradeItem,
  factoryItemFingerprint,
  syncFactoryItems
} from "../scripts/automation/transformations/factory-items.mjs";
import {
  factoryMaterials,
  factoryHomunculusRecipe,
  factoryChildren
} from "../scripts/automation/transformations/factory-homunculi.mjs";
import { controlFactory } from "../scripts/automation/transformations/factory-actions.mjs";
import {
  installFactoryHooks,
  malfunctionFactory,
  runFactoryTurn,
  handleFactoryTurn,
  factoryDamageEvent
} from "../scripts/automation/transformations/factory-events.mjs";
import { runFactoryFortitude, applyFactoryDefense } from "../scripts/automation/transformations/factory-defense.mjs";
import { applyFactoryDamage } from "../scripts/automation/transformations/factory-damage.mjs";
import {
  prepareFactoryAttenuation,
  prepareFactoryFirstAttack,
  finishFactoryFirstAttack
} from "../scripts/automation/transformations/factory-attacks.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { listAutomationEvents } from "../scripts/automation/shared/event-ledger.mjs";
import { factoryPulse } from "../scripts/automation/transformations/factory-use.mjs";
import { prepareConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";

beforeEach(setupFactory);
async function installed(id, recipient = actor, extra = {}) {
  const r = {
    id: `r-${id}`,
    augmentId: id,
    ownerUuid: actor.uuid,
    snapshot: { int: 2, tier: 4, dc: 19, prof: 5, imperfections: true },
    ...extra
  };
  await recipient.setFlag(MODULE_ID, "factoryAugments", [...factoryRecords(recipient), r]);
  const i = owned(factoryUpgradeItem(recipient, r), recipient);
  recipient.items.push(i);
  await i.setFlag(MODULE_ID, "factoryManagedFingerprint", factoryItemFingerprint(i));
  return { record: r, item: i };
}
const def = id => FACTORY_AUGMENTS.find(a => a.id === id);
test("reflection provenance survives resolving the real activity instead of its transient clone", async () => {
  await factoryPulse(source, item("grounding"), [target], {
    damage: [{ formula: "8", type: "lightning" }],
    requestId: "reflection-origin",
    metadata: { factoryReflection: true }
  });
  const native = ctx.calls[0].activity,
    packet = { damageDetail: [{ type: "lightning", value: 8 }] },
    workflow = {
      id: "reflected-damage",
      actor,
      activity: native,
      token: source,
      workflowOptions: { grimgutzAuraPulse: true },
      targets: new Set([{ document: target, actor: target.actor }])
    };
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow, damageItem: packet });
  assert.equal(packet.calcDamageOptions[MODULE_ID].damageEvent.factoryReflection, true);
});
test("confirmed reflected damage never offers another grounding reaction", async () => {
  await factoryDamageEvent({
    actor,
    amount: 8,
    event: {
      workflowId: "reflected",
      sourceTokenUuid: target.uuid,
      targetTokenUuid: source.uuid,
      activityUuid: act("grounding", "grounding").uuid,
      damageTypes: ["lightning"],
      factoryReflection: true
    }
  });
  assert.equal(ctx.prompts.length, 0);
  assert.equal(ctx.calls.length, 0);
});
test("air walkers grant flight only in own turn, not permanently", async () => {
  await installed("air-walkers");
  assert.ok(
    !factoryPassiveDefinitions(actor).some(e => e.system.changes.some(c => c.key === "system.attributes.movement.fly"))
  );
  const combat = encounter();
  assert.ok(
    factoryPassiveDefinitions(actor).some(e => e.system.changes.some(c => c.key === "system.attributes.movement.fly"))
  );
  combat.turn = 1;
  combat.combatant = combat.turns[1];
  assert.ok(
    !factoryPassiveDefinitions(actor).some(e => e.system.changes.some(c => c.key === "system.attributes.movement.fly"))
  );
});
test("first attack cancelled before rolling does not spend the next first-attack bonus", async () => {
  await installed("berserk");
  await installed("reflexes");
  encounter();
  const a = attack(),
    seen = [],
    workflow = {
      id: "cancel-first",
      actor,
      activity: a,
      token: source,
      attackRollModifierTracker: { advantage: { add: (...p) => seen.push(p) } }
    };
  await prepareFactoryFirstAttack(workflow);
  await finishFactoryFirstAttack(workflow);
  await prepareFactoryFirstAttack({ ...workflow, id: "actual-first" });
  assert.equal(seen.length, 2);
});

test("real installation consumes exact gold and one rest operation, then applies recipient effect", async () => {
  await patchFactory(actor, { shortRest: { id: "sr", used: false } });
  ctx.answers.push([target.uuid], "new", "legs", "tendons", "yes");
  assert.equal((await use("innovation", "install", "install-target")).status, "success");
  assert.equal(actor.system.currency.gp, 4900);
  assert.equal(target.actor.system.attributes.movement.walk, 40);
  assert.equal(factoryRecords(target.actor).length, 1);
  assert.equal(factoryState(actor).shortRest.used, true);
  assert.equal(factoryState(actor).lastAugmentAt, 0);
  assert.equal(ctx.calls[0].activity.activation.type, "special");
});
test("installation cancellation before confirmation is free", async () => {
  await patchFactory(actor, { shortRest: { id: "sr", used: false } });
  ctx.answers.push([source.uuid], "new", "legs", "tendons", "no");
  assert.equal((await use("innovation", "install")).status, "cancelled");
  assert.equal(actor.system.currency.gp, 5000);
  assert.equal(factoryRecords(actor).length, 0);
  assert.equal(ctx.calls.length, 0);
  assert.equal(factoryState(actor).shortRest.used, false);
});
test("creation failure rolls back confirmed gold and leaves rest unused", async () => {
  await patchFactory(actor, { shortRest: { id: "sr", used: false } });
  actor.createEmbeddedDocuments = async () => {
    throw Error("create failed");
  };
  ctx.answers.push([source.uuid], "new", "legs", "tendons", "yes");
  assert.equal((await use("innovation", "install")).status, "needs-review");
  assert.equal(actor.system.currency.gp, 5000);
  assert.equal(factoryRecords(actor).length, 0);
  assert.equal(factoryState(actor).shortRest.used, false);
});
test("empty gold cannot create or spend native action", async () => {
  await actor.update({ "system.currency.gp": 99 });
  await patchFactory(actor, { shortRest: { id: "sr", used: false } });
  ctx.answers.push([source.uuid], "new", "legs", "tendons");
  await assert.rejects(use("innovation", "install"), /100/);
  assert.equal(ctx.calls.length, 0);
  assert.equal(factoryRecords(actor).length, 0);
});
test("same request cannot charge twice or reopen installation dialog", async () => {
  await patchFactory(actor, { shortRest: { id: "sr", used: false } });
  ctx.answers.push([source.uuid], "new", "legs", "tendons", "yes");
  await use("innovation", "install", "same-install");
  const prompts = ctx.prompts.length;
  await use("innovation", "install", "same-install");
  assert.equal(actor.system.currency.gp, 4900);
  assert.equal(ctx.prompts.length, prompts);
});
test("homunculus creation produces real native attacks and consumes LR ticket only once", async () => {
  await patchFactory(actor, { longRest: { id: "lr", used: false } });
  ctx.answers.push("wood", "yes");
  assert.equal((await use("homunculus", "create")).status, "success");
  const child = factoryChildren(actor)[0];
  assert.ok(child);
  assert.equal(child.system.attributes.hp.max, 40);
  assert.equal(child.system.attributes.ac.flat, 15);
  assert.ok(child.items.some(i => [...i.system.activities.values()].some(a => a.type === "attack")));
  assert.equal(factoryState(actor).longRest.used, true);
  assert.equal(actor.system.currency.gp, 5000);
});
test("minute repair uses a real hit die and never calls a full rest", async () => {
  ctx.answers.push("yes");
  await use("armor", "repair-start");
  await assert.rejects(use("armor", "repair"), /минуту/);
  game.time.worldTime = 60;
  ctx.answers.push("yes", "d10");
  assert.equal((await use("armor", "repair")).status, "success");
  assert.equal(ctx.hitDice[0].denomination, "d10");
  assert.equal(ctx.calls.length, 0);
});
test("first-attack advantage applies only in own turn, not again to second attack", async () => {
  await installed("berserk");
  await installed("reflexes");
  encounter();
  const a = attack(),
    seen = [],
    workflow = {
      id: "first",
      actor,
      activity: a,
      token: source,
      attackRollModifierTracker: { advantage: { add: (...p) => seen.push(p) } }
    };
  await prepareFactoryFirstAttack(workflow);
  await prepareFactoryFirstAttack({ ...workflow, id: "second" });
  assert.equal(seen.length, 1);
});
test("attenuation rolls once for eligible spell and locks until own turn begins", async () => {
  await installed("attenuation", target.actor);
  encounter();
  const a = attack(actor, { spell: true, melee: false }),
    wrapped = { actor: target.actor, document: target },
    workflow = { id: "ray", actor, item: a.item, activity: a, token: source, targets: new Set([wrapped]) };
  ctx.answers.push("yes");
  await prepareFactoryAttenuation(workflow);
  assert.equal(workflow.targets.size, 0);
  assert.equal(factoryState(target.actor).attenuationLocked, true);
  assert.deepEqual(ctx.rolls, ["1d6"]);
  await prepareFactoryAttenuation({ ...workflow, id: "ray-second", targets: new Set([wrapped]) });
  assert.equal(ctx.rolls.length, 1);
  await runFactoryTurn({ operation: "start", sourceTokenUuid: target.uuid, sceneId: canvas.scene.id });
  assert.equal(factoryState(target.actor).attenuationLocked, false);
});
test("charged packet bonus uses final lightning protection and cannot repeat callback", async () => {
  await installed("charged");
  const a = attack(),
    workflow = {
      id: "charged",
      actor,
      item: a.item,
      activity: a,
      token: source,
      attackRoll: {},
      hitTargets: new Set([{ actor: target.actor, document: target }])
    },
    p = { damageDetail: [{ type: "slashing", value: 8 }], rawDamageDetail: [{ type: "slashing", value: 8 }] };
  ctx.answers.push("yes");
  await applyFactoryDamage({ actor: target.actor, document: target }, { workflow, damageItem: p });
  assert.equal(p.damageDetail.find(p => p.type === "lightning").value, 6);
  await applyFactoryDamage({ actor: target.actor, document: target }, { workflow, damageItem: p });
  assert.deepEqual(ctx.rolls, ["1d10"]);
});

test("Factory source has 18 main cards, 51 upgrades, eight materials and nine folders", () => {
  assert.equal(FACTORY_FEATURES.length, 18);
  assert.equal(FACTORY_AUGMENTS.length, 51);
  assert.equal(factoryDocuments.length, 77);
  assert.equal(factoryFolders.length, 9);
  assert.equal(factoryDocuments.filter(d => d.flags[MODULE_ID].factoryFlaw).length, 4);
  assert.ok(
    factoryDocuments.every(d => !d.effects.length && d.system.description.value.includes("Автоматизация Foundry:"))
  );
});
test("main transformation stays separate, with cumulative 1/6/11/16 advancement", () => {
  const root = factoryTransformationDocuments[0];
  assert.equal(root.folder, null);
  assert.deepEqual(
    root.system.advancement.filter(a => a.type === "ItemGrant").map(a => [a.level, a.configuration.items.length]),
    [
      [1, 3],
      [6, 1],
      [11, 1],
      [16, 1]
    ]
  );
  assert.deepEqual(
    root.system.advancement.filter(a => a.type === "ItemChoice").map(a => a.configuration.pool.length),
    [4, 8, 12]
  );
});
test("tier and save DC follow character boundaries, references do not raise tier", async () => {
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
    assert.equal(factoryLevel(actor), tier);
    assert.equal(factoryDC(actor), 8 + 5 + tier + 2);
  }
});
test("optional prerequisites default off and reject only INT below 13 when enabled", async () => {
  await actor.update({ "system.abilities.int.value": 10 });
  const root = actor.items.find(i => i.system.identifier === "factory-transformation");
  assert.notEqual(validateFactoryItem(root, null, null, "gm"), false);
  game.settings.get = () => true;
  assert.equal(validateFactoryItem(root, null, null, "gm"), false);
});
test("advancement rejects missing prerequisite and duplicate boon", () => {
  assert.equal(validateFactoryAdvancement({ actor }, null, [item("living")], null, []), false);
  const a = { items: actor.items.filter(i => i !== item("homunculus")) };
  assert.equal(validateFactoryAdvancement({ actor: a }, null, [item("modified")], null, []), false);
});
test("dependency gates iron/crystal and adamantine/mithral materials", async () => {
  assert.equal(factoryMaterials(actor).length, 8);
  await item("modified").delete();
  assert.deepEqual(factoryMaterials(actor), ["clay", "wood", "flesh", "stone"]);
  assert.ok(!factoryHas(actor, "immortal"));
});
test("self Deus adds one slot to each body area, never to others", () => {
  assert.deepEqual(factoryCapacity(actor, actor), { head: 2, body: 4, arms: 3, legs: 3 });
  assert.deepEqual(factoryCapacity(actor, target.actor), { head: 1, body: 3, arms: 2, legs: 2 });
});
test("without sculptor other recipients have one total slot", async () => {
  await item("sculptor").delete();
  await installed("tendons", target.actor);
  assert.deepEqual(factoryCapacity(actor, target.actor), { total: 1 });
  assert.ok(factoryInstallFailures(actor, target.actor, def("skin")).includes("нет свободного слота"));
});
test("slots count all creators and reject duplicate upgrades", async () => {
  await installed("senses", actor, { ownerUuid: "Actor.other" });
  assert.ok(factoryInstallFailures(actor, actor, def("senses")).includes("это улучшение уже установлено"));
  await installed("reflexes");
  assert.ok(factoryInstallFailures(actor, actor, def("neural")).includes("нет свободного слота"));
});
test("replacing an upgrade frees only its slot and tier gates remain enforced", async () => {
  const { record } = await installed("senses");
  await installed("reflexes");
  assert.deepEqual(factoryInstallFailures(actor, actor, def("neural"), record.id), []);
  await item("deus").delete();
  assert.ok(factoryInstallFailures(actor, actor, def("drive")).includes("нужен Deus Ex Machanicus"));
});
test("configured manufactured form applies capped real stats and chosen type only once", async () => {
  await patchFactory(actor, { physical: "dex", bodyType: "construct" });
  await syncFactory(actor);
  await syncFactory(actor);
  assert.equal(actor.system.abilities.int.value, 16);
  assert.equal(actor.system.abilities.dex.value, 15);
  assert.equal(actor.system.details.type.value, "construct");
  assert.equal(actor.effects.filter(e => e.getFlag(MODULE_ID, "factoryPassive") === "form").length, 1);
});
test("form never lowers high stats and improved stats do not grow max on every sync", async () => {
  await actor.update({ "system.abilities.int.value": 20 });
  await installed("con");
  await syncFactory(actor);
  await syncFactory(actor);
  assert.equal(actor.system.abilities.int.value, 20);
  assert.equal(actor.system.abilities.con.value, 16);
  assert.equal(actor.system.abilities.con.max, 22);
});
test("focus affects concentration only; second mind uses native limit", async () => {
  await installed("focus");
  await installed("second-mind");
  const changes = factoryPassiveDefinitions(actor).flatMap(e => e.system.changes);
  assert.ok(changes.some(c => c.key === "system.attributes.concentration.roll.mode" && c.value === "1"));
  assert.ok(changes.some(c => c.key === "system.attributes.concentration.limit" && c.value === "2"));
  assert.ok(!changes.some(c => c.key === "system.abilities.con.roll.mode"));
});
test("flavor-only lungs, rested and back do not create empty active effects", async () => {
  for (const id of ["lungs", "rested", "back"]) await installed(id);
  assert.ok(factoryPassiveDefinitions(actor).every(e => e.system.changes.length));
  assert.ok(
    !factoryPassiveDefinitions(actor).some(e => String(e.flags[MODULE_ID].factoryPassive).startsWith("augment:"))
  );
});
test("addiction starts after first real operation, 72h normally or 24h with withdrawal", async () => {
  assert.equal(factoryAddicted(actor), false);
  await item("withdrawal").delete();
  await patchFactory(actor, { lastAugmentAt: 0 });
  game.time.worldTime = 259199;
  assert.equal(factoryAddicted(actor), false);
  game.time.worldTime++;
  assert.equal(factoryAddicted(actor), true);
  actor.items.push(
    owned(
      factoryDocuments.find(d => d.system.identifier === "factory-withdrawal"),
      actor
    )
  );
  game.time.worldTime = 86400;
  assert.equal(factoryAddicted(actor), true);
});
test("addiction removes concentration but a new install timestamp restores only its own vulnerability", async () => {
  await actor.beginConcentrating(null, {});
  await patchFactory(actor, { lastAugmentAt: 0 });
  game.time.worldTime = 86400;
  await syncFactory(actor);
  assert.equal(actor.concentration.effects.size, 0);
  assert.ok(actor.system.traits.dv.value.includes("psychic"));
  await patchFactory(actor, { lastAugmentAt: game.time.worldTime });
  await syncFactory(actor);
  assert.ok(!actor.system.traits.dv?.value?.includes("psychic"));
});
test("regeneration stops at half max, never at zero or over half", async () => {
  await actor.update({ "system.attributes.hp.value": 28 });
  assert.equal(factoryRegeneration(actor), 2);
  await actor.update({ "system.attributes.hp.value": 0 });
  assert.equal(factoryRegeneration(actor), 0);
  await actor.update({ "system.attributes.hp.value": 31 });
  assert.equal(factoryRegeneration(actor), 0);
});
test("critical malfunction disables all installed tiers and preserves item uses", async () => {
  const heart = await installed("heart"),
    tendons = await installed("tendons"),
    strength = await installed("str");
  await heart.item.update({ "system.uses.spent": 1 });
  await syncFactory(actor);
  assert.equal(actor.system.attributes.movement.walk, 40);
  await malfunctionFactory(actor, "crit-one");
  assert.equal(factoryActiveRecords(actor).length, 0);
  assert.equal(actor.system.attributes.movement.walk, 30);
  assert.equal(heart.item.system.uses.spent, 1);
  assert.equal(factoryRecords(actor).length, 3);
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "factoryMalfunction")).duration.value, 60);
});
test("malfunction ends early on INT against saved creator DC", async () => {
  await installed("tendons", target.actor);
  await malfunctionFactory(target.actor, "crit-target");
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "factoryMalfunction"));
  await runFactoryTurn({ operation: "end", sourceTokenUuid: target.uuid, sceneId: canvas.scene.id, effects: [e.uuid] });
  assert.equal(ctx.saves[0].ability, "int");
  assert.equal(ctx.saves[0].target, e.getFlag(MODULE_ID, "factoryMalfunction").dc);
  assert.equal(factoryActiveRecords(target.actor).length, 1);
});
test("replayed critical callback does not restart minute timer", async () => {
  await installed("tendons");
  await malfunctionFactory(actor, "same-crit");
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "factoryMalfunction"));
  game.time.worldTime = 20;
  await malfunctionFactory(actor, "same-crit");
  assert.equal(actor.effects.find(e => e.getFlag(MODULE_ID, "factoryMalfunction")).uuid, e.uuid);
  assert.equal(e.start.time, 0);
});
test("expired malfunction restores upgrades without deleting them", async () => {
  await installed("tendons");
  await malfunctionFactory(actor, "expiry-crit");
  game.time.worldTime = 60;
  assert.equal(factoryActiveRecords(actor).length, 1);
  await syncFactory(actor);
  assert.equal(actor.system.attributes.movement.walk, 40);
});
test("second heart uses native action, half maximum and once-per-long-rest stock", async () => {
  const heart = await installed("heart");
  await actor.update({ "system.attributes.hp.value": 5 });
  const activity = [...heart.item.system.activities.values()][0];
  assert.equal((await controlFactory(actor, activity)).status, "success");
  assert.equal(actor.system.attributes.hp.value, 35);
  assert.equal(heart.item.system.uses.spent, 1);
  assert.equal(ctx.calls[0].activity.activation.type, "action");
  assert.equal(heart.item.system.uses.recovery[0].period, "lr");
  await controlFactory(actor, activity);
  assert.equal(actor.system.attributes.hp.value, 35);
});
test("cancelled native heart use neither heals nor spends", async () => {
  const heart = await installed("heart");
  ctx.nativeMode = false;
  await controlFactory(actor, [...heart.item.system.activities.values()][0]);
  assert.equal(heart.item.system.uses.spent, 0);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("firewall gets second stock only with a real active neural implant", async () => {
  const f = await installed("firewall");
  assert.equal(f.item.system.uses.max, "1");
  await installed("neural", actor, { save: "wis" });
  await syncFactoryItems(actor);
  assert.equal(f.item.system.uses.max, "2");
});
test("managed generated cards preserve manual edits and spent charges", async () => {
  const heart = await installed("heart");
  await heart.item.update({ "system.description.value": "My manual description", "system.uses.spent": 1 });
  await syncFactoryItems(actor);
  assert.equal(heart.item.system.description.value, "My manual description");
  assert.equal(heart.item.system.uses.spent, 1);
});
test("fangs and mantis are real weapons with flat creator-mod attacks and explicit damage", async () => {
  for (const id of ["fangs", "mantis"]) {
    const r = await installed(id, actor, { ability: "int" }),
      a = [...r.item.system.activities.values()].find(a => a.type === "attack");
    assert.equal(a.attack.bonus, "7");
    assert.equal(a.damage.includeBase, false);
    assert.equal(a.damage.parts[0].number, 2);
    assert.equal(a.damage.parts[0].denomination, id === "fangs" ? 4 : 6);
  }
});
test("eight homunculus recipes have numeric HP and creator attack bonus, not STR bonus", () => {
  for (const material of factoryMaterials(actor)) {
    const r = factoryHomunculusRecipe(actor, material);
    assert.equal(r.hpFormula, String(r.hp));
    assert.equal(r.features[0].activities[0].attackBonus, 9);
    assert.equal(r.features[0].activities[0].formula, "1d12 + 4");
    assert.equal(r.unique, false);
    assert.ok(!r.lifecycle);
    assert.equal(r.features.length, 2);
  }
});
test("homunculus material stats include adamantine and mithral special bases", () => {
  assert.equal(factoryHomunculusRecipe(actor, "stone").ac, 17);
  assert.equal(factoryHomunculusRecipe(actor, "iron").ac, 19);
  assert.equal(factoryHomunculusRecipe(actor, "adamantine").ac, 24);
  assert.equal(factoryHomunculusRecipe(actor, "adamantine").hp, 80);
  assert.equal(factoryHomunculusRecipe(actor, "mithral").movement.walk, 40);
});
test("all eight material descriptions include real rules, not only a generic block", () => {
  const wood = factoryDocuments.find(d => d.system.identifier === "factory-material-wood");
  assert.match(wood.system.description.value, /15 фут/);
  const crystal = factoryDocuments.find(d => d.system.identifier === "factory-material-crystal");
  assert.match(crystal.system.description.value, /20 фут/);
});
test("rest receipt decrements ascension cooldown once; a short rest never decrements", async () => {
  await patchFactory(actor, { ascensionRests: 3 });
  await requestGm("factory-rest", actor, { long: true }, { requestId: "rest-once" });
  await requestGm("factory-rest", actor, { long: true }, { requestId: "rest-once" });
  assert.equal(factoryState(actor).ascensionRests, 2);
  await requestGm("factory-rest", actor, { long: false }, { requestId: "short-rest" });
  assert.equal(factoryState(actor).ascensionRests, 2);
  assert.equal(factoryState(actor).shortRest.used, false);
});
test("fortitude excludes radiant/critical and repeated request cannot heal twice", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  assert.equal(await runFactoryFortitude(actor, { amount: 8, radiant: true, requestId: "radiant" }), false);
  assert.equal(await runFactoryFortitude(actor, { amount: 8, critical: true, requestId: "critical" }), false);
  ctx.answers.push("yes");
  await runFactoryFortitude(actor, { amount: 8, requestId: "fortitude" });
  assert.equal(actor.system.attributes.hp.value, 1);
  assert.equal(ctx.saves[0].target, 13);
  await actor.update({ "system.attributes.hp.value": 0 });
  await runFactoryFortitude(actor, { amount: 8, requestId: "fortitude" });
  assert.equal(ctx.saves.length, 1);
  assert.equal(actor.system.attributes.hp.value, 0);
});
test("start-turn events work without combat.scene and second callback does not heal again", async () => {
  await actor.update({ "system.attributes.hp.value": 5 });
  const c = encounter();
  await patchFactory(actor, { arcReady: false });
  await handleFactoryTurn(c, { turn: 0 });
  assert.equal(actor.system.attributes.hp.value, 15);
  assert.equal(factoryState(actor).arcReady, true);
  await handleFactoryTurn(c, { turn: 0 });
  assert.equal(actor.system.attributes.hp.value, 15);
});
test("other-scene events queue instead of healing behind the GM", async () => {
  await actor.update({ "system.attributes.hp.value": 5 });
  const c = encounter();
  canvas.scene = { id: "elsewhere" };
  await handleFactoryTurn(c, { turn: 0 });
  assert.equal(actor.system.attributes.hp.value, 5);
  assert.equal((await listAutomationEvents()).find(e => e.kind === "factory-turn").state, "queued");
});
test("perfection only reduces nonmagical physical attacks, never all bludgeoning", () => {
  const a = attack(target.actor),
    workflow = { id: "physical", item: a.item, activity: a },
    p = { damageDetail: [{ type: "slashing", value: 12, active: {} }] };
  applyFactoryDefense({ actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail[0].value, 6);
  const magic = { damageDetail: [{ type: "slashing", value: 12 }] };
  applyFactoryDefense({ actor }, { workflow: { ...workflow, item: { type: "spell" } }, damageItem: magic });
  assert.equal(magic.damageDetail[0].value, 12);
  const falling = { damageDetail: [{ type: "bludgeoning", value: 12 }] };
  applyFactoryDefense({ actor }, { workflow: { ...workflow, activity: { type: "damage" } }, damageItem: falling });
  assert.equal(falling.damageDetail[0].value, 12);
});
test("perfection does not halve already resisted damage again", () => {
  const a = attack(target.actor),
    p = { damageDetail: [{ type: "piercing", value: 6, active: { resistance: true } }] };
  applyFactoryDefense({ actor }, { workflow: { id: "resisted", activity: a, item: a.item }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 6);
});
test("passives use installed creator INT, not recipient INT", async () => {
  await installed("reflexes", target.actor);
  await target.actor.update({ "system.abilities.int.value": 8 });
  const changes = factoryPassiveDefinitions(target.actor).flatMap(e => e.system.changes);
  assert.equal(changes.find(c => c.key === "system.attributes.init.bonus").value, "2");
});
test("instruction cards do not secretly install upgrades or spend resources", async () => {
  const ref = owned(
    factoryDocuments.find(d => d.system.identifier === "factory-upgrade-tendons"),
    target.actor
  );
  target.actor.items.push(ref);
  await syncFactory(target.actor);
  assert.equal(target.actor.system.attributes.movement.walk, 30);
  assert.equal(factoryRecords(target.actor).length, 0);
});
test("hook installation registers native interception, rest, turn and concentration hooks", () => {
  installFactoryHooks();
  for (const h of [
    "dnd5e.preUseActivity",
    "midi-qol.preTargetingV2",
    "dnd5e.restCompleted",
    "updateCombat",
    "dnd5e.preBeginConcentrating"
  ])
    assert.ok(ctx.hooks.get(h)?.length, h);
});
test("installed attacks are blocked while malfunction is active", async () => {
  await installed("fangs");
  await malfunctionFactory(actor, "blocked");
  installFactoryHooks();
  const a = [
    ...actor.items.find(i => i.system.identifier === "factory-installed-fangs").system.activities.values()
  ].find(a => a.type === "attack");
  assert.equal(ctx.hooks.get("dnd5e.preUseActivity")[0](a), false);
});
test("public registries include Factory and packet order keeps narrow defenses last", () => {
  assert.equal(typeof getAutomationActionHandlers().get("factory-control"), "function");
  assert.equal(typeof getAutomationActionHandlers().get("factory-homunculus"), "function");
  const handlers = getMidiHookHandlers();
  assert.equal(typeof handlers.applyFactoryDamage, "function");
  const order = MIDI_QOL_HOOKS.filter(([h]) => h === "midi-qol.preTargetDamageApplication").map(([, n]) => n);
  assert.ok(order.indexOf("applyFactoryDamage") < order.indexOf("prepareConfirmedDamage"));
  assert.ok(order.indexOf("applyFactoryDefense") > order.indexOf("prepareConfirmedDamage"));
});
test("diagnostics are read-only, include receipts and disabled upgrades", async () => {
  await installed("tendons");
  const before = actor.toObject();
  assert.equal(inspectFactory(actor).augments.length, 1);
  assert.deepEqual(actor.toObject(), before);
});
test("Factory links do not rewrite other classes' same-name features", () => {
  const other = {
      _id: "other",
      name: "Other",
      system: { description: { value: "Улучшенная Сила и Фабрика инноваций" } }
    },
    root = structuredClone(factoryTransformationDocuments[0]);
  linkDocumentDescriptions([
    { name: "transformations", documents: [root] },
    { name: "features", documents: [...factoryDocuments, other] }
  ]);
  assert.equal(other.system.description.value, "Улучшенная Сила и Фабрика инноваций");
});
