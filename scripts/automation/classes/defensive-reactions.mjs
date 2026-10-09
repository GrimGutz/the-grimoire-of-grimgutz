import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { activeBenefits, benefitData, addCombatBenefit, onPrepareAttack, canReact, inFeet, meleeReach, tokenRef,
  turnKey, combatForScene, recordModuleReaction } from "../shared/combat-benefits.mjs";
import { onConfirmedDamage, onPrepareDamage } from "../shared/damage-events.mjs";
import { reactionAttack, useNativeUtility } from "../shared/native-actions.mjs";
import { guardianLevel } from "./guardian.mjs";
import { isAuraIncapacitated } from "../shared/aura-conditions.mjs";

export const guardianMarksPerTurn = level => [0, 2, 3, 3, 4, 4][Math.max(0, Math.min(5, level))];
async function mark(source, target, id, magical = false) {
  const actor = source.actor, item = findFeature(actor, "guardian-mark");
  if (!item || isAuraIncapacitated(actor) || (magical && !inFeet(source, target, 30, source.parent))) return false;
  const turn = turnKey(combatForScene(source.parent)), counter = actor.getFlag(MODULE_ID, "guardianMarksThisTurn");
  const targets = counter?.turn === turn ? counter.targets : [];
  if (!targets.includes(target.uuid) && targets.length >= guardianMarksPerTurn(guardianLevel(actor))) return false;
  return runAutomationEvent({ id: `guardian-mark:${source.uuid}:${target.uuid}:${id}`, kind: "guardian-mark", sceneId: source.parent.id,
    sourceActorUuid: actor.uuid, sourceTokenUuid: source.uuid, targetTokenUuid: target.uuid, magical, name: item.name },
    () => applyMark(source, target, magical), { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id });
}
registerAutomationEvent("guardian-mark", async event => {
  const source = await fromUuid(event.sourceTokenUuid), target = await fromUuid(event.targetTokenUuid);
  if (!source?.actor || !target?.actor || source.parent.id !== event.sceneId || target.parent.id !== event.sceneId) throw Error("Источник или цель Метки недоступны.");
  return applyMark(source, target, event.magical);
});
async function applyMark(source, target, magical) {
  const actor = source.actor, item = findFeature(actor, "guardian-mark");
  if (!item) return false;
    if (!await confirmOwner(actor, item.name, magical ? "Пометить цель? Подтвердите, что она видит или слышит вас." : "Пометить цель после попадания?")) return false;
    return serialMutation(`guardian-mark:${actor.uuid}`, async () => {
    if (!isGmAuthority() || isAuraIncapacitated(actor)) return false;
    const turn = turnKey(combatForScene(source.parent)) ?? `time:${Math.floor(Number(game.time?.worldTime ?? 0) / 6)}`;
    const counter = actor.getFlag(MODULE_ID, "guardianMarksThisTurn"), targets = counter?.turn === turn ? counter.targets : [];
    if (!targets.includes(target.uuid) && targets.length >= guardianMarksPerTurn(guardianLevel(actor))) return false;
    for (const effect of activeBenefits(target.actor).filter(effect => benefitData(effect).kind === "mark")) await effect.delete();
    await addCombatBenefit(source, target, item, { kind: "mark", protectedBy: source.uuid, guardianMark: true, expiry: "sourceEnd" });
    await actor.setFlag(MODULE_ID, "guardianMarksThisTurn", { turn, targets: [...new Set([...targets, target.uuid])] });
    return true;
    });
}
registerGmRequest("guardian-weapon-hit", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceUuid);
  if (!source || source.actor.uuid !== actor.uuid || activity?.item?.actor?.uuid !== actor.uuid
    || activity.attack?.type?.value !== "melee" || activity.attack?.type?.classification !== "weapon") return { status: "declined" };
  for (const uuid of data.targets ?? []) { const target = await fromUuid(uuid); if (target?.parent?.id === source.parent.id) await mark(source, target, data.workflowId); }
  return { status: "success" };
});
export async function handleGuardianWeaponHit(workflow) {
  if (!enabled() || workflow?.aborted || !workflow?.attackRoll || !workflow.hitTargets?.size) return;
  return requestGm("guardian-weapon-hit", workflow.actor, { activityUuid: workflow.activity.uuid, sourceUuid: tokenRef(workflow.token).uuid,
    targets: [...workflow.hitTargets].map(token => tokenRef(token).uuid), workflowId: workflow.id }, { timeoutMs: 120000 });
}
onConfirmedDamage(async ({ event, amount }) => {
  if (amount <= 0) return;
  const source = await fromUuid(event.sourceTokenUuid), target = await fromUuid(event.targetTokenUuid), activity = await fromUuid(event.activityUuid);
  if (!source || !target) return;
  if (activity?.item?.type === "spell" || (activity?.type !== "attack" && activity?.item?.type === "feat")) await mark(source, target, event.workflowId, true);
  for (const effect of activeBenefits(source.actor).filter(effect => benefitData(effect).guardianMark)) {
    const data = benefitData(effect), guardian = await fromUuid(data.protectedBy), item = guardian && findFeature(guardian.actor, "guardian-mark");
    if (!guardian || guardian.uuid === target.uuid || !item || !canReact(guardian.actor) || itemUses(item).remaining < 1
      || !inFeet(guardian, source, meleeReach(guardian.actor), guardian.parent)) continue;
    await runAutomationEvent({ id: `guardian-retaliation:${guardian.uuid}:${event.key}`, kind: "guardian-retaliation", sceneId: guardian.parent.id,
      sourceActorUuid: guardian.actor.uuid, sourceTokenUuid: guardian.uuid, targetTokenUuid: source.uuid, name: "Особая атака Метки" },
      () => reactionAttack(guardian, source, { name: "Особая атака Метки", resource: item, opportunity: true, meleeOnly: true }),
      { queued: !canvas?.ready || canvas.scene?.id !== guardian.parent.id });
  }
});
registerAutomationEvent("guardian-retaliation", async event => {
  const source = await fromUuid(event.sourceTokenUuid), target = await fromUuid(event.targetTokenUuid), item = source && findFeature(source.actor, "guardian-mark");
  if (!source?.actor || !target?.actor || !item || itemUses(item).remaining < 1) return false;
  return reactionAttack(source, target, { name: event.name, resource: item, opportunity: true, meleeOnly: true });
});
onPrepareDamage(async ({ actor, data }) => {
  if (!data.opportunity || !findFeature(actor, "guardian-calling")) return;
  return { bonuses: [{ value: Math.max(1, Number(actor.system.abilities.con.mod)), name: "Призвание стража" }] };
});

