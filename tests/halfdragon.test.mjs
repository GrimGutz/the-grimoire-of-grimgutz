import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { ctx, actor, source, target, setupFactory, owned, attack, encounter } from "./factory-fixture.mjs";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { HALFDRAGON_FEATURES, HALFDRAGON_ANCESTRIES } from "../scripts/automation/shared/halfdragon-definitions.mjs";
import { halfdragonDocuments, halfdragonFolders } from "../src/packs/halfdragon-features.mjs";
import { halfdragonTransformationDocuments } from "../src/packs/halfdragon-transformation.mjs";
import {
  hdState,
  hdRules,
  hdPatch,
  hdLevel,
  hdHas,
  hdDC,
  hdAncestry,
  hdPoolMaximum,
  hdBreathSpec,
  halfdragonPassiveDefinitions,
  syncHalfdragon,
  hdGuardActive,
  validateHalfdragonItem,
  validateHalfdragonAdvancement,
  inspectHalfdragon
} from "../scripts/automation/transformations/halfdragon.mjs";
import { hdExpense, hdAvailableHitDice, hdCondition } from "../scripts/automation/transformations/halfdragon-use.mjs";
import {
  resolveHalfdragonSangromancy,
  halfdragonBreath
} from "../scripts/automation/transformations/halfdragon-areas.mjs";
import {
  applyHalfdragonBite,
  finishHalfdragonAttack,
  halfdragonAttackData
} from "../scripts/automation/transformations/halfdragon-combat.mjs";
import {
  installHalfdragonHooks,
  handleHalfdragonTurn,
  captureHalfdragonHp,
  observeHalfdragonHp,
  clearHalfdragonRoarHp,
  wakeHalfdragonGas,
  syncHalfdragonLight
} from "../scripts/automation/transformations/halfdragon-events.mjs";
import {
  halfdragonLivingRecipe,
  dismissHalfdragonLiving
} from "../scripts/automation/transformations/halfdragon-summons.mjs";
import { HALFDRAGON_AURAS } from "../scripts/automation/transformations/halfdragon-auras.mjs";
import { applySpellSourceResistance } from "../scripts/automation/midi/spell-resistance.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { listAutomationEvents } from "../scripts/automation/shared/event-ledger.mjs";
import { cleanupCombatBenefits } from "../scripts/automation/shared/combat-benefits.mjs";
import { synchronizeSummonLifecycle } from "../scripts/automation/shared/summon-lifecycle.mjs";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
const item = id => actor.items.find(i => i.system.identifier === `halfdragon-${id}`);
const act = (id, op) =>
  [...item(id).system.activities.values()].find(a => !op || a.flags[MODULE_ID].halfdragonOperation === op);
const use = (id, op, idempotency = `hd${++ctx.seq}`) =>
  requestGm(
    "halfdragon-action",
    actor,
    { activityUuid: act(id, op).uuid, sourceUuid: source.uuid },
    { requestId: idempotency }
  );
