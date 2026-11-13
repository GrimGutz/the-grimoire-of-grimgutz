import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, automationAction, notify } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { tokenRef, turnKey, combatForScene } from "../shared/combat-benefits.mjs";
import { creatureHasBlood } from "../shared/blood-traits.mjs";
import { onConfirmedDamage } from "../shared/damage-events.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";
import {
  sanguinistBloodPoints,
  sanguinistSpellDC,
  spendBloodPoints as spendSanguinistBloodPoints
} from "./sanguinist.mjs";

const operations = new Map();
const serial = (actor, operation) => {
  const next = (operations.get(actor.uuid) ?? Promise.resolve()).catch(() => {}).then(operation);
  operations.set(actor.uuid, next);
  return next;
};
export function verifiedBloodSpell(actor, item, workflowId) {
  return (
    item?.getFlag?.(MODULE_ID, "bloodSpell") === true ||
    item?.flags?.[MODULE_ID]?.bloodSpell === true ||
    actor.getFlag?.(MODULE_ID, "bloodSpellArmed")?.reservedWorkflowId === workflowId ||
    (actor.getFlag?.(MODULE_ID, "bloodSpellWorkflows") ?? []).includes(workflowId)
  );
}
export async function armBloodSpell(actor) {
  const used = Number(actor.getFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_SPELL_USED) ?? 0);
  if (used >= Math.max(1, Number(actor.system.attributes.prof))) {
    notify("Нет оставшихся изменений заклинания в Кровавое.", "warn");
    return false;
  }
  await actor.setFlag(MODULE_ID, "bloodSpellArmed", { nonce: foundry.utils.randomID(), usedAtReserve: used });
  notify("Следующее подтверждённое заклинание будет Кровавым. Отмена каста не расходует применение.");
  return true;
}
registerGmRequest("reserve-blood-spell", (actor, data) =>
  serial(actor, async () => {
    const activity = await fromUuid(data.activityUuid),
      arm = actor.getFlag(MODULE_ID, "bloodSpellArmed");
    if (!activity || activity.item?.actor?.uuid !== actor.uuid || activity.item.type !== "spell" || !arm)
      return { status: "declined" };
    if (arm.reservedWorkflowId && arm.reservedWorkflowId !== data.workflowId) return { status: "busy" };
    await actor.setFlag(MODULE_ID, "bloodSpellArmed", { ...arm, reservedWorkflowId: data.workflowId });
    return { status: "success" };
  })
);
registerGmRequest("complete-blood-spell", (actor, data) =>
  serial(actor, async () => {
    const arm = actor.getFlag(MODULE_ID, "bloodSpellArmed"),
      completed = actor.getFlag(MODULE_ID, "bloodSpellWorkflows") ?? [];
    if (completed.includes(data.workflowId)) return { status: "success" };
    if (arm?.reservedWorkflowId !== data.workflowId) return { status: "declined" };
    if (data.cancelled) {
      await actor.setFlag(MODULE_ID, "bloodSpellArmed", { ...arm, reservedWorkflowId: null });
      return { status: "cancelled" };
    }
    const used = Number(actor.getFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_SPELL_USED) ?? 0);
    if (used !== arm.usedAtReserve) return { status: "needs-review", error: "Счётчик изменён вручную во время каста." };
    await actor.update({
      [`flags.${MODULE_ID}.${FLAGS.SANGUINIST_BLOOD_SPELL_USED}`]: used + 1,
      [`flags.${MODULE_ID}.bloodSpellWorkflows`]: [...completed, data.workflowId].slice(-128),
      [`flags.${MODULE_ID}.-=bloodSpellArmed`]: null
    });
    return { status: "success" };
  })
);
export async function prepareBloodSpell(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow?.item?.type !== "spell" ||
    workflow.workflowOptions?.grimgutzAuraPulse
  )
    return;
  if (verifiedBloodSpell(workflow.actor, workflow.item, workflow.id)) {
    workflow.grimgutzBloodSpell = true;
    return;
  }
  if (!workflow.actor.getFlag(MODULE_ID, "bloodSpellArmed")) return;
  const result = await requestGm("reserve-blood-spell", workflow.actor, {
    activityUuid: workflow.activity.uuid,
    workflowId: workflow.id
  });
  if (result.status === "success") workflow.grimgutzBloodSpell = true;
}
export async function finishBloodSpell(workflow) {
  if (workflow?.actor?.getFlag(MODULE_ID, "bloodSpellArmed")?.reservedWorkflowId !== workflow.id) return;
  return requestGm("complete-blood-spell", workflow.actor, {
    workflowId: workflow.id,
    cancelled: workflow.aborted === true && !workflow.attackRoll && !workflow.grimgutzBloodCastConfirmed
  });
}

