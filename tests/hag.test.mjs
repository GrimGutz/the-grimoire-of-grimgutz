import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { ctx, actor, source, target, base, setupFactory, owned, attack, encounter } from "./factory-fixture.mjs";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { HAG_FEATURES, HAG_TYPES } from "../scripts/automation/shared/hag-definitions.mjs";
import { hagDocuments, hagFolders } from "../src/packs/hag-features.mjs";
import { hagTransformationDocuments } from "../src/packs/hag-transformation.mjs";
import {
  hagState,
  patchHag,
  hagLevel,
  hagHas,
  hagCurses,
  hagType,
  hagDC,
  hagPassiveDefinitions,
  syncHag,
  validateHagItem,
  validateHagAdvancement,
  inspectHag,
  hagRules
} from "../scripts/automation/transformations/hag.mjs";
import {
  applyHagCurse,
  activeHagCurses,
  syncHagCurseModifiers,
  removeHagCurses,
  addHagJinx
} from "../scripts/automation/transformations/hag-curses.mjs";
import { hagExpense } from "../scripts/automation/transformations/hag-use.mjs";
import { rollHagFortunes, hagFortuneTurn } from "../scripts/automation/transformations/hag-choices.mjs";
import { applyHagDamage, applyHagDefense } from "../scripts/automation/transformations/hag-combat.mjs";
import {
  installHagHooks,
  hagNaturalOne,
  finishHagSaves,
  runHagCall,
  captureHagBroomDrop,
  recordHagDamage,
  observeHagBroomDrop
} from "../scripts/automation/transformations/hag-events.mjs";
import {
  hagSummonRecipe,
  guardHagReflection,
  cleanupHagReflection
} from "../scripts/automation/transformations/hag-summons.mjs";
import { getAutomationActionHandlers, getMidiHookHandlers } from "../scripts/automation/runtime.mjs";
import { MIDI_QOL_HOOKS } from "../scripts/automation/midi/hooks.mjs";
import { requestGm } from "../scripts/automation/shared/gm-requests.mjs";
import { listAutomationEvents } from "../scripts/automation/shared/event-ledger.mjs";
import { linkDocumentDescriptions } from "../tools/link-descriptions.mjs";
import { prepareConfirmedDamage } from "../scripts/automation/shared/damage-events.mjs";
const item = id => actor.items.find(i => i.system.identifier === `hag-${id}`);
const act = (id, op) =>
  [...item(id).system.activities.values()].find(a => !op || a.flags[MODULE_ID].hagOperation === op);
const use = (id, op, requestId = `h${++ctx.seq}`) =>
  requestGm("hag-action", actor, { activityUuid: act(id, op).uuid, sourceUuid: source.uuid }, { requestId });