async function activateArmor(target, workflowId, kind) {
  return serialMutation(`crawling-armor:${target.actor.uuid}`, () => activateArmorOnce(target, workflowId, kind));
}
async function activateArmorOnce(target, workflowId, kind) {
  const actor = target.actor, item = findFeature(actor, "crawling-armor");
  const existing = activeBenefits(actor).find(effect => benefitData(effect).kind === "armor-workflow"
    && benefitData(effect).workflowId === workflowId && benefitData(effect).targetTokenUuid === target.uuid && benefitData(effect).armorKind === kind);
  if (existing) return existing;
  if (!item || itemUses(item).remaining < 1 || !canReact(actor) || actor.getFlag(MODULE_ID, "armorReview")) return null;
  if (!await confirmOwner(actor, item.name, kind === "ac" ? "Использовать реакцию и рой ради +5 КД против этой атаки?" : "Использовать реакцию и рой ради преимущества на этот спасбросок?")) return null;
  const result = await useNativeUtility([...item.system.activities.values()][0]);
  if (result === false || result?.aborted) return null;
  if (result === undefined) { await actor.setFlag(MODULE_ID, "armorReview", true); notify("Применение брони не подтверждено; проверьте реакцию и ресурс вручную.", "warn"); return null; }
  await recordModuleReaction(actor, target.parent);
  await actor.setFlag(MODULE_ID, "crawlingArmorReady", false);
  const swarmUuid = actor.getFlag(MODULE_ID, "crawlingArmorSwarmUuid"), swarm = swarmUuid ? await fromUuid(swarmUuid) : null;
  if (swarm && swarm.getFlag(MODULE_ID, "summonedBy") === actor.uuid && swarm.getFlag(MODULE_ID, "summonKind") === "insect-armor-swarm")
    await swarm.update({ "system.attributes.hp.value": 0 }); // Never kill the unrelated intelligent swarm.
  return addCombatBenefit(target, target, item, { kind: "armor-workflow", workflowId, armorKind: kind });
}
onPrepareAttack(async ({ target, data }) => {
  const effect = await activateArmor(target, data.workflowId, "ac");
  return effect ? [{ kind: "armor-ac", amount: 5, targetActorUuid: target.actor.uuid, effectUuid: effect.uuid, name: "Шевелящаяся броня: +5 КД" }] : [];
});
const saveArmor = new Map();
registerGmRequest("armor-saving-throw", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), target = await fromUuid(data.targetUuid), source = await fromUuid(data.sourceUuid);
  if (!source || source.actor.uuid !== actor.uuid || activity?.item?.actor?.uuid !== actor.uuid || target?.parent?.id !== source.parent.id
    || activity.item.type !== "spell" || !data.destructive) return { status: "declined" };
  const effect = await activateArmor(target, data.workflowId, "save");
  if (effect) saveArmor.set(`${actor.uuid}:${data.workflowId}:${target.uuid}`, effect.uuid);
  return { status: "success", advantage: Boolean(effect) };
});
export async function prepareArmorSave(target, workflow, details) {
  if (!enabled() || !findFeature(target.actor, "crawling-armor") || !workflow.actor || !workflow.token) return;
  const result = await requestGm("armor-saving-throw", workflow.actor, { activityUuid: workflow.activity.uuid,
    sourceUuid: tokenRef(workflow.token).uuid, targetUuid: tokenRef(target).uuid, workflowId: workflow.id,
    destructive: Boolean(workflow.activity.damage?.parts?.length) }, { timeoutMs: 120000, requestId: `armor-save:${workflow.id}:${tokenRef(target).uuid}` });
  if (!result.advantage) return;
  details.advantage = true;
  for (const choice of Object.values(details.advantageByChoice ?? {})) { choice.advantage = true; choice.tracker?.advantage?.add?.(`${MODULE_ID}.armor`, "Шевелящаяся броня"); }
  details.tracker?.advantage?.add?.(`${MODULE_ID}.armor`, "Шевелящаяся броня");
}
registerGmRequest("finish-defense-reactions", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid);
  if (activity?.item?.actor?.uuid !== actor.uuid) throw Error("Неверный источник реакции.");
  const source = await fromUuid(data.sourceUuid);
  if (source?.actor?.uuid !== actor.uuid) return { status: "declined" };
  for (const token of source.parent.tokens) for (const effect of activeBenefits(token.actor))
    if (benefitData(effect).kind === "armor-workflow" && benefitData(effect).workflowId === data.workflowId) await effect.delete();
  return { status: "success" };
});
export async function finishDefenseReactions(workflow) {
  if (workflow.actor && workflow.token) await requestGm("finish-defense-reactions", workflow.actor, { activityUuid: workflow.activity.uuid,
    sourceUuid: tokenRef(workflow.token).uuid, workflowId: workflow.id });
}
export function installDefenseHooks() {
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (enabled() && activity?.item?.system?.identifier === "crawling-armor"
      && !activity.getFlag?.(MODULE_ID, "leaderResolved")) {
      notify("Броня предлагается перед подходящей атакой или спасброском. Ресурс без такого события не расходуется.", "info");
      return false;
    }
  });
  Hooks.on("dnd5e.rollInitiative", (_rolls, { subject }) => { if (!enabled() || !subject?.isOwner) return;
    const mark = findFeature(subject, "guardian-mark"), uses = itemUses(mark);
    if (mark && uses.remaining === 0 && uses.maximum > 0) void mark.update({ "system.uses.spent": Math.max(0, uses.spent - 1) }); });
  Hooks.on("updateItem", item => {
    if (!enabled() || !isGmAuthority() || !item.actor || item.system?.identifier !== "crawling-armor" || itemUses(item).remaining < 1) return;
    void item.actor.setFlag(MODULE_ID, "crawlingArmorReady", true);
    void item.actor.unsetFlag(MODULE_ID, "armorReview");
  });
}