async function offerBloodletting(actor, source, target, eventId) {
  const item = findFeature(actor, "bloodletting");
  if (!item || sanguinistBloodPoints(actor) < 2 || !target?.actor) return false;
  if (!game.modules?.get("midi-qol")?.active || !globalThis.MidiQOL?.completeActivityUse)
    throw Error("Кровопускание требует Midi-QOL.");
  return runAutomationEvent(
    {
      id: `bloodletting:${source.uuid}:${target.uuid}:${eventId}`,
      kind: "bloodletting-offer",
      sceneId: source.parent.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: target.uuid,
      sourceItemUuid: item.uuid,
      spellEventId: eventId,
      dc: sanguinistSpellDC(actor),
      name: item.name
    },
    event => applyBloodletting(event),
    { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id }
  );
}
registerAutomationEvent("bloodletting-offer", applyBloodletting);
async function applyBloodletting(event) {
  const source = await fromUuid(event.sourceTokenUuid),
    target = await fromUuid(event.targetTokenUuid),
    item = await fromUuid(event.sourceItemUuid),
    actor = source?.actor;
  if (!actor || !target?.actor || item?.actor?.uuid !== actor.uuid) return { status: "needs-review" };
  const eventId = event.spellEventId;
  if (
    !(await confirmOwner(actor, item.name, "Потратить 2 единицы крови на эту цель?")) ||
    !(await creatureHasBlood(target.actor))
  )
    return false;
  if (!isGmAuthority()) return { status: "needs-review" };
  if (!(await serial(actor, () => spendSanguinistBloodPoints(actor, 2)))) return false;
  const dc = event.dc;
  const result = await dispatchAutomationPulse({
    scene: source.parent,
    sourceToken: source.object ?? { actor, document: source },
    sourceItem: item,
    targets: [target.object ?? { actor: target.actor, document: target }],
    eventKey: `bloodletting-roll:${source.uuid}:${target.uuid}:${eventId}`,
    event: {
      save: "con",
      dc: String(dc),
      damage: [{ formula: "2d8", type: "necrotic" }],
      onSave: "none",
      condition: {
        name: "Кровопускание: кровотечение",
        key: "bloodletting",
        persistent: true,
        flags: {
          repeatSave: {
            ability: "con",
            dc,
            event: "turnEnd",
            damage: [{ formula: "2d8", type: "necrotic" }],
            sourceTokenUuid: source.uuid,
            sourceItemUuid: item.uuid,
            targetTokenUuid: target.uuid
          }
        }
      },
      replaceCondition: true
    }
  });
  return ["completed", "queued"].includes(result?.status) ? true : { status: "needs-review" };
}
onConfirmedDamage(async ({ event, amount }) => {
  if (!event.bloodSpell || event.automatic || amount <= 0) return;
  const source = await fromUuid(event.sourceTokenUuid),
    target = await fromUuid(event.targetTokenUuid),
    activity = await fromUuid(event.activityUuid);
  if (!source || !target || !verifiedBloodSpell(source.actor, activity?.item, event.workflowId)) return;
  await source.actor.setFlag(MODULE_ID, "lastBloodSpellTargets", {
    sourceTokenUuid: source.uuid,
    targets: [target.uuid],
    eventId: event.workflowId,
    turn: turnKey(combatForScene(source.parent))
  });
  await offerBloodletting(source.actor, source, target, event.workflowId);
});
registerGmRequest("blood-failed-saves", async (actor, data) => {
  const source = await fromUuid(data.sourceUuid),
    activity = await fromUuid(data.activityUuid);
  if (
    !source ||
    source.actor.uuid !== actor.uuid ||
    activity?.item?.actor?.uuid !== actor.uuid ||
    !verifiedBloodSpell(actor, activity.item, data.workflowId)
  )
    return { status: "declined" };
  const targets = (await Promise.all(data.targets.map(uuid => fromUuid(uuid)))).filter(
    target => target?.parent?.id === source.parent.id
  );
  await actor.setFlag(MODULE_ID, "lastBloodSpellTargets", {
    sourceTokenUuid: source.uuid,
    targets: targets.map(target => target.uuid),
    eventId: data.workflowId,
    turn: turnKey(combatForScene(source.parent))
  });
  for (const target of targets) await offerBloodletting(actor, source, target, data.workflowId);
  return { status: "success" };
});
export async function handleBloodFailedSaves(workflow) {
  if (!enabled() || workflow?.aborted || !workflow.grimgutzBloodSpell) return;
  if (Object.values(workflow.targetSaveDetails ?? {}).some(details => details.saveRoll))
    workflow.grimgutzBloodCastConfirmed = true;
  if (!workflow.failedSaves?.size) return;
  return requestGm(
    "blood-failed-saves",
    workflow.actor,
    {
      sourceUuid: tokenRef(workflow.token).uuid,
      activityUuid: workflow.activity.uuid,
      workflowId: workflow.id,
      targets: [...workflow.failedSaves].map(token => tokenRef(token).uuid)
    },
    { timeoutMs: 120000 }
  );
}
registerGmRequest("manual-bloodletting", async actor => {
  const context = actor.getFlag(MODULE_ID, "lastBloodSpellTargets");
  const source = context && (await fromUuid(context.sourceTokenUuid));
  if (!source || context.turn !== turnKey(combatForScene(source.parent)))
    throw Error("Сначала разыграйте подтверждённое Кровавое заклинание.");
  const selected = await chooseSceneTokens(actor, source.parent, {
    title: "Цель Кровопускания",
    relation: token => context.targets.includes(token.uuid)
  });
  if (!selected?.length) return { status: "cancelled" };
  return offerBloodletting(actor, source, selected[0], context.eventId);
});
export function useBloodletting(actor) {
  return requestGm("manual-bloodletting", actor, {}, { timeoutMs: 120000 });
}
export function installSanguinistCombatHooks() {
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    if (enabled() && isGmAuthority() && result.longRest)
      for (const key of ["bloodSpellArmed", "lastBloodSpellTargets"]) void actor.unsetFlag(MODULE_ID, key);
  });
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (!enabled() || automationAction(activity) !== "use-bloodletting") return;
    void useBloodletting(activity.actor).catch(error => notify(error.message, "warn"));
    return false;
  });
}