const statusEffects = (a, kind) => a.effects.filter(e => e.getFlag(MODULE_ID, "halfdragonCondition")?.kind === kind);
const hitWorkflow = (a, targetDoc = target) => ({
  id: `hit${++ctx.seq}`,
  actor: a.actor,
  item: a.item,
  activity: a,
  token: { document: source, actor },
  tokenUuid: source.uuid,
  hitTargets: new Set([{ document: targetDoc, actor: targetDoc.actor }])
});
beforeEach(async () => {
  await setupFactory();
  for (const i of [...actor.items]) if (i.type !== "class") await i.delete();
  await actor.update({ "system.abilities.con.value": 16, "system.skills.prc.value": 0 });
  actor.items.push(
    ...halfdragonTransformationDocuments.map(d => owned(d, actor)),
    ...halfdragonDocuments.map(d => owned(d, actor))
  );
  await hdPatch(actor, { ancestry: "red" });
  await syncHalfdragon(actor);
  await item("roar").update({ "system.uses.max": "5" });
  const preview = game.system.canvas.AbilityTemplate.fromActivity;
  game.system.canvas.AbilityTemplate.fromActivity = (a, p) =>
    preview(a, p).map(r => ({
      drawPreview: async () => {
        const ds = await r.drawPreview();
        if (ds && p)
          for (const d of ds) {
            d.shapes[0].x = p.x;
            d.shapes[0].y = p.y;
          }
        return ds;
      }
    }));
  MidiQOL.computeTargetsFromTemplates = (uuids, src, exclude, relation) => {
    assert.ok(uuids.every(u => typeof u === "string"));
    return (relation === "ally" ? [source, target] : [target])
      .filter(t => !exclude || t.uuid !== src)
      .map(t => ({ document: t, actor: t.actor }));
  };
  const native = MidiQOL.completeActivityUse;
  MidiQOL.completeActivityUse = async (a, c) => {
    const result = await native(a, c);
    if (!result || result.aborted) return result;
    for (const cost of a.consumption?.targets ?? [])
      if (cost.type === "hitDice") {
        const cls = actor.items.find(i => i.type === "class");
        await cls.update({ "system.hitDiceUsed": Number(cls.system.hitDiceUsed ?? 0) + Number(cost.value) });
      }
    Object.assign(result, { actor: a.actor, item: a.item, targets: result.hitTargets });
    if (a.flags?.[MODULE_ID]?.halfdragonBreathCast) await resolveHalfdragonSangromancy(result);
    return result;
  };
});
test("Dragon authors one root and eighteen cards without fake passive effects", () => {
  assert.equal(halfdragonTransformationDocuments.length, 1);
  assert.equal(HALFDRAGON_FEATURES.length, 18);
  assert.equal(halfdragonFolders.length, 3);
  assert.equal(HALFDRAGON_FEATURES.filter(r => r.flaw).length, 4);
  for (const d of halfdragonDocuments) {
    assert.equal(d.effects.length, 0);
    assert.match(d.img, /^icons\//);
    assert.match(d.system.description.value, /Автоматизация Foundry:/);
  }
});
test("Dragon grants 1/6/11/16 and cumulative single choices", () => {
  const a = halfdragonTransformationDocuments[0].system.advancement;
  assert.deepEqual(
    a.filter(x => x.type === "ItemGrant").map(x => [x.level, x.configuration.items.length]),
    [
      [1, 3],
      [6, 1],
      [11, 1],
      [16, 1]
    ]
  );
  assert.deepEqual(
    a.filter(x => x.type === "ItemChoice").map(x => x.configuration.pool.length),
    [4, 8, 12]
  );
});
test("Fifteen ancestries give family-specific elemental breath", async () => {
  assert.equal(HALFDRAGON_ANCESTRIES.length, 15);
  for (const a of HALFDRAGON_ANCESTRIES) {
    await hdPatch(actor, { ancestry: a.id });
    const spec = hdBreathSpec(actor, 3);
    assert.equal(spec.shape, a.family === "chromatic" ? "line" : "cone");
    assert.equal(spec.damage[0].type, a.damageType);
    assert.equal(spec.damage[0].formula, "3d6");
    assert.equal(spec.width, a.family === "chromatic" ? 5 : undefined);
  }
});
test("Breath enhancement doubles length only and pool tracks character level plus tier", async () => {
  assert.equal(hdPoolMaximum(actor), 20);
  assert.equal(hdBreathSpec(actor, 1).size, 120);
  await item("empowered").delete();
  await syncHalfdragon(actor);
  assert.equal(hdBreathSpec(actor, 1).size, 60);
  assert.equal(hdPoolMaximum(actor), 16);
});
test("Form adds CON4 CHA2, capped at22 by this increase", async () => {
  assert.equal(actor.system.abilities.con.value, 20);
  assert.equal(actor.system.abilities.cha.value, 16);
  assert.equal(actor.system.abilities.con.max, 22);
  await actor.update({ "system.abilities.con.value": 21, "system.abilities.cha.value": 24 });
  await syncHalfdragon(actor);
  assert.equal(actor.system.abilities.con.value, 22);
  assert.equal(actor.system.abilities.cha.value, 24);
  assert.equal(actor.system.details.type.value, "humanoid");
  assert.equal(inspectHalfdragon(actor).additionalType, "dragon");
});
test("Suppression removes only its numeric form bonus", async () => {
  item("form").isSuppressed = true;
  await syncHalfdragon(actor);
  assert.equal(actor.system.abilities.con.value, 16);
  assert.equal(inspectHalfdragon(actor).additionalType, null);
});
test("Passive sync does not heal, reset spent dice, or duplicate effects", async () => {
  await item("breath").update({ "system.uses.spent": 4 });
  const n = actor.effects.length;
  await syncHalfdragon(actor);
  await syncHalfdragon(actor);
  assert.equal(actor.effects.length, n);
  assert.equal(actor.system.attributes.hp.value, 40);
  assert.equal(item("breath").system.uses.spent, 4);
});
test("Manual maximum and passive changes survive synchronization", async () => {
  await item("breath").update({ "system.uses.max": "99" });
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "halfdragonPassive") === "form");
  await e.update({ "system.changes": [] });
  await syncHalfdragon(actor);
  assert.equal(item("breath").system.uses.max, "99");
  assert.equal(e.system.changes.length, 0);
});
test("Scales are an unarmored baseline, not +13 bonus, and disable with armor", async () => {
  assert.equal(actor.system.attributes.ac.formula, "13 + @abilities.dex.mod + @abilities.cha.mod");
  actor.items.push(
    owned({ name: "Armor", type: "equipment", system: { type: { value: "heavy" }, equipped: true } }, actor)
  );
  await syncHalfdragon(actor);
  assert.ok(!halfdragonPassiveDefinitions(actor).some(e => e.flags[MODULE_ID].halfdragonPassive === "scales"));
});
test("Dragon scales can explicitly yield to another AC calculation", async () => {
  ctx.answers.push("no");
  await use("scales", "scales");
  assert.equal(hdState(actor).scalesEnabled, false);
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "halfdragonPassive") === "scales"));
});
test("Senses never escalate their own proficiency into expertise on repeated sync", async () => {
  assert.equal(actor.system.skills.prc.value, 1);
  await syncHalfdragon(actor);
  assert.equal(actor.system.skills.prc.value, 1);
  await actor.update({ "system.skills.prc.value": 1 });
  await syncHalfdragon(actor);
  assert.equal(actor.system.skills.prc.value, 2);
  assert.equal(actor.system.attributes.senses.blindsight, 30);
});
test("Senses convert thirty feet to actor metric units", async () => {
  await actor.update({ "system.attributes.senses.units": "m" });
  await syncHalfdragon(actor);
  assert.ok(Math.abs(actor.system.attributes.senses.blindsight - 9.144) < 0.01);
});
test("Wings require worn clothing and armor to be adapted, without unequipping", async () => {
  assert.equal(actor.system.attributes.movement.fly, 30);
  const gear = owned(
    { name: "Coat", type: "equipment", system: { type: { value: "clothing" }, equipped: true } },
    actor
  );
  actor.items.push(gear);
  await syncHalfdragon(actor);
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "halfdragonPassive") === "wings"));
  await gear.setFlag(MODULE_ID, "halfdragonWingAdapted", true);
  await syncHalfdragon(actor);
  assert.equal(actor.system.attributes.movement.fly, 30);
  assert.equal(gear.system.equipped, true);
});
test("Optional entry requirement uses CON16 and character13, not level-scaled inventions", async () => {
  assert.equal(hdDC(actor), 18);
  const root = item("transformation");
  await actor.items.find(i => i.type === "class").update({ "system.levels": 12 });
  game.settings.get = () => true;
  assert.equal(validateHalfdragonItem(root, {}, {}, game.user.id), false);
  game.settings.get = (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES;
  assert.notEqual(validateHalfdragonItem(root, {}, {}, game.user.id), false);
});
test("Duplicate boons are rejected while lower-tier choices stay available", () => {
  assert.equal(
    validateHalfdragonAdvancement(
      { actor },
      [],
      [halfdragonDocuments.find(d => d.system.identifier === "halfdragon-scales")],
      [],
      []
    ),
    false
  );
});
test("Agreed rest/HP/grasp defaults are read-only and new cards use SR/LR", () => {
  const before = structuredClone(hdState(actor));
  assert.equal(hdRules(actor).breathRecovery, "sr");
  assert.equal(hdRules(actor).roarRecovery, "sr");
  assert.equal(hdRules(actor).livingHpMode, "roll");
  assert.equal(hdRules(actor).graspSeconds, 60);
  assert.deepEqual(hdState(actor), before);
  for (const id of ["breath", "roar", "fundamentum"]) assert.equal(item(id).system.uses.recovery[0].period, "sr");
  for (const id of ["guard", "descendant", "polymorph"]) assert.equal(item(id).system.uses.recovery[0].period, "lr");
});
test("Cancelling ancestry or rules preserves all existing choices", async () => {
  const before = structuredClone(hdState(actor));
  ctx.answers.push("no");
  await use("form", "ancestry");
  ctx.answers.push("sr", null);
  await use("breath", "rules");
  assert.deepEqual(hdState(actor), before);
});
test("Empty pool rejects before a native workflow", async () => {
  await item("breath").update({ "system.uses.spent": 20 });
  assert.throws(() => hdExpense(act("breath"), { cost: 1 }), /Недостаточно/);
  assert.equal(ctx.calls.length, 0);
});
test("Cancelling dice selection or placement consumes nothing", async () => {
  await use("breath", "breath");
  ctx.answers.push(3);
  ctx.cancelPlacement = true;
  await use("breath", "breath");
  assert.equal(item("breath").system.uses.spent, 0);
  assert.equal(ctx.calls.length, 0);
});
test("Breath placement feeds native UUID targeting, DEX and selected dice/half", async () => {
  ctx.answers.push(3, "no");
  const result = await use("breath", "breath", "breath-native");
  assert.equal(result.status, "success");
  assert.equal(item("breath").system.uses.spent, 3);
  const a = ctx.calls[0].activity;
  assert.deepEqual(a.save.ability, ["dex"]);
  assert.equal(a.damage.onSave, "half");
  assert.equal(a.damage.parts[0].number, 3);
  assert.ok(a.damage.parts[0].types.includes("fire"));
  assert.equal(canvas.scene.regions.length, 0);
});
test("Repeated breath callbacks do not reopen dialogs or spend dice twice", async () => {
  ctx.answers.push(2, "no");
  await use("breath", "breath", "same-breath");
  const n = ctx.prompts.length,
    c = ctx.calls.length;
  await use("breath", "breath", "same-breath");
  assert.equal(ctx.prompts.length, n);
  assert.equal(ctx.calls.length, c);
  assert.equal(item("breath").system.uses.spent, 2);
});
test("Sangromancy spends five actual HD and applies vulnerability before breath returns", async () => {
  encounter();
  ctx.answers.push(3, "yes", [target.uuid]);
  const result = await use("breath", "breath", "sang");
  assert.equal(result.status, "success");
  assert.equal(hdAvailableHitDice(actor), 11);
  assert.equal(item("breath").system.uses.spent, 3);
  assert.ok(target.actor.system.traits.dv.value.includes("fire"));
  assert.deepEqual(ctx.calls[1].activity.save.ability, ["con"]);
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "combatBenefit")?.kind === "halfdragon-vulnerability");
  assert.equal(e.getFlag(MODULE_ID, "combatBenefit").expiry, "sourceEnd");
  await resolveHalfdragonSangromancy({
    ...ctx.calls[0],
    actor,
    targets: new Set([{ document: target, actor: target.actor }])
  });
  assert.equal(hdAvailableHitDice(actor), 11);
});
test("Cancelling Sangromancy recipient choice cancels the entire breath before HD/dice expense", async () => {
  ctx.answers.push(3, "yes", null);
  await use("breath", "breath");
  assert.equal(item("breath").system.uses.spent, 0);
  assert.equal(hdAvailableHitDice(actor), 16);
  assert.equal(ctx.calls.length, 0);
});
test("Insufficient HD does not offer or spend Sangromancy", async () => {
  await actor.items.find(i => i.type === "class").update({ "system.hitDiceUsed": 14 });
  ctx.answers.push(2);
  await use("breath", "breath");
  assert.equal(ctx.prompts.length, 1);
  assert.equal(hdAvailableHitDice(actor), 2);
  assert.equal(ctx.calls.length, 1);
});
test("A successful Sangromancy CON save grants no vulnerability", async () => {
  ctx.failSaves = false;
  ctx.answers.push(2, "yes", [target.uuid]);
  await use("breath", "breath");
  assert.ok(
    !target.actor.effects.some(e => e.getFlag(MODULE_ID, "combatBenefit")?.kind === "halfdragon-vulnerability")
  );
});
test("Metallic gas has fixed 15-foot CON geometry even with Empowered Breath", async () => {
  await hdPatch(actor, { ancestry: "gold" });
  await use("fundamentum", "fundamentum");
  assert.deepEqual(ctx.calls[0].activity.save.ability, ["con"]);
  const sleep = statusEffects(target.actor, "sleep")[0];
  assert.equal(sleep.duration.value, 60);
  assert.equal(sleep.duration.units, "seconds");
  assert.equal(sleep.getFlag(MODULE_ID, "repeatSave"), undefined);
  assert.equal(item("fundamentum").system.uses.spent, 1);
});
test("Gas sleep respects unconscious immunity and wakes only after confirmed positive damage", async () => {
  await hdPatch(actor, { ancestry: "gold" });
  await use("fundamentum", "fundamentum");
  await wakeHalfdragonGas({ actor: target.actor, amount: 0 });
  assert.equal(statusEffects(target.actor, "sleep").length, 1);
  await wakeHalfdragonGas({ actor: target.actor, amount: 1 });
  assert.equal(statusEffects(target.actor, "sleep").length, 0);
  await target.actor.update({ "system.traits.ci.value": ["unconscious"] });
  assert.equal(
    await hdCondition(source, target, item("fundamentum"), { kind: "sleep", statuses: ["unconscious"], seconds: 60 }),
    false
  );
});
test("Gem grasp is a minute, no concentration, with STR repeat at target end", async () => {
  await hdPatch(actor, { ancestry: "amethyst" });
  ctx.answers.push([target.uuid], "yes");
  await use("fundamentum", "fundamentum");
  const e = statusEffects(target.actor, "grasp")[0];
  assert.equal(e.duration.value, 60);
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").event, "turnEnd");
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").ability, "str");
  assert.equal(actor.concentration.effects.size, 0);
});
test("Chromatic armor retaliates on a melee hit at five feet without requiring damage", async () => {
  await use("fundamentum", "fundamentum");
  const a = attack(target.actor),
    w = {
      ...hitWorkflow(a, source),
      actor: target.actor,
      tokenUuid: target.uuid,
      token: { document: target, actor: target.actor }
    };
  await finishHalfdragonAttack(w);
  assert.equal(ctx.calls.length, 2);
  assert.equal(ctx.calls[1].activity.damage.parts[0].custom.formula, "5");
  await finishHalfdragonAttack(w);
  assert.equal(ctx.calls.length, 2);
});
test("A ranged hit never triggers chromatic armor", async () => {
  await use("fundamentum", "fundamentum");
  const a = attack(target.actor, { melee: false });
  await finishHalfdragonAttack({ ...hitWorkflow(a, source), actor: target.actor, tokenUuid: target.uuid });
  assert.equal(ctx.calls.length, 1);
});
test("Chromatic Roar gives fear/WIS repeat and no fake advantage", async () => {
  await use("roar", "roar");
  const e = statusEffects(target.actor, "fear")[0];
  assert.ok(target.actor.statuses.has("frightened"));
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").ability, "wis");
  assert.equal(e.duration.value, 60);
});
test("Metallic Roar grants one attack advantage to source and allies without saves", async () => {
  encounter();
  await hdPatch(actor, { ancestry: "silver" });
  ctx.failSaves = false;
  await use("roar", "roar");
  for (const a of [actor, target.actor]) {
    const e = a.effects.find(e => e.getFlag(MODULE_ID, "combatBenefit")?.kind === "attack-advantage");
    assert.equal(e.getFlag(MODULE_ID, "combatBenefit").remaining, 1);
    assert.equal(e.getFlag(MODULE_ID, "combatBenefit").expiry, "sourceStart");
  }
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].activity.type, "utility");
  assert.equal(canvas.scene.regions.length, 0);
});
test("Gem Roar tracks only its granted THP and source LR removes only those", async () => {
  await hdPatch(actor, { ancestry: "amethyst" });
  await use("roar", "roar");
  assert.equal(target.actor.system.attributes.hp.temp, 16);
  assert.equal(target.actor.getFlag(MODULE_ID, "halfdragonRoarHp").sourceActorUuid, actor.uuid);
  await clearHalfdragonRoarHp(target.actor);
  assert.equal(target.actor.system.attributes.hp.temp, 16);
  await target.actor.update({ "system.attributes.hp.temp": 30 });
  await clearHalfdragonRoarHp(actor);
  assert.equal(actor.system.attributes.hp.temp, 0);
  assert.equal(target.actor.system.attributes.hp.temp, 30);
});
test("Damage decreases owned temporary HP atomically and a new grant relinquishes ownership", async () => {
  await actor.update({ "system.attributes.hp.temp": 16 });
  await actor.setFlag(MODULE_ID, "halfdragonRoarHp", { sourceActorUuid: target.actor.uuid, remaining: 16 });
  let changes = { "system.attributes.hp.temp": 10 };
  captureHalfdragonHp(actor, changes, {});
  await actor.update(changes);
  assert.equal(actor.getFlag(MODULE_ID, "halfdragonRoarHp").remaining, 10);
  changes = { "system.attributes.hp.temp": 20 };
  captureHalfdragonHp(actor, changes, {});
  await actor.update(changes);
  assert.equal(actor.getFlag(MODULE_ID, "halfdragonRoarHp"), null);
});
test("Cancelling the circular Roar preview spends no use", async () => {
  await hdPatch(actor, { ancestry: "silver" });
  ctx.cancelPlacement = true;
  await use("roar", "roar");
  assert.equal(item("roar").system.uses.spent, 0);
});
test("Natural claws and bite have unarmed STR classification and separate dice/types", () => {
  const claws = halfdragonAttackData(act("limbs", "claws"), "claws"),
    bite = halfdragonAttackData(act("limbs", "bite"), "bite");
  assert.equal(claws.attack.type.classification, "unarmed");
  assert.equal(claws.attack.ability, "str");
  assert.equal(claws.damage.parts[0].number, 2);
  assert.equal(bite.damage.parts[0].denomination, 8);
  assert.ok(bite.damage.parts[0].types.includes("piercing"));
});
test("Bite hit cancels only elemental resistance and expires after source next end", async () => {
  const combat = encounter();
  ctx.answers.push([target.uuid]);
  await use("limbs", "bite");
  const a = ctx.calls[0].activity;
  await finishHalfdragonAttack(hitWorkflow(a));
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "halfdragonBiteType") === "fire");
  assert.ok(e);
  assert.equal(e.getFlag(MODULE_ID, "combatBenefit").expiry, "sourceEnd");
  combat.previous = { round: 1, turn: 0 };
  combat.turn = 1;
  combat.combatant = combat.turns[1];
  await cleanupCombatBenefits(combat, { turn: 1 });
  assert.ok(target.actor.effects.includes(e));
  combat.previous = { round: 1, turn: 0 };
  combat.round = 2;
  await cleanupCombatBenefits(combat, { round: 2, turn: 1 });
  assert.ok(!target.actor.effects.includes(e));
});
test("Bite packet ignores fire resistance but never immunity or unrelated cold", async () => {
  ctx.answers.push([target.uuid]);
  await use("limbs", "bite");
  await finishHalfdragonAttack(hitWorkflow(ctx.calls[0].activity));
  let options;
  target.actor.calculateDamage = (parts, o) => {
    options = o;
    return parts.map(p => ({ ...p, value: 0, active: { immunity: true } }));
  };
  const p = {
    rawDamageDetail: [
      { type: "fire", value: 20 },
      { type: "cold", value: 20 }
    ],
    damageDetail: [
      { type: "fire", value: 10 },
      { type: "cold", value: 10 }
    ]
  };
  applyHalfdragonBite({ actor: target.actor }, { workflow: {}, damageItem: p });
  assert.ok(options.ignore.resistance.has("fire"));
  assert.equal(options.ignore.immunity, undefined);
  assert.equal(p.damageDetail.find(x => x.type === "fire").value, 0);
  assert.equal(p.damageDetail.find(x => x.type === "cold").value, 10);
});
test("Guard provides only spell-source resistance and never halves a resistant packet twice", async () => {
  await use("guard", "guard");
  assert.ok(hdGuardActive(actor));
  const p = { damageDetail: [{ type: "cold", value: 20, active: {} }] };
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "weapon" } }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 20);
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "spell" } }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 10);
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "spell" } }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 10);
});
test("Guard does not grant magic-save advantage and expires after sixty seconds", async () => {
  await use("guard", "guard");
  assert.ok(actor.system.traits.di.value.includes("fire"));
  assert.ok(!actor.effects.some(e => e.system.changes.some(c => c.key.includes("advantage"))));
  game.time.worldTime = 61;
  assert.equal(hdGuardActive(actor), false);
  await syncHalfdragonLight(source);
  assert.equal(source.light.bright, 0);
});
test("Guard light restores its own values while preserving a manually changed radius", async () => {
  await use("guard", "guard");
  assert.equal(source.light.bright, 10);
  assert.equal(source.light.dim, 20);
  await source.update({ "light.bright": 45 });
  for (const e of [...actor.effects]) if (e.getFlag(MODULE_ID, "halfdragonGuard")) await e.delete();
  await syncHalfdragonLight(source);
  assert.equal(source.light.bright, 45);
  assert.equal(source.light.dim, 0);
});
test("Living Breath recipe reproduces PDF stats, damage, snapshot and lifecycle", () => {
  const r = halfdragonLivingRecipe(actor, 27);
  assert.equal(r.hp, 27);
  assert.equal(r.ac, 15);
  assert.equal(r.size, "lg");
  assert.equal(r.type, "elemental");
  assert.equal(r.abilities.str, 19);
  assert.deepEqual(r.dr, ["fire"]);
  assert.ok(r.ci.includes("grappled"));
  assert.equal(r.lifecycle.seconds, 3600);
  assert.equal(r.snapshot.dc, 18);
  const a = Object.values(r.extraItems[0].system.activities)[0];
  assert.equal(a.attack.bonus, "9");
  assert.equal(a.damage.parts.length, 2);
  assert.equal(a.damage.parts[1].number, 2);
  assert.equal(r.snapshot.tier, 4);
  assert.equal(HALFDRAGON_AURAS[0].radius, 5);
});
test("Living Breath spends the common pool and HP is the SUM, not count", async () => {
  ctx.answers.push(3, "yes");
  const r = await use("living", "living", "pet");
  assert.equal(r.status, "success");
  const s = hdState(actor).living,
    pet = await fromUuid(s.actorUuids[0]);
  assert.equal(pet.system.attributes.hp.max, 6);
  assert.equal(item("breath").system.uses.spent, 3);
  assert.equal(pet.getFlag(MODULE_ID, "summonTemplate").placement.x, 150);
  assert.equal(pet.getFlag(MODULE_ID, "summonTemplate").snapshot.damageType, "fire");
});
test("Cancelled living placement spends no dice or summon", async () => {
  ctx.answers.push(2);
  ctx.cancelPlacement = true;
  await use("living", "living");
  assert.equal(ctx.createCount, 0);
  assert.equal(item("breath").system.uses.spent, 0);
});
test("Successful new living breath replaces only its own old pet", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "first-pet");
  const before = hdState(actor).living.actorUuids[0];
  ctx.answers.push(3, "yes");
  await use("living", "living", "second-pet");
  assert.equal(await fromUuid(before), undefined);
  assert.ok(await fromUuid(hdState(actor).living.actorUuids[0]));
  assert.ok(game.actors.includes(actor));
});
test("Failed replacement leaves previous living breath and no orphan new actor", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "ok-pet");
  const before = hdState(actor).living.actorUuids[0],
    n = game.actors.length;
  ctx.createFailAt = 2;
  ctx.answers.push(3, "yes");
  const result = await use("living", "living", "bad-pet");
  assert.equal(result.status, "needs-review");
  assert.ok(await fromUuid(before));
  assert.equal(hdState(actor).living.actorUuids[0], before);
  assert.equal(game.actors.length, n);
});
test("Living Breath lifecycle removes death/expiry, never heals at zero", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "expired-pet");
  const id = hdState(actor).living.actorUuids[0];
  game.time.worldTime = 3601;
  await synchronizeSummonLifecycle();
  assert.equal(await fromUuid(id), undefined);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("Living aura fires at target start once, including an ally", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "aura-pet");
  const state = hdState(actor).living,
    petToken = await fromUuid(state.tokenUuids[0]);
  petToken.x = 100;
  const combat = encounter(1);
  combat.previous = { round: 1, turn: 0 };
  const before = ctx.calls.length;
  await handleHalfdragonTurn(combat, { turn: 1 });
  assert.equal(ctx.calls.length, before + 1);
  const a = ctx.calls.at(-1).activity;
  assert.deepEqual(a.save.ability, ["con"]);
  assert.equal(a.save.dc.formula, "18");
  assert.equal(a.damage.parts[0].number, 1);
  await handleHalfdragonTurn(combat, { turn: 1 });
  assert.equal(ctx.calls.length, before + 1);
});
test("Off-scene living aura queues snapshot and does not roll retroactively", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "queued-pet");
  const petToken = await fromUuid(hdState(actor).living.tokenUuids[0]);
  petToken.x = 100;
  const combat = encounter(1);
  combat.previous = { round: 1, turn: 0 };
  const n = ctx.calls.length;
  canvas.ready = false;
  await handleHalfdragonTurn(combat, { turn: 1 });
  assert.equal(ctx.calls.length, n);
  assert.ok(
    (await listAutomationEvents()).some(e => e.kind === "halfdragon-turn" && e.state === "queued" && e.dc === 18)
  );
});
test("Hidden living breath remains mechanically active", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "hidden-pet");
  const t = await fromUuid(hdState(actor).living.tokenUuids[0]);
  t.x = 100;
  t.hidden = true;
  const c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  const n = ctx.calls.length;
  await handleHalfdragonTurn(c, { turn: 1 });
  assert.equal(ctx.calls.length, n + 1);
});
test("Shapechange is required; Polymorph cannot substitute", async () => {
  actor.items.push(
    owned({ name: "Polymorph", type: "spell", system: { identifier: "polymorph", activities: {} } }, actor)
  );
  await assert.rejects(use("polymorph", "polymorph"), /Shapechange/);
  assert.equal(item("polymorph").system.uses.spent, 0);
});
test("Real Shapechange uses native concentration/limitations, no slot, one LR use", async () => {
  const spell = owned(
    {
      name: "Shapechange",
      type: "spell",
      system: {
        identifier: "shapechange",
        level: 9,
        activities: {
          a: {
            _id: "a",
            type: "utility",
            duration: { concentration: true, value: "1", units: "hour" },
            consumption: { spellSlot: true, targets: [] }
          }
        }
      }
    },
    actor
  );
  actor.items.push(spell);
  ctx.answers.push("yes");
  const r = await use("polymorph", "polymorph");
  assert.equal(r.status, "success");
  assert.equal(item("polymorph").system.uses.spent, 1);
  assert.equal(ctx.calls[0].activity.item.system.identifier, "shapechange");
  assert.equal(ctx.calls[0].activity.duration.concentration, true);
  assert.equal(ctx.calls[0].activity.consumption.spellSlot, false);
});
test("Descendant requires actual zero HP and affirmative owner consent", async () => {
  await use("descendant", "recover");
  assert.equal(ctx.calls.length, 0);
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("no");
  await use("descendant", "recover");
  assert.equal(ctx.calls.length, 0);
  assert.equal(item("descendant").system.uses.spent, 0);
});
test("Descendant sends native half-max healing and never deletes foreign conditions", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  await actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Manual unconscious", statuses: ["unconscious"], system: { changes: [] } }
  ]);
  ctx.answers.push("yes");
  await use("descendant", "recover", "recover-once");
  assert.equal(ctx.calls[0].activity.type, "heal");
  assert.equal(ctx.calls[0].activity.healing.custom.formula, "30");
  assert.equal(item("descendant").system.uses.spent, 1);
  assert.equal(
    actor.effects.some(e => e.name === "Manual unconscious"),
    true
  );
  await use("descendant", "recover", "recover-once");
  assert.equal(ctx.calls.length, 1);
});
test("HP transition capture ignores already-zero HP and duplicate observation", async () => {
  const options = {};
  captureHalfdragonHp(actor, { "system.attributes.hp.value": 0 }, options);
  assert.ok(options[MODULE_ID].halfdragonDropId);
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("no");
  await observeHalfdragonHp(actor, {}, options);
  const n = ctx.prompts.length;
  await observeHalfdragonHp(actor, {}, options);
  assert.equal(ctx.prompts.length, n);
  const next = {};
  captureHalfdragonHp(actor, { "system.attributes.hp.value": 0 }, next);
  assert.equal(next[MODULE_ID], undefined);
});
test("Insatiable greed cannot be bypassed by an easier WIS roll", async () => {
  await use("greed", "greed");
  assert.equal(ctx.saves.length, 0);
  await item("insatiable").delete();
  ctx.answers.push("yes");
  await use("greed", "greed");
  assert.equal(ctx.saves[0].target, 16);
});
test("True form reveals while concentrating without altering portraits or dispositions", async () => {
  await hdPatch(actor, { appearance: "humanoid" });
  await actor.beginConcentrating(act("breath"), {});
  await syncHalfdragon(actor);
  assert.equal(hdState(actor).appearance, "true");
  assert.equal(source.disposition, 1);
  assert.equal(source.hidden, false);
});
test("Actual runtime registrations include Dragon and packet hook twice around generic rebuilding", () => {
  assert.equal(typeof getAutomationActionHandlers().get("halfdragon-control"), "function");
  assert.equal(typeof getMidiHookHandlers().applyHalfdragonBite, "function");
  assert.equal(MIDI_QOL_HOOKS.filter(([, n]) => n === "applyHalfdragonBite").length, 2);
  installHalfdragonHooks();
  for (const h of [
    "dnd5e.preUseActivity",
    "midi-qol.postCheckSaves",
    "updateCombat",
    "preUpdateActor",
    "dnd5e.restCompleted"
  ])
    assert.ok(ctx.hooks.has(h));
});
test("Generic Dragon names cannot relink unrelated existing descriptions", () => {
  const other = {
    _id: "unrelated",
    name: "Other",
    type: "feat",
    flags: {},
    system: { identifier: "unrelated", description: { value: "Дыхание и Полиморф" } }
  };
  linkDocumentDescriptions([{ name: "features", documents: [...structuredClone(halfdragonDocuments), other] }]);
  assert.equal(other.system.description.value, "Дыхание и Полиморф");
});
test("Unknown native outcome remains reviewable without speculative second expense", async () => {
  ctx.nativeMode = undefined;
  ctx.answers.push(2, "no");
  const r = await use("breath", "breath", "unknown");
  assert.equal(r.status, "needs-review");
  const n = ctx.calls.length;
  await use("breath", "breath", "unknown");
  assert.equal(ctx.calls.length, n);
});
test("Non-authoritative GM/client cannot execute periodic events", async () => {
  const other = { id: "other", isGM: true, active: true };
  game.users.push(other);
  game.user = other;
  const c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  await handleHalfdragonTurn(c, { turn: 1 });
  assert.equal(ctx.calls.length, 0);
});
test("Closing the optional Sangromancy prompt cancels before all native costs", async () => {
  ctx.answers.push(2, null);
  await use("breath", "breath");
  assert.equal(ctx.calls.length, 0);
  assert.equal(item("breath").system.uses.spent, 0);
  assert.equal(hdAvailableHitDice(actor), 16);
});
test("Unknown Sangromancy outcome aborts original damage, retains expense and never retries", async () => {
  const native = MidiQOL.completeActivityUse;
  MidiQOL.completeActivityUse = async (a, c) =>
    a.flags?.[MODULE_ID]?.auraPulse && a.save?.ability?.includes("con") ? undefined : native(a, c);
  ctx.answers.push(2, "yes", [target.uuid]);
  const r = await use("breath", "breath", "unknown-sang");
  assert.equal(r.status, "needs-review");
  assert.equal(hdAvailableHitDice(actor), 11);
  assert.equal(item("breath").system.uses.spent, 2);
  assert.ok(
    !target.actor.effects.some(e => e.getFlag(MODULE_ID, "combatBenefit")?.kind === "halfdragon-vulnerability")
  );
  const n = ctx.calls.length;
  await use("breath", "breath", "unknown-sang");
  assert.equal(ctx.calls.length, n);
});
test("Pool level increase preserves spent dice and follows its managed maximum", async () => {
  await item("breath").update({ "system.uses.spent": 8 });
  await actor.items.find(i => i.type === "class").update({ "system.levels": 17 });
  await syncHalfdragon(actor);
  assert.equal(item("breath").system.uses.max, "21");
  assert.equal(item("breath").system.uses.spent, 8);
});
test("Outside combat Metallic Roar does not invent a six-second duration", async () => {
  await hdPatch(actor, { ancestry: "gold" });
  await use("roar", "roar");
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "combatBenefit")?.kind === "attack-advantage");
  assert.equal(e.duration.value, null);
  assert.equal(e.getFlag(MODULE_ID, "combatBenefit").expiry, null);
});
test("Gem grasp cancellation is safe before its once-per-rest expenditure", async () => {
  await hdPatch(actor, { ancestry: "amethyst" });
  ctx.answers.push([target.uuid], "no");
  await use("fundamentum", "fundamentum");
  assert.equal(ctx.calls.length, 0);
  assert.equal(item("fundamentum").system.uses.spent, 0);
});
test("Living Breath knows Draconic but cannot speak", () => {
  const r = halfdragonLivingRecipe(actor, 12);
  assert.deepEqual(r.languages.value, ["draconic"]);
  assert.match(r.languages.custom, /не говорит/);
});
test("An out-of-range living aura and its own token never receive a pulse", async () => {
  ctx.answers.push(2, "yes");
  await use("living", "living", "range-pet");
  const pet = await fromUuid(hdState(actor).living.tokenUuids[0]);
  pet.x = 10000;
  const c = encounter(1);
  c.previous = { round: 1, turn: 0 };
  const n = ctx.calls.length;
  await handleHalfdragonTurn(c, { turn: 1 });
  assert.equal(ctx.calls.length, n);
});
test("Suppressed active guard stops source resistance immediately", async () => {
  await use("guard", "guard");
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "halfdragonGuard"));
  e.isSuppressed = true;
  assert.equal(hdGuardActive(actor), false);
  const p = { damageDetail: [{ type: "cold", value: 20, active: {} }] };
  applySpellSourceResistance({ actor }, { workflow: { item: { type: "spell" } }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 20);
});
