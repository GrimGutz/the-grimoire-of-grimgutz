import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature } from "../shared/helpers.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { onConfirmedDamage } from "../shared/damage-events.mjs";
import { onPrepareAttack, activeBenefits, benefitData, addCombatBenefit, tokenRef, consumeBenefit, canReact } from "../shared/combat-benefits.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { useLeaderStratagem, leaderDistance } from "./leader-stratagems.mjs";
import { isForwardTurn } from "../shared/combat-flow.mjs";

const saveReservations = new Map();
async function guidingTarget(source, target) {
  const guide = activeBenefits(source.actor).find(effect => benefitData(effect).kind === "guiding-magic");
  if (!guide) return;
  if (activeBenefits(target.actor).some(effect => benefitData(effect).kind === "guiding-target" && benefitData(effect).sourceTokenUuid === source.uuid)) return;
  const item = await fromUuid(benefitData(guide).sourceItemUuid);
  await addCombatBenefit(source, target, item, { kind: "guiding-target", amount: benefitData(guide).amount });
}
onPrepareAttack(async ({ attacker, target, activity, data }) => {
  const results = [];
  if (data.opportunity) for (const effect of activeBenefits(target.actor)) {
    const bonus = benefitData(effect);
    if (bonus.kind === "opportunity-ac") results.push({ kind: "attack-bonus", amount: -bonus.amount, name: effect.name, effectUuid: effect.uuid });
  }
  if (activity.item.type === "spell" || activity.attack?.type?.classification === "spell") {
    const mark = activeBenefits(target.actor).find(effect => {
      const data = benefitData(effect), source = [...attacker.parent.tokens].find(token => token.uuid === data.sourceTokenUuid);
      return data.kind === "guiding-target" && source && source.disposition === attacker.disposition && source.uuid !== attacker.uuid;
    });
    if (mark) {
      const item = await fromUuid(benefitData(mark).sourceItemUuid);
      // Midi's ignoreCover flag preserves total cover; it evaluates per workflow.
      const effect = await addCombatBenefit(attacker, attacker, item, { kind: "cover-workflow", workflowId: data.workflowId,
        changes: [{ key: "flags.midi-qol.ignoreCover", value: `workflow.id === ${JSON.stringify(data.workflowId)}`, type: "custom", phase: "initial", priority: 20 }] });
      results.push({ effectUuid: effect.uuid, kind: "cover-workflow", amount: 0, name: effect.name });
    }
  }
  return results;
});
registerGmRequest("leader-save-benefits", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), target = await fromUuid(data.targetUuid), source = await fromUuid(data.sourceUuid);
  if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid || source?.actor?.uuid !== actor.uuid || target?.parent?.id !== source.parent.id)
    throw Error("Неверный контекст спасброска.");
  const effects = [];
  for (const effect of activeBenefits(target.actor)) {
    const bonus = benefitData(effect);
    if (bonus.kind === "caution" && bonus.against?.includes(source.uuid)) effects.push(effect);
    if (bonus.kind === "battle-cry") {
      const fear = [...(activity.item.effects ?? [])].some(effect => effect.statuses?.has?.("frightened"))
        || data.frightened === true;
      if (fear || await confirmOwner(target.actor, effect.name, "Это спасбросок против испуга?")) effects.push(effect);
    }
  }
  saveReservations.set(`${actor.uuid}:${data.workflowId}:${target.uuid}`, effects.map(effect => effect.uuid));
  return { status: "success", advantage: effects.length > 0 };
});
export async function prepareLeaderTargetSave(target, workflow, details) {
  if (!enabled() || !target?.actor || !workflow.actor || !workflow.token) return;
  const result = await requestGm("leader-save-benefits", workflow.actor, { activityUuid: workflow.activity.uuid,
    targetUuid: tokenRef(target).uuid, sourceUuid: tokenRef(workflow.token).uuid, workflowId: workflow.id,
    frightened: [...(workflow.item.effects ?? [])].some(effect => effect.statuses?.has?.("frightened")) },
  { requestId: `save-benefits:${workflow.id}:${tokenRef(target).uuid}`, timeoutMs: 120000 });
  if (result.status === "success" && result.advantage) {
    details.advantage = true;
    for (const choice of Object.values(details.advantageByChoice ?? {})) {
      choice.advantage = true; choice.tracker?.advantage?.add?.(`${MODULE_ID}.leader-save`, "Стратагема Лидера");
    }
    details.tracker?.advantage?.add?.(`${MODULE_ID}.leader-save`, "Стратагема Лидера");
  }
}
registerGmRequest("leader-save-complete", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid);
  if ((activity?.actor ?? activity?.item?.actor)?.uuid !== actor.uuid) throw Error("Не найден источник спасброска.");
  for (const uuid of data.targets ?? []) {
    const effects = saveReservations.get(`${actor.uuid}:${data.workflowId}:${uuid}`) ?? [];
    for (const id of effects) { const effect = await fromUuid(id);
      if (effect && benefitData(effect)?.kind === "caution") await consumeBenefit(effect, `${data.workflowId}:save:${uuid}`); }
    saveReservations.delete(`${actor.uuid}:${data.workflowId}:${uuid}`);
  }
  return { status: "success" };
});
export async function finishLeaderSaves(workflow) {
  if (!enabled() || workflow?.aborted || !workflow.actor) return;
  const rolled = Object.entries(workflow.targetSaveDetails ?? {}).filter(([, details]) => details.saveRoll).map(([uuid]) => uuid);
  await requestGm("leader-save-complete", workflow.actor, { activityUuid: workflow.activity.uuid, workflowId: workflow.id, targets: rolled });
  await requestGm("leader-guiding-targets", workflow.actor, { activityUuid: workflow.activity.uuid,
    sourceUuid: tokenRef(workflow.token)?.uuid, targets: [...(workflow.failedSaves ?? [])].map(token => tokenRef(token).uuid) });
}
registerGmRequest("leader-guiding-targets", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceUuid);
  if (!source || source.actor.uuid !== actor.uuid || activity?.item?.actor?.uuid !== actor.uuid || activity.item.type !== "spell") return { status: "success" };
  for (const uuid of data.targets ?? []) { const target = await fromUuid(uuid); if (target?.parent?.id === source.parent.id) await guidingTarget(source, target); }
  return { status: "success" };
});
onConfirmedDamage(async ({ actor: damaged, amount, event }) => {
  if (amount <= 0 || event.automatic) return;
  const source = await fromUuid(event.sourceTokenUuid), target = await fromUuid(event.targetTokenUuid), activity = await fromUuid(event.activityUuid);
  if (!source || !target) return;
  if (activity?.item?.type === "spell") await guidingTarget(source, target);
  for (const leader of [...source.parent.tokens]) {
    const item = findFeature(leader.actor, "stratagem-reinforcement");
    if (!item || leader.uuid === source.uuid || leader.disposition !== source.disposition || !canReact(leader.actor)) continue;
    const { inFeet } = await import("../shared/combat-benefits.mjs");
    if (!inFeet(leader, source, leaderDistance(leader.actor, 60), source.parent) && !inFeet(leader, target, leaderDistance(leader.actor, 60), source.parent)) continue;
    if (!await confirmOwner(leader.actor, item.name, "Усилить подтверждённый урон союзника реакцией?")) continue;
    const activity = [...item.system.activities.values()][0];
    await useLeaderStratagem(activity);
  }
});
registerGmRequest("finish-leader-roll", async (actor, data) => {
  for (const effect of activeBenefits(actor)) if (benefitData(effect).workflowId === data.workflowId && benefitData(effect).kind === "cover-workflow") await effect.delete();
  return { status: "success" };
});
export async function finishLeaderRoll(workflow) {
  if (workflow?.actor) await requestGm("finish-leader-roll", workflow.actor, { workflowId: workflow.id });
}
export function maximizeHitDiceParts(parts, count) {
  let remaining = count, used = 0;
  const result = parts.map(part => String(part).replace(/(\d+)d(\d+)/g, (match, n, die) => {
    const take = Math.min(Number(n), remaining); if (!take) return match;
    remaining -= take; used += take;
    return `${take * Number(die)}${Number(n) > take ? ` + ${Number(n) - take}d${die}` : ""}`;
  }));
  return { parts: result, used };
}
export function installLeaderEventHooks() {
  Hooks.on("dnd5e.preRollHitDie", config => {
    if (!enabled() || config[MODULE_ID]?.hitDiceResolved) return;
    const actor = config.subject, effect = activeBenefits(actor).find(effect => benefitData(effect).kind === "maximize-hit-dice");
    if (!effect) return;
    void (async () => {
      if (!await confirmOwner(actor, effect.name, "Максимизировать доступные Кости Хитов?")) {
        await actor.rollHitDie({ ...config, [MODULE_ID]: { hitDiceResolved: true } }); return;
      }
      let used = 0;
      const rolls = (config.rolls ?? []).map(roll => { const result = maximizeHitDiceParts(roll.parts ?? [], Number(benefitData(effect).remaining)); used += result.used; return { ...roll, parts: result.parts }; });
      const result = await actor.rollHitDie({ ...config, rolls, [MODULE_ID]: { hitDiceResolved: true } }, { configure: false });
      if (result?.length && used) { const state = benefitData(effect); await effect.setFlag(MODULE_ID, "combatBenefit", { ...state, remaining: Math.max(0, state.remaining - used) }); if (state.remaining <= used) await effect.delete(); }
    })().catch(error => console.error(`${MODULE_ID} | Hit die benefit failed`, error));
    return false;
  });
  Hooks.on("dnd5e.preRollSkill", config => {
    if (!enabled() || config[MODULE_ID]?.skillResolved || !["ath", "acr"].includes(config.skill)) return;
    const actor = config.subject, effect = activeBenefits(actor).find(effect => benefitData(effect).kind === "battle-cry");
    if (!effect) return;
    void (async () => {
      const applies = await confirmOwner(actor, effect.name, "Это проверка захвата, толчка или смятия?");
      const rolls = (config.rolls ?? []).map(roll => ({ ...roll, parts: [...(roll.parts ?? []), ...(applies ? [String(benefitData(effect).amount)] : [])] }));
      await actor.rollSkill({ ...config, rolls, [MODULE_ID]: { skillResolved: true } });
    })().catch(error => console.error(`${MODULE_ID} | Skill benefit failed`, error)); return false;
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!isGmAuthority() || !enabled() || !isForwardTurn(combat, changes)) return;
    const actor = combat.combatant?.actor;
    for (const effect of activeBenefits(actor).filter(effect => benefitData(effect).kind === "start-disengage")) {
      void (async () => { if (canReact(actor) && await confirmOwner(actor, effect.name, "Использовать реакцию для Отхода?")) {
        await MidiQOL.setReactionUsed(actor); await effect.setFlag(MODULE_ID, "combatBenefit", { ...benefitData(effect), kind: "disengage" }); }
      })().catch(error => console.error(`${MODULE_ID} | Disengage benefit failed`, error));
    }
  });
}
