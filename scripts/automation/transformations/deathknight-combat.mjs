import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, itemUses } from "../shared/helpers.mjs";
import {
  dkHas,
  dkAnchor,
  dkReaperActive,
  dkPassiveActive,
  dkTransformationLevel,
  dkPatch,
  dkState
} from "./deathknight.mjs";
import { dkCreatureType } from "./deathknight-levels.mjs";
import { dkGm, dkExpense } from "./deathknight-use.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";
export const dkBoundAttack = (actor, activity) =>
  activity?.type === "attack" && activity.item?.type === "weapon" && activity.item.id === dkAnchor(actor)?.id;
export const dkMeleeAttack = activity =>
  activity?.type === "attack" && activity.item?.type === "weapon" && activity.attack?.type?.value === "melee";
export function prepareDeathknightDamageRoll(config) {
  const activity = config?.subject,
    actor = activity?.actor ?? activity?.item?.actor,
    roll = config?.rolls?.[0];
  if (!enabled() || !actor || !roll || config.grimgutzDeathknightDamage) return;
  config.grimgutzDeathknightDamage = true;
  const add = formula => {
    config.rolls.push({
      parts: [formula],
      data: roll.data,
      options: { ...roll.options, type: "necrotic", types: ["necrotic"] }
    });
  };
  if (dkHas(actor, "strikes") && dkMeleeAttack(activity)) add(`${dkTransformationLevel(actor) >= 4 ? 2 : 1}d8`);
  if (dkReaperActive(actor) && dkBoundAttack(actor, activity)) add("2d8");
  const specialization =
    actor.getFlag?.(MODULE_ID, "deathknightSpecialization") ??
    actor.getFlag?.(MODULE_ID, "summonTemplate")?.snapshot?.specialization;
  if (specialization === "assassin" && config[MODULE_ID]?.deathknightAssassin) roll.parts.push("2d6");
}
export function prepareDeathknightReach(activity) {
  const actor = activity?.actor;
  if (
    !enabled() ||
    !dkReaperActive(actor) ||
    !dkMeleeAttack(activity) ||
    activity.item === actor.items?.get?.(activity.item.id) ||
    activity.grimgutzDeathknightReach
  )
    return;
  activity.grimgutzDeathknightReach = true;
  const base = Number(activity.range?.value ?? activity.item.system.range?.reach ?? 5);
  activity.updateSource?.({ "range.value": base + 5, "range.units": "ft", "range.override": true });
}
export function applyDeathknightHealing(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !dkHas(token?.actor, "form") ||
    !dkPassiveActive(token.actor, "form") ||
    (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage") ||
    damageItem.grimgutzDeathknightHealing
  )
    return;
  const actor = token.actor,
    parts = calculatedDamage(damageItem),
    healing = parts.filter(p => p.type === "healing" && Number(p.value) < 0);
  if (!healing.length) return;
  const zero = Number(actor.system.attributes.hp.value) === 0,
    foreign = workflow.actor?.uuid !== actor.uuid && ["spell", "feat"].includes(workflow.item?.type);
  if (!zero && !foreign) return;
  const amount = -healing.reduce((n, p) => n + Number(p.value), 0);
  for (const p of healing) p.value = 0;
  if (zero) healing[0].value = -1;
  else parts.push({ type: "temphp", value: amount, active: {} });
  commitCalculatedDamage(token, damageItem, parts);
  damageItem.grimgutzDeathknightHealing = true;
}
registerGmRequest("deathknight-critical", (actor, data, { requestId }) =>
  serialMutation(`deathknight-critical:${actor.uuid}`, async () => {
    const activity = await fromUuid(data.activityUuid),
      item = findFeature(actor, "deathknight-annihilate"),
      use = [...(item?.system.activities?.values?.() ?? [])][0];
    if (
      !enabled() ||
      !isGmAuthority() ||
      !dkHas(actor, "annihilate") ||
      activity?.actor?.uuid !== actor.uuid ||
      !dkBoundAttack(actor, activity) ||
      !data.workflowId
    )
      return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    if (itemUses(item).remaining < 1) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "deathknight-critical", activityUuid: activity.uuid },
      async () => {
        if (
          !(await confirmOwner(
            actor,
            "Искореняющий удар",
            "Это попадание Оружием Рыцаря Смерти при действии Атака? Потратить применение до LR, сделать урон этого попадания критическим? Смерть при пороге 40 подтверждает GM после урона."
          ))
        )
          return false;
        return useNativeUtility(use, { dataPatch: dkExpense(use, { activation: "special", cost: 1 }) });
      },
      async () => {
        await dkPatch(actor, { annihilationWorkflow: data.workflowId });
        return true;
      }
    );
  })
);
export async function offerDeathknightCritical(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow.grimgutzDeathknightCritical ||
    !dkHas(workflow.actor, "annihilate") ||
    !dkBoundAttack(workflow.actor, workflow.activity) ||
    workflow.hitTargets?.size !== 1 ||
    workflow.isCritical
  )
    return;
  workflow.grimgutzDeathknightCritical = true;
  const reply = await requestGm(
    "deathknight-critical",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, workflowId: workflow.id },
    { requestId: `deathknight-critical:${workflow.id}`, timeoutMs: 180000 }
  );
  if (reply.status === "success") workflow.isCritical = true;
}
registerGmRequest("deathknight-magical-save", async (caster, data) => {
  const activity = await fromUuid(data.activityUuid),
    target = await fromUuid(data.targetUuid);
  if (
    !enabled() ||
    !isGmAuthority() ||
    activity?.actor?.uuid !== caster.uuid ||
    !dkHas(target?.actor, "souls") ||
    !dkPassiveActive(target.actor, "souls") ||
    !data.workflowId
  )
    return false;
  const key = `deathknight-magic:${data.workflowId}:${target.uuid}`,
    old = nativeApplicationReply(target.actor, key);
  if (old) return old;
  return applyNativeOnce(
    target.actor,
    { requestId: key, action: "deathknight-magical-save", activityUuid: activity.uuid },
    () =>
      confirmOwner(
        dkGm(target.actor),
        "Связь душ: магический эффект",
        "Этот спасбросок вызван магическим эффектом? Обычная способность/яд/захват не становятся магией автоматически."
      ),
    async () => true
  );
});
export async function prepareDeathknightSave(target, workflow, details) {
  if (!enabled() || !target?.actor || (details.rollType && details.rollType !== "save")) return;
  const actor = target.actor;
  if (
    dkHas(actor, "outcast") &&
    (dkCreatureType(workflow?.actor) === "celestial" ||
      (dkCreatureType(workflow?.actor) === "humanoid" && workflow.actor?.getFlag?.(MODULE_ID, "deathknightBlessed")))
  ) {
    details.disadvantage = true;
    details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.deathknight-outcast`, "Отверженный: эта цель");
  }
  if (!dkHas(actor, "souls") || !dkPassiveActive(actor, "souls")) return;
  let magic =
    workflow?.item?.type === "spell" ||
    workflow?.item?.system?.properties?.has?.("mgc") ||
    workflow?.activity?.flags?.[MODULE_ID]?.deathknightMagical;
  if (!magic && workflow?.activity && workflow.actor) {
    const result = await requestGm(
      "deathknight-magical-save",
      workflow.actor,
      {
        activityUuid: workflow.activity.uuid,
        targetUuid: target.document?.uuid ?? target.uuid,
        workflowId: workflow.id
      },
      { requestId: `deathknight-magic-check:${workflow.id}:${target.document?.uuid ?? target.uuid}`, timeoutMs: 180000 }
    );
    magic = result.status === "success";
  }
  if (magic) {
    details.advantage = true;
    details.modifierTracker?.advantage?.add?.(`${MODULE_ID}.deathknight-souls`, "Связь душ: магия");
  }
}
export function prepareDeathknightAttack(workflow) {
  if (!enabled() || workflow?.targets?.size !== 1 || !dkHas(workflow.actor, "outcast")) return;
  const target = [...workflow.targets][0]?.actor;
  if (
    dkCreatureType(target) === "celestial" ||
    (dkCreatureType(target) === "humanoid" && target.getFlag?.(MODULE_ID, "deathknightBlessed"))
  )
    workflow.attackRollModifierTracker?.disadvantage?.add?.(
      `${MODULE_ID}.deathknight-outcast`,
      "Отверженный: эта цель"
    );
}
