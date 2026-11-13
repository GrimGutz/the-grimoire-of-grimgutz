import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { ctx, actor, source, target, setupFactory, owned, attack, encounter } from "./factory-fixture.mjs";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { GOD_FEATURES, godAnnihilationDamage, godWrathDice } from "../scripts/automation/shared/god-definitions.mjs";
import { godDocuments, godFolders } from "../src/packs/god-features.mjs";
import { godTransformationDocuments } from "../src/packs/god-transformation.mjs";
import {
  godState,
  patchGod,
  godLevel,
  godDC,
  godHas,
  godFunctional,
  godPool,
  godDomain,
  syncGod,
  godPassiveDefinitions,
  validateGodItem,
  inspectGod
} from "../scripts/automation/transformations/god.mjs";
import {
  chooseGodForm,
  godDawn,
  chooseGodElement,
  godRecover
} from "../scripts/automation/transformations/god-choices.mjs";
import { applyGodHealing, godPulse } from "../scripts/automation/transformations/god-use.mjs";
import {
  godPreparedSpell,
  castGodSpell,
  finishGodSaves,
  prepareGodCounter
} from "../scripts/automation/transformations/god-spells.mjs";
import {
  godDevourBudget,
  activateGodDomain,
  endGodDomain,
  godHorizontalFeet
} from "../scripts/automation/transformations/god-areas.mjs";
import {
  grantGodMercy,
  activeGodMercies,
  syncGodMercies,
  godGiftFingerprint,
  removeGodGiftItem,
  cleanupGodGifts
} from "../scripts/automation/transformations/god-gifts.mjs";
import {
  handleGodTurn,
  runGodTurn,
  recordGodDamage,
  captureGodHp,
  installGodHooks,
  refreshGodMercyRecipient
} from "../scripts/automation/transformations/god-events.mjs";
import {
  applyGodElement,
  applyGodDefenses,
  blockGodResurrection
} from "../scripts/automation/transformations/god-midi.mjs";
import { GOD_AURAS } from "../scripts/automation/transformations/god-auras.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { prepareConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
import { listAutomationEvents } from "../scripts/automation/shared/event-ledger.mjs";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
import { applySpellSourceResistance } from "../scripts/automation/midi/spell-resistance.mjs";
const item = id => actor.items.find(i => i.system.identifier === `god-${id}`),
  act = (id, op) => [...item(id).system.activities.values()].find(a => !op || a.flags[MODULE_ID].godOperation === op),
  use = (id, op, requestId = `g${++ctx.seq}`) =>
    requestGm("god-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
beforeEach(async () => {
  await setupFactory();
  for (const i of [...actor.items]) if (i.type !== "class") await i.delete();
  actor.items.push(...godTransformationDocuments.map(d => owned(d, actor)), ...godDocuments.map(d => owned(d, actor)));
  await actor.items.find(i => i.type === "class").update({ "system.levels": 20 });
  await actor.update({
    "system.attributes.prof": 6,
    ...Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(a => [`system.abilities.${a}.value`, 22]))
  });
  await patchGod(actor, { alignment: "good" });
  await syncGod(actor);
  const fromActivity = game.system.canvas.AbilityTemplate.fromActivity;
  game.system.canvas.AbilityTemplate.fromActivity = (a, options) =>
    fromActivity(a, options).map(p => ({
      drawPreview: async () => {
        const placed = await p.drawPreview();
        if (placed && a.flags?.[MODULE_ID]?.area?.origin === "self")
          for (const d of placed) d.shapes[0] = { ...d.shapes[0], x: options.x, y: options.y };
        return placed;
      }
    }));
  const complete = MidiQOL.completeActivityUse;
  MidiQOL.completeActivityUse = async (a, c) => {
    const r = await complete(a, c);
    if (r && typeof r === "object")
      r.targets = new Set([...(r.hitTargets ?? []), ...(r.failedSaves ?? []), ...(r.saves ?? [])]);
    return r;
  };
});

