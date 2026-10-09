import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, notify } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { runAutomationEvent } from "../shared/event-ledger.mjs";
import { onConfirmedDamage } from "../shared/damage-events.mjs";
import { creatureHasBlood } from "../shared/blood-traits.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { choiceDialog } from "../shared/dialogs.mjs";
import { tokenRef, inFeet } from "../shared/combat-benefits.mjs";
import { isAuraIncapacitated, isAuraDefeated } from "../shared/aura-conditions.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";
import { isForwardTurn } from "../shared/combat-flow.mjs";
import { automationActors } from "../effects/temporary-effects.mjs";

export function drainLinkActive(source, target, link) {
  return Boolean(source?.actor && target?.actor && source.parent?.id === target.parent?.id && link?.targetTokenUuid === target.uuid
    && !isAuraDefeated(source) && !isAuraIncapacitated(source.actor) && !isAuraDefeated(target)
    && !target.actor.getFlag?.(MODULE_ID, "bloodDrainResisting") && (link.willing || isAuraIncapacitated(target.actor))
    && inFeet(source, target, 5, source.parent));
}
export const bloodDrainHealing = amount => Math.max(0, Math.floor(Number(amount) / 2));
async function drain(source, link) {
  const target = await fromUuid(link.targetTokenUuid), item = findFeature(source.actor, "blood-drain");
  if (!item || !drainLinkActive(source, target, link)) { await source.actor.unsetFlag(MODULE_ID, "bloodDrainLink"); return false; }
  const combat = game.combats?.find?.(combat => combat.started && combat.scene?.id === source.parent.id);
  const round = combat ? `${combat.id}:${combat.round}` : `time:${Math.floor(Number(game.time.worldTime) / 6)}`;
  return dispatchAutomationPulse({ scene: source.parent, sourceToken: source.object ?? { actor: source.actor, document: source }, sourceItem: item,
    targets: [target.object ?? { actor: target.actor, document: target }], event: { damage: [{ formula: "2d6", type: link.damageType }], metadata: { bloodDrain: true } },
    eventKey: `blood-drain:${source.uuid}:${round}` });
}
registerGmRequest("insect-bite-hit", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceUuid), target = await fromUuid(data.targetUuid);
  if (!source || source.actor.uuid !== actor.uuid || activity?.item?.actor?.uuid !== actor.uuid || !activity.flags?.[MODULE_ID]?.insectBite
    || !target || target.parent.id !== source.parent.id || !inFeet(source, target, 5, source.parent)) throw Error("Неверное попадание укусом.");
  return runAutomationEvent({ id: `bite:${data.workflowId}:${target.uuid}`, kind: "insect-bite-hit", sceneId: source.parent.id,
    sourceActorUuid: actor.uuid, name: "Начать высасывание крови" }, async () => {
    if (!await confirmOwner(actor, "Высасывание крови", "Начать пить кровь этой цели?") || !await creatureHasBlood(target.actor)) return false;
    const willing = !isAuraIncapacitated(target.actor);
    if (willing && !await confirmOwner(target.actor, "Высасывание крови", "Цель добровольно не сопротивляется?")) return false;
    let damageType = actor.getFlag(MODULE_ID, "bloodDrainDamageType");
    if (!damageType) { damageType = await choiceDialog({ title: "Тип урона высасывания (GM)", label: "В PDF тип 2к6 не указан; выберите правило кампании",
      choices: Object.entries(CONFIG.DND5E.damageTypes).map(([key, value]) => [key, value.label]), defaultValue: "piercing" });
      if (!damageType) return false; await actor.setFlag(MODULE_ID, "bloodDrainDamageType", damageType); }
    const link = { sourceTokenUuid: source.uuid, targetTokenUuid: target.uuid, willing, damageType, nonce: foundry.utils.randomID() };
    await actor.setFlag(MODULE_ID, "bloodDrainLink", link); return drain(source, link);
  });
});
export async function handleInsectBiteHit(workflow) {
  if (!enabled() || workflow?.aborted || !workflow?.attackRoll || !workflow.activity.flags?.[MODULE_ID]?.insectBite || workflow.hitTargets?.size !== 1) return;
  return requestGm("insect-bite-hit", workflow.actor, { activityUuid: workflow.activity.uuid, sourceUuid: tokenRef(workflow.token).uuid,
    targetUuid: tokenRef([...workflow.hitTargets][0]).uuid, workflowId: workflow.id }, { timeoutMs: 120000 });
}
registerGmRequest("insect-blood-drain", async actor => {
  const link = actor.getFlag(MODULE_ID, "bloodDrainLink"), source = link ? await fromUuid(link.sourceTokenUuid) : null;
  if (!source || source.actor.uuid !== actor.uuid) throw Error("Сначала попадите укусом и подтвердите начало высасывания.");
  return drain(source, link);
});
export function useInsectBloodDrain(actor) { return requestGm("insect-blood-drain", actor, {}, { timeoutMs: 120000 }); }
export async function endInsectBloodDrain(actorOrUuid) {
  const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (!actor?.isOwner) throw Error("Нет прав на владельца высасывания.");
  await actor.unsetFlag(MODULE_ID, "bloodDrainLink");
}
onConfirmedDamage(async ({ event, amount }) => {
  if (!event.bloodDrain || amount <= 0) return;
  const source = await fromUuid(event.sourceTokenUuid), item = source && findFeature(source.actor, "blood-drain");
  if (!source || !item || isAuraDefeated(source)) return;
  const healing = bloodDrainHealing(amount); if (!healing) return;
  await dispatchAutomationPulse({ scene: source.parent, sourceToken: source.object ?? { actor: source.actor, document: source }, sourceItem: item,
    targets: [source.object ?? { actor: source.actor, document: source }], event: { damage: [{ formula: String(healing), type: "healing" }] },
    eventKey: `blood-drain-healing:${event.key}` });
});
export function installInsectCombatHooks() {
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (!enabled() || !activity.flags?.[MODULE_ID]?.bloodDrain || activity.flags[MODULE_ID].auraPulse) return;
    void useInsectBloodDrain(activity.actor).catch(error => notify(error.message, "warn")); return false;
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return;
    const actor = combat.combatant?.actor, link = actor?.getFlag(MODULE_ID, "bloodDrainLink");
    if (!link) return;
    void fromUuid(link.sourceTokenUuid).then(source => source ? drain(source, link) : actor.unsetFlag(MODULE_ID, "bloodDrainLink"))
      .catch(error => console.error(`${MODULE_ID} | Blood drain failed`, error));
  });
  for (const hook of ["updateToken", "deleteToken"]) Hooks.on(hook, () => {
    if (!enabled() || !isGmAuthority()) return;
    for (const actor of automationActors()) { const link = actor.getFlag(MODULE_ID, "bloodDrainLink"); if (!link) continue;
      void Promise.all([fromUuid(link.sourceTokenUuid), fromUuid(link.targetTokenUuid)]).then(([source, target]) => {
        if (!drainLinkActive(source, target, link)) return actor.unsetFlag(MODULE_ID, "bloodDrainLink"); }); }
  });
}