beforeEach(async () => {
  await setupFactory();
  for (const i of [...actor.items]) if (i.type !== "class") await i.delete();
  actor.items.push(...hagTransformationDocuments.map(d => owned(d, actor)), ...hagDocuments.map(d => owned(d, actor)));
  await patchHag(actor, { type: "night" });
  await syncHag(actor);
  for (const id of ["curse", "hex"])
    await item(id).update({ "system.uses.max": String(actor.system.abilities.cha.mod) });
});
test("Hag has one root, fourteen boons, four flaws and real icons", () => {
  assert.equal(hagTransformationDocuments.length, 1);
  assert.equal(hagDocuments.length, 18);
  assert.equal(HAG_FEATURES.filter(r => r.flaw).length, 4);
  assert.equal(hagFolders.length, 3);
  assert.equal(HAG_TYPES.length, 4);
  for (const d of hagDocuments) {
    assert.equal(d.effects.length, 0);
    assert.match(d.img, /^icons\//);
    assert.match(d.system.description.value, /Автоматизация Foundry:/);
  }
});
test("Hag progression grants all base features and cumulative single choices", () => {
  const a = hagTransformationDocuments[0].system.advancement;
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
test("Hag uses CHA save DC and optional CHA13 entry requirement", async () => {
  assert.equal(hagDC(actor), 16);
  const root = item("transformation");
  await actor.update({ "system.abilities.cha.value": 12 });
  game.settings.get = (_m, k) => true;
  assert.equal(validateHagItem(root, {}, {}, game.user.id), false);
  game.settings.get = (_m, k) => k !== SETTINGS.STRICT_PREREQUISITES;
  assert.notEqual(validateHagItem(root, {}, {}, game.user.id), false);
});
test("Form raises CHA2 and INT1 but never past16 by this method", async () => {
  assert.equal(actor.system.abilities.cha.value, 16);
  assert.equal(actor.system.abilities.int.value, 15);
  await actor.update({ "system.abilities.cha.value": 15, "system.abilities.int.value": 18 });
  await syncHag(actor);
  assert.equal(actor.system.abilities.cha.value, 16);
  assert.equal(actor.system.abilities.int.value, 18);
  assert.equal(actor.system.details.type.value, "humanoid");
  assert.equal(inspectHag(actor).additionalType, "fiend");
});
test("Repeated passive sync is idempotent and does not heal", async () => {
  const n = actor.effects.length;
  await syncHag(actor);
  await syncHag(actor);
  assert.equal(actor.effects.length, n);
  assert.equal(actor.system.attributes.hp.value, 40);
});
test("Manual passive edits remain intact", async () => {
  const e = actor.effects.find(e => e.getFlag(MODULE_ID, "hagPassive") === "form");
  await e.update({ "system.changes": [] });
  await syncHag(actor);
  assert.equal(e.system.changes.length, 0);
});
test("Suppressed form gives no ability bonus or additional creature type", async () => {
  item("form").isSuppressed = true;
  await syncHag(actor);
  assert.equal(actor.system.abilities.cha.value, 14);
  assert.equal(inspectHag(actor).additionalType, null);
});
test("Death-save disadvantage is suspended only in GM-confirmed home", async () => {
  assert.ok(hagPassiveDefinitions(actor).some(e => e.flags[MODULE_ID].hagPassive === "bond"));
  await patchHag(actor, { home: true });
  await syncHag(actor);
  assert.ok(!hagPassiveDefinitions(actor).some(e => e.flags[MODULE_ID].hagPassive === "bond"));
});
test("Body bonuses use only the primary type, not extra curses", async () => {
  await patchHag(actor, { type: "sea", curses: ["night", "scarlet"] });
  await syncHag(actor);
  assert.equal(actor.system.attributes.movement.swim, 30);
  assert.ok(!actor.system.traits.dr.value.includes("fire"));
  assert.equal(hagType(actor), "sea");
});
test("Coven requires Double Curse even at tierIV", async () => {
  await item("double").delete();
  assert.equal(hagHas(actor, "coven"), false);
  assert.deepEqual(hagCurses(actor), ["night"]);
  assert.equal(
    validateHagAdvancement({ actor }, [], [hagDocuments.find(d => d.system.identifier === "hag-coven")], [], []),
    false
  );
});
test("Additional curses remain distinct and limited to three", async () => {
  await patchHag(actor, { curses: ["night", "scarlet", "green", "sea"] });
  assert.deepEqual(hagCurses(actor), ["night", "scarlet", "green"]);
  await item("coven").delete();
  assert.deepEqual(hagCurses(actor), ["night", "scarlet"]);
});
test("Cancel choosing type does not mutate state", async () => {
  const old = structuredClone(hagState(actor));
  ctx.answers.push("no");
  await use("form", "type");
  assert.deepEqual(hagState(actor), old);
});
test("Cancel curse target spends nothing and produces no save", async () => {
  await use("curse", "curse");
  assert.equal(item("curse").system.uses.spent, 0);
  assert.equal(ctx.calls.length, 0);
});
test("Curse uses native WIS save and one real shared use", async () => {
  ctx.answers.push([target.uuid], "yes");
  const result = await use("curse", "curse", "cast");
  assert.equal(result.status, "success");
  assert.equal(item("curse").system.uses.spent, 1);
  assert.equal(activeHagCurses(target.actor).length, 1);
  assert.equal(ctx.calls.filter(c => c.activity.type === "save").length, 1);
  const before = ctx.prompts.length;
  await use("curse", "curse", "cast");
  assert.equal(ctx.prompts.length, before);
  assert.equal(item("curse").system.uses.spent, 1);
});
test("A successful WIS save does not create a curse", async () => {
  ctx.failSaves = false;
  ctx.answers.push([target.uuid], "yes");
  await use("curse", "curse");
  assert.equal(activeHagCurses(target.actor).length, 0);
  assert.equal(item("curse").system.uses.spent, 1);
});
test("Empty curse resource rejects before native expenditure", () => {
  item("curse").system.uses.spent = 100;
  assert.throws(() => hagExpense(act("curse"), { cost: 1 }), /Недостаточно/);
});
test("Night modifies attacks and saves, never general checks", async () => {
  await applyHagCurse(source, target, item("curse"), ["night"]);
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "hagCurseModifiers"));
  assert.equal(e.system.changes.length, 5);
  assert.ok(e.system.changes.every(c => !c.key.includes("check")));
  assert.match(e.system.changes[0].value, /1d4 \+ 4/);
});
test("Repeated same-source curse replaces only its previous curse", async () => {
  await applyHagCurse(source, target, item("curse"), ["night"]);
  await applyHagCurse(source, target, item("curse"), ["sea"]);
  assert.equal(activeHagCurses(target.actor).length, 1);
  assert.ok(target.actor.statuses.has("frightened"));
});
test("Sea rolls one AC penalty and respects fear immunity without losing AC penalty", async () => {
  await target.actor.update({ "system.traits.ci.value": ["frightened"] });
  await applyHagCurse(source, target, item("curse"), ["sea"]);
  assert.ok(!target.actor.statuses.has("frightened"));
  assert.equal(ctx.rolls.filter(f => f === "1d4 + 4").length, 1);
  assert.ok(
    target.actor.effects
      .find(e => e.getFlag(MODULE_ID, "hagCurseModifiers"))
      .system.changes.some(c => c.key === "system.attributes.ac.bonus" && c.value === "-6")
  );
});
test("Charmed immunity blocks only charmed condition", async () => {
  await target.actor.update({ "system.traits.ci.value": ["charmed"] });
  await applyHagCurse(source, target, item("curse"), ["green"]);
  assert.ok(!target.actor.statuses.has("charmed"));
  assert.deepEqual(activeHagCurses(target.actor)[0].getFlag(MODULE_ID, "hagCurse").types, ["green"]);
});
test("Enchanted Body rejects this transformation's new curse", async () => {
  const result = await applyHagCurse(source, source, item("curse"), ["sea"]);
  assert.equal(result, false);
  assert.equal(activeHagCurses(actor).length, 0);
});
test("Removing curse preserves unrelated manual effects", async () => {
  await target.actor.createEmbeddedDocuments("ActiveEffect", [{ name: "Manual", system: { changes: [] } }]);
  await applyHagCurse(source, target, item("curse"), ["night"]);
  await removeHagCurses(target.actor);
  assert.equal(target.actor.effects.length, 1);
  assert.equal(target.actor.effects[0].name, "Manual");
});
test("Expired curse no longer contributes modifiers", async () => {
  await applyHagCurse(source, target, item("curse"), ["night"]);
  game.time.worldTime = 61;
  await syncHagCurseModifiers(target.actor);
  assert.ok(!target.actor.effects.some(e => e.getFlag(MODULE_ID, "hagCurseModifiers")));
});
test("Body halves only nonmagical attack damage and only once", () => {
  const workflow = {
      actor: target.actor,
      item: { type: "weapon", system: { properties: new Set() } },
      activity: { type: "attack" }
    },
    packet = { damageDetail: [{ type: "slashing", value: 12, active: {} }] };
  applyHagDefense({ actor }, { workflow, damageItem: packet });
  assert.equal(packet.damageDetail[0].value, 6);
  applyHagDefense({ actor }, { workflow, damageItem: packet });
  assert.equal(packet.damageDetail[0].value, 6);
  const fall = { damageDetail: [{ type: "bludgeoning", value: 12, active: {} }] };
  applyHagDefense({ actor }, { workflow: { ...workflow, activity: { type: "damage" } }, damageItem: fall });
  assert.equal(fall.damageDetail[0].value, 12);
});
test("Body does not double halve resistance or ignore typed resistance bypass", () => {
  for (const active of [
    { resistance: true },
    { [MODULE_ID]: { resistance: true } },
    { [MODULE_ID]: { ignoreResistance: true } }
  ]) {
    const packet = { damageDetail: [{ type: "slashing", value: 12, active }] };
    applyHagDefense(
      { actor },
      { workflow: { item: { type: "weapon", system: {} }, activity: { type: "attack" } }, damageItem: packet }
    );
    assert.equal(packet.damageDetail[0].value, 12);
  }
});
test("Green reduction clamps at zero without healing and is idempotent", () => {
  const packet = {
    rawDamageDetail: [{ type: "slashing", value: 3 }],
    damageDetail: [{ type: "slashing", value: 3 }],
    calcDamageOptions: { [MODULE_ID]: { damageEvent: { hagGreenReduction: 8 } } }
  };
  applyHagDamage({ actor: target.actor }, { workflow: {}, damageItem: packet });
  assert.equal(packet.totalDamage, 0);
  assert.equal(packet.newHP, 40);
  applyHagDamage({ actor: target.actor }, { workflow: {}, damageItem: packet });
  assert.equal(packet.totalDamage, 0);
});
test("Jinx paralysis gets exactly one end-turn CHA repeat", async () => {
  await addHagJinx(source, target, item("jinx"), "paralysis");
  const e = target.actor.effects[0];
  assert.ok(e.statuses.has("paralyzed"));
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").event, "turnEnd");
  assert.equal(e.getFlag(MODULE_ID, "repeatSave").ability, "cha");
});
test("Jinx vulnerability and madness do not invent a repeat-save moment", async () => {
  await addHagJinx(source, target, item("jinx"), "vulnerability", "cold");
  await addHagJinx(source, target, item("jinx"), "madness");
  for (const e of target.actor.effects) assert.equal(e.getFlag(MODULE_ID, "repeatSave"), undefined);
  assert.ok(target.actor.system.traits.dv.value.includes("cold"));
});
test("Fortune rolls two d20 at tierIV and no automatic free refresh", async () => {
  ctx.answers.push("yes");
  await rollHagFortunes(actor, { requestId: "rest" });
  assert.equal(hagState(actor).fortunes.length, 2);
  await rollHagFortunes(actor, { requestId: "rest" });
  assert.equal(ctx.rolls.filter(f => f === "1d20").length, 2);
});
test("Fortune rolls one d20 before tierIV", async () => {
  await actor.items.find(i => i.type === "class").update({ "system.levels": 11 });
  await rollHagFortunes(actor, { requestId: "rest", confirmed: true });
  assert.equal(hagState(actor).fortunes.length, 1);
});
test("Fortune tracks turns even in combat with no combat.scene", () => {
  const c = encounter();
  assert.equal(hagFortuneTurn(actor), "combat:1:0");
  c.turn = 1;
  assert.equal(hagFortuneTurn(actor), "combat:1:1");
});
test("Hunger creates real disadvantages but no arbitrary calendar", async () => {
  assert.ok(!hagState(actor).hungry);
  ctx.answers.push("yes");
  await use("hunger", "hunger");
  assert.equal(hagState(actor).appearance, "true");
  assert.ok(actor.effects.some(e => e.getFlag(MODULE_ID, "hagPassive") === "hunger"));
  assert.equal(hagState(actor).hungerExpiresAt, undefined);
});
test("Concentration or unconsciousness reveals appearance without modifying portrait", async () => {
  await patchHag(actor, { appearance: "humanoid" });
  await actor.createEmbeddedDocuments("ActiveEffect", [
    { name: "Unconscious", statuses: ["unconscious"], system: { changes: [] } }
  ]);
  await syncHag(actor);
  assert.equal(hagState(actor).appearance, "true");
});
test("Reflection recipe has one HP and no independent attacks or resources", () => {
  const r = hagSummonRecipe(actor, actor, "reflection");
  assert.equal(r.hp, 1);
  assert.equal(r.hpFormula, "1");
  assert.deepEqual(r.extraItems, []);
  assert.equal(r.unique, false);
});
test("Reflection movement guard is synchronous and enforces fixed initial area", () => {
  const t = {
    ...target,
    actor: {
      getFlag: () => ({
        kind: "hag-reflection",
        snapshot: { sceneId: source.parent.id, origin: { x: 0, y: 0, width: 1, height: 1, elevation: 0 } }
      })
    }
  };
  assert.equal(guardHagReflection(t, { x: 20000 }), false);
  assert.equal(guardHagReflection(t, { x: 100 }), undefined);
});
test("Hag natural-one test does not count discarded dice or a natural2", () => {
  assert.equal(
    hagNaturalOne({
      dice: [
        {
          faces: 20,
          results: [
            { result: 1, active: false },
            { result: 12, active: true }
          ]
        }
      ]
    }),
    false
  );
  assert.equal(hagNaturalOne({ dice: [{ faces: 20, results: [{ result: 1, active: true }] }] }), true);
  assert.equal(hagNaturalOne({ dice: [{ faces: 20, results: [{ result: 2, active: true }] }] }), false);
});
test("Coven Call uses character level, not transformation tier", async () => {
  await runHagCall({ id: "call", sourceTokenUuid: source.uuid, sourceItemUuid: item("call").uuid, dice: 8 });
  assert.equal(ctx.calls.at(-1).activity.damage.parts[0].number, 8);
  assert.equal(ctx.calls.at(-1).activity.damage.parts[0].denomination, 6);
  assert.equal(ctx.calls.at(-1).activity.flags[MODULE_ID].hagCall, true);
});
test("Ordinary nonmagical save does not trigger Coven Call", async () => {
  await finishHagSaves({
    id: "plain",
    item: { type: "feat" },
    activity: {},
    targets: new Set([{ document: source, actor }]),
    tokenSaves: { [source.uuid]: { dice: [{ faces: 20, results: [{ result: 1 }] }] } }
  });
  assert.equal(ctx.calls.length, 0);
});
test("Live registrations expose Hag and native packet handlers", () => {
  assert.equal(typeof getAutomationActionHandlers().get("hag-control"), "function");
  for (const name of ["applyHagDamage", "applyHagDefense"]) {
    assert.equal(typeof getMidiHookHandlers()[name], "function");
    assert.ok(MIDI_QOL_HOOKS.some(([, n]) => n === name));
  }
  installHagHooks();
  for (const name of ["dnd5e.preUseActivity", "dnd5e.restCompleted", "midi-qol.postCheckSaves", "preUpdateToken"])
    assert.ok(ctx.hooks.has(name));
});
test("New Hex cards use the agreed native LR recovery, with no SR recovery", async () => {
  assert.deepEqual(hagDocuments.find(d => d.system.identifier === "hag-hex").system.uses.recovery, [
    { period: "lr", type: "recoverAll" }
  ]);
  await item("hex").update({ "system.uses.spent": 2 });
  ctx.answers.push("all", "source", "lr");
  await use("curse", "rules");
  assert.equal(hagState(actor).curseMode, "all");
  assert.equal(hagState(actor).scarletDamageType, "source");
  assert.equal(item("hex").system.uses.recovery[0].period, "lr");
  assert.equal(item("hex").system.uses.spent, 2);
});
test("Cancelling rules configuration applies no partial settings", async () => {
  ctx.answers.push("all", null);
  const old = structuredClone(hagState(actor));
  await use("curse", "rules");
  assert.deepEqual(hagState(actor), old);
});
test("Combined curses default to one WIS save and one resource without a rules prompt", async () => {
  await patchHag(actor, { curses: ["green", "sea"] });
  ctx.answers.push([target.uuid], "yes");
  await use("curse", "curse");
  assert.deepEqual(activeHagCurses(target.actor)[0].getFlag(MODULE_ID, "hagCurse").types, ["night", "green", "sea"]);
  assert.equal(ctx.calls.filter(c => c.activity.type === "save").length, 1);
  assert.equal(item("curse").system.uses.spent, 1);
  assert.equal(ctx.prompts.length, 2);
  assert.equal(hagState(actor).curseMode, undefined);
});
test("Unknown native outcome never replays a curse or refunds speculative expenditure", async () => {
  ctx.nativeMode = undefined;
  ctx.answers.push([target.uuid], "yes");
  const r = await use("curse", "curse", "unknown");
  assert.equal(r.status, "needs-review");
  const n = ctx.calls.length;
  await use("curse", "curse", "unknown");
  assert.equal(ctx.calls.length, n);
  assert.equal(activeHagCurses(target.actor).length, 0);
});
test("Scarlet waits for confirmed positive damage, deduplicates and cannot recurse", async () => {
  await patchHag(actor, { scarletDamageType: "cold" });
  await applyHagCurse(source, target, item("curse"), ["scarlet"]);
  const event = { key: "scarlet-a", targetTokenUuid: target.uuid, damageTypes: ["fire"] };
  await recordHagDamage({ actor: target.actor, amount: 0, event });
  assert.equal(ctx.calls.length, 0);
  await recordHagDamage({ actor: target.actor, amount: 7, event });
  assert.equal(ctx.calls.length, 1);
  assert.ok(ctx.calls[0].activity.damage.parts[0].types.includes("cold"));
  await recordHagDamage({ actor: target.actor, amount: 7, event });
  assert.equal(ctx.calls.length, 1);
  await recordHagDamage({
    actor: target.actor,
    amount: 7,
    event: { ...event, key: "own-scarlet", hagCurseDamage: true }
  });
  assert.equal(ctx.calls.length, 1);
});
test("Scarlet from another scene is queued instead of rolled retroactively", async () => {
  await applyHagCurse(source, target, item("curse"), ["scarlet"]);
  canvas.ready = false;
  await recordHagDamage({
    actor: target.actor,
    amount: 3,
    event: { key: "scarlet-away", targetTokenUuid: target.uuid, damageTypes: ["fire"] }
  });
  assert.equal(ctx.calls.length, 0);
  assert.ok(
    (await listAutomationEvents()).some(
      e => e.kind === "hag-event" && e.operation === "scarlet" && e.state === "queued"
    )
  );
});
test("Scarlet defaults to the original damage type without asking GM", async () => {
  await applyHagCurse(source, target, item("curse"), ["scarlet"]);
  await recordHagDamage({
    actor: target.actor,
    amount: 2,
    event: { key: "scarlet-type-a", targetTokenUuid: target.uuid, damageTypes: ["fire"] }
  });
  assert.equal(hagRules(actor).scarletDamageType, "source");
  assert.ok(ctx.calls.at(-1).activity.damage.parts[0].types.includes("fire"));
  await recordHagDamage({
    actor: target.actor,
    amount: 2,
    event: { key: "scarlet-type-b", targetTokenUuid: target.uuid, damageTypes: ["cold"] }
  });
  assert.ok(ctx.calls.at(-1).activity.damage.parts[0].types.includes("cold"));
  assert.equal(ctx.prompts.length, 0);
});
test("Actual magical natural1 save triggers Coven Call once through GM", async () => {
  const a = attack(target.actor, { spell: true }),
    roll = { dice: [{ faces: 20, results: [{ result: 1, active: true }] }] },
    workflow = {
      id: "actual-call",
      actor: target.actor,
      activity: a,
      item: a.item,
      targets: new Set([{ document: source, actor }]),
      tokenSaves: { [source.uuid]: roll }
    };
  await finishHagSaves(workflow);
  assert.equal(ctx.calls.length, 1);
  await finishHagSaves(workflow);
  assert.equal(ctx.calls.length, 1);
});
test("Coven Call explicitly bypasses immunity/resistance and retains bypass marker", () => {
  let options;
  target.actor.calculateDamage = (parts, o) => {
    options = o;
    return parts.map(p => ({ ...p, active: {} }));
  };
  const packet = { rawDamageDetail: [{ type: "force", value: 20 }], damageDetail: [{ type: "force", value: 0 }] };
  applyHagDamage(
    { actor: target.actor },
    { workflow: { activity: { flags: { [MODULE_ID]: { hagCall: true } } } }, damageItem: packet }
  );
  assert.equal(options.ignore.resistance, true);
  assert.equal(options.ignore.immunity, true);
  assert.equal(packet.damageDetail[0].active[MODULE_ID].ignoreResistance, true);
  assert.equal(packet.totalDamage, 20);
});
test("Broom explosion carries magical piercing rather than ignoring all physical immunity", () => {
  const packet = {
    rawDamageDetail: [{ type: "piercing", value: 20 }],
    damageDetail: [{ type: "piercing", value: 20 }]
  };
  applyHagDamage(
    { actor: target.actor },
    { workflow: { activity: { flags: { [MODULE_ID]: { hagBroomExplosion: true } } } }, damageItem: packet }
  );
  assert.ok(packet.rawDamageDetail[0].properties.has("mgc"));
  assert.equal(packet.calcDamageOptions.ignore, undefined);
});
test("Reflection group is concentration-bound, expires at60 and never deletes source actor", async () => {
  ctx.answers.push("yes");
  assert.equal((await use("reflection", "reflection", "reflect")).status, "success");
  const state = hagState(actor).reflection;
  assert.equal(state.actorUuids.length, 4);
  assert.ok(state.concentrationUuid);
  assert.equal(state.initializing, false);
  game.time.worldTime = 61;
  await cleanupHagReflection(actor);
  assert.equal(hagState(actor).reflection, null);
  assert.ok(game.actors.includes(actor));
  for (const uuid of state.actorUuids) assert.equal(await fromUuid(uuid), undefined);
});
test("Creating the concentration effect cannot prematurely erase new reflections", async () => {
  const begin = actor.beginConcentrating;
  actor.beginConcentrating = async (...args) => {
    await cleanupHagReflection(actor);
    return begin.apply(actor, args);
  };
  ctx.answers.push("yes");
  await use("reflection", "reflection");
  assert.equal(hagState(actor).reflection.actorUuids.length, 4);
});
test("A saved Voodoo target creates no fake doll or expiry", async () => {
  ctx.answers.push([target.uuid], "yes", 0);
  ctx.saveTotal = 30;
  await use("voodoo", "voodoo");
  assert.equal(target.actor.effects.length, 0);
  assert.equal(ctx.createCount, 0);
});
test("Voodoo failed save stores one 50HP persistent link and does not duplicate target spells", async () => {
  ctx.answers.push([target.uuid], "yes", 5);
  ctx.saveTotal = 0;
  await use("voodoo", "voodoo");
  const e = target.actor.effects.find(e => e.getFlag(MODULE_ID, "hagVoodoo"));
  assert.equal(e.getFlag(MODULE_ID, "hagVoodoo").hp, 50);
  assert.equal(e.duration.value, null);
  assert.equal(ctx.saves[0].rolls[0].parts[0], "-5");
  assert.equal(e.system.changes.length, 0);
});
test("Hex hit declines once, spends no die, and uses no permanent damage bonus", async () => {
  const a = attack(),
    w = {
      id: "hex-decline",
      actor,
      activity: a,
      item: a.item,
      token: { document: source, actor },
      hitTargets: new Set([{ document: target, actor: target.actor }])
    },
    p = { rawDamageDetail: [{ type: "slashing", value: 10 }], damageDetail: [{ type: "slashing", value: 10 }] };
  ctx.answers.push("no");
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: w, damageItem: p });
  assert.equal(item("hex").system.uses.spent, 0);
  const n = ctx.prompts.length;
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: w, damageItem: p });
  assert.equal(ctx.prompts.length, n);
  assert.ok(!actor.effects.some(e => e.system?.changes?.some(c => c.key.endsWith(".damage"))));
});
test("Hex hit consumes exactly one die for this target and replay does not double damage", async () => {
  const a = attack(),
    w = {
      id: "hex-yes",
      actor,
      activity: a,
      item: a.item,
      token: { document: source, actor },
      tokenUuid: source.uuid,
      hitTargets: new Set([{ document: target, actor: target.actor }])
    },
    p = { rawDamageDetail: [{ type: "slashing", value: 10 }], damageDetail: [{ type: "slashing", value: 10 }] };
  ctx.answers.push("yes");
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: w, damageItem: p });
  assert.equal(item("hex").system.uses.spent, 1);
  assert.equal(p.totalDamage, 16);
  await prepareConfirmedDamage({ document: target, actor: target.actor }, { workflow: w, damageItem: p });
  assert.equal(p.totalDamage, 16);
  assert.equal(item("hex").system.uses.spent, 1);
});
test("Hag's generic curse name cannot relink unrelated cards", () => {
  const other = {
    _id: "outside",
    name: "Other",
    type: "feat",
    system: { identifier: "other", description: { value: "Проклятие" } },
    flags: {}
  };
  const a = structuredClone(hagDocuments),
    before = other.system.description.value;
  linkDocumentDescriptions([{ name: "features", documents: [...a, other] }]);
  assert.equal(other.system.description.value, before);
});
test("Failure of fourth reflection rolls back the entire group, not just its final token", async () => {
  ctx.createFailAt = 4;
  ctx.answers.push("yes");
  const before = game.actors.length;
  await use("reflection", "reflection");
  assert.equal(game.actors.length, before);
  assert.equal(hagState(actor).reflection, undefined);
  assert.ok(!canvas.scene.tokens.some(t => t.actor?.getFlag?.(MODULE_ID, "summonTemplate")?.kind === "hag-reflection"));
});
test("Broom uses approved real statblock and a live broom cannot be cloned or healed", async () => {
  ctx.answers.push(base.uuid, "yes");
  assert.equal((await use("broom", "broom", "broom-one")).status, "success");
  const r = hagState(actor).broom;
  assert.equal(r.actorUuids.length, 1);
  const broom = await fromUuid(r.actorUuids[0]);
  assert.equal(broom.system.attributes.hp.max, base.system.attributes.hp.max);
  await broom.update({ "system.attributes.hp.value": 12 });
  await assert.rejects(use("broom", "broom", "broom-two"), /Живая метла/);
  assert.equal(broom.system.attributes.hp.value, 12);
  assert.equal(ctx.createCount, 1);
});
test("Broom zeroHP creates exactly one 10-foot native save/damage pulse", async () => {
  ctx.answers.push(base.uuid, "yes");
  await use("broom", "broom");
  const state = hagState(actor).broom,
    broom = await fromUuid(state.actorUuids[0]),
    options = {};
  captureHagBroomDrop(broom, { "system.attributes.hp.value": 0 }, options);
  await broom.update({ "system.attributes.hp.value": 0 });
  const n = ctx.calls.length;
  await observeHagBroomDrop(broom, {}, options);
  assert.equal(ctx.calls.length, n + 1);
  const pulse = ctx.calls.at(-1).activity;
  assert.deepEqual(pulse.save.ability, ["dex"]);
  assert.equal(pulse.damage.onSave, "half");
  assert.equal(pulse.damage.parts[0].number, 5);
  assert.equal(pulse.damage.parts[0].denomination, 6);
  await observeHagBroomDrop(broom, {}, options);
  assert.equal(ctx.calls.length, n + 1);
});
test("Several sources' Night curse does not double-stack, and suppressing one does not remove another", async () => {
  await applyHagCurse(source, target, item("curse"), ["night"]);
  const foreign = { ...source, uuid: "Scene.one.Token.foreign", actor: { ...actor, uuid: "Actor.foreign" } };
  await applyHagCurse(foreign, target, item("curse"), ["night"]);
  assert.equal(activeHagCurses(target.actor).length, 2);
  assert.equal(
    target.actor.effects
      .find(e => e.getFlag(MODULE_ID, "hagCurseModifiers"))
      .system.changes.filter(c => c.key === "system.bonuses.abilities.save").length,
    1
  );
  await activeHagCurses(target.actor)[0].update({ disabled: true });
  await syncHagCurseModifiers(target.actor);
  assert.equal(activeHagCurses(target.actor).length, 1);
  assert.ok(target.actor.effects.some(e => e.getFlag(MODULE_ID, "hagCurseModifiers")));
});
test("Green packet recalculation preserves a pre-existing typed resistance bypass", () => {
  const packet = {
      rawDamageDetail: [{ type: "slashing", value: 20 }],
      damageDetail: [{ type: "slashing", value: 20 }],
      calcDamageOptions: {
        ignore: { resistance: new Set(["slashing"]) },
        [MODULE_ID]: { damageEvent: { hagGreenReduction: 4 } }
      }
    },
    workflow = { item: { type: "weapon", system: {} }, activity: { type: "attack" } };
  applyHagDamage({ actor }, { workflow, damageItem: packet });
  applyHagDefense({ actor }, { workflow, damageItem: packet });
  assert.equal(packet.totalDamage, 16);
  assert.equal(packet.damageDetail[0].active[MODULE_ID].ignoreResistance, true);
});
test("Magical physical parts and independent flat shields are not misclassified", () => {
  const packet = { damageDetail: [{ type: "piercing", value: 20, properties: new Set(["mgc"]), active: {} }] };
  applyHagDefense(
    { actor },
    { workflow: { item: { type: "feat", system: {} }, activity: { type: "attack" } }, damageItem: packet }
  );
  assert.equal(packet.totalDamage, 20);
  const hooks = MIDI_QOL_HOOKS.filter(([h]) => h === "midi-qol.preTargetDamageApplication").map(([, n]) => n);
  assert.ok(hooks.indexOf("applyHagDefense") < hooks.indexOf("applySummonProtection"));
});
test("Agreed Hag defaults and diagnostics do not mutate existing actor state", () => {
  const before = structuredClone(hagState(actor));
  assert.deepEqual(hagRules(actor), { curseMode: "all", scarletDamageType: "source", hexRecovery: "lr" });
  assert.deepEqual(inspectHag(actor).rules, hagRules(actor));
  assert.deepEqual(hagState(actor), before);
});
test("Explicit GM recovery/type/mode overrides and spent dice survive passive sync", async () => {
  await patchHag(actor, { curseMode: "one", scarletDamageType: "cold", hexRecovery: "manual" });
  await item("hex").update({ "system.uses.recovery": [], "system.uses.spent": 2 });
  await syncHag(actor);
  assert.deepEqual(hagRules(actor), { curseMode: "one", scarletDamageType: "cold", hexRecovery: "manual" });
  assert.deepEqual(item("hex").system.uses.recovery, []);
  assert.equal(item("hex").system.uses.spent, 2);
});
test("Ambiguous empty legacy recovery is not silently rewritten or recharged", async () => {
  await item("hex").update({ "system.uses.recovery": [], "system.uses.spent": 1 });
  await syncHag(actor);
  assert.deepEqual(item("hex").system.uses.recovery, []);
  assert.equal(item("hex").system.uses.spent, 1);
});
test("Mixed Scarlet damage asks only for the missing concrete damage type", async () => {
  await applyHagCurse(source, target, item("curse"), ["scarlet"]);
  ctx.answers.push("cold");
  await recordHagDamage({
    actor: target.actor,
    amount: 3,
    event: { key: "scarlet-mixed", targetTokenUuid: target.uuid, damageTypes: ["fire", "cold"] }
  });
  assert.equal(ctx.prompts.length, 1);
  assert.ok(ctx.calls.at(-1).activity.damage.parts[0].types.includes("cold"));
  assert.equal(hagRules(actor).scarletDamageType, "source");
});
test("Explicit legacy single-curse mode is retained instead of applying all types", async () => {
  await patchHag(actor, { curses: ["green", "sea"], curseMode: "one" });
  ctx.answers.push([target.uuid], "yes", "green");
  await use("curse", "curse");
  assert.deepEqual(activeHagCurses(target.actor)[0].getFlag(MODULE_ID, "hagCurse").types, ["green"]);
  assert.equal(hagState(actor).curseMode, "one");
});