test("native annihilation uses one save, then force ring damage, not repeated saves", async () => {
  await patchGod(actor, { alignment: "evil" });
  ctx.answers.push("yes");
  assert.equal((await use("judgment", "judgment")).status, "success");
  assert.equal(ctx.calls[0].activity.type, "save");
  assert.equal(ctx.calls[0].activity.damage.parts.length, 0);
  assert.equal(ctx.calls[1].activity.type, "damage");
  assert.equal(ctx.calls[1].activity.damage.parts[0].custom.formula, "800");
  assert.deepEqual(ctx.calls[1].activity.damage.parts[0].types, ["force"]);
  assert.equal(item("zeal").system.uses.spent, 220);
});
test("declined0HP offer never reopens for same event", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push("no");
  await requestGm("god-recover", actor, {}, { requestId: "declined-drop" });
  const n = ctx.prompts.length;
  await requestGm("god-recover", actor, {}, { requestId: "declined-drop" });
  assert.equal(ctx.prompts.length, n);
  assert.equal(item("zeal").system.uses.spent, 0);
});
test("temporary other-source bonuses do not consume the chosen form allocation", async () => {
  ctx.answers.push(4, 4, 2);
  await chooseGodForm(actor);
  await actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Other bonus", system: { changes: [{ key: "system.abilities.str.value", type: "add", value: "2" }] } }
  ]);
  await syncGod(actor);
  assert.equal(actor.system.abilities.str.value, 28);
  assert.equal(godState(actor).allocation.str, 4);
});
test("Mercy endurance refreshes recipient proficiency without requiring a source change", async () => {
  ctx.answers.push([target.uuid], "endurance");
  await use("mercy", "mercy");
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "godMercy"));
  await target.actor.update({ "system.attributes.prof": 6 });
  await refreshGodMercyRecipient(target.actor);
  assert.equal(e.system.changes.find(c => c.key === "system.abilities.str.bonuses.save").value, "6");
});
test("Demiurgy bypasses source-specific spell resistance but runs before flat shields", async () => {
  await patchGod(actor, { element: "fire" });
  await target.actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Spell resistance", flags: { [MODULE_ID]: { hollowPassive: "fortified-soul" } }, system: { changes: [] } }
  ]);
  const p = {
      rawDamageDetail: [{ type: "fire", value: 12 }],
      damageDetail: [{ type: "fire", value: 6, active: { resistance: true } }]
    },
    workflow = { actor, item: { type: "spell" } };
  applyGodElement({ actor: target.actor }, { workflow, damageItem: p });
  applySpellSourceResistance({ actor: target.actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail[0].value, 12);
  const order = MIDI_QOL_HOOKS.filter(([h]) => h === "midi-qol.preTargetDamageApplication").map(([, n]) => n);
  assert.ok(order.lastIndexOf("applyGodElement") < order.indexOf("applySummonProtection"));
});
test("unknown Devour outcome requires explicit GM closure, never a refund", async () => {
  await patchGod(actor, {
    devour: { requestId: "unknown", confirmed: {}, distributed: 0, completed: false, closed: false }
  });
  ctx.answers.push("close");
  await use("restoration", "devour-healing");
  assert.equal(godState(actor).devour.closed, true);
  assert.equal(item("zeal").system.uses.spent, 0);
});
test("real devour has a native sphere, cost40, no unconfirmed healing and verifiable cast receipt", async () => {
  await patchGod(actor, { alignment: "evil" });
  ctx.answers.push("yes");
  assert.equal((await use("restoration", "restoration", "devour-real")).status, "success");
  assert.equal(item("zeal").system.uses.spent, 40);
  assert.equal(godDevourBudget(actor), 0);
  assert.equal(ctx.calls[0].activity.damage.parts[0].number, 12);
  assert.equal(godState(actor).devour.completed, true);
  const native = ctx.calls[0].activity,
    p = { damageDetail: [{ type: "force", value: 25 }] },
    wf = {
      id: "devour-wf",
      actor,
      activity: native,
      token: source,
      targets: new Set([{ document: target, actor: target.actor }])
    };
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: wf, damageItem: p });
  assert.equal(p.calcDamageOptions[MODULE_ID].damageEvent.godDevourCastId, "devour-real");
});
test("counter requires an armed caster, owner and GM agreement, and charges exactly10 per level", async () => {
  ctx.answers.push([target.uuid], "yes");
  await use("zeal", "counter");
  const a = attack(target.actor, { spell: true });
  await a.item.update({ "system.level": 3 });
  const wf = { id: "enemy-cast", actor: target.actor, item: a.item, activity: a, spellLevel: 3 };
  ctx.answers.push("yes", "yes");
  assert.equal(await prepareGodCounter(wf), false);
  assert.equal(wf.aborted, true);
  assert.equal(item("zeal").system.uses.spent, 30);
  assert.equal(godState(actor).counterWatch, null);
});
test("translocation previews a native point then moves the existing party, no token copies", async () => {
  ctx.answers.push([target.uuid], "scene", "yes");
  assert.equal((await use("translocation", "translocation")).status, "success");
  assert.equal(item("zeal").system.uses.spent, 40);
  assert.equal(source.x, 200);
  assert.equal(target.x, 300);
  assert.equal(canvas.scene.tokens.length, 2);
  assert.equal(canvas.scene.regions.length, 0);
});
test("spent charges do not turn an expiring native feat gift into a manual edit", async () => {
  const feat = owned(
    { name: "Boon", type: "feat", system: { identifier: "actual-boon", uses: { max: "1", spent: 0 }, activities: {} } },
    actor
  );
  actor.items.push(feat);
  await patchGod(actor, { alignment: "evil" });
  ctx.answers.push([target.uuid], "feat", feat.uuid, "yes");
  await use("gift", "gift");
  const copy = target.actor.items.find(i => i.getFlag(MODULE_ID, "godGift"));
  assert.ok(copy);
  await copy.update({ "system.uses.spent": 1 });
  game.time.worldTime = 14400;
  await cleanupGodGifts();
  assert.ok(!target.actor.items.includes(copy));
  assert.ok(actor.items.includes(feat));
});
test("unknown healing source is not guessed to be external", () => {
  const p = { damageDetail: [{ type: "healing", value: -20 }] };
  applyGodDefenses({ actor }, { workflow: {}, damageItem: p });
  assert.equal(p.damageDetail[0].value, -20);
});
test("God has 14 boons, four flaws, three feature folders and one separate root", () => {
  assert.equal(godDocuments.length, 18);
  assert.equal(GOD_FEATURES.filter(r => r.flaw).length, 4);
  assert.equal(godFolders.length, 3);
  assert.equal(godTransformationDocuments[0].folder, null);
  assert.ok(
    godDocuments.every(d => !d.effects.length && d.system.description.value.includes("Автоматизация Foundry:"))
  );
});
test("tier boundaries and highest-ability save DC", async () => {
  for (const [n, tier] of [
    [1, 1],
    [5, 1],
    [6, 2],
    [10, 2],
    [11, 3],
    [15, 3],
    [16, 4],
    [20, 4]
  ]) {
    await actor.items.find(i => i.type === "class").update({ "system.levels": n });
    assert.equal(godLevel(actor), tier);
    assert.equal(godDC(actor), 8 + 6 + tier + 6);
  }
});
test("strict prerequisites require level20 and one score22, default off", async () => {
  const root = actor.items.find(i => i.system.identifier === "god-transformation");
  await actor.items.find(i => i.type === "class").update({ "system.levels": 19 });
  assert.notEqual(validateGodItem(root, null, null, "gm"), false);
  game.settings.get = () => true;
  assert.equal(validateGodItem(root, null, null, "gm"), false);
  await actor.items.find(i => i.type === "class").update({ "system.levels": 20 });
  assert.notEqual(validateGodItem(root, null, null, "gm"), false);
});
test("form accepts exactly ten points, capped26, without replacing original creature type", async () => {
  ctx.answers.push(4, 4, 2);
  assert.equal(await chooseGodForm(actor), true);
  assert.equal(actor.system.abilities.str.value, 26);
  assert.equal(actor.system.abilities.dex.value, 26);
  assert.equal(actor.system.abilities.con.value, 24);
  assert.equal(actor.system.details.type.value, "humanoid");
  assert.equal(godState(actor).additionalType, "celestial");
  await syncGod(actor);
  assert.equal(actor.system.abilities.str.value, 26);
});
test("cancelled/incomplete distribution does not mutate scores or allocation", async () => {
  ctx.answers.push(4, null);
  assert.equal(await chooseGodForm(actor), false);
  assert.equal(godState(actor).allocation, undefined);
  assert.equal(actor.system.abilities.str.value, 22);
});
test("normal form respec requires GM, never grants extra free points", async () => {
  await patchGod(actor, { allocation: { str: 4, dex: 4, con: 2 } });
  ctx.answers.push("no");
  assert.equal(await chooseGodForm(actor), false);
  assert.equal(godState(actor).allocation.str, 4);
});
test("zeal maximum scales with tier, existing spent resource remains, no SR/LR recovery", async () => {
  assert.equal(item("zeal").system.uses.max, "400");
  assert.deepEqual(item("zeal").system.uses.recovery, []);
  await item("zeal").update({ "system.uses.spent": 33 });
  await syncGod(actor);
  assert.equal(item("zeal").system.uses.spent, 33);
});
test("manual pool maximum is preserved", async () => {
  await item("zeal").update({ "system.uses.max": "777" });
  await syncGod(actor);
  assert.equal(item("zeal").system.uses.max, "777");
});
test("dawn is confirmed, once at given timestamp, never invented as long rest", async () => {
  await item("zeal").update({ "system.uses.spent": 99 });
  ctx.answers.push("no");
  await godDawn(actor);
  assert.equal(item("zeal").system.uses.spent, 99);
  ctx.answers.push("yes");
  await godDawn(actor);
  assert.equal(item("zeal").system.uses.spent, 0);
  await item("zeal").update({ "system.uses.spent": 20 });
  ctx.answers.push("yes");
  await godDawn(actor);
  assert.equal(item("zeal").system.uses.spent, 20);
});
test("wrath uses agreed 4d8 per tier, a real cone and one 30-point expense", async () => {
  assert.deepEqual([1, 2, 3, 4].map(godWrathDice), [4, 8, 12, 16]);
  assert.equal((await use("zeal", "wrath")).status, "success");
  const a = ctx.calls[0].activity;
  assert.equal(a.damage.parts[0].number, 16);
  assert.equal(a.damage.parts[0].denomination, 8);
  assert.equal(a.damage.onSave, "half");
  assert.deepEqual(a.save.ability, ["con"]);
  assert.equal(item("zeal").system.uses.spent, 30);
  assert.equal(canvas.scene.regions.length, 0);
});
test("cancelled template placement spends nothing", async () => {
  ctx.cancelPlacement = true;
  await use("zeal", "wrath");
  assert.equal(item("zeal").system.uses.spent, 0);
  assert.equal(ctx.calls.length, 0);
});
test("apathy removes own boons, blocks active powers, preserves inventory and returns cleanly", async () => {
  ctx.answers.push("yes");
  await use("apathy", "apathy");
  assert.equal(godFunctional(actor), false);
  assert.equal(godHas(actor, "apotheosis"), false);
  await assert.rejects(use("zeal", "wrath"), /апатии/);
  assert.ok(item("apotheosis"));
  ctx.answers.push("yes");
  await use("apathy", "awaken");
  assert.equal(godFunctional(actor), true);
  assert.equal(actor.system.attributes.hp.effectiveMax, 100);
});
test("apotheosis and demiscience create only real numeric passives", () => {
  const c = godPassiveDefinitions(actor).flatMap(e => e.system.changes);
  assert.ok(c.some(c => c.key === "system.attributes.hp.bonuses.overall" && c.value === "40"));
  assert.ok(c.some(c => c.key === "system.traits.dr.value" && c.value === "all"));
  assert.ok(c.some(c => c.key === "system.attributes.senses.ranges.truesight" && c.value === "120"));
  assert.ok(!c.some(c => c.key.includes("init")));
  assert.ok(!actor.effects.some(e => e.getFlag(MODULE_ID, "godPassive") === "rival"));
});
test("strain is an attached 20ft circle only at0HP, not suppressed by hidden source", async () => {
  const d = GOD_AURAS.find(d => d.id === "god-strain");
  assert.equal(d.radius, 20);
  assert.equal(d.sourceCondition(source), false);
  await actor.update({ "system.attributes.hp.value": 0 });
  source.hidden = true;
  assert.equal(d.sourceCondition(source), true);
  await patchGod(actor, { apathy: true });
  assert.equal(d.sourceCondition(source), false);
});
test("strain successful save rolls2d8 and failed save4d8, not half of a4d8 roll", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  const r = {
    id: "strain",
    operation: "strain",
    sceneId: source.parent.id,
    sourceTokenUuid: source.uuid,
    targetTokenUuid: target.uuid,
    dc: 24
  };
  ctx.failSaves = false;
  await runGodTurn(r);
  assert.equal(ctx.calls.at(-1).activity.damage.parts[0].number, 2);
  ctx.failSaves = true;
  await runGodTurn({ ...r, id: "strain-fail" });
  assert.equal(ctx.calls.at(-1).activity.damage.parts[0].number, 4);
});
test("turn events infer scene from combatant token, do not duplicate and queue off-scene", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  const c = encounter(1);
  await handleGodTurn(c, { turn: 1 });
  const n = ctx.calls.length;
  await handleGodTurn(c, { turn: 1 });
  assert.equal(ctx.calls.length, n);
  c.round = 2;
  c.previous = { round: 1, turn: 1 };
  canvas.scene = { id: "other" };
  await handleGodTurn(c, { round: 2 });
  assert.ok((await listAutomationEvents()).some(e => e.kind === "god-turn" && e.state === "queued"));
});
test("domain costs100, concentrates for60s, has selected recipients and ends with own concentration", async () => {
  ctx.answers.push([target.uuid]);
  assert.equal((await use("domain", "domain")).status, "success");
  assert.equal(item("zeal").system.uses.spent, 100);
  assert.deepEqual(godDomain(actor).targetUuids, [target.uuid]);
  const d = GOD_AURAS.find(d => d.id === "god-domain");
  assert.equal(d.radius, 100);
  assert.equal(d.targetCondition(source, target), true);
  assert.equal(d.targetCondition(source, source), false);
  await endGodDomain(actor);
  assert.equal(godDomain(actor), null);
  assert.equal(actor.concentration.effects.size, 0);
});
test("domain heal/loss differs: loss bypasses temps and resistance without invented damage", async () => {
  ctx.answers.push([target.uuid]);
  await use("domain", "domain");
  const r = {
    id: "domain-tick",
    operation: "domain",
    sceneId: source.parent.id,
    sourceTokenUuid: source.uuid,
    targetTokenUuid: target.uuid,
    domainId: godDomain(actor).requestId,
    alignment: "evil"
  };
  await target.actor.update({ "system.attributes.hp.temp": 50 });
  await runGodTurn(r);
  assert.equal(target.actor.system.attributes.hp.value, 20);
  assert.equal(target.actor.system.attributes.hp.temp, 50);
  await runGodTurn({ ...r, alignment: "good" });
  assert.equal(target.actor.system.attributes.hp.value, 40);
});
test("external healing is halved once, own healing is preserved", async () => {
  const a = attack(target.actor, { spell: true }),
    p = { damageDetail: [{ type: "healing", value: -15 }] },
    workflow = { actor: target.actor, item: a.item, activity: a };
  applyGodDefenses({ actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail[0].value, -7);
  applyGodDefenses({ actor }, { workflow, damageItem: p });
  assert.equal(p.damageDetail[0].value, -7);
  const own = { damageDetail: [{ type: "healing", value: -15 }] };
  applyGodDefenses({ actor }, { workflow: { ...workflow, actor }, damageItem: own });
  assert.equal(own.damageDetail[0].value, -15);
});
test("manual distribution respects external curse and own-source exception", async () => {
  await actor.update({ "system.attributes.hp.value": 10 });
  await applyGodHealing(target.actor, actor, 20);
  assert.equal(actor.system.attributes.hp.value, 20);
  await applyGodHealing(actor, actor, 20);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("physical immunity applies only to nonmagical weapons, never falling or magical weapons", () => {
  const a = attack(target.actor),
    p = { damageDetail: [{ type: "slashing", value: 40 }] };
  applyGodDefenses({ actor }, { workflow: { actor: target.actor, item: a.item, activity: a }, damageItem: p });
  assert.equal(p.damageDetail[0].value, 0);
  const q = { damageDetail: [{ type: "bludgeoning", value: 40 }] };
  applyGodDefenses(
    { actor },
    { workflow: { actor: target.actor, item: a.item, activity: { type: "damage" } }, damageItem: q }
  );
  assert.equal(q.damageDetail[0].value, 40);
});
test("chosen Demiurgy type ignores both immunity/resistance while retaining other types", async () => {
  await patchGod(actor, { element: "fire" });
  target.actor.calculateDamage = (parts, opts) =>
    parts.map(p => ({
      ...p,
      value: opts.ignore.immunity.has(p.type) && opts.ignore.resistance.has(p.type) ? p.value : 0
    }));
  const p = {
    rawDamageDetail: [
      { type: "fire", value: 12 },
      { type: "cold", value: 10 }
    ],
    damageDetail: [
      { type: "fire", value: 0, active: { immunity: true } },
      { type: "cold", value: 5, active: { resistance: true } }
    ]
  };
  applyGodElement({ actor: target.actor }, { workflow: { actor }, damageItem: p });
  assert.equal(p.damageDetail.find(p => p.type === "fire").value, 12);
  assert.equal(p.damageDetail.find(p => p.type === "cold").value, 5);
  applyGodElement({ actor: target.actor }, { workflow: { actor }, damageItem: p });
  assert.equal(p.damageDetail.find(p => p.type === "fire").value, 12);
});
test("element cannot be changed freely without GM confirmation", async () => {
  await patchGod(actor, { element: "fire" });
  ctx.answers.push("no");
  await chooseGodElement(actor);
  assert.equal(godState(actor).element, "fire");
});
test("mantle offers only after failed save and spends60 exactly once", async () => {
  const wrapped = { actor, document: source },
    a = attack(target.actor, { spell: true }),
    wf = { id: "mantle", actor: target.actor, activity: a, failedSaves: new Set([wrapped]), saves: new Set() };
  ctx.answers.push("yes");
  await finishGodSaves(wf);
  assert.equal(wf.failedSaves.size, 0);
  assert.equal(wf.saves.size, 1);
  assert.equal(item("zeal").system.uses.spent, 60);
  await finishGodSaves(wf);
  assert.equal(item("zeal").system.uses.spent, 60);
});
test("mantle refusal preserves failure and pool", async () => {
  const w = { actor, document: source },
    a = attack(target.actor, { spell: true }),
    wf = { id: "no-mantle", actor: target.actor, activity: a, failedSaves: new Set([w]), saves: new Set() };
  ctx.answers.push("no");
  await finishGodSaves(wf);
  assert.equal(wf.failedSaves.size, 1);
  assert.equal(item("zeal").system.uses.spent, 0);
});
test("One for All uses multiples of20, caps healing and is allowed at0HP", async () => {
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push(2);
  assert.equal((await godRecover(actor, act("united", "recover"), "recover")).status, "success");
  assert.equal(item("zeal").system.uses.spent, 40);
  assert.equal(actor.system.attributes.hp.value, 20);
  assert.equal(ctx.calls[0].config.midiOptions.workflowOptions.allowIncapacitated, true);
});
test("All for One never invents or deletes followers; GM confirms real victims", async () => {
  await patchGod(actor, { alignment: "evil" });
  await actor.update({ "system.attributes.hp.value": 0 });
  ctx.answers.push(7, "yes");
  await godRecover(actor, act("united", "recover"), "evil-recover");
  assert.equal(actor.system.attributes.hp.value, 7);
  assert.equal(item("zeal").system.uses.spent, 0);
  assert.ok(game.actors.includes(target.actor));
});
test("HP capture only observes actual transition from positive to0", async () => {
  const options = {};
  captureGodHp(actor, { "system.attributes.hp.value": 0 }, options);
  assert.ok(options[MODULE_ID].godDropId);
  await actor.update({ "system.attributes.hp.value": 0 });
  const next = {};
  captureGodHp(actor, { "system.attributes.hp.value": 0 }, next);
  assert.equal(next[MODULE_ID], undefined);
});
test("annihilation bands and infinite-height horizontal geometry preserve boundaries", () => {
  assert.deepEqual(
    [0, 30, 30.1, 60, 61, 150, 300, 301].map(godAnnihilationDamage),
    [800, 800, 400, 400, 200, 50, 1, 0]
  );
  assert.equal(godHorizontalFeet(source, { ...target, elevation: 100000 }), 5);
});
test("devour budget includes only confirmed final damage, ignores repeated callbacks", async () => {
  await patchGod(actor, { devour: { requestId: "devour", confirmed: {}, distributed: 0, closed: false } });
  const e = { key: "packet", sourceActorUuid: actor.uuid, targetTokenUuid: target.uuid, godDevourCastId: "devour" };
  await recordGodDamage({ actor: target.actor, amount: 17, event: e });
  await recordGodDamage({ actor: target.actor, amount: 17, event: { ...e, key: "duplicate" } });
  assert.equal(godDevourBudget(actor), 17);
  await recordGodDamage({ actor: target.actor, amount: 8, event: { ...e, targetTokenUuid: source.uuid } });
  assert.equal(godDevourBudget(actor), 25);
});
test("devour healing cannot be claimed before completion or twice", async () => {
  await patchGod(actor, {
    devour: {
      requestId: "devour",
      confirmed: { [target.uuid]: { amount: 30 } },
      distributed: 0,
      completed: true,
      closed: false
    }
  });
  ctx.answers.push("heal", [target.uuid], "yes", 20);
  await use("restoration", "devour-healing", "heal-once");
  assert.equal(target.actor.system.attributes.hp.value, 60);
  assert.equal(godDevourBudget(actor), 10);
  await use("restoration", "devour-healing", "heal-once");
  assert.equal(godDevourBudget(actor), 10);
});
test("own Judgment periodic damage does not end turning, other damage does", async () => {
  const [e] = await target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Turned",
      flags: { [MODULE_ID]: { godJudgment: { sourceActorUuid: actor.uuid } } },
      system: { changes: [] }
    }
  ]);
  await recordGodDamage({
    actor: target.actor,
    amount: 10,
    event: { sourceActorUuid: actor.uuid, godJudgmentOwn: true }
  });
  assert.ok(target.actor.effects.includes(e));
  await recordGodDamage({ actor: target.actor, amount: 1, event: { sourceActorUuid: actor.uuid } });
  assert.ok(!target.actor.effects.includes(e));
});
test("Judgment pulse provenance is saved through the owned activity lookup", async () => {
  await godPulse(source, item("judgment"), [target], {
    damage: [{ formula: "2d10", type: "force" }],
    requestId: "own-judgment",
    metadata: { godJudgmentOwn: true }
  });
  const native = ctx.calls[0].activity,
    p = { damageDetail: [{ type: "force", value: 12 }] },
    wf = {
      id: "judge-tick",
      actor,
      activity: native,
      token: source,
      targets: new Set([{ document: target, actor: target.actor }]),
      workflowOptions: { grimgutzAuraPulse: true }
    };
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: wf, damageItem: p });
  assert.equal(p.calcDamageOptions[MODULE_ID].damageEvent.godJudgmentOwn, true);
});
test("Mercy cap and unique recipient are enforced; no invented expiry", async () => {
  ctx.answers.push([target.uuid], "endurance");
  await use("mercy", "mercy");
  assert.equal((await activeGodMercies(actor)).length, 1);
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "godMercy"));
  assert.equal(e.duration.value, null);
  assert.equal(e.system.changes.filter(c => c.key.endsWith(".proficient")).length, 6);
  ctx.answers.push([target.uuid], "speed");
  await use("mercy", "mercy");
  assert.equal(target.actor.effects.filter(e => e.getFlag(MODULE_ID, "godMercy")).length, 1);
});
test("Mercy suppresses during source apathy and preserves recipient manual movement", async () => {
  ctx.answers.push([target.uuid], "speed");
  await use("mercy", "mercy");
  assert.equal(target.actor.system.attributes.movement.walk, 60);
  await patchGod(actor, { apathy: true });
  await syncGodMercies(actor);
  assert.equal(target.actor.system.attributes.movement.walk, 30);
  await target.actor.update({ "system.attributes.movement.walk": 35 });
  await patchGod(actor, { apathy: false });
  await syncGodMercies(actor);
  assert.equal(target.actor.system.attributes.movement.walk, 70);
});
test("gift +2 lasts4h and evil giver applies exhaustion only to another target", async () => {
  await patchGod(actor, { alignment: "evil" });
  ctx.answers.push([target.uuid], "ability", "str", "yes");
  await use("gift", "gift");
  assert.equal(target.actor.system.abilities.str.value, 16);
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "godGift"));
  assert.equal(e.duration.value, 14400);
  assert.equal(target.actor.system.attributes.exhaustion, 1);
  assert.equal(item("zeal").system.uses.spent, 40);
});
test("Wish requires an actual native card and locks for a real week, not rest", async () => {
  const spell = owned(
    {
      name: "Wish",
      type: "spell",
      system: {
        identifier: "wish",
        level: 9,
        prepared: 0,
        activities: {
          wish: { _id: "wish", type: "utility", activation: { type: "action" }, consumption: { targets: [] } }
        }
      }
    },
    actor
  );
  actor.items.push(spell);
  assert.equal((await use("wish", "wish")).status, "success");
  assert.equal(item("zeal").system.uses.spent, 80);
  assert.equal(godState(actor).wishReadyAt, 604800);
  await assert.rejects(use("wish", "wish"), /неделя/);
});
test("unprepared spells are not enabled by Demiurgy, cantrips are known native items", () => {
  assert.equal(godPreparedSpell({ type: "spell", system: { level: 3, prepared: 0 } }), false);
  assert.equal(godPreparedSpell({ type: "spell", system: { level: 3, prepared: 1 } }), true);
  assert.equal(godPreparedSpell({ type: "spell", system: { level: 0, prepared: 0 } }), true);
});
test("curse blocks supported resurrection without editing actor inventories", () => {
  const wrapped = { actor, document: source },
    wf = { item: { type: "spell", system: { identifier: "revivify" } }, targets: new Set([wrapped]) };
  assert.equal(blockGodResurrection(wf), false);
  assert.equal(wf.aborted, true);
  assert.equal(wf.targets.size, 0);
});
test("diagnostics and registrations are real, non-mutating, with late packet defenses", () => {
  const before = actor.toObject();
  assert.equal(inspectGod(actor).level, 4);
  assert.deepEqual(actor.toObject(), before);
  assert.equal(typeof getAutomationActionHandlers().get("god-control"), "function");
  assert.equal(typeof getMidiHookHandlers().applyGodElement, "function");
  installGodHooks();
  assert.ok(ctx.hooks.get("updateCombat").length);
  const order = MIDI_QOL_HOOKS.filter(([h]) => h === "midi-qol.preTargetDamageApplication").map(([, n]) => n);
  assert.ok(order.indexOf("applyGodElement") < order.indexOf("prepareConfirmedDamage"));
  assert.ok(order.lastIndexOf("applyGodElement") < order.indexOf("applySpellSourceResistance"));
});
test("God scoped names do not relink old cards", () => {
  const other = { _id: "other", name: "Other", system: { description: { value: "Милость и Божественная Форма" } } };
  linkDocumentDescriptions([{ name: "features", documents: [...godDocuments, other] }]);
  assert.equal(other.system.description.value, "Милость и Божественная Форма");
});
